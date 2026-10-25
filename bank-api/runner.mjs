// A separate, short-lived process and fresh browser for each bank consultation.
// Credentials arrive over IPC, never via command arguments, URLs, or files.
import {getBank} from './vendor/banking.mjs';
import {progressStage,diagnosticReason} from './diagnostics.mjs';
process.once('message',async({bankId,credentials})=>{
 let stage='LAUNCH_BROWSER';
 try{
  const bank=getBank(bankId);if(!bank)throw Error('Banco no disponible');
  const result=await bank.scrape({...credentials,chromePath:process.env.CHROME_PATH,saveScreenshots:false,headful:false,skipCreditCards:true,onProgress:value=>{const next=progressStage(value);if(next)stage=next;}});
  credentials.password='';
  // Do not send screenshot, debug log, HTML, cookies, or login data to the API.
  process.send?.({success:result.success,accounts:result.accounts,balance:result.balance,movements:result.movements,error:result.success?undefined:diagnosticReason(result.error),stage});
 }catch(error){process.send?.({success:false,error:diagnosticReason(error),stage});}
 finally{process.disconnect?.();setTimeout(()=>process.exit(0),50).unref();}
});
