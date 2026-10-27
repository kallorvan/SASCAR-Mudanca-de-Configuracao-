/* Layout Base · Grupo Dínamo / Tóliman — comportamento comum dos painéis */
const NAVY="#112346",ACC="#E4536C",PLUM="#8E5AA8",STEEL="#98A6BC",YARD="#4C6493",GOOD="#2E7D52";
const MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES3=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const g=id=>document.getElementById(id);
const nf=n=>new Intl.NumberFormat('pt-BR').format(Math.round(n));
const n1=n=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

/* tooltip: cria o #tip se a página não tiver */
let tip=g('tip');
if(!tip){tip=el('div');tip.id='tip';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');document.body.appendChild(tip)}
function bindTip(node,html){
  node.addEventListener('mouseenter',()=>{tip.innerHTML=typeof html==='function'?html():html;tip.style.opacity=1});
  node.addEventListener('mousemove',e=>{const w=tip.offsetWidth,h=tip.offsetHeight;
    tip.style.left=Math.min(e.clientX+16,innerWidth-w-12)+'px';
    tip.style.top=Math.max(10,e.clientY-h-14)+'px'});
  node.addEventListener('mouseleave',()=>tip.style.opacity=0);
}

/* grupo de botões .modes: marca o clicado e chama cb(valor) */
function modes(box,itens,atual,cb){
  box.innerHTML='';
  itens.forEach(([v,rot])=>{const b=el('button',null,rot);b.type='button';b.dataset.v=v;
    b.setAttribute('aria-pressed',String(v)===String(atual));
    b.onclick=()=>{box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));cb(v)};
    box.appendChild(b)});
}

/* barras horizontais .bar-row: dados=[{nm,sub,v,cls}] */
function barras(box,dados,{fmt=nf,max}={}){
  const m=max||Math.max(...dados.map(d=>d.v),1);
  box.innerHTML='';
  dados.forEach(d=>{const r=el('div','bar-row',
    `<div class="nm">${esc(d.nm)}${d.sub?`<small>${esc(d.sub)}</small>`:''}</div>`+
    `<div class="track"><s class="${d.cls||'s20'}" style="width:${d.v/m*100}%"></s></div>`+
    `<div class="vl">${fmt(d.v)}${d.pc!=null?`<em>${n1(d.pc)}%</em>`:''}</div>`);
    if(d.tip)bindTip(r,d.tip);box.appendChild(r)});
}

/* topo fixo que encolhe ao rolar + entrada suave dos cards */
(function(){
  const bar=g('stickytop');
  if(bar){const medir=()=>document.documentElement.style.setProperty('--stickyh',bar.offsetHeight+'px');
    addEventListener('scroll',()=>{bar.classList.toggle('scrolled',scrollY>8);medir()},{passive:true});
    addEventListener('resize',medir);medir()}
})();
function reveal(sel='section .card, .cx-card, .sh-eras, .kpis'){
  if(!('IntersectionObserver' in window))return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.05});
  document.querySelectorAll(sel).forEach(n=>{if(!n.classList.contains('reveal')){n.classList.add('reveal');io.observe(n)}});
}
