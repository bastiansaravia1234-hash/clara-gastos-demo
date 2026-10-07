import {buildFinanceContext,answerFinanceQuestion} from './finance-agent-model.mjs';

export function createFinanceAgent(React){
  const h=React.createElement;
  return function FinanceAgent({data,scope,month,onAction}){
    const [input,setInput]=React.useState('');
    const [messages,setMessages]=React.useState([]);
    const ctx=React.useMemo(()=>buildFinanceContext(data,scope,month),[data,scope,month]);
    const ask=value=>{
      const q=String(value||'').trim().slice(0,500); if(!q) return;
      const advice=answerFinanceQuestion(q,ctx);
      setMessages(m=>[...m.slice(-16),{role:'user',text:q},{role:'assistant',text:advice.text,advice}]);
      setInput('');
    };
    const starters=['¿Cómo voy este mes?','¿Cuánto puedo gastar por día?','¿Dónde puedo reducir gastos?','¿Qué pagos tengo pendientes?','¿Cómo van mis metas?'];
    return h('section',{className:'assistant-panel panel','aria-label':'Agente financiero de Clara'},
      h('div',{className:'assistant-panel-header'},h('div',null,h('h2',null,'Agente financiero Clara'),h('p',null,'Analiza tus datos reales del mes y te ayuda a decidir mejor.')),h('span',{className:'assistant-mode'},'Agente local')),
      h('div',{className:'assistant-context'},h('span',null,'Privado: el análisis ocurre en tu dispositivo.'),h('span',null,`${month} · ${scope==='Todos'?'Vista general':scope}`)),
      h('div',{className:'assistant-conversation',role:'log','aria-live':'polite'},
        !messages.length&&h('div',{className:'assistant-welcome'},h('h3',null,'¿Qué quieres revisar?'),h('p',null,'Puedo leer tu presupuesto, pagos, gastos y metas sin enviar tus datos a internet.'),h('div',{className:'assistant-starters'},starters.map(s=>h('button',{key:s,onClick:()=>ask(s)},s)))),
        messages.map((m,i)=>h('div',{key:i,className:`chat-message ${m.role}`},h('div',null,h('span',{className:'chat-author'},m.role==='assistant'?'Clara · Agente financiero':'Tú'),h('p',null,m.text),m.advice?.action&&h('button',{className:'chat-action',onClick:()=>onAction?.(m.advice.action)},m.advice.label||'Abrir'))))
      ),
      h('form',{className:'assistant-composer',onSubmit:e=>{e.preventDefault();ask(input)}},h('input',{value:input,onChange:e=>setInput(e.target.value),placeholder:'Pregúntame por tu presupuesto, gastos o metas…',maxLength:500}),h('button',{type:'submit',disabled:!input.trim()},'Enviar')),
      h('p',{className:'assistant-disclaimer'},'Este agente entrega orientación basada en tus registros; no realiza transferencias, inversiones ni cambios automáticos.')
    );
  };
}
