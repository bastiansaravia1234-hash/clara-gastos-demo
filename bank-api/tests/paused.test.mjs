import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {createBankApi} from '../server.mjs';
test('production defaults reject all bank login, credential replacement and sync routes before auth or body processing',async t=>{
 let called=0;const api=createBankApi({supabaseUrl:'https://test.supabase.co',publishableKey:'public',masterKey:randomBytes(32).toString('base64'),allowedOrigins:['https://clara.example'],fetchImpl:async()=>{called++;throw Error('Must not contact any service');},scrapeImpl:async()=>{called++;throw Error('Must not log in');}});
 const server=http.createServer(api.handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await api.shutdown();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 for(const path of ['/v1/connections','/v1/connections/10000000-0000-4000-8000-000000000001/sync','/v1/connections/10000000-0000-4000-8000-000000000001/credentials']){
  const r=await fetch(base+path,{method:'POST',headers:{Origin:'https://clara.example','Content-Type':'application/json'},body:'{"password":"DO-NOT-USE"}'});assert.equal(r.status,503);const body=await r.json();assert.equal(body.error.code,'BANK_ACCESS_PAUSED');assert.doesNotMatch(JSON.stringify(body),/DO-NOT-USE/);
 }
 const health=await (await fetch(base+'/healthz')).json();assert.equal(health.bankLoginEnabled,false);assert.ok(health.banks.every(bank=>bank.status==='paused'));assert.equal(called,0);
});
