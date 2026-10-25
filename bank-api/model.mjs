import {createHash} from 'node:crypto';
export function normalizeRut(value){
 const clean=String(value||'').replace(/[.\s-]/g,'').toUpperCase();
 if(!/^\d{7,8}[0-9K]$/.test(clean))throw Error('RUT_INVALIDO');
 const number=clean.slice(0,-1);let sum=0,factor=2;
 for(const digit of [...number].reverse()){sum+=Number(digit)*factor;factor=factor===7?2:factor+1;}
 const mod=11-sum%11,check=mod===11?'0':mod===10?'K':String(mod);
 if(check!==clean.slice(-1))throw Error('RUT_INVALIDO');
 return number+'-'+check;
}
export function bankDate(raw){
 const v=String(raw||'').trim();let match=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/),value;
 if(match)value=match[1]+'-'+match[2]+'-'+match[3];
 else{match=v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(!match)return null;value=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');}
 const time=Date.parse(value+'T12:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?value:null;
}
const text=(v,max=180)=>String(v||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,32);
export function normalizeSnapshot(result,bankId,now=new Date().toISOString()){
 if(!result||result.success!==true)throw Error('CONSULTA_FALLIDA');
 const source=Array.isArray(result.accounts)?result.accounts:result.balance!==undefined?[{balance:result.balance,movements:result.movements||[]}]:[];
 if(!source.length)throw Error('SIN_CUENTAS');
 if(source.length>1&&source.some(a=>!a.label))throw Error('CUENTAS_SIN_IDENTIFICAR');
 let rejected=0,foreign=0;
 const products=source.slice(0,12).map((account,index)=>{
  if(account.currency&&account.currency!=='CLP'){foreign++;return null;}
  if(typeof account.balance!=='number'||!Number.isSafeInteger(account.balance)||Math.abs(account.balance)>1e12){rejected++;return null;}
  const label=text(account.label||'Cuenta bancaria '+(index+1),100);
  const productId='account-'+digest(account.label?label:'index-'+index);
  const occurrences=new Map(),movements=[];
  for(const raw of (Array.isArray(account.movements)?account.movements:[])){
   if(raw.currency&&raw.currency!=='CLP'){foreign++;continue;}
   if(raw.source&&raw.source!=='account')continue;
   const date=bankDate(raw.date),title=text(raw.description);
   if(!date||!title||!Number.isSafeInteger(raw.amount)||raw.amount===0||Math.abs(raw.amount)>1e12){rejected++;continue;}
   const signature=JSON.stringify([productId,date,title,raw.amount]);
   const occurrence=occurrences.get(signature)||0;occurrences.set(signature,occurrence+1);
   movements.push({id:digest(signature+'#'+occurrence),date,title,amount:Math.abs(raw.amount),kind:raw.amount>0?'income':'expense',currency:'CLP'});
  }
  if((account.movements?.length||0)>0&&movements.length===0)throw Error('MOVIMIENTOS_INCOMPATIBLES');
  movements.sort((a,b)=>b.date.localeCompare(a.date));
  return {id:productId,label,balance:account.balance,currency:'CLP',movements:movements.slice(0,1000),truncated:movements.length>1000};
 }).filter(Boolean);
 if(!products.length)throw Error('SIN_CUENTAS_CLP');
 if(new Set(products.map(p=>p.id)).size!==products.length)throw Error('CUENTAS_SIN_IDENTIFICAR');
 return {version:1,bankId,at:now,products,rejected,foreign};
}
export function safeBankError(error){
 const message=String(error?.message||error||'').toLowerCase();
 if(/2fa|segundo factor|clave din[aá]mica|captcha|otp|verificaci[oó]n|bci pass|coordenada/.test(message))return {code:'REQUIRES_ACTION',status:'requires_action',message:'El banco solicita una verificación adicional. Revisa su app o web. La conexión no puede continuar automáticamente.'};
 if(/credencial|incorrect|inv[aá]lid|contrase[nñ]a|clave.*(err[oó]nea|expir|bloque)|acceso.*bloque/.test(message))return {code:'CREDENTIALS',status:'requires_action',message:'No se pudo validar el acceso. Revisa la clave en la web del banco antes de volver a conectar.'};
 if(/timeout|tiempo|timed out/.test(message))return {code:'TIMEOUT',status:'error',message:'El banco no respondió a tiempo. Conservamos la última consulta válida.'};
 if(/sin_cuentas|sin cuentas/.test(message))return {code:'NO_ACCOUNTS',status:'error',message:'El banco no entregó una cuenta en pesos compatible. Conservamos los datos anteriores.'};
 return {code:'BANK_UNAVAILABLE',status:'error',message:'No se pudo leer el banco. Puede haber cambiado su acceso o estar bloqueando la consulta. Conservamos los últimos datos válidos.'};
}
