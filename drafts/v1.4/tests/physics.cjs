const P=require('../dist/physics.js');
const assert=require('node:assert/strict');
const disc=(x,y,vx=0,vy=0)=>({x,y,vx,vy,out:false});
for(const [x,y,s] of [[3,30.5,10],[2.25,33,8],[3.75,33,8],[1.5,36,7],[4.5,36,7],[3,38.2,-10],[3,33,0],[2,31.5,0],[3,31.5-.28125,0],[.2,38,0]])assert.equal(P.score(disc(x,y)),s,`${x},${y}`);
for(const slick of [0,60,100]){const dec=P.deceleration(slick),v=2;const sim=P.simulate([disc(3,5,0,v)],dec);assert.ok(Math.abs(sim.discs[0].y-(5+v*v/(2*dec)))<.002);assert.ok(sim.time<100);}
const hit=[disc(3,30,0,2),disc(3,30.49)];P.step(hit,P.DT,.66);assert.ok(hit[1].vy>1.9);assert.ok(hit[0].vy<.1);
const collision=P.simulate([disc(3,1.18,0,7),disc(3,33.3)],.66);assert.ok(collision.discs[1].y>33.3);
const fast=P.simulate([disc(3,1.18,0,6.5)],P.deceleration(90)),slow=P.simulate([disc(3,1.18,0,6.5)],P.deceleration(20));assert.ok(fast.discs[0].out);assert.ok(slow.discs[0].y<25.5);
const left=P.simulate([disc(3,1.18,0,6.5)],.66,-.01),right=P.simulate([disc(3,1.18,0,6.5)],.66,.01);assert.ok(left.discs[0].x<3&&right.discs[0].x>3);
const oblique=[disc(3,30,0,4),disc(3.3,30.39)];const before=oblique.reduce((t,d)=>t+d.vy,0);P.step(oblique,P.DT,0);assert.ok(Math.abs(oblique.reduce((t,d)=>t+d.vy,0)-before)<1e-10);assert.ok(Math.abs(oblique.reduce((t,d)=>t+d.vx,0))<1e-10);assert.ok(oblique[0].vx<0&&oblique[1].vx>0);
console.log('PASS: scoring cells, border clearance, kitchen separator, analytic stopping distances, collision momentum and glancing angles, slickness, drift.');
for(const x of [-.2,0,.1,5.9,6,6.2]){const ds=[disc(x,35)];P.step(ds,P.DT,.66);assert.equal(ds[0].out,false,'Overhanging biscuit remains in play');}
for(const x of [-.26,6.26]){const ds=[disc(x,35)];P.step(ds,P.DT,.66);assert.equal(ds[0].out,true,'Fully departed biscuit is out');}
const edgeHit=P.simulate([disc(.2,34,0,2),disc(.2,34.8)],.66);assert.ok(edgeHit.discs[1].y>35);assert.ok(!edgeHit.discs[1].out);
const chain=P.simulate([disc(3,30,0,3),disc(3,31),disc(3,32)],.66);for(const i of [1,2])assert.ok(chain.paths[i].some(p=>p[1]>31+i-1+.01),'Collision paths include every displaced biscuit');
assert.equal(P.score(disc(.32,38)),0,'Angled kitchen boundary invalidates a line-touching biscuit');assert.equal(P.score(disc(.9,38)),-10);
console.log('PASS: partial edge overhang, full departure, collisions with overhanging biscuits, chain reaction paths, angled kitchen scoring.');

