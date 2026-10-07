// All amounts are integer Chilean pesos. This module never changes stored data.
export function todayInChile(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type => parts.find(p => p.type === type).value).join('-');
}
export function parsePesos(value) {
  const text = String(value).trim().replace(/^\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) throw new Error('Ingresa pesos enteros, por ejemplo 30000 o 30.000.');
  const amount = Number(text.replaceAll('.', ''));
  if (!Number.isSafeInteger(amount)) throw new Error('El monto es demasiado grande.');
  return amount;
}
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T12:00:00Z');
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0,10) === date;
}
export function dueDate(bill, month) {
  if (!validDate(bill.date) || !/^\d{4}-\d{2}$/.test(month)) return null;
  if (!bill.repeat) return bill.date.startsWith(month) ? bill.date : null;
  if (month < bill.date.slice(0,7)) return null;
  const [year, m] = month.split('-').map(Number);
  const day = Math.min(Number(bill.date.slice(8)), new Date(Date.UTC(year,m,0)).getUTCDate());
  return `${month}-${String(day).padStart(2,'0')}`;
}
export const occurrenceKey = (bill, month) => `${bill.id}:${month}`;
export function planFor(data, month, scope = 'Todos', today = todayInChile()) {
  const planner = data.planner || {budgets:{}, bills:[]};
  const accounts = data.accounts.filter(a => scope === 'Todos' || a.scope === scope);
  const accountIds = new Set(accounts.map(a => a.id));
  const transactions = data.transactions.filter(t => accountIds.has(t.accountId));
  const expenses = transactions.filter(t => t.kind === 'expense' && t.date.startsWith(month)).reduce((s,t) => s+t.amount,0);
  const balance = accounts.reduce((s,a) => s+a.opening,0) + transactions.filter(t => t.date <= today).reduce((s,t) => s+(t.kind === 'income' ? t.amount : -t.amount),0);
  const bills = (planner.bills || []).filter(b => accountIds.has(b.accountId)).map(bill => {
    const due = dueDate(bill,month);
    const transactionId = bill.paid?.[month];
    const paid = !!transactionId && data.transactions.some(t => t.id === transactionId && t.kind === 'expense');
    return {...bill,due,paid,overdue:!paid && due < today};
  }).filter(b => b.due).sort((a,b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title,'es'));
  const pending = bills.filter(b => !b.paid).reduce((s,b) => s+b.amount,0);
  const budget = planner.budgets?.[`${month}|${scope}`] || {limit:0,reserve:0};
  const free = balance-pending-budget.reserve;
  const remaining = budget.limit > 0 ? budget.limit-expenses-pending : null;
  const [year,m] = month.split('-').map(Number);
  const days = month < today.slice(0,7) ? 0 : new Date(Date.UTC(year,m,0)).getUTCDate()-(month === today.slice(0,7) ? Number(today.slice(8))-1 : 0);
  const daily = budget.limit > 0 && days > 0 ? Math.floor(Math.max(0,Math.min(free,remaining))/days) : null;
  return {accounts,expenses,balance,bills,pending,budget,free,remaining,days,daily};
}
export function saveBudget(data,month,scope,limit,reserve) {
  if (![limit,reserve].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Revisa los montos del presupuesto.');
  return {...data,planner:{...data.planner,version:1,bills:data.planner?.bills||[],budgets:{...data.planner?.budgets,[`${month}|${scope}`]:{limit,reserve}}}};
}
export function addBill(data,bill) {
  if (!bill.title.trim() || !validDate(bill.date) || !Number.isSafeInteger(bill.amount) || bill.amount <= 0 || !data.accounts.some(a=>a.id===bill.accountId)) throw new Error('Revisa el nombre, monto, vencimiento y cuenta del pago.');
  return {...data,planner:{...data.planner,version:1,budgets:data.planner?.budgets||{},bills:[...(data.planner?.bills||[]),{...bill,title:bill.title.trim(),paid:{}}]}};
}
export function recordPayment(data,billId,month,date,transactionId,today = todayInChile()) {
  const bill = data.planner?.bills?.find(b=>b.id===billId);
  if (!bill || !dueDate(bill,month) || !validDate(date) || date > today || !data.accounts.some(a=>a.id===bill.accountId)) throw new Error('El pago o la fecha ya no son válidos.');
  if (bill.paid?.[month] && data.transactions.some(t=>t.id===bill.paid[month])) return data;
  if (data.transactions.some(t=>t.id===transactionId)) return data;
  const transaction = {id:transactionId,title:bill.title,kind:'expense',amount:bill.amount,accountId:bill.accountId,category:bill.category,date,note:`Pago del planificador · vencimiento ${dueDate(bill,month)}`};
  return {...data,transactions:[transaction,...data.transactions],planner:{...data.planner,bills:data.planner.bills.map(b=>b.id===billId?{...b,paid:{...b.paid,[month]:transactionId}}:b)}};
}
