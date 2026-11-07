/* Feet, seconds, equal-mass 6-inch discs. No dependencies. */
(function(root){
'use strict';
const R=.25, LINE=.0625, DT=1/240;
const deceleration=slick=>.12+1.35*(1-slick/100);
function slide(d,dt,a,drift=0){
  const v=Math.hypot(d.vx,d.vy);
  if(v>.00001){
   const t=Math.min(dt,v/a), f=Math.max(0,1-a*t/v);
   // Exact constant-friction displacement; drift is a small cross-court acceleration.
   d.x+=d.vx*t*(1+f)/2+drift*t*t/2;d.y+=d.vy*t*(1+f)/2;
   d.vx=d.vx*f+(f>0?drift*t:0);d.vy*=f;
   if(Math.hypot(d.vx,d.vy)<.012){d.vx=0;d.vy=0;}
  }
}
function step(discs,dt,a,drift=0){
 for(const d of discs){
  if(d.out)continue;
  slide(d,dt,a,drift);
  if(d.x+R<0||d.x-R>6||d.y-R>39||d.y+R<0){d.out=true;d.vx=0;d.vy=0;}
 }
 for(let i=0;i<discs.length;i++)for(let j=i+1;j<discs.length;j++){
  const p=discs[i],q=discs[j];if(p.out||q.out)continue;
  const dx=q.x-p.x,dy=q.y-p.y,dist=Math.hypot(dx,dy);
  if(dist>=2*R||dist<1e-9)continue;
  const nx=dx/dist,ny=dy/dist,overlap=2*R-dist;
  p.x-=nx*overlap/2;p.y-=ny*overlap/2;q.x+=nx*overlap/2;q.y+=ny*overlap/2;
  const rel=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;
  if(rel<0){const impulse=-(1+.94)*rel/2;p.vx-=impulse*nx;p.vy-=impulse*ny;q.vx+=impulse*nx;q.vy+=impulse*ny;}
 }
}
// Starting center stays clear of the sloped shooting-area side, including paint.
function startingPoint(color,position){
 const y=1.18,clearance=R+LINE/2+.01;
 const outer=6-y/3-clearance*Math.hypot(1,1/3);
 const x=3.55+(outer-3.55)*Math.max(0,Math.min(100,position))/100;
 return{x:color==='black'?6-x:x,y};
}
// Aim for an unobstructed stopping point under the current friction and drift.
// Contact with other biscuits can change the resulting position.
function targetShot(start,target,a,drift=0){
 const dx=target.x-start.x,dy=target.y-start.y,distance=Math.hypot(dx,dy);
 let speed=Math.sqrt(2*a*distance),vx=distance?speed*dx/distance:0,vy=distance?speed*dy/distance:0;
 if(drift){
  const endpoint=(xx,yy)=>{const d={x:start.x,y:start.y,vx:xx,vy:yy};
   for(let i=0;i<240*100&&(d.vx||d.vy);i++)slide(d,DT,a,drift);
   return d;
  };
  for(let i=0;i<12;i++){
   const end=endpoint(vx,vy),ex=target.x-end.x,ey=target.y-end.y;
   if(Math.hypot(ex,ey)<.0005)break;
   const eps=.001,xEnd=endpoint(vx+eps,vy),yEnd=endpoint(vx,vy+eps);
   const j11=(xEnd.x-end.x)/eps,j21=(xEnd.y-end.y)/eps,j12=(yEnd.x-end.x)/eps,j22=(yEnd.y-end.y)/eps,det=j11*j22-j12*j21;
   if(Math.abs(det)<1e-9)break;
   vx+=(ex*j22-ey*j12)/det;vy+=(ey*j11-ex*j21)/det;
  }
 }
 return{angle:Math.atan2(vx,vy)*180/Math.PI,speed:Math.hypot(vx,vy)};
}
function insideCircle(poly,d){
 const clearance=R+LINE/2;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];
  if((dx*(d.y-a[1])-dy*(d.x-a[0]))/Math.hypot(dx,dy)<=clearance+1e-8)return false;
 }return true;
}
// Polygons counterclockwise in court coordinates; y increases toward the foot.
const zones=[{n:10,p:[[3,28.5],[4,31.5],[2,31.5]]},
 {n:8,p:[[2,31.5],[3,31.5],[3,34.5],[1,34.5]]},
 {n:8,p:[[3,31.5],[4,31.5],[5,34.5],[3,34.5]]},
 {n:7,p:[[1,34.5],[3,34.5],[3,37.5],[0,37.5]]},
 {n:7,p:[[3,34.5],[5,34.5],[6,37.5],[3,37.5]]},
 {n:-10,p:[[.5,37.5],[5.5,37.5],[6,39],[0,39]]}];
// Eldridge, Shuffleboard Basics p.1: full-width 7 base; kitchen sides inset
// at the 7 line and flaring outward toward the baseline. Rendering uses these
// same scoring vertices so a visual fix cannot silently change only one model.
const diagramLines=[
 [zones[3].p[3],zones[0].p[0],zones[4].p[2],zones[3].p[3]],
 [zones[0].p[2],zones[0].p[1]],
 [zones[3].p[0],zones[4].p[1]],
 [[3,31.5],[3,37.5]],
 [zones[5].p[3],zones[5].p[2]],
 [zones[5].p[0],zones[5].p[3]],
 [zones[5].p[1],zones[5].p[2]],
 [[2.75,39],[3,37.5],[3.25,39]]
];
function score(d){if(d.out)return 0;for(const z of zones)if(insideCircle(z.p,d))return z.n;return 0;}
function simulate(discs,a,drift=0){const ds=structuredClone(discs),paths=ds.map(d=>[[d.x,d.y]]);let time=0;
 for(let i=0;i<240*100;i++){
  step(ds,DT,a,drift);time+=DT;
  if(i%12===0)ds.forEach((d,j)=>{if(!d.out)paths[j].push([d.x,d.y]);});
  if(ds.every(d=>d.out||(!d.vx&&!d.vy)))break;
 }ds.forEach((d,j)=>paths[j].push([d.x,d.y]));return{discs:ds,paths,time};}
const api={R,LINE,DT,deceleration,step,score,zones,diagramLines,simulate,startingPoint,targetShot};
if(typeof module!=='undefined')module.exports=api;else root.Physics=api;
})(globalThis);
