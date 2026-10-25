import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
function key(value){const k=Buffer.from(value||'','base64');if(k.length!==32)throw Error('VAULT_NOT_CONFIGURED');return k;}
export function sealCredentials(value,masterKey,userId,connectionId){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(masterKey),iv);
 cipher.setAAD(Buffer.from('clara-bank-v1:'+userId+':'+connectionId));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function openCredentials(envelope,masterKey,userId,connectionId){
 const [version,nonce,tag,ciphertext,...extra]=String(envelope).split('.');
 if(version!=='v1'||!nonce||!tag||!ciphertext||extra.length)throw Error('INVALID_VAULT');
 const iv=Buffer.from(nonce,'base64url'),authTag=Buffer.from(tag,'base64url');
 if(iv.length!==12||authTag.length!==16)throw Error('INVALID_VAULT');
 const cipher=createDecipheriv('aes-256-gcm',key(masterKey),iv);
 cipher.setAAD(Buffer.from('clara-bank-v1:'+userId+':'+connectionId));cipher.setAuthTag(authTag);
 return JSON.parse(Buffer.concat([cipher.update(Buffer.from(ciphertext,'base64url')),cipher.final()]).toString('utf8'));
}
export function validMasterKey(value){try{key(value);return true;}catch{return false;}}
