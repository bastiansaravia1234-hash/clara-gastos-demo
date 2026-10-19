import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeImport,validateImport,mergeImport,persistImport,importSummary,STORAGE_KEY} from '../features/import-data.mjs';
const payload={version:1,id:'test-import',account:{name:'Mi cuenta de prueba',opening:10000},transactions:[{title:'Compra de prueba',amount:1300,kind:'expense',category:'Alimentación',date:'2026-10-01'},{title:'Ingreso de prueba',amount:400,kind:'income',category:'Otros',date:'2026-10-02'}]};
const empty=()=>({version:1,demo:false,profile:null,accounts:[],transactions:[],goals:[],activities:[]});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
test('round trip through a private fragment and validate dates and integer pesos',()=>{
  assert.deepEqual(decodeImport('#importar='+encodeURIComponent(JSON.stringify(payload))),validateImport(payload));
  assert.equal(decodeImport('#resumen'),null);
  assert.throws(()=>validateImport({...payload,transactions:[{...payload.transactions[0],date:'2026-02-31'}]}));
  assert.throws(()=>validateImport({...payload,transactions:[{...payload.transactions[0],amount:1.5}]}));
  assert.throws(()=>validateImport({...payload,id:'__proto__.'}));
});
test('import preserves real data, plans, goals and profile; imports are immutable and repeat-safe',()=>{
  const current={...empty(),accounts:[{id:'existing',opening:50}],transactions:[{id:'old',amount:5}],goals:[{id:'goal'}],profile:{name:'Prueba'},planner:{bills:[{id:'bill'}]}};
  const copy=structuredClone(current), next=mergeImport(current,payload);
  assert.deepEqual(current,copy);assert.equal(next.accounts.length,2);assert.equal(next.transactions.length,3);
  assert.equal(next.transactions[0].accountId,next.accounts[1].id);
  assert.deepEqual(next.planner,current.planner);assert.deepEqual(next.goals,current.goals);
  next.transactions[0].amount=2000;
  assert.equal(mergeImport(next,payload),next);assert.equal(next.transactions[0].amount,2000);
  assert.deepEqual(importSummary(payload),{income:400,expenses:1300,balance:9100});
});
test('example replacement is explicit and backed up; real data cannot be replaced',()=>{
  const store=storage(),original={...empty(),demo:true,accounts:[{id:'demo'}]};
  const raw=JSON.stringify(original);store.setItem(STORAGE_KEY,raw);
  const result=persistImport(store,payload,true,raw);
  assert.equal(result.data.demo,false);assert.equal(result.data.accounts.length,1);
  assert.equal(store.getItem('clara-respaldo-importacion-test-import'),raw);
  assert.equal(persistImport(store,payload).alreadyImported,true);
  assert.throws(()=>mergeImport(empty(),payload,true));
});
test('malformed existing state, concurrent edits and backup quota errors leave active data untouched',()=>{
  const store=storage();store.setItem(STORAGE_KEY,'broken');
  assert.throws(()=>persistImport(store,payload));assert.equal(store.getItem(STORAGE_KEY),'broken');
  const raw=JSON.stringify(empty());store.setItem(STORAGE_KEY,raw);
  assert.throws(()=>persistImport(store,payload,false,'stale'));assert.equal(store.getItem(STORAGE_KEY),raw);
  const restricted={getItem:()=>raw,setItem(){throw new Error('Quota exceeded');}};
  assert.throws(()=>persistImport(restricted,payload));assert.equal(restricted.getItem(STORAGE_KEY),raw);
});
