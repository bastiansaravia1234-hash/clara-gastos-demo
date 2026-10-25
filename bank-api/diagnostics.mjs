// Only fixed diagnostic codes cross the browser process boundary.
const stages=new Map([
 ['Abriendo sitio del banco...','OPEN_BANK'],['Ingresando a Mi cuenta...','OPEN_LOGIN'],
 ['Ingresando RUT...','FILL_RUT'],['Ingresando clave...','FILL_PASSWORD'],
 ['Iniciando sesión...','SUBMIT_LOGIN'],['Sesión iniciada correctamente','READ_PRODUCTS'],
 ['Buscando cartola de cuenta...','OPEN_STATEMENT'],['Extrayendo movimientos de cuenta...','READ_STATEMENT'],
 ['Consulta de cuenta finalizada','COMPLETE']
]);
export const progressStage=value=>stages.get(value)||null;
export function diagnosticReason(error){
 const message=String(error?.message||error||'').toLowerCase();
 if(/2fa|segundo factor|clave din[aá]mica|captcha|otp|verificaci[oó]n|bci pass|coordenada/.test(message))return 'REQUIRES_ACTION';
 if(/credencial|incorrect|inv[aá]lid|contrase[nñ]a|clave.*(err[oó]nea|expir|bloque)|acceso.*bloque/.test(message))return 'CREDENTIALS';
 if(/no se encontr[oó] campo de rut/.test(message))return 'RUT_FIELD_MISSING';
 if(/no se encontr[oó] campo de clave/.test(message))return 'PASSWORD_FIELD_MISSING';
 if(/strict mode violation/.test(message))return 'AMBIGUOUS_SELECTOR';
 if(/timeout|tiempo|timed out/.test(message))return 'TIMEOUT';
 if(/err_name_not_resolved|err_connection|err_cert|err_tunnel/.test(message))return 'BANK_NETWORK';
 if(/browser.*closed|target.*closed/.test(message))return 'BROWSER_CLOSED';
 return 'BANK_UNAVAILABLE';
}
