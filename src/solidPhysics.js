// Conservative spherical contact envelopes around the folded mesh. Small adaptive
// substeps prevent a fast thrown ball from tunnelling through resting balls.
export function stepSolids(balls, dt, {width,height,sweepEdge=null,sweepSpeed=0}) {
 const radius=b=>Math.max(12,b.radius||b.size*.25);
 const fixed=b=>b.state==='held'||b.state==='ready';
 const moving=balls.filter(b=>!fixed(b));
 const speed=Math.max(1,...balls.map(b=>Math.hypot(b.vx||0,b.vy||0)));
 const minR=Math.min(20,...balls.map(radius));
 const steps=Math.max(4,Math.min(32,Math.ceil(speed*dt/(minR*.35))));
 const h=dt/steps;
 function walls(b){if(fixed(b))return;const r=radius(b);
  if(b.state!=='sweeping'){
   if(b.x<r){b.x=r;b.vx=Math.abs(b.vx)*.35;}
   if(b.x>width-r){b.x=width-r;b.vx=-Math.abs(b.vx)*.35;}
  }
  if(b.state==='flying'){
   if(b.y<r){b.y=r;b.vy=Math.abs(b.vy)*.3;}
   if(b.y>=b.floor){b.y=b.floor;if(b.vy>0){b.vy*=-.27;b.vx*=.8;}if(Math.abs(b.vy)<55){b.state='ground';b.vy=0;b.motionDeadline=0;b.dirty=true;}}
  }else{
   const top=height-240+r,bottom=height-25-r;
   if(b.y<top){b.y=top;b.vy=Math.abs(b.vy)*.3;}
   if(b.y>bottom){b.y=bottom;b.vy=-Math.abs(b.vy)*.3;}
  }
 }
 for(let step=0;step<steps;step++){
  for(const b of moving){b.vx||=0;b.vy||=0;const ox=b.x,oy=b.y;
   if(b.state==='flying')b.vy+=1400*h;
   else{const drag=Math.exp(-(b.state==='sweeping'?.65:2.7)*h);b.vx*=drag;b.vy*=drag;if(Math.hypot(b.vx,b.vy)<2)b.vx=b.vy=0;}
   if(b.state==='sweeping'&&sweepEdge!==null&&b.x-radius(b)<sweepEdge){b.x=sweepEdge+radius(b);b.vx=Math.max(b.vx,sweepSpeed*1.1);}
   b.x+=b.vx*h;b.y+=b.vy*h;walls(b);
   b.rotation+=(b.x-ox)/radius(b)*.75;b.rx+=(b.y-oy)/radius(b)*.7;
   if(Math.abs(b.x-ox)+Math.abs(b.y-oy)>.01)b.dirty=true;
  }
  // Position and impulse constraints are solved together so resting contacts
  // transfer momentum to neighbouring balls, including a whole cluster.
  for(let pass=0;pass<10;pass++){
   for(let a=0;a<balls.length;a++)for(let j=a+1;j<balls.length;j++){
    const A=balls[a],B=balls[j],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy),limit=radius(A)+radius(B)+1;
    if(d>=limit)continue;
    const nx=d>.0001?dx/d:1,ny=d>.0001?dy/d:0,wa=fixed(A)?0:1,wb=fixed(B)?0:1,total=wa+wb;if(!total)continue;
    const correction=(limit-d)/total;
    A.x-=nx*correction*wa;A.y-=ny*correction*wa;B.x+=nx*correction*wb;B.y+=ny*correction*wb;
    const closing=((B.vx||0)-(A.vx||0))*nx+((B.vy||0)-(A.vy||0))*ny;
    if(closing<0){const impulse=-closing*1.28/total;
     A.vx-=impulse*nx*wa;A.vy-=impulse*ny*wa;B.vx+=impulse*nx*wb;B.vy+=impulse*ny*wb;
     const tangent=((B.vx||0)-(A.vx||0))*(-ny)+((B.vy||0)-(A.vy||0))*nx;
     const friction=Math.max(-impulse*.2,Math.min(impulse*.2,-tangent/total));
     A.vx+=ny*friction*wa;A.vy-=nx*friction*wa;B.vx-=ny*friction*wb;B.vy+=nx*friction*wb;
     A.rotation-=friction*wa*.0007;B.rotation+=friction*wb*.0007;
    }
    if(wa)A.dirty=true;if(wb)B.dirty=true;
   }
   for(const b of moving)walls(b);
  }
 }
}
