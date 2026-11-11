import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { stepSolids } from './solidPhysics';
import { createPaperPath } from './paperPhysics';
import {textureCanvas,creaseSeed,W,H} from './paperContent';

// The React Bits deformation solver is shared across sheets. One renderer supports
// throwing, ground persistence and picking sheets up without extra WebGL contexts.
export default function PaperScene({apiRef,onGround,onOpen,onHold,onThrow,onSweepEnd,onMotion,onError}){
 const canvas=useRef(), broom=useRef();const callbacks=useRef({onGround,onOpen,onHold,onThrow,onSweepEnd,onMotion,onError});callbacks.current={onGround,onOpen,onHold,onThrow,onSweepEnd,onMotion,onError};
 useEffect(()=>{
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas:canvas.current,alpha:true,antialias:true});}catch(e){callbacks.current.onError?.();return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera();camera.position.z=1500;camera.near=.1;camera.far=4000;
 scene.add(new THREE.HemisphereLight(0xe5e8ee,0x161719,.75));const light=new THREE.DirectionalLight(0xf5f3e9,2.1);light.position.set(-500,700,1100);scene.add(light);
 const aspect=H/W,cols=10,rows=13,rest=[],uv=[],indices=[];
 for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){rest.push(c/cols-.5,(r/rows-.5)*aspect,0);uv.push(c/cols,r/rows);if(c<cols&&r<rows){let a=r*(cols+1)+c;indices.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}}
 // Reuse a bounded set of physically different fold paths, selected by sheet ID.
 const foldPaths=new Map();
 function sheetPath(doc){const variant=creaseSeed(doc)%8;if(foldPaths.has(variant))return foldPaths.get(variant);
  const path=createPaperPath(Float32Array.from(rest),indices,1,5+variant%4,.65+(variant%3)*.1,.85+(variant%4)*.12,17+variant*137);
  const folded=path.samples.at(-1);let radius=0;for(let n=0;n<folded.length;n+=3)radius=Math.max(radius,Math.hypot(folded[n],folded[n+1],folded[n+2]));
  const result={path,radius};foldPaths.set(variant,result);return result;
 }
 const items=new Map();let width=canvas.current.parentElement.clientWidth,height=canvas.current.parentElement.clientHeight,frame,previous=0,held=null,active=null,disposed=false,sweep=null,lastSync=0,motionState=false,stillSince=0;
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),g=ctx.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(49,43,31,.28)');g.addColorStop(1,'rgba(49,43,31,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
 function resize(){width=canvas.current.parentElement.clientWidth;height=canvas.current.parentElement.clientHeight;camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);for(const item of items.values()){if(item.state==='ground'){item.x=Math.max(50,Math.min(width-50,item.nx*width));item.y=height-item.bottom;}}}
 function localRect(rect){const r=canvas.current.getBoundingClientRect();return {...rect,left:rect.left-r.left,top:rect.top-r.top,width:rect.width,height:rect.height};}
 function build(doc,rect){let item=items.get(doc.id);if(item){item.doc=doc;item.mesh.material[0].map.dispose();item.mesh.material[0].map=new THREE.CanvasTexture(textureCanvas(doc));item.mesh.material[0].map.colorSpace=THREE.SRGBColorSpace;item.mesh.material[0].needsUpdate=true;return item;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>rest.slice(i*3,i*3+3)),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(indices.flatMap(i=>uv.slice(i*2,i*2+2)),2));geometry.computeVertexNormals();geometry.addGroup(0,indices.length,0);geometry.addGroup(0,indices.length,1);
  const texture=new THREE.CanvasTexture(textureCanvas(doc));texture.colorSpace=THREE.SRGBColorSpace;
  const material=[new THREE.MeshStandardMaterial({map:texture,side:THREE.FrontSide,roughness:1}),new THREE.MeshStandardMaterial({color:'#c6c6c0',side:THREE.BackSide,roughness:1})];const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const shadow=new THREE.Sprite(new THREE.SpriteMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.5}));scene.add(shadow);
  item={id:doc.id,doc,mesh,shadow,foldData:sheetPath(doc),x:rect.left+rect.width/2,y:rect.top+rect.height/2,size:rect.width,fold:0,target:0,rotation:0,rx:0,ry:0,state:'ready',vx:0,vy:0,bounces:0};items.set(doc.id,item);return item;
 }
 function deform(item){const path=item.foldData.path;const f=Math.max(0,Math.min(1,item.fold))*64,l=Math.floor(f),u=Math.min(64,l+1),t=f-l,a=path.samples[l],b=path.samples[u];const p=item.mesh.geometry.attributes.position;
 for(let i=0;i<indices.length;i++)for(let k=0;k<3;k++){let j=indices[i]*3+k;p.array[i*3+k]=a[j]+(b[j]-a[j])*t+(item.doc.creased?(path.creased[j]-rest[j])*.11*(1-item.fold):0);}
 p.needsUpdate=true;item.mesh.geometry.computeVertexNormals();item.mesh.geometry.computeBoundingSphere();}
 const ray=new THREE.Raycaster();
 function pointerdown(e){if(!active||held||e.button!==0)return;const item=items.get(active);if(!item||item.state!=='ready')return;const bounds=canvas.current.getBoundingClientRect();const ex=e.clientX-bounds.left,ey=e.clientY-bounds.top;ray.setFromCamera(new THREE.Vector2(ex/width*2-1,1-ey/height*2),camera);if(!ray.intersectObject(item.mesh).length)return;e.preventDefault();canvas.current.setPointerCapture(e.pointerId);held={item,id:e.pointerId,x:e.clientX,y:e.clientY,last:performance.now(),dx:item.x-ex,dy:item.y-ey,start:performance.now()};item.state='held';item.target=1;callbacks.current.onHold?.(true);}
 function pointermove(e){if(!held||e.pointerId!==held.id)return;const now=performance.now(),dt=Math.max(.008,(now-held.last)/1000),i=held.item;i.vx=THREE.MathUtils.clamp((e.clientX-held.x)/dt,-1700,1700);i.vy=THREE.MathUtils.clamp((e.clientY-held.y)/dt,-1700,1700);const bounds=canvas.current.getBoundingClientRect();i.x=e.clientX-bounds.left+held.dx*(1-i.fold);i.y=e.clientY-bounds.top+held.dy*(1-i.fold);i.ry=i.vx*.0002;held.x=e.clientX;held.y=e.clientY;held.last=now;}
 function release(e){if(!held||e.pointerId!==held.id)return;const i=held.item;if(i.readonly&&performance.now()-held.start<200){i.state='ready';i.target=1;held=null;callbacks.current.onHold?.(false);if(canvas.current.hasPointerCapture(e.pointerId))canvas.current.releasePointerCapture(e.pointerId);return;}const short=!i.readonly&&performance.now()-held.start<160&&i.fold<.2;i.state=short?'ready':'flying';i.target=short?0:1;if(!short){if(performance.now()-held.last>100){i.vx=0;i.vy=0;}i.vx*=.55;i.vy*=.55;i.floor=height-55-Math.random()*65;i.bounces=0;active=null;callbacks.current.onThrow?.();}else{i.vx=i.vy=0;}held=null;callbacks.current.onHold?.(false);if(canvas.current.hasPointerCapture(e.pointerId))canvas.current.releasePointerCapture(e.pointerId);}
 function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(.035,(time-previous)/1000||.016);previous=time;
 let sweepEdge=null,sweepSpeed=0;
 if(sweep){const t=Math.min(1,(time-sweep.start)/4600),x=-700+(width+1600)*t;
  broom.current.style.transform=`translate3d(${x}px,0,0) rotate(-13deg)`;sweepEdge=x+570;sweepSpeed=(width+1600)/4.6;
 }
 const solids=[];
 for(const i of items.values()){
  if(!i.mesh.visible)continue;
  if(i.state==='flying')i.size+=(Math.min(210,width*.45)-i.size)*Math.min(1,dt*2);
  if(['ground','flying','sweeping'].includes(i.state)||(['held','ready'].includes(i.state)&&i.fold>.8)){
   i.radius=i.size*i.foldData.radius;solids.push(i);
  }
 }
 stepSolids(solids,dt,{width,height,sweepEdge,sweepSpeed});
 const movingNow=!!sweep||Array.from(items.values()).some(i=>['flying','dragground','held','sweeping'].includes(i.state)||(i.state==='ground'&&(Math.hypot(i.vx||0,i.vy||0)>2||i.dirty)));
 if(movingNow){stillSince=0;if(!motionState){motionState=true;callbacks.current.onMotion?.(true);}}
 else if(motionState){if(!stillSince)stillSince=time;if(time-stillSince>200){motionState=false;callbacks.current.onMotion?.(false);}}

 if(time-lastSync>80){lastSync=time;for(const i of solids){if(i.state==='ground'&&i.dirty){i.dirty=false;i.nx=i.x/width;i.bottom=height-i.y;callbacks.current.onGround?.(i.id,{x:i.nx,bottom:i.bottom,rotation:i.rotation,size:i.size});}}}
 if(sweep&&time-sweep.start>=4600&&sweep.ids.every(id=>{const b=items.get(id);return !b||b.x>width+b.radius;})){const ids=sweep.ids;sweep=null;broom.current.style.visibility='hidden';apiRef.current.clear(ids);callbacks.current.onSweepEnd?.(ids);}
 for(const i of items.values()){
  if(!i.mesh.visible)continue;
  let old=i.fold;i.fold+=(i.target-i.fold)*Math.min(1,dt*7);if(Math.abs(i.fold-i.target)<.001)i.fold=i.target;if(old!==i.fold||!i.updated){deform(i);i.updated=true;}
  if(i.state==='opening'){const t=Math.min(1,(time-i.openStart)/1000),v=1-Math.pow(1-t,3);i.x=i.fromX+(i.rect.left+i.rect.width/2-i.fromX)*v;i.y=i.fromY+(i.rect.top+i.rect.height/2-i.fromY)*v;i.size=i.fromSize+(i.rect.width-i.fromSize)*v;i.rotation=i.fromRotation*(1-v);i.rx*=1-dt*7;i.ry*=1-dt*7;if(t===1){i.state='ready';i.readonly=true;i.fold=i.target=0;i.rx=i.ry=i.rotation=0;active=i.id;callbacks.current.onOpen?.(i.id);}}
  i.mesh.position.set(i.x-width/2,height/2-i.y,i.state==='stacked'?(i.stackDepth||-50):50);i.mesh.scale.setScalar(i.size);i.mesh.rotation.set(i.rx,i.ry,i.rotation);
  i.shadow.visible=i.mesh.visible&&i.state!=='stacked';i.shadow.position.set(i.x-width/2+8,height/2-(i.state==='flying'?i.floor:i.y+18),-200);let sw=['ready','opening','stacked'].includes(i.state)?i.size*.85:i.size*.6;i.shadow.scale.set(sw,sw*(i.fold>.5?.24:.95),1);i.shadow.material.opacity=i.state==='flying'?.32:.65;
 }
 renderer.render(scene,camera);
 }
 apiRef.current={
  ready(doc,rect){rect=localRect(rect);const i=build(doc,rect);i.readonly=!!doc.readonly;i.state='ready';i.mesh.visible=i.shadow.visible=true;i.x=rect.left+rect.width/2;i.y=rect.top+rect.height/2;i.size=rect.width;i.rx=i.ry=i.rotation=0;i.fold=i.target=0;i.updated=false;active=doc.id;},
  grabGround(id,x,y){const i=items.get(id);if(!i||i.state!=='ground')return false;const r=canvas.current.getBoundingClientRect();i.state='dragground';i.dragOffsetX=i.x-(x-r.left);i.dragOffsetY=i.y-(y-r.top);i.dragX=x;i.dragY=y;i.dragTime=performance.now();i.vx=i.vy=0;return true;},
  moveGround(id,x,y){const i=items.get(id);if(!i||i.state!=='dragground')return;const now=performance.now(),dt=Math.max(.008,(now-i.dragTime)/1000),r=canvas.current.getBoundingClientRect();i.vx=THREE.MathUtils.clamp((x-i.dragX)/dt,-1800,1800);i.vy=THREE.MathUtils.clamp((y-i.dragY)/dt,-1800,1800);i.x=x-r.left+i.dragOffsetX;i.y=y-r.top+i.dragOffsetY;i.ry=i.vx*.00015;i.dragX=x;i.dragY=y;i.dragTime=now;},
  releaseGround(id,cancel=false){const i=items.get(id);if(!i||i.state!=='dragground')return;if(cancel||performance.now()-i.dragTime>120)i.vx=i.vy=0;i.vx*=.6;i.vy*=.6;i.state='flying';i.floor=height-70;i.target=1;i.bounces=0;},
  park(doc,rect,order=0){rect=localRect(rect);const i=build(doc,rect);i.readonly=!!doc.readonly;i.state='stacked';i.fold=i.target=0;i.rx=i.ry=i.rotation=0;i.stackDepth=-1200+Math.min(order,65)*16;i.x=rect.left+rect.width/2;i.y=rect.top+rect.height/2;i.size=rect.width;i.updated=false;i.mesh.visible=true;i.shadow.visible=false;if(active===doc.id)active=null;},
  hide(id){const i=items.get(id);if(i){i.mesh.visible=i.shadow.visible=false;i.state='editing';}if(active===id)active=null;},
  restore(doc){const ground=doc.ground||{x:.2,bottom:70};const i=build(doc,{left:0,top:0,width:190});i.state='ground';i.fold=i.target=1;i.x=ground.x*width;i.y=height-ground.bottom;i.nx=ground.x;i.bottom=ground.bottom;i.rotation=ground.rotation||0;i.rx=.5;i.size=ground.size||190;i.dirty=true;},
  open(id,rect){rect=localRect(rect);const i=items.get(id);if(!i)return;build({...i.doc,creased:true,readonly:true},rect);i.updated=false;i.state='opening';i.fromX=i.x;i.fromY=i.y;i.fromSize=i.size;i.fromRotation=i.rotation;i.rect=rect;i.openStart=performance.now();i.target=0;active=null;},
  sweep(ids){if(sweep||!ids.length)return; sweep={ids,start:performance.now()};broom.current.style.visibility="visible";for(const id of ids){const i=items.get(id);if(i){i.state="sweeping";i.vx=i.vy=0;}}},
  clear(ids){for(const id of ids){const i=items.get(id);if(!i)continue;scene.remove(i.mesh,i.shadow);i.mesh.geometry.dispose();i.mesh.material.forEach(m=>{m.map?.dispose();m.dispose()});i.shadow.material.dispose();items.delete(id);}},
  crumple(){if(active){const i=items.get(active);i.target=1;i.readonly=true;}},
  drop(){if(!active)return;const i=items.get(active);i.fold=.3;i.target=1;i.state='flying';i.vx=350;i.vy=-280;i.floor=height-70;i.bounces=0;active=null;callbacks.current.onThrow?.();},
  resize
 };
 resize();window.addEventListener('resize',resize);const el=canvas.current;el.addEventListener('pointerdown',pointerdown);el.addEventListener('pointermove',pointermove);el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);frame=requestAnimationFrame(animate);
 return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);el.removeEventListener('pointerdown',pointerdown);el.removeEventListener('pointermove',pointermove);el.removeEventListener('pointerup',release);el.removeEventListener('pointercancel',release);apiRef.current.clear([...items.keys()]);shadowTexture.dispose();renderer.dispose();apiRef.current=null;};
 },[]);
 return <><canvas className="physics-canvas" ref={canvas} aria-label="可以抓取、揉皱和投掷的纸张"/><div ref={broom} className="giant-broom" aria-hidden="true"><div className="broom-handle"/><div className="broom-neck"/><div className="broom-head"/><div className="broom-bristles">{Array.from({length:95},(_,i)=><i key={i} style={{left:`${i*1.04}%`,height:`${85+i%8*2}%`,transform:`rotate(${(i-47)*.13}deg)`}}/>)}</div></div></>;
}
