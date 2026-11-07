'use strict';
const $=id=>document.getElementById(id),P=Physics;
let discs=[],color='yellow',activeSetup='open',running=false,history=[],lastShot=null,preview=null,aimPoint=null;
let placing=false,dragging=null,mobileView="scoring";
let paths=[],time=0,accumulator=0,lastFrame=0,shotDisc=null,viewMaps={};
const value=id=>Number($(id).value),a=()=>P.deceleration(value('slick')),drift=()=>value('drift')*.00055;
const launch=()=>({x:color==='yellow'?3.55+value('position')*.021:2.45-value('position')*.021,y:1.18});
const moving=d=>!d.out&&Math.hypot(d.vx,d.vy)>.00001;
const createDisc=(x,y,c=color)=>({x,y,color:c,vx:0,vy:0,out:false,id:Math.random().toString(36).slice(2)});
const shot=()=>{const l=launch(),r=value('angle')*Math.PI/180,d=createDisc(l.x,l.y);d.vx=Math.sin(r)*value('speed');d.vy=Math.cos(r)*value('speed');return d;};
const descriptions={open:'An open board. Aim for an 8 and get a feel for your speed.',clear:'Clip the black disc with a firm shot. Try to send both discs off the board.',stpete:'A St. Pete guard is across from the shooter, near the height of the apex. Find the hide behind it.',tampa:'A Tampa guard is near the apex, on the shooter’s side. Try to tuck an 8 behind it.',roll:'A scoring disc and a guard. Experiment with a glancing contact to roll your shooter behind the guard.',kitchen:'Bump the black disc from the 8 toward the kitchen. Too much speed sends it past the baseline.'};
function aimAt(x,y){const l=launch();$('angle').value=Math.max(-12,Math.min(12,Math.atan2(x-l.x,y-l.y)*180/Math.PI)).toFixed(2);aimPoint={x,y};}
function setup(name){
 if(running)return;placing=false;syncPlacement();activeSetup=name;discs=[];history=[];lastShot=null;paths=[];color='yellow';$('position').value=12;$('drift').value=0;
 let x=4.05,y=33.1,travel=0;
 if(name==='clear'){discs=[createDisc(3.9,33.2,'black')];x=4.22;y=33.2;travel=65;}
 if(name==='stpete'){discs=[createDisc(1.5,28.5,'yellow')];$('position').value=95;x=1.48;y=35.7;}
 if(name==='tampa'){discs=[createDisc(3.4,28.5,'yellow')];$('position').value=95;x=4.25;y=33.5;}
 if(name==='roll'){discs=[createDisc(4.1,33.2,'black'),createDisc(1.5,28.5,'yellow')];x=4.38;y=33.2;travel=42;}
 if(name==='kitchen'){discs=[createDisc(4.05,33.3,'black')];x=4.05;y=33.3;travel=37;}
 aimAt(x,y);$('speed').value=Math.sqrt(2*a()*(travel||Math.hypot(x-launch().x,y-launch().y))).toFixed(2);
 document.querySelectorAll('.setup').forEach(b=>{b.classList.toggle('active',b.dataset.setup===name);b.setAttribute('aria-pressed',b.dataset.setup===name);});
 $('setupTip').textContent=descriptions[name];$('result').textContent='Ready when you are.';update();
}
function scores(){let yellow=0,black=0;for(const d of discs)if(!d.out){const s=P.score(d);if(d.color==='yellow')yellow+=s;else black+=s;}$('yellowScore').textContent=yellow;$('blackScore').textContent=black;$('count').textContent=discs.filter(d=>!d.out).length;}
function update(){
 $('positionVal').textContent=`${Math.round(value('position'))}% outside`;
 $('angleVal').textContent=`${value('angle')>0?'+':''}${value('angle').toFixed(2)}°`;
 $('speedVal').textContent=`${value('speed').toFixed(2)} ft/s`;
 $('slickVal').textContent=`${value('slick')} / 100`;
 $('driftVal').textContent=value('drift')===0?'None':`${Math.abs(value('drift'))}% ${value('drift')<0?'left':'right'}`;
 $('distance').textContent=`${(value('speed')**2/(2*a())).toFixed(1)} ft`;
 $('friction').textContent=`${a().toFixed(2)} ft/s²`;
 ['yellow','black'].forEach(c=>{$(c).classList.toggle('selected',color===c);$(c).setAttribute('aria-pressed',color===c);});
 $('undo').disabled=running||!history.length;$('retry').disabled=running||!lastShot;
 $('shoot').disabled=running;$('shoot').innerHTML=running?'Disc in motion…':'Shoot disc <span aria-hidden="true">↗</span>';
 document.querySelectorAll('.controls select,#addBiscuit,.controls input,.controls .setup,.color-picker button,#left,#right,#reset').forEach(el=>el.disabled=running);
 if(!running)preview=P.simulate([...structuredClone(discs.filter(d=>!d.out)),shot()],a(),drift());
 scores();draw();
}
function fire(retry=false){
 if(running)return;
 if(retry&&lastShot){discs=structuredClone(lastShot.discs);paths=[];}
 const before=structuredClone(discs);history.push({discs:before,paths:structuredClone(paths)});lastShot={discs:before};
 shotDisc=shot();discs.push(shotDisc);paths=discs.map((d,i)=>paths[i]?.length?paths[i]:[[d.x,d.y]]);running=true;time=0;accumulator=0;lastFrame=0;
 $('result').textContent='Watch the line and the contact.';update();requestAnimationFrame(animate);
}
function finish(){
 running=false;
 const s=P.score(shotDisc),isShort=!shotDisc.out&&shotDisc.y+P.R<25.5-P.LINE/2;
 for(const d of discs)if(!d.out&&d.y+P.R<25.5-P.LINE/2)d.out=true;
 $('result').textContent=shotDisc.out?(isShort?'Short of the dead line. Disc removed.':'Shooter off the court.'):(s===-10?'Shooter in the kitchen. −10 points.':s>0?`Shooter scores ${s}.`:'Shooter in play, no score.');
 update();
}
function animate(stamp){
 if(!running)return;if(!lastFrame)lastFrame=stamp;
 accumulator+=Math.min((stamp-lastFrame)/1000,.05)*3;lastFrame=stamp;
 while(accumulator>=P.DT){P.step(discs,P.DT,a(),drift());accumulator-=P.DT;time+=P.DT;
  if(Math.round(time/P.DT)%12===0)discs.forEach((d,i)=>{if(!d.out)paths[i].push([d.x,d.y]);});
  if(discs.every(d=>!moving(d))||time>100){finish();return;}
 }
 scores();draw();requestAnimationFrame(animate);
}
function canvasSize(c){const b=c.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);if(c.width!==Math.round(b.width*ratio)||c.height!==Math.round(b.height*ratio)){c.width=Math.round(b.width*ratio);c.height=Math.round(b.height*ratio);}const ctx=c.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,b.width,b.height);return{ctx,w:b.width,h:b.height};}
function render(id,zoom){
 const {ctx,w,h}=canvasSize($(id));if(w<1||h<1)return;
 const vertical=zoom||h>w,yMin=zoom?28:-.5,yMax=39.5,length=yMax-yMin;
 // One scale for both axes preserves court and biscuit proportions.
 const scale=Math.max(.01,vertical?Math.min((w-16)/7,(h-16)/length):Math.min((w-16)/length,(h-16)/7));
 const x0=vertical?(w-6*scale)/2:(w-length*scale)/2-yMin*scale;
 const y0=vertical?(h-length*scale)/2:(h-6*scale)/2;
 const map=(x,y)=>vertical?[x0+x*scale,y0+(yMax-y)*scale]:[x0+y*scale,y0+x*scale];
 viewMaps[id]={map,scale,x0,y0,vertical,yMax};
 if(id==='overview'){
  $(id).setAttribute('aria-label',vertical?'Full court overview. Shots travel from bottom to top.':'Full court overview. Shots travel from left to right.');
  const captions=document.querySelectorAll('.court-caption span');
  captions[0].textContent=vertical?'HEAD ↓ / FOOT ↑':'HEAD / SHOOTING END';
  captions[1].textContent=vertical?'Tap to aim · drag biscuits':'FOOT / SCORING END →';
 }
 const line=(points,stroke='#e5e9cf',width=P.LINE*scale,dash=[])=>{ctx.beginPath();points.forEach((p,i)=>{const q=map(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
 const rect=(x,y,ww,hh,fill)=>{const p=map(x,y),q=map(x+ww,y+hh);ctx.fillStyle=fill;ctx.fillRect(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1]));};
 const text=(str,x,y,size=12,fill='#e3e8ce')=>{const q=map(x,y);ctx.fillStyle=fill;ctx.font=`500 ${size}px 'DM Sans',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(str,...q);};
 // A full-width slab and muted apron: no walls or table-shuffleboard cushions.
 rect(-.16,zoom?28:0,6.32,zoom?11.5:39,'#c7cebd');rect(0,zoom?28:0,6,zoom?11.5:39,'#476d56');
 rect(0,37.5,6,1.5,'#395a48');if(!zoom)rect(0,0,6,1.5,'#395a48');
 ctx.save();const tl=map(-.5,yMax),br=map(6.5,yMin);ctx.beginPath();ctx.rect(Math.min(tl[0],br[0]),Math.min(tl[1],br[1]),Math.abs(br[0]-tl[0]),Math.abs(br[1]-tl[1]));ctx.clip();
 for(let n=0;n<39;n++)line([[0,n],[6,n]],'#ffffff05',.5);
 function triangle(reverse=false){const y=v=>reverse?39-v:v;
  P.diagramLines.forEach(points=>line(points.map(([x,yy])=>[x,y(yy)])));
  const fs=zoom?18:Math.max(7,scale*.55);
  text('10',3,y(30.45),fs);text('8',2.25,y(33),fs);text('8',3.75,y(33),fs);text('7',1.6,y(36),fs);text('7',4.4,y(36),fs);
  if(zoom){text('−10',1.5,y(38.25),15);text('−10',4.5,y(38.25),15);}else{text('−10',1.5,y(38.25),7);text('−10',4.5,y(38.25),7);}
 }
 triangle();if(!zoom)triangle(true);
 line([[0,25.5],[6,25.5]],'#e5e9cf',Math.max(.8,P.LINE*scale));if(!zoom)line([[0,13.5],[6,13.5]],'#e5e9cf',Math.max(.8,P.LINE*scale));
 if(zoom)text('DEAD LINE',3,25.1,8,'#bcccb3');
 if($('trails').checked)paths.forEach((path,i)=>{if(path.length>1)line(path,discs[i]?.color==='black'?'#c3cec399':'#edcb6ea6',zoom?1.8:1.1);});
 if(!running){
  const l=launch(),r=value('angle')*Math.PI/180;
  line([[l.x,l.y],[l.x+Math.sin(r)*48,l.y+Math.cos(r)*48]],'#dce8bd66',zoom?1:1,[4,5]);
  if($('prediction').checked&&preview)preview.paths.forEach((path,i)=>{
   const start=path[0],end=preview.discs[i],isShooter=i===preview.paths.length-1;
   if(!isShooter&&!path.some(p=>Math.hypot(p[0]-start[0],p[1]-start[1])>.005))return;
   const ink=isShooter?'#e3ed9c':end.color==='black'?'#b9dafa':'#ffd17a';
   line(path,ink,zoom?1.8:1.2,[5,5]);
   const q=map(end.x,end.y);ctx.beginPath();ctx.arc(...q,P.R*scale,0,Math.PI*2);ctx.strokeStyle=ink;ctx.lineWidth=1.2;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);
  });
 }
 for(const d of discs){if(d.out)continue;const q=map(d.x,d.y),radius=P.R*scale;
  ctx.shadowColor='#162e3180';ctx.shadowBlur=zoom?5:2;ctx.shadowOffsetY=2;
  ctx.beginPath();ctx.arc(...q,radius,0,Math.PI*2);ctx.fillStyle=d.color==='yellow'?'#edc559':'#202e29';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle=d.color==='yellow'?'#ba9437':'#111f19';ctx.lineWidth=Math.max(1,scale*.025);ctx.stroke();
  ctx.beginPath();ctx.arc(...q,radius*.63,0,Math.PI*2);ctx.strokeStyle=d.color==='yellow'?'#f8df8d':'#53665a';ctx.lineWidth=.8;ctx.stroke();
  if(zoom&&P.score(d))text(String(P.score(d)),d.x,d.y,Math.max(8,scale*.19),d.color==='yellow'?'#5b4a24':'#d5dfd3');
 }
 if(!running&&!zoom){const l=launch(),q=map(l.x,l.y);ctx.beginPath();ctx.arc(...q,P.R*scale,0,Math.PI*2);ctx.fillStyle=color==='yellow'?'#f0cf6a':'#1d2b25';ctx.fill();ctx.strokeStyle='#fff9';ctx.lineWidth=1;ctx.stroke();}
 if(!running&&aimPoint){const q=map(aimPoint.x,aimPoint.y);ctx.strokeStyle='#eef5ba';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,zoom?7:3,0,Math.PI*2);ctx.moveTo(q[0]-(zoom?11:5),q[1]);ctx.lineTo(q[0]+(zoom?11:5),q[1]);ctx.moveTo(q[0],q[1]-(zoom?11:5));ctx.lineTo(q[0],q[1]+(zoom?11:5));ctx.stroke();}
 ctx.restore();
}
function draw(){render('overview',false);render('target',true);}
function courtPoint(event,id){const b=$(id).getBoundingClientRect(),v=viewMaps[id];if(!v)return null;const xx=event.clientX-b.left,yy=event.clientY-b.top;return {x:v.vertical?(xx-v.x0)/v.scale:(yy-v.y0)/v.scale,y:v.vertical?v.yMax-(yy-v.y0)/v.scale:(xx-v.x0)/v.scale};}
function saveArrangement(){history.push({discs:structuredClone(discs),paths:structuredClone(paths)});paths=[];lastShot=null;}
function pointerDown(e,id){if(running)return;const p=courtPoint(e,id);if(!p)return;
 const hit=discs.findLast(d=>!d.out&&Math.hypot(d.x-p.x,d.y-p.y)<=Math.max(P.R,12/viewMaps[id].scale));
 if(hit&&!placing){saveArrangement();dragging={disc:hit,id,dx:hit.x-p.x,dy:hit.y-p.y};$(id).setPointerCapture(e.pointerId);return;}
 if(p.x<-.24||p.x>6.24||p.y<0||p.y>39)return;
 if(placing){if(discs.some(d=>!d.out&&Math.hypot(d.x-p.x,d.y-p.y)<2*P.R)){ $('placementHint').textContent='Choose a space without another biscuit.';return;}saveArrangement();discs.push(createDisc(p.x,p.y,$('addColor').value));placing=false;syncPlacement();update();return;}
 if(p.y>=20){aimAt(p.x,p.y);update();}
}
function syncPlacement(){$('addBiscuit').setAttribute('aria-pressed',placing);$('addBiscuit').textContent=placing?'Cancel placement':'Place on court';$('placementHint').textContent=placing?'Tap the court to place your '+$('addColor').value+' biscuit.':'Choose a color and tap the court to add. Drag any biscuit to move it.';}
$('addBiscuit').onclick=()=>{placing=!placing;syncPlacement();};$('addColor').onchange=syncPlacement;
for(const id of ['overview','target']){
 $(id).addEventListener('pointerdown',e=>pointerDown(e,id));
 $(id).addEventListener('pointermove',e=>{if(!dragging||dragging.id!==id)return;const p=courtPoint(e,id);const x=Math.max(-.24,Math.min(6.24,p.x+dragging.dx)),y=Math.max(0,Math.min(39,p.y+dragging.dy));if(discs.some(d=>d!==dragging.disc&&!d.out&&Math.hypot(d.x-x,d.y-y)<2*P.R))return;Object.assign(dragging.disc,{x,y});update();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(event,()=>{dragging=null;});
}
const tabButtons=[...document.querySelectorAll('[data-tab]')];
function selectTab(n){tabButtons.forEach((b,i)=>{b.setAttribute('aria-pressed',i===n);$('controlPage'+i).classList.toggle('active',i===n);});}
tabButtons.forEach((b,i)=>b.onclick=()=>selectTab(i));
$('toggleControls').onclick=()=>{const hidden=document.body.classList.toggle('controls-hidden');$('toggleControls').setAttribute('aria-expanded',!hidden);$('toggleControls').textContent=hidden?'Show controls':'Hide controls';draw();};
function selectView(full){mobileView=full?'full':'scoring';document.body.classList.toggle('full-view',full);$('fullView').setAttribute('aria-pressed',full);$('scoringView').setAttribute('aria-pressed',!full);draw();}
$('fullView').onclick=()=>selectView(true);$('scoringView').onclick=()=>selectView(false);
for(const id of ['position','angle','speed','slick','drift'])$(id).addEventListener('input',()=>{if(id==='angle'||id==='position')aimPoint=null;update();});
for(const id of ['prediction','trails'])$(id).addEventListener('change',draw);
for(const c of ['yellow','black'])$(c).onclick=()=>{color=c;aimPoint=null;update();};

$('shoot').onclick=()=>fire();$('retry').onclick=()=>fire(true);
$('undo').onclick=()=>{if(!history.length||running)return;const h=history.pop();discs=h.discs;paths=h.paths;$('result').textContent='Shot undone. Adjust and try again.';update();};
$('reset').onclick=()=>setup('open');document.querySelectorAll('[data-setup]').forEach(b=>b.onclick=()=>setup(b.dataset.setup));
function nudge(n){if(running)return;$('angle').value=(Math.min(12,Math.max(-12,value('angle')+n))).toFixed(2);aimPoint=null;update();}
$('left').onclick=()=>nudge(-.05);$('right').onclick=()=>nudge(.05);
document.addEventListener('keydown',e=>{if($('about').open||e.target.matches('input,button,a,select,textarea'))return;
 if(e.code==='Space'){e.preventDefault();fire();}if(e.code==='ArrowLeft'){e.preventDefault();nudge(-.05);}if(e.code==='ArrowRight'){e.preventDefault();nudge(.05);}});
$('aboutBtn').onclick=$('sourcesBtn').onclick=()=>$('about').showModal();$('closeDialog').onclick=()=>$('about').close();$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
new ResizeObserver(draw).observe($('overview'));new ResizeObserver(draw).observe($('target'));setup('open');
