// Exercise the real application pointer handlers with mouse and emulated-touch
// event shapes, using a minimal DOM/canvas fixture (no browser dependencies).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=[],ids=new Map(),documentListeners={};
function element(tag='div'){
 const el={tagName:tag.toUpperCase(),value:'',dataset:{},style:{},listeners:{},attributes:{},children:[],className:'',width:0,height:0,disabled:false,
  setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},append(b){b.parentElement=this;this.children.push(b);},
  setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:this.id==='overview'?800:500,height:this.id==='overview'?150:600};},
  getContext(){return new Proxy({},{get:()=>()=>{}});},showModal(){this.open=true;},close(){this.open=false;}};
 let id='';Object.defineProperty(el,'id',{get:()=>id,set(v){id=v;ids.set(v,this);}});
 el.classList={add(c){el.className+=' '+c;},remove(c){el.className=el.className.split(/\s+/).filter(x=>x!==c).join(' ');},toggle(c,on){const has=el.className.split(/\s+/).includes(c),next=on??!has;next?this.add(c):this.remove(c);return next;}};
 elements.push(el);return el;
}
const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
for(const m of html.matchAll(/<(\w+)\b([^>]*)>/g)){
 const attrs=m[2],id=attrs.match(/\bid="([^"]+)"/),cls=attrs.match(/\bclass="([^"]+)"/);
 if(!id&&!cls&&!attrs.includes('data-'))continue;const el=element(m[1]);if(id)el.id=id[1];if(cls)el.className=cls[1];
 el.value=attrs.match(/\bvalue="([^"]+)"/)?.[1]??'';
 for(const a of attrs.matchAll(/data-([a-z]+)="([^"]+)"/g))el.dataset[a[1]]=a[2];
 el.parentElement=element('div');
}
const captions=[element('span'),element('span')];
function query(selector){if(selector==='.court-caption span')return captions;if(selector==='[data-tab]')return elements.filter(e=>e.dataset.tab!==undefined);if(selector==='[data-setup]')return elements.filter(e=>e.dataset.setup);
 if(selector==='.setup')return elements.filter(e=>e.className.split(/\s+/).includes('setup'));
 if(selector==='.biscuit-supply')return elements.filter(e=>e.className.includes('biscuit-supply'));return[];}
const document={getElementById:id=>ids.get(id),querySelectorAll:query,createElement:element,body:element('body'),addEventListener(k,fn){(documentListeners[k]??=[]).push(fn);}};
const context=vm.createContext({document,window:{innerWidth:390,devicePixelRatio:1},Physics:require('../dist/physics.js'),structuredClone,Math,ResizeObserver:class{observe(){}},requestAnimationFrame(){}});
vm.runInContext(fs.readFileSync(require.resolve('../dist/app.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);
function point(id,x,y){return run(`viewMaps['${id}'].map(${x},${y})`);}
function event(id,x,y,opts={}){const [clientX,clientY]=point(id,x,y);return {clientX,clientY,pointerId:10,pointerType:'touch',button:-1,isPrimary:false,preventDefault(){},...activePointer,...opts};}
function send(id,type,e){for(const fn of ids.get(id).listeners[type]??[])fn(e);}
let activePointer={};
for(const end of ['head','foot'])for(const pointer of [{pointerType:'touch',button:0,isPrimary:true},{pointerType:'touch',button:-1,isPrimary:false},{pointerType:'mouse',button:0,isPrimary:false}]){
 activePointer=pointer;
 run(`selectShootingEnd('${end}');setup('open')`);
 const blackStart=point('overview',1.5,1.18),yellowStart=point('overview',4.5,1.18);
 assert.ok(yellowStart[1]>blackStart[1],'Full court keeps yellow below black at both shooting ends');
 assert.ok(parseFloat(ids.get('overviewSupplyyellow').style.top)>parseFloat(ids.get('overviewSupplyblack').style.top),'Full-court supplies keep yellow below black');
 const a=event('target',4,34);send('target','pointerdown',a);
 assert.equal(run('aimPoint.x'),4);assert.ok(Math.abs(run('aimPoint.y')-34)<1e-8,'Emulated touch sets a target');
 const bank=ids.get('targetSupplyyellow');send(bank.id,'pointerdown',event('target',7,26));
 assert.equal(run('dragging.kind'),'supply');
 send(bank.id,'pointermove',event('target',4.5,35));send(bank.id,'pointerup',event('target',4.5,35));
 assert.equal(run('discs.length'),1,'Touch drop places biscuit');assert.equal(run('dragging'),null);
 send('target','pointerdown',event('target',4.5,35));assert.equal(run('dragging.kind'),'disc');
 send('target','pointermove',event('target',4,36,{pointerId:11}));assert.equal(run('discs[0].y'),35,'Second touch cannot take over');
 send('target','pointermove',event('target',4,36));send('target','pointerup',event('target',4,36));assert.equal(run('discs[0].y'),36);
 const p0=JSON.stringify(run('aimPoint'));send('target','pointerdown',event('target',2,32,{pointerType:'mouse',button:2,isPrimary:true}));assert.equal(JSON.stringify(run('aimPoint')),p0,'Mouse right click is ignored');
 const blackLeft=parseFloat(ids.get('targetSupplyblack').style.left),yellowLeft=parseFloat(ids.get('targetSupplyyellow').style.left);
 assert.ok(end==='head'?blackLeft<yellowLeft:yellowLeft<blackLeft,'Scoring-view supplies swap sides');
 const initial=run('launch()');send('overview','pointerdown',event('overview',initial.x,initial.y));assert.equal(run('dragging.kind'),'shooter');
 send('overview','pointermove',event('overview',5,.8));send('overview','pointerup',event('overview',5,.8));assert.ok(run("value('position')")>50);
}
console.log('PASS: touch target placement, supply drops, biscuit/shooter drags, pointer ownership, secondary-click rejection, and Head/Foot supply sides.');

run("selectShootingEnd('head');setup('open');discs=[createDisc(4.2,33,'yellow')];discs[0].vx=.3;discs[0].vy=.8;paths=[[[4.2,33],[4.4,34]]];selectShootingEnd('foot');");
assert.equal(run('discs[0].x'),4.2);assert.equal(run('discs[0].y'),6);assert.equal(run('discs[0].vx'),.3);assert.equal(run('discs[0].vy'),-.8);
assert.equal(run('paths[0][0][0]'),4.2);assert.equal(run('paths[0][0][1]'),6);
console.log('PASS: full-court colors remain fixed; end changes preserve physical cross-court positions and velocities.');
