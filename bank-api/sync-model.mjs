export const BANKS=[['falabella','Banco Falabella'],['bchile','Banco de Chile'],['santander','Santander'],['bci','BCI'],['bestado','BancoEstado / CuentaRUT'],['itau','Itaú'],['scotiabank','Scotiabank'],['bice','BICE'],['edwards','Banco Edwards']].map(([id,name])=>({id,name}));
export const BANK_CONSENT='clara-bank-readonly-2026-10-v1';
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const signature=t=>[t.date,t.kind,t.amount,fold(t.title)].join('|');
export function applyBankSnapshot(data,connection){
 const snapshot=connection.snapshot,product=snapshot?.products?.find(p=>p.id===connection.product_id),account=data.accounts.find(a=>a.id===connection.account_id&&a.scope==='Personal');
 if(!product||!account||snapshot.version!==1||product.currency!=='CLP'||!Number.isSafeInteger(product.balance)||!Array.isArray(product.movements))return data;
 const previous=data.bankSync?.[connection.id];
 if(previous?.at===snapshot.at&&previous?.accountId===account.id&&previous?.productId===product.id)return data;
 const transactions=data.transactions.map(t=>({...t})),seen=new Set(transactions.filter(t=>t.bankConnectionId===connection.id).map(t=>t.bankMovementId));
 const manual=new Map();for(const t of transactions){if(t.accountId!==account.id||t.bankMovementId)continue;const key=signature(t);if(!manual.has(key))manual.set(key,[]);manual.get(key).push(t);}
 let added=0,adopted=0;
 for(const movement of product.movements){
  if(!/^[0-9a-f]{32}$/.test(movement.id||'')||!['income','expense'].includes(movement.kind)||!Number.isSafeInteger(movement.amount)||movement.amount<=0||movement.currency!=='CLP'||!/^\d{4}-\d{2}-\d{2}$/.test(movement.date||''))throw Error('La consulta bancaria tiene datos incompatibles. No se ha incorporado.');
  if(seen.has(movement.id))continue;
  const match=manual.get(signature(movement))?.shift();
  if(match){match.bankMovementId=movement.id;match.bankConnectionId=connection.id;adopted++;}
  else{transactions.push({id:'bank-'+connection.id+'-'+movement.id,accountId:account.id,title:movement.title,amount:movement.amount,kind:movement.kind,date:movement.date,category:movement.kind==='income'?'Otros ingresos':'Otros',note:'Importado desde '+(BANKS.find(b=>b.id===connection.bank_id)?.name||'tu banco'),bankConnectionId:connection.id,bankMovementId:movement.id});added++;}
  seen.add(movement.id);
 }
 const signed=transactions.filter(t=>t.accountId===account.id).reduce((sum,t)=>sum+(t.kind==='income'?t.amount:-t.amount),0);
 const accounts=data.accounts.map(a=>a.id!==account.id?a:{...a,opening:product.balance-signed,bank:BANKS.find(b=>b.id===connection.bank_id)?.name||a.bank,bankBalance:product.balance,bankSyncedAt:snapshot.at});
 return {...data,accounts,transactions,bankSync:{...data.bankSync,[connection.id]:{at:snapshot.at,accountId:account.id,productId:product.id,added,adopted}}};
}
export function newBankAccount(connection,product){return {id:'linked-'+connection.id+'-'+product.id.slice(-10),name:(BANKS.find(b=>b.id===connection.bank_id)?.name||'Mi banco')+' · '+product.label,bank:BANKS.find(b=>b.id===connection.bank_id)?.name||'Banco',type:'Cuenta corriente',scope:'Personal',opening:0,color:'pink'};}
