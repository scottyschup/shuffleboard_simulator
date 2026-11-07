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
