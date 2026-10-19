// Generic local import. Personal financial records belong in the private URL
// fragment supplied by the owner, never in this public repository.
export const STORAGE_KEY = 'clara-finanzas-v1';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const text = (value, max = 120) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const pesos = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
export function validateImport(input) {
  if (!input || input.version !== 1 || !validId(input.id) || !text(input.account?.name) || !pesos(input.account?.opening) || !Array.isArray(input.transactions) || input.transactions.length > 500) throw new Error('La carga no tiene un formato válido.');
  const transactions = input.transactions.map(item => {
    if (!text(item.title) || !text(item.category,60) || !pesos(item.amount) || item.amount === 0 || !validDate(item.date) || !['expense','income'].includes(item.kind)) throw new Error('Revisa los montos y las fechas de la carga.');
    return {title:item.title.trim(),amount:item.amount,category:item.category.trim(),date:item.date,kind:item.kind,note:typeof item.note === 'string' ? item.note.slice(0,500) : ''};
  });
  if (input.replacesImportId !== undefined && (!validId(input.replacesImportId) || input.replacesImportId === input.id)) throw new Error('La referencia de actualización no es válida.');
  if (input.ownerName !== undefined && !text(input.ownerName,50)) throw new Error('Revisa el nombre del perfil.');
  return {version:1,id:input.id,account:{name:input.account.name.trim(),opening:input.account.opening,...(text(input.account.bank,80)?{bank:input.account.bank}: {})},transactions,...(input.replacesImportId?{replacesImportId:input.replacesImportId}:{}),...(input.ownerName?{ownerName:input.ownerName.trim()}: {})};
}
export function decodeImport(hash) {
  if (!hash.startsWith('#importar=')) return null;
  if (hash.length > 120000) throw new Error('La carga es demasiado grande.');
  return validateImport(JSON.parse(decodeURIComponent(hash.slice(10))));
}
export function readCurrent(raw) {
  if (raw === null) return null;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !['accounts','transactions','goals','activities'].every(key => Array.isArray(data[key]))) throw new Error('No se pudieron leer tus datos actuales. No se ha cambiado nada.');
  return data;
}
export function importSummary(payload) {
  const income = payload.transactions.filter(t=>t.kind==='income').reduce((sum,t)=>sum+t.amount,0);
  const expenses = payload.transactions.filter(t=>t.kind==='expense').reduce((sum,t)=>sum+t.amount,0);
  return {income,expenses,balance:payload.account.opening+income-expenses};
}
export function mergeImport(current, input, replaceExamples = false) {
  const payload = validateImport(input);
  if (current?.imports?.some(item=>item.id===payload.id)) return current;
  if (replaceExamples && !current?.demo) throw new Error('Solo se pueden reemplazar los datos de ejemplo.');
  const base = !current || replaceExamples ? {version:1,demo:false,profile:current?.profile||null,accounts:[],transactions:[],goals:[],activities:[]} : current;
  const previous = payload.replacesImportId && base.imports?.find(item=>item.id===payload.replacesImportId);
  const previousAccountId = previous?.accountId || (previous?'import-'+payload.replacesImportId:null);
  const accountId = previousAccountId || 'import-'+payload.id;
  const prefix = 'import-'+payload.id;
  const priorIds = new Set(previous ? Array.from({length:previous.count},(_,i)=>'import-'+payload.replacesImportId+'-'+i) : []);
  const existingTransactions = base.transactions.filter(t=>!priorIds.has(t.id));
  if ((!previous && base.accounts.some(a=>a.id===accountId)) || payload.transactions.some((_,i)=>existingTransactions.some(t=>t.id===prefix+'-'+i))) throw new Error('Ya hay registros con el identificador de esta carga. No se ha cambiado nada.');
  const account={id:accountId,name:payload.account.name,bank:payload.account.bank||'Registro manual',type:'Cuenta vista',scope:'Personal',opening:payload.account.opening,color:'pink'};
  const accounts = previous && base.accounts.some(a=>a.id===accountId) ? base.accounts.map(a=>a.id===accountId?{...a,...account}:a) : [...base.accounts,account];
  return {...base,profile:payload.ownerName?{...base.profile,name:payload.ownerName,email:base.profile?.email||''}:base.profile,accounts,transactions:[...payload.transactions.map((t,i)=>({...t,id:prefix+'-'+i,accountId})),...existingTransactions],imports:[...(base.imports||[]),{id:payload.id,count:payload.transactions.length,accountId}]};
}
export function persistImport(storage, input, replaceExamples = false, expectedRaw) {
  const raw = storage.getItem(STORAGE_KEY);
  if (expectedRaw !== undefined && raw !== expectedRaw) throw new Error('Tus datos cambiaron en otra pestaña. Recarga para revisar antes de importar.');
  const current = readCurrent(raw), next = mergeImport(current,input,replaceExamples);
  if (next === current) return {data:current,alreadyImported:true};
  // Back up before every change; quota or permission errors leave active data intact.
  if (raw !== null) storage.setItem('clara-respaldo-importacion-'+input.id,raw);
  storage.setItem(STORAGE_KEY,JSON.stringify(next));
  return {data:next,alreadyImported:false};
}