// Reference diagram regression: 7s reach the full-width base, while the kitchen
// starts 6 inches inset on either side. Their outside borders do not join.
assert.deepEqual(P.zones[3].p,[[1,34.5],[3,34.5],[3,37.5],[0,37.5]]);
assert.deepEqual(P.zones[4].p,[[3,34.5],[5,34.5],[6,37.5],[3,37.5]]);
assert.deepEqual(P.zones[5].p,[[.5,37.5],[5.5,37.5],[6,39],[0,39]]);
assert.deepEqual(P.diagramLines[0],[[0,37.5],[3,28.5],[6,37.5],[0,37.5]]);
for(const x of [.5,5.5])assert.equal(P.score(disc(x,37.1)),7,'Deep outside 7 remains scoring');
console.log('PASS: source-diagram triangle widths, full 7 base, separate inset kitchen, deep outside 7 scoring.');
for(const c of ['yellow','black'])for(let i=0;i<=100;i++){
 const start=P.startingPoint(c,i),clearance=P.R+P.LINE/2;
 assert.ok((start.x-start.y/3)/Math.hypot(1,1/3)>clearance,'Start clears left diagonal');
 assert.ok((6-start.y/3-start.x)/Math.hypot(1,1/3)>clearance,'Start clears right diagonal');
 assert.ok(start.y>clearance&&1.5-start.y>clearance,'Start clears front and back lines');
}
for(const slick of [0,60,100])for(const c of ['yellow','black']){
 const start=P.startingPoint(c,100),target={x:3.75,y:33},a=P.deceleration(slick),s=P.targetShot(start,target,a);
 const end=P.simulate([disc(start.x,start.y,Math.sin(s.angle*Math.PI/180)*s.speed,Math.cos(s.angle*Math.PI/180)*s.speed)],a).discs[0];
 assert.ok(Math.hypot(end.x-target.x,end.y-target.y)<.002,'Click-to-target speed reaches destination across slickness settings');
}
for(const drift of [-.03,.03]){
 const start=P.startingPoint('yellow',12),target={x:3.75,y:33},s=P.targetShot(start,target,.66,drift);
 const end=P.simulate([disc(start.x,start.y,Math.sin(s.angle*Math.PI/180)*s.speed,Math.cos(s.angle*Math.PI/180)*s.speed)],.66,drift).discs[0];
 assert.ok(!end.out);assert.ok(Math.hypot(end.x-target.x,end.y-target.y)<.003,'Click target compensates for drift');
}
console.log('PASS: both colors clear shooting-area lines across entire slider; target angle/speed reach requested spot across slickness settings and with drift.');
const colors=(yellow,black)=>[...Array.from({length:yellow},()=>({...disc(2,33),color:'yellow'})),...Array.from({length:black},()=>({...disc(4,33),color:'black'}))];
assert.equal(P.remainingBiscuits(colors(0,0),'yellow','yellow'),3,'Reserve queued shooter');
assert.equal(P.remainingBiscuits(colors(3,0),'yellow','yellow'),0,'Three placed plus shooter fill yellow supply');
assert.equal(P.remainingBiscuits(colors(3,0),'black','yellow'),4,'Other color has independent allowance');
assert.equal(P.remainingBiscuits(colors(3,4),'black','yellow'),0,'Four placed fill other supply');
assert.equal(P.remainingBiscuits(colors(4,0),'yellow'),0,'Fifth shot cannot be queued');
const removed=colors(3,0);removed[0].out=true;assert.equal(P.remainingBiscuits(removed,'yellow','yellow'),0,'Out biscuits still consume capacity');
console.log('PASS: independent four-biscuit limits, shooter reservation, full supply, and collected biscuits retaining capacity.');

const collection=colors(4,4);collection.forEach((d,i)=>{d.out=true;d.x=i%2?-.6:6.6;d.y=35;});
const live={...disc(3,33),color:'yellow'};const mixed=[...collection,live];P.collectOffCourt(mixed);
assert.deepEqual(live,{...disc(3,33),color:'yellow'},'Collection leaves live biscuits untouched');
for(const d of collection){assert.ok(d.parked&&d.out);assert.ok(d.y>39+P.R);assert.equal(P.score(d),0);assert.equal(d.vx,0);assert.equal(d.vy,0);}
for(let i=0;i<collection.length;i++)for(let j=i+1;j<collection.length;j++)assert.ok(Math.hypot(collection[i].x-collection[j].x,collection[i].y-collection[j].y)>2*P.R,'Collected biscuits do not overlap');
const saved=structuredClone(collection);P.collectOffCourt(collection);assert.deepEqual(collection,saved,'Collection is stable across frames');
assert.equal(P.remainingBiscuits(collection,'yellow'),0);assert.equal(P.remainingBiscuits(collection,'black'),0);
P.step(collection,P.DT,.66);assert.deepEqual(collection,saved,'Collected biscuits are excluded from collisions');
console.log('PASS: off-court collection behind kitchen, stable non-overlapping slots, zero score, no collisions, and retained four-biscuit limits.');

for(const c of ['yellow','black'])for(const y of [-1,.4,1,1.18,2])for(const pos of [0,25,50,100]){
 const p=P.startingPoint(c,pos,y),inverse=P.startingPosition(c,p.x,p.y),clearance=P.R+P.LINE/2;
 assert.ok(Math.abs(inverse.position-pos)<1e-8);assert.equal(inverse.y,p.y);
 assert.ok((p.x-p.y/3)/Math.hypot(1,1/3)>clearance);assert.ok((6-p.y/3-p.x)/Math.hypot(1,1/3)>clearance);
 assert.ok(p.y>clearance&&1.5-p.y>clearance);
}
for(const c of ['yellow','black'])for(const x of [-20,20]){const p=P.startingPosition(c,x,-2);assert.ok(p.position>=0&&p.position<=100);assert.ok(p.y>0);}
console.log('PASS: shooter dragging maps to slider for both colors and clamps to legal starting-area boundaries.');
