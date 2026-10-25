// A separate, short-lived process and fresh browser for each bank consultation.
// Credentials arrive over IPC, never via command arguments, URLs, or files.
import {getBank} from './vendor/banking.mjs';
process.once('message',async({bankId,credentials})=>{
 try{
  const bank=getBank(bankId);if(!bank)throw Error('Banco no disponible');
  const result=await bank.scrape({...credentials,chromePath:process.env.CHROME_PATH,saveScreenshots:false,headful:false,skipCreditCards:true});
  credentials.password='';
  // Do not send screenshot, debug log, HTML, cookies, or login data to the API.
  process.send?.({success:result.success,accounts:result.accounts,balance:result.balance,movements:result.movements,error:result.error});
 }catch(error){process.send?.({success:false,error:String(error.message||'BANK_UNAVAILABLE').slice(0,250)});}
 finally{process.disconnect?.();setTimeout(()=>process.exit(0),50).unref();}
});
