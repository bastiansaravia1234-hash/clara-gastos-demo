import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePesos,dueDate,validDate,planFor,saveBudget,addBill,recordPayment,todayInChile} from '../features/planner-model.mjs';
const base=()=>({version:1,accounts:[{id:'a',opening:500000,scope:'Personal'},{id:'b',opening:300000,scope:'Hogar'}],transactions:[{id:'old',kind:'expense',amount:100000,date:'2026-10-01',accountId:'a'},{id:'future',kind:'income',amount:1000000,date:'2026-11-01',accountId:'a'}],goals:[],activities:[]});
const bill=(extra={})=>({id:'bill',title:'Arriendo',amount:100000,accountId:'a',date:'2026-10-05',category:'Gastos de casa',repeat:true,...extra});
test('Chilean peso parsing rejects ambiguous decimals, signs and unsafe integers',()=>{
  assert.equal(parsePesos('$ 30.000'),30000);assert.equal(parsePesos('30000'),30000);assert.equal(parsePesos('0'),0);
  for(const input of ['30,5','30.00','-20','1e5','9007199254740992',''])assert.throws(()=>parsePesos(input));
});
test('Recurring due dates clamp the day and never backfill before their start month',()=>{
  const b=bill({date:'2024-01-31'});assert.equal(dueDate(b,'2024-02'),'2024-02-29');assert.equal(dueDate(b,'2025-02'),'2025-02-28');assert.equal(dueDate(b,'2024-04'),'2024-04-30');assert.equal(dueDate(b,'2023-12'),null);
  assert.equal(dueDate({...b,repeat:false},'2024-02'),null);assert.equal(validDate('2026-02-30'),false);
});
test('Budget reserves pending payments once, respects scope and ignores future money in current balance',()=>{
  let data=addBill(base(),bill());data=saveBudget(data,'2026-10','Personal',300000,50000);
  const p=planFor(data,'2026-10','Personal','2026-10-07');assert.equal(p.balance,400000);assert.equal(p.expenses,100000);assert.equal(p.pending,100000);assert.equal(p.free,250000);assert.equal(p.remaining,100000);assert.equal(p.daily,4000);assert.equal(p.days,25);
  assert.equal(planFor(data,'2026-10','Hogar','2026-10-07').pending,0);assert.equal(planFor(data,'2026-10','Todos','2026-10-07').balance,700000);assert.equal(data.accounts[0].opening,500000);
});
test('Registering a payment creates exactly one expense and does not double count pending money',()=>{
  let data=saveBudget(addBill(base(),bill()),'2026-10','Personal',300000,50000);
  data=recordPayment(data,'bill','2026-10','2026-10-07','paid','2026-10-07');const p=planFor(data,'2026-10','Personal','2026-10-07');
  assert.equal(p.balance,300000);assert.equal(p.pending,0);assert.equal(p.expenses,200000);assert.equal(p.free,250000);assert.equal(p.remaining,100000);
  assert.strictEqual(recordPayment(data,'bill','2026-10','2026-10-07','second','2026-10-07'),data);
  assert.equal(planFor(data,'2026-11','Personal','2026-10-07').pending,100000);
  assert.throws(()=>recordPayment(data,'bill','2026-11','2026-10-08','third','2026-10-07'));
});
test('Deleting the linked transaction restores its pending reminder; JSON backups keep budgets and paid references',()=>{
  const data=recordPayment(saveBudget(addBill(base(),bill()),'2026-10','Personal',300000,50000),'bill','2026-10','2026-10-07','paid','2026-10-07');
  const reloaded=JSON.parse(JSON.stringify(data));assert.deepEqual(planFor(reloaded,'2026-10','Personal','2026-10-07'),planFor(data,'2026-10','Personal','2026-10-07'));
  reloaded.transactions=reloaded.transactions.filter(t=>t.id!=='paid');assert.equal(planFor(reloaded,'2026-10','Personal','2026-10-07').pending,100000);
});
test('Overspending, finished months and unset budgets never produce a misleading positive daily margin',()=>{
  let data=saveBudget(addBill(base(),bill({amount:500000})),'2026-10','Personal',200000,50000);
  const p=planFor(data,'2026-10','Personal','2026-10-07');assert.equal(p.daily,0);assert.equal(p.free,-150000);assert.equal(p.remaining,-400000);
  assert.equal(planFor(data,'2026-09','Personal','2026-10-07').daily,null);assert.equal(planFor(base(),'2026-10','Personal','2026-10-07').daily,null);
});
test('Payment and reminder validation reject missing accounts and invalid calendar dates',()=>{
  assert.throws(()=>addBill(base(),bill({accountId:'gone'})));assert.throws(()=>addBill(base(),bill({date:'2026-02-30'})));assert.throws(()=>addBill(base(),bill({amount:0})));
  assert.throws(()=>recordPayment(base(),'missing','2026-10','2026-10-07','paid','2026-10-07'));
});
test('Today follows Santiago across UTC midnight',()=>{
  assert.equal(todayInChile(new Date('2026-10-08T01:00:00Z')),'2026-10-07');
});
