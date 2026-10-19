import {parsePesos,validDate} from './planner-model.mjs';
export const expenseCategories=['Alimentación','Gastos de casa','Transporte','Salud','Telefonía','Internet y redes','Mascotas','Ocio','Negocio','Otros'];
export const incomeCategories=['Sueldo','Ventas','Otros ingresos'];
export function updateMovement(data,id,fields) {
  if (!data.transactions.some(t=>t.id===id)) throw new Error('Este movimiento ya no existe.');
  const amount=parsePesos(fields.amount), title=String(fields.title||'').trim(), kind=fields.kind;
  const categories=kind==='income'?incomeCategories:expenseCategories;
  if (!title || title.length>120 || amount<=0 || !validDate(fields.date) || !categories.includes(fields.category) || !['expense','income'].includes(kind) || !data.accounts.some(a=>a.id===fields.accountId)) throw new Error('Revisa la descripción, categoría, monto, cuenta y fecha.');
  return {...data,transactions:data.transactions.map(t=>t.id===id?{...t,title,amount,kind,category:fields.category,accountId:fields.accountId,date:fields.date,note:String(fields.note||'').slice(0,500)}:t)};
}
export function movementTotals(data,scope='Todos',month='') {
  const accounts=data.accounts.filter(a=>scope==='Todos'||a.scope===scope), ids=new Set(accounts.map(a=>a.id));
  const all=data.transactions.filter(t=>ids.has(t.accountId));
  const transactions=all.filter(t=>!month||t.date.startsWith(month));
  const total=kind=>transactions.filter(t=>t.kind===kind).reduce((s,t)=>s+t.amount,0);
  return {transactions,income:total('income'),expenses:total('expense'),balance:accounts.reduce((s,a)=>s+a.opening,0)+all.reduce((s,t)=>s+(t.kind==='income'?t.amount:-t.amount),0)};
}
