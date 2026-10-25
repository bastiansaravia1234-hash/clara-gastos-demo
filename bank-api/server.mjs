import http from 'node:http';
import {fork,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {banks,bankById,CONSENT_VERSION} from './catalog.mjs';
import {sealCredentials,openCredentials,validMasterKey} from './crypto.mjs';
import {normalizeRut,normalizeSnapshot,safeBankError} from './model.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const publicFields='id,bank_id,label,masked_rut,status,message,error_code,product_id,account_id,snapshot,last_synced_at,last_attempt_at,next_attempt_at,created_at,updated_at';
class ApiError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const iso=()=>new Date().toISOString();

export function scrapeInChild(bankId,credentials,registerCancel=()=>{}){
 return new Promise((resolve,reject)=>{
  const directory=mkdtempSync(join(tmpdir(),'clara-bank-'));
  const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:directory,CHROME_PATH:process.env.CHROME_PATH||'/usr/bin/chromium',DISPLAY:process.env.DISPLAY,LANG:'es_CL.UTF-8'};
  const child=fork(fileURLToPath(new URL('./runner.mjs',import.meta.url)),[],{env,detached:process.platform!=='win32',stdio:['ignore','ignore','ignore','ipc'],execArgv:['--max-old-space-size=96']});
  let settled=false;
  const kill=()=>{
   if(process.platform!=='win32'){
    try{const processes=execFileSync('ps',['-eo','pid=,ppid='],{encoding:'utf8',timeout:1000}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
     const descendants=pid=>processes.filter(([,parent])=>parent===pid).flatMap(([id])=>[...descendants(id),id]);for(const pid of descendants(child.pid))try{process.kill(pid,'SIGKILL');}catch{}}
    catch{/* Also terminate the process group if process enumeration is unavailable. */}
   }
   try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}
   try{rmSync(directory,{recursive:true,force:true});}catch{}
  };
  function done(error,result){if(settled)return;settled=true;clearTimeout(timer);registerCancel(null);kill();credentials.password='';error?reject(error):resolve(result);}
  const timer=setTimeout(()=>done(Error('BANK_TIMEOUT')),180000);
  registerCancel(()=>done(Error('CANCELLED')));
  child.once('message',result=>done(null,result));
  child.once('error',()=>done(Error('BROWSER_UNAVAILABLE')));
  child.once('exit',()=>{if(!settled)done(Error('BROWSER_CLOSED'));});
  child.send({bankId,credentials},error=>{if(error)done(Error('BROWSER_UNAVAILABLE'));});
 });
}

