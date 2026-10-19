import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../features/launch-screen-v1.js',import.meta.url),'utf8');
function boot(previous=false,reduced=false){
  let rendered=false,watch,removed=false,reloaded=false;const timers=[],writes=[],classes=new Set(['clara-starting']);
  const label={textContent:''},retry={hidden:true,addEventListener(_,fn){this.click=fn;}},screen={querySelector:s=>s==='button'?retry:label,classList:{add(c){classes.add(c);}},remove(){removed=true;}};
  const root={querySelector:()=>rendered,attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}};
  vm.runInNewContext(source,{document:{getElementById:id=>id==='root'?root:screen,documentElement:{classList:{remove:c=>classes.delete(c)}}},performance:{now:()=>0},matchMedia:()=>({matches:reduced}),localStorage:{getItem:()=>previous?'yes':null,setItem:(...args)=>writes.push(args)},location:{reload(){reloaded=true;}},MutationObserver:class{constructor(fn){watch=fn;}observe(){}disconnect(){}},setTimeout:(fn,delay)=>{const timer={fn,delay};timers.push(timer);return timer;},clearTimeout:t=>{if(t)t.cancelled=true;}});
  return {label,retry,root,writes,timers,classes,render(){rendered=true;watch();},removed:()=>removed,reloaded:()=>reloaded};
}
test('launch stays visible until the main screen exists and changes no financial data',()=>{
  const app=boot();assert.equal(app.timers.length,1);assert.equal(app.writes.length,0);assert.equal(app.root.attributes['aria-busy'],'true');
  app.render();assert.equal(app.timers[0].cancelled,true);assert.equal(app.timers[1].delay,1500);
  app.timers[1].fn();assert.equal(app.root.attributes['aria-busy'],undefined);assert.ok(app.classes.has('launch-finished'));assert.deepEqual(app.writes,[['clara-launched-v1','yes']]);
  app.timers[2].fn();assert.equal(app.removed(),true);
});
test('repeat openings are shorter, reduced motion skips the presentation delay, and slow loading offers retry',()=>{
  const again=boot(true);again.render();assert.equal(again.label.textContent,'Abriendo Clara');assert.equal(again.timers[1].delay,450);
  const reduced=boot(false,true);reduced.render();assert.equal(reduced.timers[1].delay,0);
  const slow=boot();slow.timers[0].fn();assert.equal(slow.retry.hidden,false);assert.match(slow.label.textContent,/conexión/);assert.equal(slow.writes.length,0);slow.retry.click();assert.equal(slow.reloaded(),true);
});
