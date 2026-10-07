// Motor local del agente financiero Clara. No hace llamadas de red ni modifica datos.
const money = value => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value||0));
const clean = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function buildFinanceContext(data, scope, month, today = new Date().toISOString().slice(0,10)) {
  const accounts=(data.accounts||[]).filter(a=>scope==='Todos'||a.scope===scope);
  const ids=new Set(accounts.map(a=>a.id));
  const tx=(data.transactions||[]).filter(t=>ids.has(t.accountId));
  const monthTx=tx.filter(t=>String(t.date||'').startsWith(month));
  const sum=(kind,items=monthTx)=>items.filter(t=>t.kind===kind).reduce((s,t)=>s+Number(t.amount||0),0);
  const expenses=sum('expense'), income=sum('income');
  const categories={};
  for(const t of monthTx.filter(t=>t.kind==='expense')) categories[t.category]=(categories[t.category]||0)+Number(t.amount||0);
  const sortedCategories=Object.entries(categories).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
  const balance=accounts.reduce((s,a)=>s+Number(a.opening||0),0)+tx.reduce((s,t)=>s+(t.kind==='income'?Number(t.amount||0):-Number(t.amount||0)),0);
  const planner=data.planner||{budgets:{},bills:[]};
  const budget=planner.budgets?.[`${month}|${scope}`]||{limit:0,reserve:0};
  const bills=(planner.bills||[]).filter(b=>ids.has(b.accountId));
  const pending=bills.filter(b=>!b.paid?.[month]).reduce((s,b)=>s+Number(b.amount||0),0);
  const daysInMonth=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  const isCurrent=month===today.slice(0,7);
  const day=isCurrent?Number(today.slice(8,10)):daysInMonth;
  const daysLeft=Math.max(0,daysInMonth-day+1);
  const remainingBudget=Number(budget.limit||0)>0?Number(budget.limit)-expenses-pending:null;
  const free=balance-pending-Number(budget.reserve||0);
  const daily=Number(budget.limit||0)>0&&daysLeft>0?Math.floor(Math.max(0,Math.min(free,remainingBudget))/daysLeft):null;
  const goals=data.goals||[];
  const goalsSaved=goals.reduce((s,g)=>s+Number(g.saved||0),0);
  const goalsTarget=goals.reduce((s,g)=>s+Number(g.target||0),0);
  return {scope,month,income,expenses,balance,categories:sortedCategories,budget:{limit:Number(budget.limit||0),reserve:Number(budget.reserve||0),remaining:remainingBudget,daily},pendingBills:pending,billsCount:bills.length,daysLeft,goals:{count:goals.length,saved:goalsSaved,target:goalsTarget}};
}

export function answerFinanceQuestion(question, ctx){
  const q=clean(question), top=ctx.categories[0], label=`${ctx.month} · ${ctx.scope==='Todos'?'Vista general':ctx.scope}`;
  if(/presup|margen|cuanto puedo gastar|gastar por dia|diario/.test(q)){
    if(!ctx.budget.limit) return {text:`${label}\n\nAún no tienes un presupuesto mensual configurado. Abre Planificador, define tu límite y una reserva de ahorro; después podré calcular un margen diario real.`,action:'planner',label:'Abrir planificador'};
    return {text:`${label}\n\n• Límite mensual: ${money(ctx.budget.limit)}.\n• Gastado: ${money(ctx.expenses)}.\n• Pagos pendientes: ${money(ctx.pendingBills)}.\n• Reserva: ${money(ctx.budget.reserve)}.\n• Restante del presupuesto: ${money(ctx.budget.remaining)}.\n• Margen diario estimado: ${ctx.budget.daily===null?'sin calcular':money(ctx.budget.daily)}.`,action:'planner',label:'Revisar planificador'};
  }
  if(/pago|cuenta|venc|pendiente/.test(q)) return {text:`${label}\n\nTienes ${money(ctx.pendingBills)} en pagos pendientes registrados en el planificador. Antes de comprometer ahorro o gasto extra, conviene reservar ese monto.`,action:'planner',label:'Ver pagos pendientes'};
  if(/meta|ahorro|objetivo/.test(q)) return ctx.goals.count?{text:`En tus metas llevas ${money(ctx.goals.saved)} de ${money(ctx.goals.target)} (${ctx.goals.target?Math.round(ctx.goals.saved/ctx.goals.target*100):0}%). Te faltan ${money(Math.max(0,ctx.goals.target-ctx.goals.saved))}.`,action:'goals',label:'Ver metas'}:{text:'Todavía no tienes metas de ahorro. Crea una para que pueda seguir tu avance.',action:'goals',label:'Crear meta'};
  if(/reduc|recort|ahorr|optim|mejor/.test(q)) return {text:`${label}\n\n${top?`Tu mayor categoría de gasto es ${top.name}: ${money(top.amount)}. Una reducción de 10% serían aprox. ${money(Math.round(top.amount*.1))}.`:'Aún no hay gastos suficientes para detectar una categoría dominante.'}\n\nTu diferencia entre ingresos y gastos del mes es ${money(ctx.income-ctx.expenses)}. Prioriza pagos pendientes y necesidades básicas antes de recortar.`,action:'report',label:'Ver reportes'};
  if(/saldo|balance|como voy|resumen|ingres|gasto|hola|ayuda/.test(q)) return {text:`${label}\n\n• Ingresos: ${money(ctx.income)}.\n• Gastos: ${money(ctx.expenses)}.\n• Diferencia: ${money(ctx.income-ctx.expenses)}.\n• Saldo actual: ${money(ctx.balance)}.\n${top?`• Mayor gasto: ${top.name} (${money(top.amount)}).`:''}`,action:'report',label:'Ver reportes'};
  return {text:'Puedo analizar tu saldo, presupuesto, margen diario, pagos pendientes, gastos por categoría y metas. Prueba preguntar “¿cuánto puedo gastar por día?” o “¿dónde puedo reducir gastos?”.'};
}