export function createBankApi({supabaseUrl,publishableKey,masterKey,allowedOrigins=[],fetchImpl=fetch,scrapeImpl=scrapeInChild}){
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl||'')||!publishableKey||!validMasterKey(masterKey))throw Error('BANK_API_CONFIGURATION_REQUIRED');
 const queue=[],jobs=new Map(),attempts=new Map();let running=null,shuttingDown=false;
 const connectionQuery=(id,userId)=>'id=eq.'+id+'&user_id=eq.'+userId;
 async function db(token,table,{method='GET',query='',body}={}){
  const response=await fetchImpl(supabaseUrl+'/rest/v1/'+table+(query?'?'+query:''),{method,headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
  const payload=await response.json().catch(()=>null);
  if(!response.ok){if(response.status===401)fail(401,'SESSION_EXPIRED','Tu sesión venció. Vuelve a entrar a Clara.');if(payload?.code==='23505')fail(409,'ALREADY_CONNECTED','Ya tienes una conexión con este banco y RUT. Usa la conexión existente.');fail(503,'STORAGE_UNAVAILABLE','No se pudo guardar la conexión. Intenta nuevamente.');}
  return payload;
 }
 async function authenticate(req){
  const header=String(req.headers.authorization||'');
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(header)||header.length>6500)fail(401,'LOGIN_REQUIRED','Inicia sesión en Clara para conectar tu banco.');
  const token=header.slice(7);
  const response=await fetchImpl(supabaseUrl+'/auth/v1/user',{headers:{apikey:publishableKey,Authorization:header},signal:AbortSignal.timeout(12000)});
  if(!response.ok)fail(401,'LOGIN_REQUIRED','Tu sesión no es válida. Vuelve a entrar a Clara.');
  const user=await response.json();if(!UUID.test(user.id||'')||user.is_anonymous)fail(401,'LOGIN_REQUIRED','Inicia sesión con tu cuenta personal de Clara.');
  return {userId:user.id,token};
 }
 async function owned(ctx,id){
  const rows=await db(ctx.token,'clara_bank_connections',{query:connectionQuery(id,ctx.userId)+'&select=*'});
  if(!rows?.[0])fail(404,'NOT_FOUND','No se encontró esta conexión en tu cuenta.');return rows[0];
 }
 function credentials(body){
  let rut;try{rut=normalizeRut(body.rut);}catch{fail(400,'RUT_INVALID','Revisa el RUT del titular.');}
  if(typeof body.password!=='string'||body.password.length<4||body.password.length>128)fail(400,'PASSWORD_INVALID','Ingresa tu clave de acceso al banco.');
  if(body.consentVersion!==CONSENT_VERSION)fail(400,'CONSENT_REQUIRED','Debes autorizar la consulta bancaria antes de continuar.');
  return {rut,password:body.password};
 }
 function rateLimit(userId){
  const now=Date.now(),list=(attempts.get(userId)||[]).filter(t=>now-t<3600000);attempts.set(userId,list);
  if(list.length>=12)fail(429,'ATTEMPT_LIMIT','Alcanzaste el límite de consultas de esta hora. Espera antes de volver a intentar.');list.push(now);
 }
 async function enqueue(ctx,row){
  if(shuttingDown)fail(503,'RESTARTING','El servicio se está reiniciando. Intenta en unos minutos.');
  if(jobs.has(row.id))fail(409,'ALREADY_SYNCING','Esta conexión ya tiene una consulta en curso.');
  if(Date.parse(row.next_attempt_at||'')>Date.now())fail(429,'COOLDOWN','Espera el plazo indicado antes de volver a consultar este banco.');
  if(queue.length>=8)fail(503,'QUEUE_FULL','Hay varias consultas en curso. Intenta en unos minutos.');
  rateLimit(ctx.userId);
  const requestId=randomUUID(),now=iso();
  const changed=await db(ctx.token,'clara_bank_connections',{method:'PATCH',query:connectionQuery(row.id,ctx.userId)+'&updated_at=eq.'+encodeURIComponent(row.updated_at)+'&request_id='+(row.request_id?'eq.'+row.request_id:'is.null'),body:{status:'queued',message:'Consulta en espera. No necesitas dejar esta pantalla abierta.',error_code:null,request_id:requestId,last_attempt_at:now,next_attempt_at:new Date(Date.now()+120000).toISOString(),updated_at:now}});
  if(!changed?.length)fail(409,'STATE_CHANGED','La conexión cambió. Actualiza la pantalla.');
  const job={...ctx,id:row.id,bankId:row.bank_id,requestId,cancel:null};jobs.set(row.id,job);queue.push(job);setImmediate(pump);return requestId;
 }
 async function updateJob(job,body){
  return db(job.token,'clara_bank_connections',{method:'PATCH',query:connectionQuery(job.id,job.userId)+'&request_id=eq.'+job.requestId,body:{...body,updated_at:iso()}});
 }
 async function pump(){
  if(running||shuttingDown)return;const job=queue.shift();if(!job)return;running=job;
  let secret=null;
  try{
   const row=await owned(job,job.id);if(row.request_id!==job.requestId)return;
   const rows=await db(job.token,'clara_bank_credentials',{query:'connection_id=eq.'+job.id+'&user_id=eq.'+job.userId+'&select=ciphertext'});
   if(!rows?.[0])throw Error('CREDENTIALS_REQUIRED');
   secret=openCredentials(rows[0].ciphertext,masterKey,job.userId,job.id);
   await updateJob(job,{status:'syncing',message:'Consultando el banco. Puede tardar algunos minutos.'});
   const result=await scrapeImpl(job.bankId,secret,cancel=>{job.cancel=cancel;});secret.password='';
   if(!result?.success)throw Error(result?.error||'BANK_UNAVAILABLE');
   const snapshot=normalizeSnapshot(result,job.bankId);
   await updateJob(job,{status:'connected',message:snapshot.rejected||snapshot.foreign?'Consulta recibida. Hay datos no compatibles que no se incorporarán.':'Consulta recibida correctamente.',error_code:null,snapshot,last_synced_at:snapshot.at,next_attempt_at:new Date(Date.now()+120000).toISOString()});
  }catch(error){
   if(jobs.get(job.id)===job){const safe=safeBankError(error);try{await updateJob(job,{status:safe.status,message:safe.message,error_code:safe.code,...(safe.code==='CREDENTIALS'?{next_attempt_at:new Date(Date.now()+900000).toISOString()}:{})});}catch{/* A failed status write never exposes credentials or overwrites finance records. */}}
  }finally{if(secret)secret.password='';job.token='';job.cancel=null;jobs.delete(job.id);running=null;if(!shuttingDown)setImmediate(pump);}
 }
 async function readBody(req){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON_REQUIRED','Usa una solicitud JSON.');
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)fail(413,'BODY_TOO_LARGE','La solicitud es demasiado grande.');chunks.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}catch{fail(400,'INVALID_JSON','La solicitud no es válida.');}
 }
 const handler=async(req,res)=>{
  const origin=String(req.headers.origin||'');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Vary','Origin');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,payload)=>{res.writeHead(status);res.end(JSON.stringify(payload));};
  try{
   if(origin&&!allowedOrigins.includes(origin))fail(403,'ORIGIN_DENIED','Este origen no está habilitado para conectar bancos.');
   if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return;}
   const url=new URL(req.url,'http://clara.internal'),path=url.pathname.replace(/\/$/,'')||'/';
   if(req.method==='GET'&&['/','/health','/healthz'].includes(path)){send(200,{status:'ok',service:'clara-bank-api',version:'1.0.0',readOnly:true,banks});return;}
   const ctx=await authenticate(req);
   if(path==='/v1/connections'&&req.method==='GET'){
    const rows=await db(ctx.token,'clara_bank_connections',{query:'user_id=eq.'+ctx.userId+'&select='+publicFields+'&order=created_at.desc'});
    for(const row of rows||[]){if(['queued','syncing'].includes(row.status)&&!jobs.has(row.id)&&Date.now()-Date.parse(row.updated_at)>300000){await db(ctx.token,'clara_bank_connections',{method:'PATCH',query:connectionQuery(row.id,ctx.userId),body:{status:'error',message:'La consulta se interrumpió. Puedes volver a intentarlo.',error_code:'INTERRUPTED',updated_at:iso()}});row.status='error';row.message='La consulta se interrumpió. Puedes volver a intentarlo.';}}
    send(200,{connections:rows});return;
   }
   if(path==='/v1/connections'&&req.method==='POST'){
    const body=await readBody(req);if(!bankById(body.bankId))fail(400,'BANK_UNSUPPORTED','Selecciona un banco disponible.');
    const secret=credentials(body),id=body.id||randomUUID();if(!UUID.test(id))fail(400,'INVALID_ID','Identificador no válido.');
    const existing=await db(ctx.token,'clara_bank_connections',{query:'user_id=eq.'+ctx.userId+'&select=id'});if(existing.length>=8)fail(409,'CONNECTION_LIMIT','Puedes conectar hasta ocho bancos por usuario.');
    const identity=createHmac('sha256',Buffer.from(masterKey,'base64')).update(ctx.userId+':'+body.bankId+':'+secret.rut).digest('hex');
    const row={id,user_id:ctx.userId,bank_id:body.bankId,label:String(body.label||bankById(body.bankId).name).trim().slice(0,80),masked_rut:'•••••'+secret.rut.slice(-5),identity_key:identity,consent_version:CONSENT_VERSION};
    let inserted;
    try{inserted=(await db(ctx.token,'clara_bank_connections',{method:'POST',body:row}))[0];await db(ctx.token,'clara_bank_credentials',{method:'POST',body:{connection_id:id,user_id:ctx.userId,ciphertext:sealCredentials(secret,masterKey,ctx.userId,id)}});}
    catch(error){if(inserted)await db(ctx.token,'clara_bank_connections',{method:'DELETE',query:connectionQuery(id,ctx.userId)}).catch(()=>{});throw error;}
    finally{secret.password='';body.password='';}
    const requestId=await enqueue(ctx,inserted);send(202,{id,requestId,status:'queued'});return;
   }
   const match=path.match(/^\/v1\/connections\/([^/]+)(?:\/(sync|credentials|link))?$/);
   if(!match||!UUID.test(match[1]))fail(404,'NOT_FOUND','Ruta no encontrada.');
   const [,id,action]=match,row=await owned(ctx,id);
   if(req.method==='DELETE'&&!action){
    const job=jobs.get(id);if(job){jobs.delete(id);job.cancel?.();const i=queue.indexOf(job);if(i!==-1)queue.splice(i,1);}
    await db(ctx.token,'clara_bank_connections',{method:'DELETE',query:connectionQuery(id,ctx.userId)});send(200,{disconnected:true});return;
   }
   if(req.method!=='POST')fail(405,'METHOD_NOT_ALLOWED','Método no disponible.');
   if(action==='sync'){await readBody(req);const requestId=await enqueue(ctx,row);send(202,{id,requestId,status:'queued'});return;}
   if(action==='credentials'){
    if(jobs.has(id))fail(409,'ALREADY_SYNCING','Espera a que termine la consulta actual.');
    const body=await readBody(req),secret=credentials(body);
    const identity=createHmac('sha256',Buffer.from(masterKey,'base64')).update(ctx.userId+':'+row.bank_id+':'+secret.rut).digest('hex');
    if(identity!==row.identity_key)fail(400,'HOLDER_CHANGED','Para conectar otro RUT, elimina esta conexión y crea una nueva.');
    await db(ctx.token,'clara_bank_credentials',{method:'PATCH',query:'connection_id=eq.'+id+'&user_id=eq.'+ctx.userId,body:{ciphertext:sealCredentials(secret,masterKey,ctx.userId,id),updated_at:iso()}});secret.password='';body.password='';
    const requestId=await enqueue(ctx,row);send(202,{id,requestId,status:'queued'});return;
   }
   if(action==='link'){
    const body=await readBody(req),product=row.snapshot?.products?.find(p=>p.id===body.productId);
    if(!product)fail(400,'PRODUCT_REQUIRED','Selecciona una cuenta que haya entregado el banco.');
    const finances=await db(ctx.token,'clara_finances',{query:'user_id=eq.'+ctx.userId+'&select=data'});
    if(!finances[0]?.data?.accounts?.some(a=>a.id===body.accountId&&a.scope==='Personal'))fail(400,'ACCOUNT_REQUIRED','Selecciona una cuenta personal de Clara.');
    await db(ctx.token,'clara_bank_connections',{method:'PATCH',query:connectionQuery(id,ctx.userId),body:{account_id:body.accountId,product_id:product.id,updated_at:iso()}});send(200,{linked:true});return;
   }
   fail(404,'NOT_FOUND','Ruta no encontrada.');
  }catch(error){const known=error instanceof ApiError;send(known?error.status:503,{error:{code:known?error.code:'SERVICE_UNAVAILABLE',message:known?error.message:'No se pudo completar la solicitud. Conservamos tus datos anteriores.'}});}
 };
 async function shutdown(){shuttingDown=true;queue.splice(0);running?.cancel?.();for(const job of jobs.values())job.token='';jobs.clear();}
 return {handler,shutdown};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const api=createBankApi({supabaseUrl:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY,masterKey:process.env.BANK_VAULT_KEY,allowedOrigins:String(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
 const server=http.createServer(api.handler);server.requestTimeout=25000;server.headersTimeout=15000;
 server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Clara Bank API ready'));
 process.once('SIGTERM',async()=>{await api.shutdown();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
