(() => {
  const screen=document.getElementById('clara-launch'),root=document.getElementById('root');
  if(!screen||!root)return;
  const label=screen.querySelector('[data-launch-status]'),retry=screen.querySelector('button');
  const started=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let first=true,finished=false,timer;
  try{first=localStorage.getItem('clara-launched-v1')!=='yes';}catch{}
  label.textContent=first?'Preparando tu espacio':'Abriendo Clara';
  root.setAttribute('aria-busy','true');
  function ready(){
    if(finished||!root.querySelector('main'))return;
    finished=true;observer.disconnect();clearTimeout(timer);
    const remaining=Math.max(0,(reduced?0:first?1500:450)-(performance.now()-started));
    setTimeout(()=>{
      try{localStorage.setItem('clara-launched-v1','yes');}catch{}
      root.removeAttribute('aria-busy');screen.classList.add('launch-finished');
      document.documentElement.classList.remove('clara-starting');
      setTimeout(()=>screen.remove(),reduced?0:400);
    },remaining);
  }
  const observer=new MutationObserver(ready);
  observer.observe(root,{childList:true,subtree:true});
  retry.addEventListener('click',()=>location.reload());
  timer=setTimeout(()=>{
    if(finished)return;
    screen.classList.add('launch-slow');
    label.textContent='Está tardando más de lo esperado. Revisa tu conexión y vuelve a intentar.';
    retry.hidden=false;
  },15000);
  ready();
})();
