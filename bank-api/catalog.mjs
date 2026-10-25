export const banks = [
  {id:'falabella',name:'Banco Falabella',status:'beta'},
  {id:'bchile',name:'Banco de Chile',status:'beta'},
  {id:'santander',name:'Santander',status:'beta'},
  {id:'bci',name:'BCI',status:'beta'},
  {id:'bestado',name:'BancoEstado / CuentaRUT',status:'beta'},
  {id:'itau',name:'Itaú',status:'beta'},
  {id:'scotiabank',name:'Scotiabank',status:'beta'},
  {id:'bice',name:'BICE',status:'beta'},
  {id:'edwards',name:'Banco Edwards',status:'beta'}
];
export const bankById = id => banks.find(b=>b.id===id);
export const CONSENT_VERSION='clara-bank-readonly-2026-10-v1';
