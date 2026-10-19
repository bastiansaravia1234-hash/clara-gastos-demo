import {updateMovement,movementTotals,expenseCategories,incomeCategories} from './movement-model.mjs';
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
export function createMovements(React) {
  const h=React.createElement;
  function Editor({data,transaction,onChange,onClose,onSaved,onDelete}) {
    const [kind,setKind]=React.useState(transaction.kind),[error,setError]=React.useState('');
    const ref=React.useRef(null);
    React.useEffect(()=>{
      const previous=document.activeElement,overflow=document.body.style.overflow;
      document.body.style.overflow='hidden';ref.current?.querySelector('input')?.focus();
      const key=event=>{
        if(event.key==='Escape')onClose();
        if(event.key==='Tab'){
          const fields=ref.current?.querySelectorAll('input,select,textarea,button');if(!fields?.length)return;
          const first=fields[0],last=fields[fields.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      };
      document.addEventListener('keydown',key);
      return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
    },[]);
    const categories=kind==='income'?incomeCategories:expenseCategories;
    const field=(label,name,props)=>h('label',{className:'rose-field'},h('span',null,label),h('input',{name,...props}));
    function submit(event){
      event.preventDefault();try{
        const form=new FormData(event.currentTarget),fields=Object.fromEntries(form);fields.kind=kind;
        updateMovement(data,transaction.id,fields);
        onChange(current=>updateMovement(current,transaction.id,fields));onSaved();onClose();
      }catch(e){setError(e.message);}
    }
    return h('div',{className:'rose-sheet-backdrop',onClick:event=>{if(event.target===event.currentTarget)onClose();}},
      h('section',{ref,className:'rose-sheet',role:'dialog','aria-modal':true,'aria-labelledby':'rose-edit-title'},
        h('div',{className:'sheet-handle','aria-hidden':true}),
        h('div',{className:'rose-sheet-heading'},h('div',null,h('span',{className:'eyebrow'},'A TU MANERA'),h('h2',{id:'rose-edit-title'},'Editar movimiento')),h('button',{type:'button',className:'rose-close','aria-label':'Cerrar edición',onClick:onClose},'×')),
        h('p',{className:'rose-muted'},'Cambia el tipo de gasto o corrige sus datos. El saldo se recalcula al guardar.'),
        h('form',{onSubmit:submit},
          h('div',{className:'rose-segments','aria-label':'Ingreso o gasto'},['expense','income'].map(value=>h('button',{key:value,type:'button','aria-pressed':kind===value,onClick:()=>setKind(value)},value==='expense'?'↗ Gasto':'↙ Ingreso'))),
          field('Descripción','title',{required:true,maxLength:120,defaultValue:transaction.title}),
          h('div',{className:'rose-form-row'},field('Monto en pesos','amount',{required:true,inputMode:'numeric',defaultValue:transaction.amount}),field('Fecha','date',{required:true,type:'date',defaultValue:transaction.date})),
          h('label',{className:'rose-field'},h('span',null,'Tipo de gasto / categoría'),h('select',{key:kind,name:'category',defaultValue:categories.includes(transaction.category)?transaction.category:categories[0]},categories.map(c=>h('option',{key:c,value:c},c)))),
          h('label',{className:'rose-field'},h('span',null,'Cuenta'),h('select',{name:'accountId',defaultValue:transaction.accountId},data.accounts.map(a=>h('option',{key:a.id,value:a.id},a.name)))),
          h('label',{className:'rose-field'},h('span',null,'Nota (opcional)'),h('textarea',{name:'note',rows:3,maxLength:500,defaultValue:transaction.note||''})),
          error&&h('p',{className:'rose-error',role:'alert'},error),
          onDelete&&h('button',{type:'button',className:'rose-delete',onClick:()=>{onClose();onDelete(transaction);}},'Eliminar movimiento'),
          h('div',{className:'rose-sheet-actions'},h('button',{type:'button',className:'button secondary',onClick:onClose},'Cancelar'),h('button',{type:'submit',className:'button primary'},'Guardar cambios')))));
  }
  return function Movements({data,onChange,month,scope,onDelete}) {
    const [editing,setEditing]=React.useState(null),[search,setSearch]=React.useState(''),[kind,setKind]=React.useState('all'),[category,setCategory]=React.useState('all'),[notice,setNotice]=React.useState('');
    const totals=movementTotals(data,scope,month);
    const transactions=[...totals.transactions].filter(t=>(kind==='all'||t.kind===kind)&&(category==='all'||t.category===category)&&`${t.title} ${t.category} ${t.amount}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).sort((a,b)=>b.date.localeCompare(a.date));
    const days=[...new Set(transactions.map(t=>t.date))];
    React.useEffect(()=>{setSearch('');setCategory('all');setEditing(null);},[month,scope]);
    return h('section',{className:'rose-movements','aria-label':'Movimientos editables'},
      h('div',{className:'rose-ledger-heading'},h('div',null,h('h2',null,'Cada movimiento, a tu manera'),h('p',{className:'rose-muted'},'Toca Editar para cambiar la categoría, descripción o monto.')),h('a',{className:'button secondary',href:'./importar.html'},'Importar')),
      notice&&h('p',{className:'rose-notice',role:'status'},notice),
      h('div',{className:'rose-ledger-stats'},h('div',null,h('span',null,'Ingresos del mes'),h('strong',null,money(totals.income))),h('div',null,h('span',null,'Gastos del mes'),h('strong',null,money(totals.expenses)))),
      h('div',{className:'rose-toolbar'},h('input',{type:'search','aria-label':'Buscar movimientos',placeholder:'Busca una compra o transferencia',value:search,onChange:event=>setSearch(event.target.value)}),h('select',{'aria-label':'Filtrar por categoría',value:category,onChange:event=>setCategory(event.target.value)},h('option',{value:'all'},'Todas las categorías'),[...expenseCategories,...incomeCategories].map(c=>h('option',{key:c,value:c},c)))),
      h('div',{className:'rose-segments','aria-label':'Filtrar movimientos'},[['all','Todos'],['expense','Gastos'],['income','Ingresos']].map(([value,label])=>h('button',{type:'button',key:value,'aria-pressed':kind===value,onClick:()=>setKind(value)},label))),
      days.length?days.map(day=>h('section',{key:day,className:'rose-day'},h('h3',null,new Date(day+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})),h('div',{className:'rose-day-card'},transactions.filter(t=>t.date===day).map(t=>h('article',{key:t.id,className:'rose-transaction'},
        h('span',{className:`rose-tx-icon ${t.kind==='income'?'is-income':''}`,'aria-hidden':true},t.kind==='income'?'↙':t.category==='Alimentación'?'◉':t.category==='Transporte'?'↗':'↗'),
        h('div',{className:'rose-tx-copy'},h('strong',null,t.title),h('span',{className:'rose-category'},t.category),t.note&&h('small',null,t.note)),
        h('div',{className:'rose-tx-value'},h('strong',{className:t.kind==='income'?'rose-income':''},(t.kind==='income'?'+':'−')+money(t.amount)),h('button',{type:'button',className:'rose-edit','aria-label':`Editar ${t.title}`,onClick:()=>{setEditing(t);setNotice('');}},'Editar'))))))) :h('div',{className:'rose-empty'},h('h3',null,'Un espacio para tus movimientos'),h('p',null,'Agrega un ingreso o gasto, importa un archivo o cambia los filtros.')),
      editing&&h(Editor,{key:editing.id,data,transaction:editing,onChange,onDelete,onClose:()=>setEditing(null),onSaved:()=>setNotice('Cambios guardados. Tu saldo y tus reportes ya están actualizados.')}));
  };
}
