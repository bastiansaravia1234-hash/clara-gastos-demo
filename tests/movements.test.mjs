import test from 'node:test';
import assert from 'node:assert/strict';
import {updateMovement,movementTotals} from '../features/movement-model.mjs';
import {mergeImport,persistImport,STORAGE_KEY} from '../features/import-data.mjs';
const original={version:1,demo:false,profile:null,accounts:[{id:'a',opening:20,scope:'Personal'}],transactions:[{id:'t',title:'Compra',accountId:'a',date:'2026-10-19',kind:'expense',category:'Otros',amount:5,note:'Nota original'}],goals:[],activities:[],planner:{bills:[],budgets:{}}};
test('category edits keep amount, balance, identity, other records and planner intact after reload',()=>{
  const fields={...original.transactions[0],category:'Transporte'};
  const next=updateMovement(original,'t',fields),reloaded=JSON.parse(JSON.stringify(next));
  assert.equal(reloaded.transactions[0].category,'Transporte');assert.equal(reloaded.transactions[0].id,'t');assert.equal(reloaded.transactions.length,1);
  assert.equal(movementTotals(reloaded).balance,15);assert.deepEqual(next.planner,original.planner);assert.equal(original.transactions[0].category,'Otros');
});
test('changing amount or income/expense recalculates totals once and rejects invalid fields',()=>{
  const fields={...original.transactions[0],amount:'1.000',kind:'income',category:'Otros ingresos'};
  const next=updateMovement(original,'t',fields);
  assert.equal(movementTotals(next).balance,1020);assert.equal(movementTotals(next).income,1000);assert.equal(movementTotals(next).expenses,0);
  assert.throws(()=>updateMovement(original,'t',{...fields,category:'Transporte'}));
  assert.throws(()=>updateMovement(original,'missing',fields));
  assert.throws(()=>updateMovement(original,'t',{...fields,date:'2026-02-31'}));
  assert.throws(()=>updateMovement(original,'t',{...fields,amount:'-10'}));
});
test('correcting a prior import replaces its opening and imported rows, keeps later manual entries and backs up',()=>{
  const prior={version:1,id:'prior',account:{name:'Prueba',opening:1000},transactions:[{title:'Antes',amount:10,kind:'expense',category:'Otros',date:'2026-10-19'}]};
  const current=mergeImport(original,prior);current.transactions.push({id:'manual',title:'Después',amount:3,kind:'expense',category:'Otros',date:'2026-10-19',accountId:'import-prior'});
  const correction={...prior,id:'corrected',replacesImportId:'prior',ownerName:'Perfil de prueba',account:{name:'Actualizada',bank:'Banco de prueba · manual',opening:100},transactions:[{title:'Abono',amount:900,kind:'income',category:'Otros ingresos',date:'2026-10-19'},{title:'Compra corregida',amount:20,kind:'expense',category:'Otros',date:'2026-10-19'}]};
  const map=new Map([[STORAGE_KEY,JSON.stringify(current)]]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  const next=persistImport(storage,correction).data;
  assert.equal(next.accounts.length,2);assert.equal(next.accounts.find(a=>a.id==='import-prior').opening,100);
  assert.ok(next.transactions.some(t=>t.id==='manual'));assert.ok(!next.transactions.some(t=>t.title==='Antes'));assert.equal(next.transactions.length,4);
  assert.equal(next.profile.name,'Perfil de prueba');assert.equal(next.accounts[1].bank,correction.account.bank);
  assert.equal(map.get('clara-respaldo-importacion-corrected'),JSON.stringify(current));assert.equal(mergeImport(next,correction),next);
  assert.equal(movementTotals(next).balance,992);
});
