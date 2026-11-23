const root=document.getElementById('workspace');
const key='pep8-layout-v1';
const defaults={code:12,trace:11,history:10,object:11,listing:11,cpu:11,input:12,output:13,terminal:12,memory:11};
let settings={fonts:{},heights:{},columns:[1.8,1,.88]};
try{const s=JSON.parse(localStorage.getItem(key));if(s&&typeof s==='object')settings={...settings,...s,fonts:s.fonts||{},heights:s.heights||{}};}catch{}
const save=()=>{try{localStorage.setItem(key,JSON.stringify(settings));}catch{}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const grips=[];const panels=[['editor','Code / Trace / History',420],['object','Object Code',160],['listing','Listing / Symbols / Stack',200],['cpu','CPU',400],['io','Input / Output',382],['memory','Memory Dump',794]];
const css=document.createElement('style');document.head.append(css);
function applyFonts(){
 const f={};for(const k in defaults)f[k]=clamp(Number(settings.fonts[k])||defaults[k],8,28);
 const rule=(sel,k)=>`${sel}{font-size:${f[k]}px!important;line-height:${Math.ceil(f[k]*1.8)}px!important;}`;
 css.textContent=rule('#editor,#highlight,#gutter','code')+`#gutter{width:${Math.max(45,f.code*4)}px}`+
 rule('.trace-row,.trace-bytes,.trace-source','trace')+rule('.history-scroll table','history')+
 rule('#object','object')+rule('#listing,#symbols,#stack,.symbol-table td,.symbol-table th','listing')+
 rule('.cpu-pane .register-row>span,.cpu-pane .register-row input,.cpu-pane .register-row code,.cpu-pane .ir-row>span,.cpu-pane .ir-row code,.cpu-pane .flag,.cpu-pane .flag button,.cpu-pane .next-instruction','cpu')+
 rule('#stdin','input')+rule('#stdout','output')+rule('#terminalOutput,#terminalInput','terminal')+
 rule('.mem-byte,.mem-addr,.mem-ascii','memory')+
 `.cpu-pane .register-row,.cpu-pane .ir-row{height:auto;min-height:${Math.ceil(f.cpu*1.8)}px}.cpu-pane .register-row input,.cpu-pane .register-row code{height:auto}.mem-row{height:${Math.ceil(f.memory*1.8)+2}px;min-width:${f.memory*24}px}.mem-byte{height:auto}.mem-addr{width:${f.memory*4.5}px}.mem-ascii{width:${f.memory*5}px}.trace-bytes{width:${f.trace*6}px}`;
 const e=document.getElementById('editor');document.getElementById('gutter').scrollTop=e.scrollTop;document.getElementById('highlight').scrollTop=e.scrollTop;
}
const fixed=matchMedia('(min-width:1001px)');
// flex-basis 0 still reserves padding and borders, so ratios are stored for the remaining height only.
const chrome=q=>{const c=getComputedStyle(q);return parseFloat(c.paddingTop)+parseFloat(c.paddingBottom)+parseFloat(c.borderTopWidth)+parseFloat(c.borderBottomWidth);};
const paneId=el=>panels.find(([id])=>el.classList.contains(id+'-pane'))?.[0];
function applyLayout(){
 const c=Array.isArray(settings.columns)&&settings.columns.length===3?settings.columns:[1.8,1,.88];
 c.forEach((n,i)=>root.style.setProperty('--column-'+i,`${clamp(Number(n)||1,.2,8)}fr`));
 // Wide screens: the page is fixed to the window and stored heights act as flex ratios within each column.
 for(const [id,,height] of panels){const p=document.querySelector('.'+id+'-pane'),h=Number(settings.heights[id])||height;if(fixed.matches){p.style.height='';p.style.flex=`${clamp(h,40,4000)} 1 0px`;}else{p.style.flex='';p.style.height=clamp(h,120,2000)+'px';}}
 for(const [g,p] of grips)g.setAttribute('aria-valuenow',Math.round(p.getBoundingClientRect().height));
 for(const h of document.querySelectorAll('.column-resizer'))h.setAttribute('aria-valuenow',Math.round(h.previousElementSibling.getBoundingClientRect().width));
}
function drag(handle,axis,getValue,update,done){
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const start=axis==='x'?e.clientX:e.clientY,value=getValue();handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
 const move=ev=>update(value,(axis==='x'?ev.clientX:ev.clientY)-start);
 const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.classList.remove('dragging');done();};
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 });
}
const dialog=document.createElement('dialog');dialog.className='appearance-dialog';dialog.setAttribute('aria-labelledby','appearanceTitle');dialog.innerHTML=`<form method="dialog"><button class="appearance-close" aria-label="설정 닫기">✕</button></form><h2 id="appearanceTitle">영역별 글자 크기</h2><label>영역 <select id="fontArea"></select></label><div class="font-adjust"><button type="button" id="fontMinus" aria-label="글자 작게">A−</button><input id="fontSize" type="number" min="8" max="28" aria-label="글자 크기"><span>px</span><button type="button" id="fontPlus" aria-label="글자 크게">A+</button></div><button id="fontReset" type="button">이 영역 기본 크기</button><p>각 영역에만 적용되며, 설정은 이 브라우저에 저장됩니다.</p>`;document.body.append(dialog);
const names={code:'Code',trace:'Trace',history:'History',object:'Object Code',listing:'Listing / Symbols / Stack',cpu:'CPU',input:'Input',output:'Output',terminal:'Terminal',memory:'Memory Dump'};
const select=dialog.querySelector('#fontArea'),input=dialog.querySelector('#fontSize');
for(const k in names)select.add(new Option(names[k],k));
function refresh(){input.value=settings.fonts[select.value]||defaults[select.value];}
function setFont(n){settings.fonts[select.value]=clamp(Number(n)||defaults[select.value],8,28);refresh();applyFonts();save();}
select.onchange=refresh;input.onchange=()=>setFont(input.value);input.oninput=()=>{if(input.value&&Number(input.value)>=8&&Number(input.value)<=28)setFont(input.value);};dialog.querySelector('#fontMinus').onclick=()=>setFont(Number(input.value)-1);dialog.querySelector('#fontPlus').onclick=()=>setFont(Number(input.value)+1);dialog.querySelector('#fontReset').onclick=()=>setFont(defaults[select.value]);
for(const [id,name,height] of panels){
 const p=document.querySelector('.'+id+'-pane');
 const head=p.querySelector('.pane-head');if(id==='cpu'){const body=document.createElement('div');body.className='cpu-body';for(const child of [...p.children])if(child!==head)body.append(child);p.append(body);}const b=document.createElement('button');b.className='font-settings';b.textContent='Aa';b.title=name+' 글자 크기';b.setAttribute('aria-label',b.title);head.append(b);
 b.onclick=()=>{select.value=id==='editor'?(document.querySelector('[data-view].active')?.dataset.view||'code'):id==='io'?(document.querySelector('[data-io].active')?.dataset.io==='terminal'?'terminal':'input'):id;refresh();dialog.showModal();};
 const grip=document.createElement('div');grip.className='panel-resizer';grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','horizontal');grip.setAttribute('aria-label',name+' 높이 조절');grip.title='위아래로 드래그 · 방향키로 조절 · 두 번 클릭하면 초기화';grip.setAttribute('aria-valuemin','120');grip.setAttribute('aria-valuemax','2000');grips.push([grip,p]);p.append(grip);
 const nextPane=()=>{let n=p.nextElementSibling;while(n&&!n.classList.contains('pane'))n=n.nextElementSibling;return n;};
 // Fixed layout: a grip only trades height with the pane below it, so the column total never changes.
 const resize=h=>{if(fixed.matches){const n=nextPane();if(!n)return;const a=p.getBoundingClientRect().height,b=n.getBoundingClientRect().height,na=clamp(h,80,a+b-80);for(const q of p.parentElement.querySelectorAll(':scope>.pane')){const k=paneId(q);if(k)settings.heights[k]=q.getBoundingClientRect().height-chrome(q);}settings.heights[id]=na-chrome(p);settings.heights[paneId(n)]=a+b-na-chrome(n);applyLayout();}else{settings.heights[id]=clamp(h,120,2000);p.style.height=settings.heights[id]+'px';}grip.setAttribute('aria-valuenow',Math.round(p.getBoundingClientRect().height));};
 drag(grip,'y',()=>p.getBoundingClientRect().height,(h,dy)=>resize(h+dy),save);
 grip.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resize(p.getBoundingClientRect().height+(e.key==='ArrowDown'?20:-20));save();}};
 grip.ondblclick=()=>{resize(height);save();};
}
const columns=[document.querySelector('.left-column'),document.querySelector('.middle-column'),document.querySelector('.memory-pane')];
for(let i=0;i<2;i++){
 const h=document.createElement('div');h.className='column-resizer col-'+i;h.tabIndex=0;h.setAttribute('role','separator');h.setAttribute('aria-orientation','vertical');h.setAttribute('aria-label',i===0?'Code 열 너비 조절':'CPU 열 너비 조절');h.title='좌우로 드래그 · 방향키로 조절';h.setAttribute('aria-valuemin','240');columns[i].after(h);
 const sizes=()=>columns.map(c=>c.getBoundingClientRect().width);
 const resize=(values,dx)=>{const s=[...values];const a=root.classList.contains('no-cpu')?0:i,b=i+1;const available=s[a]+s[b],first=clamp(s[a]+dx,240,available-240);s[a]=first;s[b]=available-first;const cols=Array.isArray(settings.columns)&&settings.columns.length===3?[...settings.columns]:[1.8,1,.88];cols[a]=s[a]/300;cols[b]=s[b]/300;settings.columns=cols;applyLayout();h.setAttribute('aria-valuenow',Math.round(first));};
 drag(h,'x',sizes,resize,save);h.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();resize(sizes(),e.key==='ArrowRight'?20:-20);save();}};
}
document.querySelector('[data-action="restoreLayout"]').addEventListener('click',()=>{settings={fonts:{},heights:{},columns:[1.8,1,.88]};applyLayout();applyFonts();save();});
applyLayout();applyFonts();
fixed.addEventListener('change',applyLayout);
