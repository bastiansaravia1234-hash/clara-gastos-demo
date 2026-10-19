import {decodeImport,validateImport,readCurrent,importSummary,persistImport,STORAGE_KEY} from './import-data.mjs?v=2';
const launch = () => location.pathname.endsWith('/importar.html') ? location.replace('./') : import('../assets/index-rose-v2.js');
const money = value => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const root = document.getElementById('root');
function element(tag, content, attrs = {}) {
  const node = document.createElement(tag); node.textContent = content;
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  return node;
}
function clearLink() { history.replaceState(null,'',location.pathname+location.search); }
async function start(filePayload = null) {
  if (!location.hash.startsWith('#importar=') && !location.pathname.endsWith('/importar.html')) {await launch();return;}
  root.replaceChildren();
  if (!filePayload && !location.hash.startsWith('#importar=')) {
    const panel = element('main','',{class:'import-panel'});
    panel.append(element('h1','Carga tus movimientos en Clara'),element('p','Selecciona tu archivo de movimientos JSON. Podrás revisar los montos antes de guardar; el archivo se lee en este navegador.'));
    const label=element('label','Archivo de movimientos '), input=element('input','',{type:'file',accept:'.json,application/json'}), feedback=element('p','',{role:'alert'});
    input.addEventListener('change',async()=>{try {const file=input.files[0];if(!file)return;if(file.size>120000)throw new Error('El archivo es demasiado grande.');await start(validateImport(JSON.parse(await file.text())));}catch(error){feedback.textContent=error.message;}});
    label.append(input);panel.append(label,feedback);root.append(panel);return;
  }
  const box = element('main','',{class:'import-panel'});
  root.append(box);
  box.append(element('h1','Carga tus movimientos en Clara'));
  const status = element('p','',{role:'status'});
  function cancel() {clearLink();root.replaceChildren();launch();}
  try {
    const payload = filePayload || decodeImport(location.hash);
    const raw = localStorage.getItem(STORAGE_KEY), current = readCurrent(raw);
    if (current?.imports?.some(item=>item.id===payload.id)) {clearLink();root.replaceChildren();await launch();return;}
    const summary = importSummary(payload);
    box.append(element('p',payload.account.name),element('p','Registro manual de cartola · Banco no conectado'));
    if(payload.replacesImportId && current?.imports?.some(item=>item.id===payload.replacesImportId)) box.append(element('p','Esta carga corrige los movimientos de la importación anterior. Se reemplazan solo los registros de esa carga, se conserva lo que agregaste después y se guarda un respaldo previo.'));
    if(payload.ownerName) box.append(element('p','Perfil: '+payload.ownerName));
    const totals = element('dl','');
    for (const [label,value] of [['Saldo inicial',payload.account.opening],['Gastos registrados',summary.expenses],['Ingresos registrados',summary.income],['Saldo tras esta carga',summary.balance]]) totals.append(element('dt',label),element('dd',money(value)));
    box.append(totals);
    const table = element('table',''), head=element('thead',''), tr=element('tr','');
    for (const label of ['Fecha','Movimiento','Monto']) tr.append(element('th',label));
    head.append(tr);table.append(head);
    const body=element('tbody','');
    for(const item of payload.transactions) {
      const row=element('tr','');
      row.append(element('td',item.date.split('-').reverse().join('/')),element('td',item.title),element('td',(item.kind==='expense'?'−':'+')+money(item.amount)));body.append(row);
    }
    table.append(body);box.append(table);
    let replace;
    if(current?.demo) {
      const label=element('label','',{class:'import-choice'});
      replace=element('input','',{type:'checkbox'});
      label.append(replace,document.createTextNode(' Empezar con estos datos y reemplazar los ejemplos. Se guarda un respaldo de lo anterior en este navegador.'));
      box.append(label);
    }
    box.append(element('p',current?'Si conservas tus registros, se agrega una cuenta separada. Revisa que no hayas anotado estos gastos anteriormente.':'Se creará una cuenta con estos movimientos.'),element('p','Se guardan solo en este navegador. Abrir esta misma carga otra vez no duplica los movimientos.'));
    const button=element('button','Cargar movimientos',{type:'button',class:'button primary'});
    button.addEventListener('click',async()=>{
      try {
        persistImport(localStorage,payload,!!replace?.checked,raw);
        button.disabled=true;clearLink();root.replaceChildren();await launch();
      } catch(error) {status.textContent=error.message;status.setAttribute('role','alert');}
    });
    box.append(button,status);
  } catch(error) {
    status.textContent='No se pudo cargar: '+error.message;status.setAttribute('role','alert');box.append(status);
  }
  const exit=element('button','Volver a Clara sin importar',{type:'button',class:'button secondary'});
  exit.addEventListener('click',cancel);box.append(exit);
}
start();
