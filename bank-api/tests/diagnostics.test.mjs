import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticReason,progressStage} from '../diagnostics.mjs';
import {safeBankError} from '../model.mjs';
test('diagnostics discard page text and credentials and retain only known reasons',()=>{
 for(const text of ['secret-password 12345678-5','<html>private balance</html>'])assert.equal(diagnosticReason(text),'BANK_UNAVAILABLE');
 assert.equal(diagnosticReason('No se encontró campo de RUT'),'RUT_FIELD_MISSING');
 assert.equal(diagnosticReason('No se encontró campo de clave'),'PASSWORD_FIELD_MISSING');
 assert.equal(diagnosticReason('locator strict mode violation: sensitive text'),'AMBIGUOUS_SELECTOR');
 assert.equal(progressStage('Ingresando RUT...'),'FILL_RUT');
 assert.equal(progressStage('Cuenta: secret account balance'),null);
});
test('structured diagnostics preserve action and credential states',()=>{
 assert.equal(safeBankError(Error('REQUIRES_ACTION')).status,'requires_action');
 assert.equal(safeBankError(Error('CREDENTIALS')).code,'CREDENTIALS');
 for(const code of ['RUT_FIELD_MISSING','PASSWORD_FIELD_MISSING','AMBIGUOUS_SELECTOR'])assert.equal(safeBankError(Error(code)).code,'LOGIN_FORM_CHANGED');
});
