import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {createBankApi} from '../server.mjs';
import {CONSENT_VERSION} from '../catalog.mjs';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',ID='20000000-0000-4000-8000-000000000001';
const sample={success:true,accounts:[{balance:5000,movements:[{date:'25-10-2026',description:'Prueba sintética',amount:-1000,balance:5000,source:'account'}]}],screenshot:'DO-NOT-EXPOSE',debug:'DO-NOT-EXPOSE'};
async function fixture(t,scrapeImpl=async()=>sample){
 const tables={clara_bank_connections:[],clara_bank_credentials:[],clara_finances:[{user_id:A,data:{accounts:[{id:'own-account',scope:'Personal'}]}},{user_id:B,data:{accounts:[{id:'other-account',scope:'Personal'}]}}]},calls=[];
 const fetchImpl=async(url,options={})=>{
  const u=new URL(url),token=options.headers.Authorization?.slice(7),user=token==='token-a'?A:token==='token-b'?B:null;calls.push({url,method:options.method||'GET'});
  if(u.pathname==='/auth/v1/user')return Response.json(user?{id:user,is_anonymous:false}:{error:'invalid'},{status:user?200:401});
  if(!user)return Response.json({},{status:401});
  const table=u.pathname.split('/').pop(),rows=tables[table],method=options.method||'GET';
  const matches=row=>row.user_id===user&&[...u.searchParams.entries()].every(([k,v])=>['select','order'].includes(k)||v==='is.null'?(v==='is.null'?row[k]==null:true):v.startsWith('eq.')?String(row[k])===v.slice(3):true);
  let matched=rows.filter(matches);
  if(method==='POST'){
   const body=JSON.parse(options.body);if(body.user_id!==user)return Response.json({},{status:403});
   if(table==='clara_bank_connections'&&rows.some(r=>r.user_id===user&&r.identity_key===body.identity_key))return Response.json({code:'23505'},{status:409});
   const row={status:'pending',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),request_id:null,...body};rows.push(row);return Response.json([row]);
  }
  if(method==='PATCH'){const patch=JSON.parse(options.body);for(const row of matched)Object.assign(row,patch);return Response.json(matched);}
  if(method==='DELETE'){tables[table]=rows.filter(r=>!matched.includes(r));if(table==='clara_bank_connections')tables.clara_bank_credentials=tables.clara_bank_credentials.filter(r=>!matched.some(c=>c.id===r.connection_id));return Response.json(matched);}
  const select=u.searchParams.get('select');if(select&&select!=='*')matched=matched.map(row=>Object.fromEntries(select.split(',').map(key=>[key,row[key]])));return Response.json(matched);
 };
 const api=createBankApi({supabaseUrl:'https://test.supabase.co',publishableKey:'public-test',masterKey:randomBytes(32).toString('base64'),allowedOrigins:['https://clara.example'],fetchImpl,scrapeImpl});
 const server=http.createServer(api.handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=async(method,path,{token='token-a',body,origin='https://clara.example'}={})=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null),headers:r.headers};};
 t.after(async()=>{await api.shutdown();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return {request,tables,calls};
}
const connect={id:ID,bankId:'falabella',rut:'12345678-5',password:'synthetic-password',consentVersion:CONSENT_VERSION};
const waitFor=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('test job did not settle');};
test('API rejects missing or invalid sessions and origins before bank operations',async t=>{const f=await fixture(t);assert.equal((await f.request('GET','/v1/connections',{token:null})).status,401);assert.equal((await f.request('GET','/v1/connections',{token:'bad'})).status,401);assert.equal((await f.request('POST','/v1/connections',{origin:'https://evil.example',body:connect})).status,403);assert.equal(f.tables.clara_bank_connections.length,0);});
test('connect stores only ciphertext; another user cannot read, sync, reconnect, link or disconnect it',async t=>{
 const f=await fixture(t),r=await f.request('POST','/v1/connections',{body:connect});assert.equal(r.status,202);await waitFor(()=>f.tables.clara_bank_connections[0]?.status==='connected');
 assert.equal(f.tables.clara_bank_credentials.length,1);assert.doesNotMatch(JSON.stringify(f.tables.clara_bank_credentials),/synthetic-password|12345678/);
 const own=await f.request('GET','/v1/connections');assert.equal(own.data.connections.length,1);assert.doesNotMatch(JSON.stringify(own),/ciphertext|synthetic-password|DO-NOT-EXPOSE/);
 assert.equal((await f.request('GET','/v1/connections',{token:'token-b'})).data.connections.length,0);
 for(const [method,suffix,body]of [['POST','/sync',{}],['POST','/credentials',connect],['POST','/link',{productId:'x',accountId:'own-account'}],['DELETE','',undefined]])assert.equal((await f.request(method,'/v1/connections/'+ID+suffix,{token:'token-b',body})).status,404);
 assert.equal(f.tables.clara_bank_connections.length,1);assert.equal((await f.request('POST','/v1/connections/'+ID+'/sync',{body:{}})).status,429);
 const deleted=await f.request('DELETE','/v1/connections/'+ID);assert.equal(deleted.status,200);assert.equal(f.tables.clara_bank_credentials.length,0);
});
test('unsupported banks, invalid RUTs and missing consent never start a bank login',async t=>{let runs=0;const f=await fixture(t,async()=>{runs++;return sample;});for(const patch of [{bankId:'unknown'},{rut:'12345678-9'},{consentVersion:null}])assert.equal((await f.request('POST','/v1/connections',{body:{...connect,...patch}})).status,400);assert.equal(runs,0);});
test('mapping validates a product and an existing personal account belonging to the caller',async t=>{const f=await fixture(t);await f.request('POST','/v1/connections',{body:connect});await waitFor(()=>f.tables.clara_bank_connections[0]?.status==='connected');const productId=f.tables.clara_bank_connections[0].snapshot.products[0].id;assert.equal((await f.request('POST','/v1/connections/'+ID+'/link',{body:{productId,accountId:'other-account'}})).status,400);assert.equal((await f.request('POST','/v1/connections/'+ID+'/link',{body:{productId,accountId:'own-account'}})).status,200);});
test('disconnect cancels a running job and a late result cannot recreate its connection',async t=>{let resolve;const paused=new Promise(r=>{resolve=r;}),f=await fixture(t,async()=>paused);await f.request('POST','/v1/connections',{body:connect});await waitFor(()=>f.tables.clara_bank_connections[0]?.status==='syncing');assert.equal((await f.request('DELETE','/v1/connections/'+ID)).status,200);resolve(sample);await new Promise(r=>setTimeout(r,25));assert.equal(f.tables.clara_bank_connections.length,0);assert.equal(f.tables.clara_bank_credentials.length,0);});
test('a bank failure is not connected and does not create a valid snapshot',async t=>{const f=await fixture(t,async()=>({success:false,error:'2FA secret-rut secret-password'}));await f.request('POST','/v1/connections',{body:connect});await waitFor(()=>f.tables.clara_bank_connections[0]?.status==='requires_action');const row=f.tables.clara_bank_connections[0];assert.equal(row.last_synced_at,undefined);assert.equal(row.snapshot,undefined);assert.doesNotMatch(row.message,/secret-rut|secret-password/);});
