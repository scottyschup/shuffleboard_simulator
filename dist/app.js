'use strict';
const $=id=>document.getElementById(id),P=Physics;
let discs=[],color='yellow',activeSetup='open',running=false,history=[],redoHistory=[],lastShot=null,preview=null,aimPoint=null;
let dragging=null,mobileView="full",launchY=1.18,shootingEnd="head";
let paths=[],time=0,accumulator=0,lastFrame=0,shotDisc=null,viewMaps={};
const value=id=>Number($(id).value),a=()=>P.deceleration(value('slick')),drift=()=>value('drift')*.00055;
const launch=()=>P.startingPoint(color,value('position'),launchY);
const moving=d=>!d.out&&Math.hypot(d.vx,d.vy)>.00001;
const createDisc=(x,y,c=color)=>({x,y,color:c,vx:0,vy:0,out:false,id:Math.random().toString(36).slice(2)});
const accuracy=id=>String($(id).value).trim()!==''&&Number.isFinite(value(id))?Math.max(0,Math.min(100,value(id))):95;
const aimDistance=()=>{const l=launch();return aimPoint?Math.hypot(aimPoint.x-l.x,aimPoint.y-l.y):(33.1-l.y)/Math.cos(value('angle')*Math.PI/180);};
const shot=(randomize=false)=>{
 const l=launch(),distance=aimDistance(),speed=randomize?P.applyAccuracy(value('speed'),accuracy('speedAccuracy')):value('speed');
 const stats=P.aimStats(accuracy('aimAccuracy'),speed,distance);
 const angle=randomize?P.sampleAim(value('angle'),accuracy('aimAccuracy'),speed,distance):value('angle');
 const r=angle*Math.PI/180,d=createDisc(l.x,l.y);d.vx=Math.sin(r)*speed;d.vy=Math.cos(r)*speed;d.launchAngle=angle;d.launchSpeed=speed;d.aimSigma=stats.sigmaDeg;return d;
};
const descriptions={open:'An open board. Aim for an 8 and get a feel for your speed.',clear:'Clip the black disc with a firm shot. Try to send both discs off the board.',stpete:'A St. Pete guard is across from the shooter, near the height of the apex. Find the hide behind it.',tampa:'A Tampa guard is near the apex, on the shooter’s side. Try to tuck an 8 behind it.',kitchen:'Bump the black disc from the 8 toward the kitchen. Too much speed sends it past the baseline.'};
function aimAt(x,y,setSpeed=false){
 const l=launch(),solution=setSpeed?P.targetShot(l,{x,y},a(),drift()):{angle:Math.atan2(x-l.x,y-l.y)*180/Math.PI};
 $('angle').value=Math.max(-20,Math.min(20,solution.angle)).toFixed(2);
 if(setSpeed)$('speed').value=Math.max(1,Math.min(18,solution.speed)).toFixed(2);
 aimPoint={x,y};
}
function setup(name){
 const [kind,guardColor='yellow']=name.split('-');
 if(running)return;dragging=null;activeSetup=name;discs=[];history=[];redoHistory=[];lastShot=null;paths=[];color='yellow';launchY=1.18;$('position').value=12;$('drift').value=0;
 let x=4.05,y=33.1,travel=0;
 if(kind==='clear'){discs=[createDisc(3.9,33.2,'black')];x=4.22;y=33.2;travel=65;}
 if(kind==='stpete'){color=guardColor;discs=[createDisc(color==='black'?4.5:1.5,28.5,color)];$('position').value=95;x=1.48;y=35.7;}
 if(kind==='tampa'){color=guardColor;discs=[createDisc(color==='black'?2.6:3.4,28.5,color)];$('position').value=95;x=4.25;y=33.5;}
 if(kind==='kitchen'){discs=[createDisc(4.05,33.3,'black')];x=4.05;y=33.3;travel=37;}
 if((kind==='stpete'||kind==='tampa')&&color==='black')x=6-x;
 aimAt(x,y);$('speed').value=Math.sqrt(2*a()*(travel||Math.hypot(x-launch().x,y-launch().y))).toFixed(2);
 document.querySelectorAll('.setup').forEach(b=>{b.classList.toggle('active',b.dataset.setup===name);b.setAttribute('aria-pressed',b.dataset.setup===name);});
 $('setupTip').textContent=descriptions[kind];$('result').textContent='Ready when you are.';update();
}
function scores(){P.collectOffCourt(discs);let yellow=0,black=0;for(const d of discs)if(!d.out){const s=P.score(d);if(d.color==='yellow')yellow+=s;else black+=s;}$('yellowScore').textContent=yellow;$('blackScore').textContent=black;$('count').textContent=discs.length;}
function update(){
 $('angleVal').textContent=`${value('angle')>0?'+':''}${value('angle').toFixed(2)}°`;
 $('speedVal').textContent=`${value('speed').toFixed(2)} ft/s`;
 $('slickVal').textContent=`${value('slick')} / 100`;
 const spread=P.aimStats(accuracy('aimAccuracy'),value('speed'),aimDistance());
 $('aimSpread').textContent=`σ ${spread.sigmaDeg.toFixed(2)}° · miss ${(100*spread.missChance).toFixed(1)}%`;
 $('aimSpread').setAttribute('aria-label',`Aim standard deviation ${spread.sigmaDeg.toFixed(2)} degrees. Estimated miss rate ${(100*spread.missChance).toFixed(1)} percent for a virtual six-inch target biscuit at the selected range, without drift or other collisions.`);
 $('driftVal').textContent=value('drift')===0?'None':`${Math.abs(value('drift'))}% ${value('drift')<0?'left':'right'}`;
 $('distance').textContent=`${(value('speed')**2/(2*a())).toFixed(1)} ft`;
 $('friction').textContent=`${a().toFixed(2)} ft/s²`;
 ['yellow','black'].forEach(c=>{$(c).classList.toggle('selected',color===c);$(c).setAttribute('aria-pressed',color===c);});
 for(const end of ['head','foot']){$(end+'End').setAttribute('aria-pressed',shootingEnd===end);$(end+'End').disabled=running||!!dragging;}
 $('scoringHeading').textContent=shootingEnd==='head'?'The scoring end · Foot':'The scoring end · Head';
 $('target').setAttribute('aria-label',`${shootingEnd==='head'?'Foot':'Head'} scoring end. Click to set aim and launch speed, or drag biscuits.`);
 $('undo').disabled=running||!history.length;$('retry').disabled=running||!redoHistory.length;
 const canShoot=P.remainingBiscuits(discs,color)>0;
 $('shoot').disabled=running||!canShoot;$('shoot').textContent='Shoot disc';$('shoot').title=canShoot?'Shoot the queued biscuit':'All four '+color+' biscuits are used';
 document.querySelectorAll('.controls select,.controls input,.controls .setup,.color-picker button,#left,#right,#speedDown,#speedUp,#reset').forEach(el=>el.disabled=running);
 if(!running&&canShoot)preview=P.simulate([...structuredClone(discs.filter(d=>!d.out)),shot()],a(),drift());
 if(!running&&!canShoot)preview=null;
 scores();draw();
}
function fire(retry=false){
 if(running||dragging)return;
 if(retry&&lastShot){restoreShot(lastShot);paths=[];}
 if(P.remainingBiscuits(discs,color)===0){update();return;}
 const before=snapshot();history.push(before);redoHistory=[];lastShot=structuredClone(before);
 for(const id of ['aimAccuracy','speedAccuracy'])$(id).value=accuracy(id).toFixed(2);
 shotDisc=shot(true);discs.push(shotDisc);paths=discs.map((d,i)=>paths[i]?.length?paths[i]:[[d.x,d.y]]);running=true;time=0;accumulator=0;lastFrame=0;
 $('result').textContent=shotDisc.aimSigma>0||accuracy('speedAccuracy')<100?`Actual launch: ${shotDisc.launchSpeed.toFixed(2)} ft/s · ${shotDisc.launchAngle.toFixed(2)}°.`:'Watch the line and the contact.';update();requestAnimationFrame(animate);
}
function finish(){
 running=false;
 const s=P.score(shotDisc),isShort=!shotDisc.out&&shotDisc.y+P.R<25.5-P.LINE/2;
 for(const d of discs)if(!d.out&&d.y+P.R<25.5-P.LINE/2)d.out=true;
 $('result').textContent=shotDisc.out?(isShort?'Short of the dead line. Biscuit collected.':'Shooter collected behind the kitchen.'):(s===-10?'Shooter in the kitchen. −10 points.':s>0?`Shooter scores ${s}.`:'Shooter in play, no score.');
 if(shotDisc.aimSigma>0||accuracy('speedAccuracy')<100)$('result').textContent+=` Actual: ${shotDisc.launchSpeed.toFixed(2)} ft/s · ${shotDisc.launchAngle.toFixed(2)}°.`;
 color=color==='yellow'?'black':'yellow';
 if(aimPoint)aimAt(aimPoint.x,aimPoint.y,true);
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
 const transverse=8,padding=16;
 const mirrorX=zoom&&shootingEnd==='foot',reverse=!zoom&&shootingEnd==='foot',vertical=(zoom?h>w/1.4:h>w),yMin=zoom?24.75:reverse?-2.25:-.5,yMax=reverse?39.5:41.25,length=yMax-yMin;
 // One scale for both axes preserves court and biscuit proportions.
 const scale=Math.max(.01,vertical?Math.min((w-padding)/transverse,(h-16)/length):Math.min((w-16)/length,(h-padding)/transverse));
 const x0=vertical?(w-6*scale)/2:(w-length*scale)/2-yMin*scale;
 const y0=vertical?(h-length*scale)/2:(h-6*scale)/2;
 const map=(x,y)=>{if(mirrorX)x=6-x;if(reverse)y=39-y;return vertical?[x0+x*scale,y0+(yMax-y)*scale]:[x0+y*scale,y0+x*scale];};
 viewMaps[id]={map,scale,x0,y0,vertical,yMax,reverse,mirrorX};
 for(const c of ['black','yellow']){
  const left=P.remainingBiscuits(discs,c,running?null:color);
  for(let slot=0;slot<4;slot++){
   const b=$(id+'Supply'+c+(slot||'')),q=map(c==='black'?-.65:6.65,25.7+slot*Math.min(3.7,Math.max(.7,26/scale)));
   b.hidden=slot>=left;b.disabled=running||slot>=left;
   b.style.left=q[0]+'px';b.style.top=q[1]+'px';
   b.style.setProperty('--disc-size',2*P.R*scale+'px');b.style.setProperty('--hit-size',Math.max(24,2*P.R*scale)+'px');
   b.setAttribute('aria-label',`${c==='black'?'Black':'Yellow'} remaining biscuit ${slot+1} of ${left}. Drag onto court.`);
   b.title='Drag a '+c+' biscuit onto the court';
  }
 }
 if(id==='overview'){
  const from=shootingEnd==='head'?'Head':'Foot',to=shootingEnd==='head'?'Foot':'Head';
  $(id).setAttribute('aria-label',`Full court overview. Shooting from ${from} toward ${to}. Drag the queued biscuit at the shooting end; click the opposite starting side to switch color.`);
  const captions=document.querySelectorAll('.court-caption span');
  captions[0].textContent=vertical?`HEAD ↓ / FOOT ↑ · SHOOT FROM ${from.toUpperCase()}`:`HEAD / ${shootingEnd==='head'?'SHOOTING':'SCORING'} END`;
  captions[1].textContent=vertical?'Tap to aim · drag biscuits':`FOOT / ${shootingEnd==='foot'?'SHOOTING':'SCORING'} END ${shootingEnd==='head'?'→':'←'}`;
 }
 const line=(points,stroke='#e5e9cf',width=P.LINE*scale,dash=[])=>{ctx.beginPath();points.forEach((p,i)=>{const q=map(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
 const rect=(x,y,ww,hh,fill)=>{const p=map(x,y),q=map(x+ww,y+hh);ctx.fillStyle=fill;ctx.fillRect(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1]));};
 const text=(str,x,y,size=12,fill='#e3e8ce')=>{const q=map(x,y);ctx.fillStyle=fill;ctx.font=`500 ${size}px 'DM Sans',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(str,...q);};
 // A full-width slab and muted apron: no walls or table-shuffleboard cushions.
 rect(-.16,zoom?24.75:0,6.32,zoom?14.25:39,'#c7cebd');rect(0,zoom?24.75:0,6,zoom?14.25:39,'#476d56');
 rect(0,39.15,6,1.85,'#dce3d4');text('COLLECTED',3,40.7,zoom?9:6,'#637568');
 rect(0,37.5,6,1.5,'#395a48');if(!zoom)rect(0,0,6,1.5,'#395a48');
 ctx.save();const tl=map(-.5,41.25),br=map(6.5,zoom?24.75:-.5);ctx.beginPath();ctx.rect(Math.min(tl[0],br[0]),Math.min(tl[1],br[1]),Math.abs(br[0]-tl[0]),Math.abs(br[1]-tl[1]));ctx.clip();
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
 for(const d of discs){if(d.out&&!d.parked)continue;const q=map(d.x,d.y),radius=P.R*scale;
  ctx.shadowColor='#162e3180';ctx.shadowBlur=zoom?5:2;ctx.shadowOffsetY=2;
  ctx.beginPath();ctx.arc(...q,radius,0,Math.PI*2);ctx.fillStyle=d.color==='yellow'?'#edc559':'#202e29';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle=d.color==='yellow'?'#ba9437':'#111f19';ctx.lineWidth=Math.max(1,scale*.025);ctx.stroke();
  ctx.beginPath();ctx.arc(...q,radius*.63,0,Math.PI*2);ctx.strokeStyle=d.color==='yellow'?'#f8df8d':'#53665a';ctx.lineWidth=.8;ctx.stroke();
  if(zoom&&P.score(d))text(String(P.score(d)),d.x,d.y,Math.max(8,scale*.19),d.color==='yellow'?'#5b4a24':'#d5dfd3');
 }
 if(!running&&!zoom){const l=launch(),q=map(l.x,l.y);ctx.beginPath();ctx.arc(...q,P.R*scale,0,Math.PI*2);ctx.fillStyle=P.remainingBiscuits(discs,color)===0?'#9aa19b':color==='yellow'?'#f0cf6a':'#1d2b25';ctx.fill();ctx.strokeStyle='#fff9';ctx.lineWidth=1;ctx.stroke();}
 if(!running&&aimPoint){const q=map(aimPoint.x,aimPoint.y);ctx.strokeStyle='#eef5ba';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,zoom?7:3,0,Math.PI*2);ctx.moveTo(q[0]-(zoom?11:5),q[1]);ctx.lineTo(q[0]+(zoom?11:5),q[1]);ctx.moveTo(q[0],q[1]-(zoom?11:5));ctx.lineTo(q[0],q[1]+(zoom?11:5));ctx.stroke();}
 ctx.restore();
 if(dragging?.kind==='supply'&&dragging.id===id&&dragging.point){
  const p=dragging.point,q=map(p.x,p.y);ctx.beginPath();ctx.arc(...q,P.R*scale,0,2*Math.PI);ctx.fillStyle=dragging.color==='yellow'?'#edc559':'#202e29';ctx.globalAlpha=.8;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=canDrop(p)?'#b7d69e':'#b75239';ctx.lineWidth=2;ctx.stroke();
 }
}
function draw(){render('overview',false);render('target',true);}
function courtPoint(event,id){const b=$(id).getBoundingClientRect(),v=viewMaps[id];if(!v)return null;const xx=event.clientX-b.left,yy=event.clientY-b.top;const p={x:v.vertical?(xx-v.x0)/v.scale:(yy-v.y0)/v.scale,y:v.vertical?v.yMax-(yy-v.y0)/v.scale:(xx-v.x0)/v.scale};if(v.mirrorX)p.x=6-p.x;if(v.reverse)p.y=39-p.y;return p;}
function snapshot(){return{discs:structuredClone(discs),paths:structuredClone(paths),color,aimPoint:aimPoint?{...aimPoint}:null,angle:value('angle'),speed:value('speed'),position:value('position'),launchY,shootingEnd,aimAccuracy:accuracy('aimAccuracy'),speedAccuracy:accuracy('speedAccuracy')};}
function restoreShot(state){discs=structuredClone(state.discs);paths=structuredClone(state.paths);color=state.color;shootingEnd=state.shootingEnd;launchY=state.launchY;aimPoint=state.aimPoint?{...state.aimPoint}:null;for(const id of ['angle','speed','position'])$(id).value=state[id];for(const id of ['aimAccuracy','speedAccuracy'])$(id).value=state[id].toFixed(2);}
function saveArrangement(){history.push(snapshot());redoHistory=[];paths=[];lastShot=null;}
function canDrop(p,except=null){return p&&p.x>=-.24&&p.x<=6.24&&p.y>=0&&p.y<=39&&!discs.some(d=>d!==except&&!d.out&&Math.hypot(d.x-p.x,d.y-p.y)<2*P.R);}
function selectShootingEnd(next){
 if(running||dragging||next===shootingEnd)return;
 history.push(snapshot());redoHistory=[];
 discs.forEach(d=>{Object.assign(d,P.reversePoint(d));d.vy=-d.vy;});
 paths=paths.map(path=>path.map(([x,y])=>{const p=P.reversePoint({x,y});return[p.x,p.y];}));
 shootingEnd=next;lastShot=null;aimPoint=null;activeSetup='custom';
 document.querySelectorAll('.setup').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
 $('angle').value=0;$('speed').value=Math.sqrt(2*a()*(33.1-launch().y)).toFixed(2);
 $('result').textContent=`Ready to shoot from the ${next==='head'?'Head toward the Foot':'Foot toward the Head'}.`;
 update();
}
$('headEnd').onclick=()=>selectShootingEnd('head');$('footEnd').onclick=()=>selectShootingEnd('foot');
function positionShooter(x,y){const next=P.startingPosition(color,x,y);launchY=next.y;$('position').value=next.position;if(aimPoint)aimAt(aimPoint.x,aimPoint.y,true);update();}
function switchShooter(next){if(running)return;color=next;if(aimPoint)aimAt(aimPoint.x,aimPoint.y,true);update();}
function isSecondaryPointer(e){return e.pointerType!=='touch'&&e.button>0;}
function pointerDown(e,id){if(isSecondaryPointer(e)||running||dragging)return;e.preventDefault();const p=courtPoint(e,id);if(!p)return;
 if(id==='overview'&&p.x>=0&&p.x<=6&&p.y>=0&&p.y<=1.5){
  const side=p.x<3?'black':'yellow';
  if(side!==color){switchShooter(side);positionShooter(p.x,p.y);return;}
  const l=launch();
  if(P.remainingBiscuits(discs,color)>0&&Math.hypot(l.x-p.x,l.y-p.y)<=Math.max(P.R,14/viewMaps[id].scale)){
   dragging={kind:'shooter',id,pointerId:e.pointerId,dx:l.x-p.x,dy:l.y-p.y,before:snapshot()};$(id).setPointerCapture(e.pointerId);return;
  }
 }

 const hit=discs.findLast(d=>(!d.out||d.parked)&&Math.hypot(d.x-p.x,d.y-p.y)<=Math.max(P.R,12/viewMaps[id].scale));
 if(hit){saveArrangement();dragging={kind:'disc',disc:hit,id,pointerId:e.pointerId,dx:hit.x-p.x,dy:hit.y-p.y};$(id).setPointerCapture(e.pointerId);return;}
 if(p.x<-.24||p.x>6.24||p.y<0||p.y>39)return;
 if(p.y>=20){aimAt(p.x,p.y,true);update();}
}
function moveBiscuit(e,id){if(!dragging||dragging.id!==id||dragging.pointerId!==e.pointerId)return;const p=courtPoint(e,id);
 if(dragging.kind==='shooter'){positionShooter(p.x+dragging.dx,p.y+dragging.dy);return;}
 if(dragging.kind==='supply'){dragging.point=p;draw();return;}
 const x=Math.max(-.24,Math.min(6.24,p.x+dragging.dx)),y=Math.max(0,Math.min(39,p.y+dragging.dy));
 if(!canDrop({x,y},dragging.disc))return;Object.assign(dragging.disc,{x,y,out:false,parked:false});update();
}
function endDrag(e,id,cancel=false){if(!dragging||dragging.id!==id||dragging.pointerId!==e.pointerId||(!cancel&&isSecondaryPointer(e)))return;const drag=dragging;dragging=null;
 if(drag.kind==='shooter'&&cancel)restoreShot(drag.before);
 if(drag.kind==='supply'){
  drag.button.classList.remove('dragging');const p=courtPoint(e,id);
  if(!cancel&&canDrop(p)&&P.remainingBiscuits(discs,drag.color,color)>0){saveArrangement();discs.push(createDisc(p.x,p.y,drag.color));$('result').textContent='Biscuit placed. Drag to rearrange.';}
 }
 update();
}
for(const id of ['overview','target']){
 const canvas=$(id);
 for(const c of ['black','yellow'])for(let slot=0;slot<4;slot++){
  const b=document.createElement('button');b.id=id+'Supply'+c+(slot||'');b.className='biscuit-supply '+c;b.dataset.color=c;b.type='button';b.innerHTML='<span aria-hidden="true"></span>';canvas.parentElement.append(b);
  b.addEventListener('pointerdown',e=>{if(isSecondaryPointer(e)||running||dragging||P.remainingBiscuits(discs,c,color)===0)return;e.preventDefault();dragging={kind:'supply',color:c,id,pointerId:e.pointerId,button:b,point:null};b.classList.add('dragging');b.setPointerCapture(e.pointerId);});
  b.addEventListener('pointermove',e=>moveBiscuit(e,id));b.addEventListener('pointerup',e=>endDrag(e,id));
  for(const ev of ['pointercancel','lostpointercapture'])b.addEventListener(ev,e=>endDrag(e,id,true));
 }
 canvas.addEventListener('pointerdown',e=>pointerDown(e,id));canvas.addEventListener('pointermove',e=>moveBiscuit(e,id));canvas.addEventListener('pointerup',e=>endDrag(e,id));
 for(const ev of ['pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>endDrag(e,id,true));
}
const tabButtons=[...document.querySelectorAll('[data-tab]')];
function selectTab(n){tabButtons.forEach((b,i)=>{b.setAttribute('aria-pressed',i===n);$('controlPage'+i).classList.toggle('active',i===n);});}
tabButtons.forEach((b,i)=>b.onclick=()=>selectTab(i));
$('toggleControls').onclick=()=>{const hidden=document.body.classList.toggle('controls-hidden');$('toggleControls').setAttribute('aria-expanded',!hidden);$('toggleControls').textContent=hidden?'Show controls':'Hide controls';draw();};
function selectView(full){mobileView=full?'full':'scoring';document.body.classList.toggle('full-view',full);$('fullView').setAttribute('aria-pressed',full);$('scoringView').setAttribute('aria-pressed',!full);draw();}
$('fullView').onclick=()=>selectView(true);$('scoringView').onclick=()=>selectView(false);
for(const id of ['position','angle','speed','slick','drift'])$(id).addEventListener('input',()=>{if(id==='position'&&aimPoint)aimAt(aimPoint.x,aimPoint.y,true);else if(id==='angle')aimPoint=null;update();});
for(const id of ['aimAccuracy','speedAccuracy']){
 $(id).addEventListener('change',()=>{$(id).value=accuracy(id).toFixed(2);update();});
}
for(const id of ['prediction','trails'])$(id).addEventListener('change',draw);
for(const c of ['yellow','black'])$(c).onclick=()=>switchShooter(c);

$('shoot').onclick=()=>fire();$('retry').onclick=()=>{if(running||!redoHistory.length)return;history.push(snapshot());restoreShot(redoHistory.pop());$('result').textContent='Shot or arrangement restored.';update();};
$('undo').onclick=()=>{if(!history.length||running)return;redoHistory.push(snapshot());const h=history.pop();restoreShot(h);$('result').textContent='Shot undone. Adjust and try again.';update();};
$('reset').onclick=()=>setup('open');document.querySelectorAll('[data-setup]').forEach(b=>b.onclick=()=>setup(b.dataset.setup));
function nudge(n){if(running)return;$('angle').value=(Math.min(20,Math.max(-20,value('angle')+n))).toFixed(2);aimPoint=null;update();}
$('left').onclick=()=>nudge(-.05);$('right').onclick=()=>nudge(.05);
function nudgeSpeed(n){if(running)return;$('speed').value=Math.min(18,Math.max(1,value('speed')+n)).toFixed(2);update();}
$('speedDown').onclick=()=>nudgeSpeed(-.05);$('speedUp').onclick=()=>nudgeSpeed(.05);
document.querySelectorAll('.info-button').forEach(b=>b.onclick=()=>{const open=b.parentElement.classList.toggle('open');b.setAttribute('aria-expanded',open);});
const dragControlSelector='canvas,.biscuit-supply,.controls input[type=range],.controls button,.shooting-picker button,.shoot-area button,.mobile-toolbar button,.toolbar-actions button';
for(const event of ['contextmenu','dragstart'])document.addEventListener(event,e=>{if(e.target.closest?.(dragControlSelector))e.preventDefault();});
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||$('about').open||!['overview','target'].includes(e.target.id))return;
 if(e.code==='ArrowLeft'){e.preventDefault();nudge(-.05);}if(e.code==='ArrowRight'){e.preventDefault();nudge(.05);}
});
$('aboutBtn').onclick=()=>$('about').showModal();$('closeDialog').onclick=()=>$('about').close();$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
function placeCourtActions(){const destination=window.innerWidth<1000?$('courtToolbar'):$('overviewHeading');if($('courtActions').parentElement!==destination)destination.append($('courtActions'));}
placeCourtActions();window.addEventListener('resize',placeCourtActions);
new ResizeObserver(draw).observe($('overview'));new ResizeObserver(draw).observe($('target'));setup('open');selectView(true);selectTab(1);
