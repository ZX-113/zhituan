export const W=420, H=536, LEFT=42, TOP=78, SIZE=22, LINE=40;
export const font = '"Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif';
export function creaseSeed(doc){let h=2166136261;for(const ch of String(doc.id||doc.number||1)){h=Math.imul(h^ch.charCodeAt(0),16777619);}return h>>>0;}
const rand=(i,k)=>{const a=Math.sin(i*127.1+k*311.7)*43758.5453;return a-Math.floor(a)};
export function paintPaper(canvas,doc,{background=true,placeholder=false}={}){
 const ratio=2; canvas.width=W*ratio;canvas.height=H*ratio;
 const c=canvas.getContext('2d'); c.scale(ratio,ratio);
 if(background){c.fillStyle='#deded8';c.fillRect(0,0,W,H);for(let i=0;i<8500;i++){c.fillStyle=`rgba(92,75,43,${rand(i,2)*.035})`;c.fillRect(rand(i,3)*W,rand(i,4)*H,.7,.7)}}
 const mess=doc.mess/100;
 let x=LEFT,y=TOP+SIZE,index=0;
 c.font=`${SIZE}px ${font}`;
 for(const ch of Array.from(doc.text)){
  if(ch==='\n'){x=LEFT;y+=LINE;index++;continue;}
  const advance=/[\u0000-\u00ff]/.test(ch)?c.measureText(ch).width:SIZE;
  if(x+advance>W-LEFT){x=LEFT;y+=LINE;}
  c.save();c.translate(x+advance/2+(rand(index,1)-.5)*mess*12,y+(rand(index,2)-.5)*mess*23);
  c.rotate((rand(index,3)-.5)*mess*.67);const scale=1+(rand(index,4)-.5)*mess*.55;c.scale(scale,scale);
  c.fillStyle='#3d4039';c.font=`${mess>.65?'600':'400'} ${SIZE}px ${font}`;
  c.fillText(ch,-advance/2,0);c.restore();x+=advance;index++;
 }
 doc.strokes.forEach(stroke=>{if(!stroke.points.length)return;c.beginPath();c.lineWidth=stroke.width;c.strokeStyle=stroke.color||'#41453b';c.lineCap='round';c.lineJoin='round';c.moveTo(...stroke.points[0]);if(stroke.points.length===1)c.lineTo(stroke.points[0][0]+.1,stroke.points[0][1]+.1);else stroke.points.slice(1).forEach(p=>c.lineTo(...p));c.stroke();});

 if(doc.creased){
  c.save();
  const seed=creaseSeed(doc)%100003,cols=3+seed%3,rows=4+Math.floor(seed/3)%3,points=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)points.push([
   x===0?0:x===cols?W:x*W/cols+(rand(y*(cols+1)+x,seed)-.5)*W/cols*.8,
   y===0?0:y===rows?H:y*H/rows+(rand(y*(cols+1)+x,seed+4)-.5)*H/rows*.8
  ]);
  function facet(ids,n){
   c.beginPath();ids.forEach((id,i)=>{const [x,y]=points[id];i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();
   c.fillStyle=n%2?`rgba(255,255,255,${.025+rand(n,seed)*.045})`:`rgba(28,27,25,${.015+rand(n,seed)*.04})`;
   c.fill();
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+1,d=a+cols+1,e=d+1;if(rand(a,seed+9)>.5){facet([a,b,e],a);facet([a,e,d],a+1);}else{facet([a,b,d],a);facet([b,e,d],a+1);}}
  c.restore();
 }
 return canvas;
}
export function textureCanvas(doc){return paintPaper(document.createElement('canvas'),doc)}
export function newDoc(number){return {id:crypto.randomUUID(),number,text:'',mess:15,strokes:[],creased:false,status:'editing'}}

export function fitsOnPaper(text){
 const c=document.createElement('canvas').getContext('2d');c.font=`${SIZE}px ${font}`;let x=LEFT,y=TOP+SIZE;
 for(const ch of Array.from(text)){if(ch==='\n'){x=LEFT;y+=LINE;}else{const a=/[\u0000-\u00ff]/.test(ch)?c.measureText(ch).width:SIZE;if(x+a>W-LEFT){x=LEFT;y+=LINE;}x+=a;}if(y>H-52)return false;}return true;
}
