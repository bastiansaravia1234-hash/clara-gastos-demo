import {todayInChile,parsePesos,planFor,saveBudget,addBill,recordPayment} from './planner-model.mjs';
const currency = new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
const money = value => currency.format(value);
const id = () => globalThis.crypto.randomUUID();
export function createPlanner(React) {
  const h = React.createElement;
  return function Planner({data,onChange,month,scope,categories}) {
    const [notice,setNotice] = React.useState('');
    const [error,setError] = React.useState(false);
    const [payment,setPayment] = React.useState(null);
    const [removed,setRemoved] = React.useState(null);
    const plan = planFor(data,month,scope), today = todayInChile();
    React.useEffect(()=>{setPayment(null);setNotice('');},[month,scope]);
    const say = (text,failed=false) => {setNotice(text);setError(failed);};
    const field = (label,name,props={}) => h('label',{className:'planner-field'},h('span',null,label),h('input',{name,...props}));
    const submitBudget = event => {
      event.preventDefault();
      try {
        const form = new FormData(event.currentTarget), limit=parsePesos(form.get('limit')), reserve=parsePesos(form.get('reserve'));
        onChange(current=>saveBudget(current,month,scope,limit,reserve));
        say('Presupuesto guardado para este mes y espacio. Se conserva al cerrar la página.');
      } catch (e) {say(e.message,true);}
    };
    const submitBill = event => {
      event.preventDefault();
      try {
        const form = new FormData(event.currentTarget);
        const bill = {id:id(),title:String(form.get('title')||''),amount:parsePesos(form.get('amount')),accountId:String(form.get('accountId')),date:String(form.get('date')),category:String(form.get('category')),repeat:form.get('repeat')==='on'};
        addBill(data,bill); // Validate before scheduling a React update.
        onChange(current=>addBill(current,bill));event.currentTarget.reset();
        say('Pago pendiente guardado. Solo se descuenta de tu cuenta cuando registras el pago.');
      } catch (e) {say(e.message,true);}
    };
    const submitPayment = event => {
      event.preventDefault();
      try {
        const date = String(new FormData(event.currentTarget).get('paidDate'));
        const transactionId=id(), billId=payment.id;
        recordPayment(data,billId,month,date,transactionId,today);
        onChange(current=>recordPayment(current,billId,month,date,transactionId,today));setPayment(null);
        say('Pago registrado como gasto en Movimientos. Tu saldo se actualizó una sola vez.');
      } catch (e) {say(e.message,true);}
    };
    const card = (label,value,description,cls='') => h('article',{className:`panel planner-stat ${cls}`},h('span',null,label),h('strong',null,value),h('p',null,description));
    return h('div',{className:'planner', 'aria-label':'Planificador mensual'},
      h('section',{className:'planner-intro panel'},h('div',null,h('span',{className:'eyebrow'},'UN PLAN PARA TU MES'),h('h2',null,'Primero lo importante. Después, lo demás.'),h('p',null,'Reserva tus pagos y un colchón de ahorro antes de decidir cuánto puedes gastar.')),h('span',{className:'planner-badge'},'Guardado en tu dispositivo')),
      notice && h('p',{className:`planner-feedback ${error?'is-error':''}`,role:error?'alert':'status'},notice),
      h('div',{className:'planner-stats'},
        card('Disponible después de reservar',money(plan.free),'Saldo actual menos pagos pendientes de este mes y reserva de ahorro.',plan.free<0?'is-negative':''),
        card('Pagos pendientes',money(plan.pending),`${plan.bills.filter(b=>!b.paid).length} vencimientos de ${month}. Los pagos registrados ya están en tus gastos.`),
        card('Margen diario',plan.daily===null?'Sin calcular':money(plan.daily),plan.days===0?'Este mes ya terminó.':plan.daily===null?'Guarda un presupuesto para calcular tu margen.':`Estimación para los ${plan.days} días restantes, incluido hoy. No garantiza gastos futuros.`)),
      h('div',{className:'planner-columns'},
        h('section',{className:'panel planner-budget'},h('h2',null,'Tu presupuesto'),h('p',null,`Mes ${month} · ${scope==='Todos'?'Vista general':scope}. El límite incluye todos los gastos del mes.`),
          h('form',{key:`${month}|${scope}|${plan.budget.limit}|${plan.budget.reserve}`,onSubmit:submitBudget,className:'planner-form'},
            field('Límite mensual de gastos','limit',{defaultValue:plan.budget.limit,inputMode:'numeric',required:true,placeholder:'Ej. 700.000'}),
            field('Reserva de ahorro','reserve',{defaultValue:plan.budget.reserve,inputMode:'numeric',required:true,placeholder:'Ej. 100.000'}),
            h('small',null,'La reserva aparta dinero en este plan; no crea un movimiento ni cambia tus metas. Límite 0 desactiva el cálculo diario.'),
            h('button',{className:'button primary',type:'submit'},'Guardar presupuesto')),
          plan.budget.limit>0 && h('div',{className:'planner-budget-detail'},h('div',null,h('span',null,'Gastado este mes'),h('strong',null,money(plan.expenses))),h('progress',{max:plan.budget.limit,value:Math.min(plan.budget.limit,plan.expenses),'aria-label':'Gastos frente al presupuesto'}),h('div',null,h('span',null,'Pendiente de pagar'),h('strong',null,money(plan.pending))),h('p',{className:plan.remaining<0?'is-negative':''},plan.remaining<0?`Gastos y compromisos superan tu límite en ${money(-plan.remaining)}.`:`Quedan ${money(plan.remaining)} del presupuesto después de los pagos pendientes.`)),
          plan.free<0 && h('p',{className:'planner-warning'},`Te faltan ${money(-plan.free)} para cubrir los pagos y la reserva con tu saldo actual.`)),
        h('section',{className:'panel planner-new-bill'},h('h2',null,'Agrega un pago pendiente'),h('p',null,'Arriendo, tarjeta, servicios o cualquier gasto que quieras tener presente.'),
          plan.accounts.length ? h('form',{onSubmit:submitBill,className:'planner-form'},
            field('Nombre del pago','title',{required:true,maxLength:100,placeholder:'Ej. Cuenta de la luz'}),
            h('div',{className:'planner-form-row'},field('Monto en pesos','amount',{required:true,inputMode:'numeric',placeholder:'Ej. 30.000'}),field('Vencimiento','date',{type:'date',required:true,defaultValue:today})),
            h('div',{className:'planner-form-row'},h('label',{className:'planner-field'},h('span',null,'Cuenta del pago'),h('select',{name:'accountId',required:true},plan.accounts.map(a=>h('option',{key:a.id,value:a.id},a.name)))),h('label',{className:'planner-field'},h('span',null,'Categoría'),h('select',{name:'category'},categories.map(c=>h('option',{key:c,value:c},c))))),
            h('label',{className:'planner-check'},h('input',{type:'checkbox',name:'repeat'}),'Repetir cada mes, desde este vencimiento'),
            h('small',null,'Si el día no existe en un mes, se usa su último día. No se realizan cobros automáticos.'),
            h('button',{className:'button primary',type:'submit'},'Guardar pago pendiente')) : h('p',{className:'planner-empty'},'Crea una cuenta en Mis cuentas para agregar tus pagos.'))),
      h('section',{className:'panel planner-calendar'},h('div',{className:'panel-heading'},h('div',null,h('h2',null,'Tus vencimientos'),h('p',null,'Registrar un pago crea un gasto. Si ya lo anotaste en Movimientos, no vuelvas a registrarlo aquí.'))),
        plan.bills.length ? h('ul',{className:'planner-bills'},plan.bills.map(b=>h('li',{key:b.id,className:'planner-bill'},
          h('div',{className:'planner-bill-copy'},h('strong',null,b.title),h('span',null,`${b.due} · ${data.accounts.find(a=>a.id===b.accountId)?.name||'Cuenta'}${b.repeat?' · Mensual':''}`)),
          h('span',{className:`planner-payment-status ${b.paid?'paid':b.overdue?'overdue':''}`},b.paid?'Registrado':b.overdue?'Vencido':'Pendiente'),h('strong',{className:'planner-bill-amount'},money(b.amount)),
          !b.paid && h('button',{className:'button secondary',type:'button',onClick:()=>{setPayment(b);setNotice('');}},'Registrar pago'),
          h('button',{className:'planner-remove',type:'button','aria-label':`Quitar recordatorio ${b.title}`,onClick:()=>{setRemoved(b);setPayment(null);onChange(current=>({...current,planner:{...current.planner,bills:current.planner.bills.filter(item=>item.id!==b.id)}}));say('Recordatorio quitado. Los gastos registrados se conservan. Puedes deshacerlo.');}},'Quitar')))) : h('p',{className:'planner-empty'},'Sin vencimientos en este mes y espacio. Agrega tu primer pago pendiente.'),
        removed && h('button',{className:'button secondary',type:'button',onClick:()=>{onChange(current=>({...current,planner:{...current.planner,bills:current.planner.bills.some(b=>b.id===removed.id)?current.planner.bills:[...current.planner.bills,removed]}}));setRemoved(null);say('Recordatorio restaurado.');}},'Deshacer eliminación'),
        payment && h('form',{onSubmit:submitPayment,className:'planner-payment-form','aria-label':`Registrar pago de ${payment.title}`},h('h3',null,`Registrar ${payment.title}`),h('p',null,`${money(payment.amount)} se anotará como gasto en la cuenta ${data.accounts.find(a=>a.id===payment.accountId)?.name}. Esto solo registra el pago; no transfiere dinero.`),field('Fecha del pago','paidDate',{type:'date',required:true,max:today,defaultValue:today}),h('div',{className:'planner-actions'},h('button',{className:'button primary',type:'submit'},'Confirmar registro'),h('button',{className:'button secondary',type:'button',onClick:()=>setPayment(null)},'Cancelar')))),
      h('p',{className:'planner-footnote'},'Tus planes se incluyen en el respaldo JSON de Configuración. Se guardan en este navegador; todavía no se sincronizan entre dispositivos.'));
  };
}
