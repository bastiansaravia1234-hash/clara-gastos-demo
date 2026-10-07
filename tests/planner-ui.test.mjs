import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanner} from '../features/planner.mjs';
function harness() {
  let state=[],cursor=0,data={version:1,accounts:[{id:'a',name:'Mi cuenta',opening:100000,scope:'Personal'}],transactions:[],goals:[],activities:[]};
  const React={createElement:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity).filter(Boolean)}),useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>state[index]=value];},useEffect(){}};
  const Component=createPlanner(React);
  return {render(){cursor=0;return Component({data,onChange:updater=>data=updater(data),month:'2026-10',scope:'Personal',categories:['Alimentación','Gastos de casa']});},data:()=>data};
}
function nodes(tree) {return [tree,...tree.children.filter(c=>typeof c==='object').flatMap(nodes)];}
function text(tree){return tree.children.map(c=>typeof c==='object'?text(c):String(c)).join('');}
function find(tree,predicate){const node=nodes(tree).find(predicate);assert.ok(node,'Expected element exists');return node;}
test('Planner UI mounts with existing data and keeps labels and submit actions available',()=>{
  const tree=harness().render();assert.ok(find(tree,n=>n.tag==='input'&&n.props.name==='limit'));assert.ok(find(tree,n=>n.tag==='input'&&n.props.name==='amount'));assert.match(text(tree),/Guardar presupuesto/);assert.match(text(tree),/Sin vencimientos/);
});
test('Budget and pending payment forms update the same app state and payment confirmation creates a transaction',()=>{
  const original=globalThis.FormData;
  globalThis.FormData=class{constructor(values){this.values=values;}get(name){return this.values[name]??null;}};
  try {
    const app=harness();let tree=app.render();
    find(tree,n=>n.tag==='form'&&nodes(n).some(c=>c.props?.name==='limit')).props.onSubmit({preventDefault(){},currentTarget:{limit:'50.000',reserve:'10.000'}});
    assert.equal(app.data().planner.budgets['2026-10|Personal'].limit,50000);
    tree=app.render();find(tree,n=>n.tag==='form'&&nodes(n).some(c=>c.props?.name==='title')).props.onSubmit({preventDefault(){},currentTarget:{title:'Luz',amount:'30.000',date:'2026-10-07',accountId:'a',category:'Gastos de casa',repeat:'on',reset(){}}});
    assert.equal(app.data().planner.bills[0].amount,30000);assert.equal(app.data().transactions.length,0);
    tree=app.render();find(tree,n=>n.tag==='button'&&text(n)==='Registrar pago').props.onClick();
    tree=app.render();find(tree,n=>n.tag==='form'&&n.props['aria-label']==='Registrar pago de Luz').props.onSubmit({preventDefault(){},currentTarget:{paidDate:'2026-10-07'}});
    assert.equal(app.data().transactions.length,1);assert.equal(app.data().transactions[0].amount,30000);
    assert.match(text(app.render()),/Registrado/);
  } finally {globalThis.FormData=original;}
});
