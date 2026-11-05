const MG=require('/home/user/bachata-move-creator/src/graph.js');
const PM=require('/home/user/bachata-move-creator/src/map.js');
const fs=require('fs');
const D=JSON.parse(fs.readFileSync('/home/user/bachata-move-creator/web/data.js','utf8').match(/=\s*(\{[\s\S]*\});?\s*$/)[1]);
const g=MG.compile(D), lay=PM.layoutMap(g), sel='open_LR', L=lay.nodes;
const kind=m=>g.moveById[m].kind;
const T=g.edges.filter(e=>MG.isTransition(g,e));
const kinds={};
for(const e of T){ if(e.from!==sel&&e.to!==sel)continue; const o=e.from===sel?e.to:e.from; const k=kind(e.move); if(k==='styling')continue; (kinds[o]=kinds[o]||new Set()).add(k);}
const ang=id=>Math.atan2(L[id].y-L[sel].y,L[id].x-L[sel].x);
const r1=Object.keys(kinds).sort((a,b)=>ang(a)-ang(b));
const r2=Object.keys(L).filter(id=>id!==sel&&!kinds[id]).sort((a,b)=>ang(a)-ang(b));
const CX=350,CY=272;
const place=(ids,rx,ry,off)=>ids.map((id,i)=>{const a=-Math.PI/2+off+i*2*Math.PI/ids.length;return {id,a,x:CX+rx*Math.cos(a),y:CY+ry*Math.sin(a)};});
const P1=place(r1,135,120,0.15);
let best=0,bs=-1;for(let o=0;o<2*Math.PI/r2.length;o+=0.01){const q=place(r2,255,222,o);let m=9;for(const a of q)for(const b of P1){let d=Math.abs(a.a-b.a)%(2*Math.PI);d=Math.min(d,2*Math.PI-d);m=Math.min(m,d*(1.2+Math.abs(Math.cos(a.a))));}if(m>bs){bs=m;best=o;}}
const P2=place(r2,255,222,best);
let svg='';
svg+=`<ellipse cx="${CX}" cy="${CY}" rx="135" ry="120" fill="none" stroke="{{c.link}}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="3 6"/>`;
svg+=`<ellipse cx="${CX}" cy="${CY}" rx="255" ry="222" fill="none" stroke="{{c.link}}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="3 6"/>`;
for(const p of P1){const ks=[...kinds[p.id]];const dx=p.x-CX,dy=p.y-CY,n=Math.hypot(dx,dy),ox=-dy/n,oy=dx/n;
 const both=ks.length>1;
 const draw=(k,o)=>{const x1=CX+ox*o,y1=CY+oy*o,x2=p.x+ox*o,y2=p.y+oy*o;
  svg+= k==='move'?`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="{{c.move}}" stroke-width="${both?5:7}" stroke-linecap="round"/>`
   :`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="{{c.adjuster}}" stroke-width="${both?6:8}" stroke-linecap="round" stroke-dasharray="0.1 13"/>`;};
 if(both){draw('move',-4.5);draw('adjuster',4.5);}else draw(ks[0],0);}
const lab=(p,size,wt,col,gap)=>{const c=Math.cos(p.a),s=Math.sin(p.a);const anc=c>0.3?'start':c<-0.3?'end':'middle';
 const x=p.x+c*gap+(anc==='middle'?0:0), y=p.y+s*gap+(s>0.6?10:s<-0.6?-2:5);
 const parts=L[p.id].label.split(' (');const mk=(t,yy)=>`<text x="${x.toFixed(0)}" y="${yy.toFixed(0)}" text-anchor="${anc}" font-family="Asap, sans-serif" font-weight="${wt}" font-size="${size}" fill="${col}" stroke="{{c.land}}" stroke-width="5" paint-order="stroke" stroke-linejoin="round">${t}</text>`;
 return parts.length>1?mk(parts[0],y-size*0.55)+mk('('+parts[1],y+size*0.55):mk(parts[0],y);};
for(const p of P2) svg+=`<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="7" fill="#ffffff" stroke="{{c.muted}}" stroke-width="2.5"/>`;
for(const p of P1) svg+=`<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="12" fill="#ffffff" stroke="{{c.ink}}" stroke-width="4"/>`;
svg+=`<rect x="${CX-46}" y="${CY-16}" width="92" height="32" rx="16" fill="{{c.ink}}"/><text x="${CX}" y="${CY+6}" text-anchor="middle" font-family="Asap, sans-serif" font-weight="800" font-size="16" fill="#ffffff">Open L-R</text>`;
for(const p of P2) svg+=lab(p,14,600,'{{c.muted}}',14);
for(const p of P1) svg+=lab(p,16,800,'{{c.ink}}',17);
fs.writeFileSync('map3.svg',svg);console.log(r1.length,r2.length);
