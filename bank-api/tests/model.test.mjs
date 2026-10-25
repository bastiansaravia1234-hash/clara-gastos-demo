import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealCredentials,openCredentials} from '../crypto.mjs';
import {normalizeRut,bankDate,normalizeSnapshot,safeBankError} from '../model.mjs';
import {applyBankSnapshot} from '../sync-model.mjs';
const key=randomBytes(32).toString('base64');
test('vault uses fresh authenticated encryption, bound to owner and connection',()=>{
 const value={rut:'12345678-5',password:'only-a-test'},a=sealCredentials(value,key,'user-a','connection-a'),b=sealCredentials(value,key,'user-a','connection-a');
 assert.notEqual(a,b);assert.doesNotMatch(a,/12345678|only-a-test/);assert.deepEqual(openCredentials(a,key,'user-a','connection-a'),value);
 assert.throws(()=>openCredentials(a,key,'user-b','connection-a'));assert.throws(()=>openCredentials(a,key,'user-a','connection-b'));assert.throws(()=>openCredentials(a,randomBytes(32).toString('base64'),'user-a','connection-a'));
 const pieces=a.split('.');pieces[3]='x'+pieces[3].slice(1);assert.throws(()=>openCredentials(pieces.join('.'),key,'user-a','connection-a'));
});
test('RUT check digit and dates are validated without rolling invalid dates',()=>{assert.equal(normalizeRut('12.345.678-5'),'12345678-5');assert.throws(()=>normalizeRut('12.345.678-9'));assert.equal(bankDate('25/10/2026'),'2026-10-25');assert.equal(bankDate('2026-10-25T12:00:00Z'),'2026-10-25');assert.equal(bankDate('31-02-2026'),null);});
const movement={date:'25-10-2026',description:'SUPERMERCADO',amount:-1000,balance:5000,source:'account'};
test('snapshot never invents a zero balance and excludes foreign currencies and secrets',()=>{
 assert.throws(()=>normalizeSnapshot({success:true,accounts:[{movements:[]}]},'falabella'));
 const snap=normalizeSnapshot({success:true,accounts:[{balance:0,movements:[]}],screenshot:'private',debug:'private',password:'private'},'falabella');assert.equal(snap.products[0].balance,0);assert.doesNotMatch(JSON.stringify(snap),/private|screenshot|password|debug/);
 const filtered=normalizeSnapshot({success:true,accounts:[{balance:5000,movements:[movement,{...movement,currency:'USD'}]}]},'falabella');assert.equal(filtered.foreign,1);assert.equal(filtered.products[0].movements.length,1);
});
test('genuinely repeated identical movements get separate stable IDs',()=>{const input={success:true,accounts:[{balance:5000,movements:[movement,movement]}]};const a=normalizeSnapshot(input,'falabella'),b=normalizeSnapshot(input,'falabella');assert.equal(a.products[0].movements.length,2);assert.notEqual(a.products[0].movements[0].id,a.products[0].movements[1].id);assert.deepEqual(a.products[0].movements,b.products[0].movements);});
const base=()=>({version:1,accounts:[{id:'account-a',scope:'Personal',opening:10000,name:'Mi cuenta'},{id:'other',scope:'Personal',opening:500}],transactions:[{id:'manual',accountId:'account-a',date:'2026-10-25',title:'Supermercado',amount:1000,kind:'expense',category:'Mi categoría',note:'Conservar'}],goals:[{id:'goal'}],activities:[]});
test('bank incorporation adopts exact manual matches, preserves categories and is idempotent',()=>{
 const snapshot=normalizeSnapshot({success:true,accounts:[{balance:5000,movements:[movement]}]},'falabella','2026-10-25T12:00:00Z'),connection={id:'connection-a',bank_id:'falabella',account_id:'account-a',product_id:snapshot.products[0].id,snapshot};
 const original=base(),next=applyBankSnapshot(original,connection);assert.equal(next.transactions.length,1);assert.equal(next.transactions[0].id,'manual');assert.equal(next.transactions[0].category,'Mi categoría');assert.equal(next.transactions[0].note,'Conservar');assert.equal(next.accounts[0].opening,6000);assert.deepEqual(next.accounts[1],original.accounts[1]);assert.equal(original.transactions[0].bankMovementId,undefined);assert.equal(applyBankSnapshot(next,connection),next);assert.deepEqual(next.goals,original.goals);
 const newer={...connection,snapshot:{...snapshot,at:'2026-10-25T13:00:00Z'}};assert.equal(applyBankSnapshot(next,newer).transactions.length,1);
});
test('bank incorporation preserves multiple same-day purchases and ignores unmapped or shared accounts',()=>{
 const snapshot=normalizeSnapshot({success:true,accounts:[{balance:4000,movements:[movement,movement]}]},'falabella'),connection={id:'connection-a',bank_id:'falabella',account_id:'account-a',product_id:snapshot.products[0].id,snapshot};
 const next=applyBankSnapshot(base(),connection);assert.equal(next.transactions.length,2);assert.equal(next.accounts[0].opening,6000);
 const original=base();assert.equal(applyBankSnapshot(original,{...connection,account_id:'missing'}),original);assert.equal(applyBankSnapshot(original,{...connection,product_id:null}),original);const shared={...original,accounts:[{...original.accounts[0],scope:'Hogar'}]};assert.equal(applyBankSnapshot(shared,connection),shared);
});
test('bank errors are actionable but never echo credentials, screenshots or raw debug',()=>{const e=safeBankError('clave incorrecta secret-123 rut-123');assert.equal(e.status,'requires_action');assert.doesNotMatch(e.message,/secret-123|rut-123/);assert.equal(safeBankError('requires 2FA').code,'REQUIRES_ACTION');assert.equal(safeBankError('BANK_TIMEOUT').code,'TIMEOUT');});
