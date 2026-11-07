/* Feet, seconds, equal-mass 6-inch discs. No dependencies. */
(function(root){
'use strict';
const R=.25, LINE=.0625, DT=1/240;
const deceleration=slick=>.12+1.35*(1-slick/100);
function step(discs,dt,a,drift=0){
 for(const d of discs){
  if(d.out)continue;
  const v=Math.hypot(d.vx,d.vy);
  if(v>.00001){
   const t=Math.min(dt,v/a), f=Math.max(0,1-a*t/v);
   // Exact constant-friction displacement; drift is a small cross-court acceleration.
   d.x+=d.vx*t*(1+f)/2+drift*t*t/2;d.y+=d.vy*t*(1+f)/2;
   d.vx=d.vx*f+(f>0?drift*t:0);d.vy*=f;
   if(Math.hypot(d.vx,d.vy)<.012){d.vx=0;d.vy=0;}
  }
  if(d.x-R<=0||d.x+R>=6||d.y-R>39||d.y+R<0){d.out=true;d.vx=0;d.vy=0;}
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
 {n:-10,p:[[0,37.5],[6,37.5],[6,39],[0,39]]}];
function score(d){if(d.out)return 0;for(const z of zones)if(insideCircle(z.p,d))return z.n;return 0;}
function simulate(discs,a,drift=0){const ds=structuredClone(discs),paths=ds.map(d=>[[d.x,d.y]]);let time=0;
 for(let i=0;i<240*100;i++){
  step(ds,DT,a,drift);time+=DT;
  if(i%12===0)ds.forEach((d,j)=>{if(!d.out)paths[j].push([d.x,d.y]);});
  if(ds.every(d=>d.out||(!d.vx&&!d.vy)))break;
 }ds.forEach((d,j)=>paths[j].push([d.x,d.y]));return{discs:ds,paths,time};}
const api={R,LINE,DT,deceleration,step,score,zones,simulate};
if(typeof module!=='undefined')module.exports=api;else root.Physics=api;
})(globalThis);
