import React,{useState,useRef,useEffect} from 'react';
import { Keyboard, Pencil, Eraser, Undo2, Wind } from 'lucide-react';
import PaperScene from './PaperScene';
import ColorPicker from './ColorPicker';
import {paintPaper,newDoc,fitsOnPaper,W,H} from './paperContent';
const KEY='paper-room-v1';
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(d)&&d.length&&d.every(x=>x.id&&typeof x.text==='string'&&Array.isArray(x.strokes)))return d.map(x=>({...x,status:x.status==='ground'?'ground':'editing'}));}catch{}return [newDoc(1)];}
export default function App(){
 const [docs,setDocs]=useState(load);const [current,setCurrent]=useState(()=>docs.find(d=>d.status!=='ground')?.id||null);const [phase,setPhase]=useState(current?(docs.find(d=>d.id===current)?.readonly?'view':'editing'):'empty');const [mode,setMode]=useState('type');const [pen,setPen]=useState(2.5);const [color,setColor]=useState('#41453b');const [sweeping,setSweeping]=useState(false);const [paperMoving,setPaperMoving]=useState(false);const [clean,setClean]=useState(false);const [notice,setNotice]=useState('');const [holding,setHolding]=useState(false);const [failed,setFailed]=useState(false);const [tray,setTray]=useState(false);
 const pile=useRef(docs.filter(d=>d.status!=='ground').map(d=>d.id).reverse()),docsRef=useRef(docs);docsRef.current=docs;
 const groundGesture=useRef(null);
 const api=useRef(),paper=useRef(),draw=useRef(),input=useRef(),stroke=useRef(null),restored=useRef(false),history=useRef(new Map()),currentRef=useRef(current);currentRef.current=current;
 const doc=docs.find(d=>d.id===current),ground=docs.filter(d=>d.status==='ground'),stored=docs.filter(d=>d.status!=='ground'&&d.id!==current);
 const update=(patch)=>setDocs(ds=>ds.map(d=>d.id===current?{...d,...(typeof patch==='function'?patch(d):patch)}:d));
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(docs))}catch{setNotice('浏览器存储空间已满，当前内容仍保留在页面中。')}},[docs]);
 useEffect(()=>{if(draw.current&&doc)paintPaper(draw.current,doc);},[doc,mode,phase]);
 useEffect(()=>{if(api.current&&!restored.current){ground.forEach(d=>api.current.restore(d));pile.current.filter(id=>id!==current).forEach((id,index)=>{const d=docs.find(x=>x.id===id);api.current.park(d,paper.current.getBoundingClientRect(),index);});restored.current=true;}},[]);
 useEffect(()=>{if(!notice)return;let t=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(t)},[notice]);
 useEffect(()=>{function key(e){if(!['TEXTAREA','INPUT'].includes(e.target.tagName)&&phase==='editing'&&!e.metaKey&&!e.ctrlKey){if(e.key.toLowerCase()==='t')setMode('type');if(e.key.toLowerCase()==='p')setMode('draw');}if(e.key==='Escape'){setClean(false);setTray(false);}if((e.metaKey||e.ctrlKey)&&e.key==='z'&&mode!=='type'&&phase==='editing'){e.preventDefault();undo();}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[mode,phase,current]);
 function remember(){const stack=history.current.get(current)||[];stack.push(structuredClone(doc.strokes));if(stack.length>50)stack.shift();history.current.set(current,stack);}
 function undo(){const stack=history.current.get(current)||[];if(stack.length)update({strokes:stack.pop()});}
 function point(e){const r=paper.current.getBoundingClientRect();return [(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H]}
 function startStroke(e){if(mode==='type'||phase!=='editing')return;e.preventDefault();paper.current.setPointerCapture(e.pointerId);remember();if(mode==='erase'){stroke.current='erase';erase(point(e));return;}stroke.current={width:pen,color,points:[point(e)]};update(d=>({strokes:[...d.strokes,stroke.current]}));}
 function erase(p){update(d=>({strokes:d.strokes.filter(s=>!s.points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<15))}));}
 function moveStroke(e){if(!stroke.current)return;if(stroke.current==='erase'){erase(point(e));return;}stroke.current.points.push(point(e));const s={...stroke.current,points:[...stroke.current.points]};update(d=>({strokes:[...d.strokes.slice(0,-1),s]}));}
 function endStroke(e){stroke.current=null;if(paper.current?.hasPointerCapture(e.pointerId))paper.current.releasePointerCapture(e.pointerId);}
 function finish(){if(!doc||failed)return;input.current?.blur();api.current?.ready(doc,paper.current.getBoundingClientRect());setPhase('ready');}
 function parkCurrent(){const id=currentRef.current;if(!id)return;const d=docsRef.current.find(x=>x.id===id);if(d)api.current?.park(d,paper.current.getBoundingClientRect(),pile.current.indexOf(id));}
 function promote(id){const d=docsRef.current.find(x=>x.id===id);currentRef.current=id||null;setCurrent(id||null);if(!d){setPhase('empty');return;}if(d.readonly){api.current?.ready(d,paper.current.getBoundingClientRect());setPhase('ready');}else{api.current?.hide(id);setPhase('editing');}}
 function thrown(){setPaperMoving(true);const id=currentRef.current;pile.current=pile.current.filter(x=>x!==id);promote(pile.current.at(-1));}
 function takeNew(){if(holding)return;parkCurrent();const next=newDoc(Math.max(0,...docsRef.current.map(d=>d.number))+1);pile.current.push(next.id);currentRef.current=next.id;setDocs(ds=>[...ds,next]);setCurrent(next.id);setPhase('editing');setMode('type');setTray(false);}
 function groundDone(id,pos){setDocs(ds=>ds.map(d=>d.id===id?{...d,status:'ground',ground:pos}:d));}
 function pickup(d){if(phase==='editing'||sweeping||holding||!docsRef.current.some(x=>x.id===d.id&&x.status==='ground'))return;parkCurrent();pile.current=pile.current.filter(id=>id!==d.id);pile.current.push(d.id);currentRef.current=d.id;setCurrent(d.id);setPhase('opening');setDocs(ds=>ds.map(x=>x.id===d.id?{...x,status:'editing',creased:true,readonly:true}:x));api.current?.open(d.id,paper.current.getBoundingClientRect());}
 function startGround(e,d){if(e.button!==0||sweeping||holding)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const g={id:d.id,doc:d,pointer:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,start:performance.now(),dragging:false};groundGesture.current=g;g.timer=setTimeout(()=>{if(groundGesture.current!==g)return;g.dragging=api.current?.grabGround(g.id,g.x,g.y);if(g.dragging)setHolding(true);},260);}
 function moveGround(e){const g=groundGesture.current;if(!g||g.pointer!==e.pointerId)return;g.lastX=e.clientX;g.lastY=e.clientY;if(!g.dragging&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>6){clearTimeout(g.timer);g.dragging=api.current?.grabGround(g.id,g.x,g.y);if(g.dragging)setHolding(true);}if(g.dragging)api.current?.moveGround(g.id,e.clientX,e.clientY);}
 function endGround(e,cancel=false){const g=groundGesture.current;if(!g||g.pointer!==e.pointerId)return;clearTimeout(g.timer);groundGesture.current=null;if(g.dragging){setPaperMoving(true);api.current?.releaseGround(g.id,cancel);setHolding(false);}else if(!cancel&&performance.now()-g.start<260&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<=6)pickup(g.doc);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 useEffect(()=>()=>{if(groundGesture.current)clearTimeout(groundGesture.current.timer)},[]);
 function switchDoc(d){if(holding)return;parkCurrent();pile.current=pile.current.filter(id=>id!==d.id);pile.current.push(d.id);promote(d.id);setTray(false);}
 return <div className={`room phase-${phase}`}>
  <div className="darkness"/><div className="floor"/><div className="light-pool"/>
  <div className="dust" aria-hidden="true">{Array.from({length:46},(_,i)=><i key={i} style={{'--x':`${16+(i*37.17)%70}%`,'--y':`${7+(i*23.13)%79}%`,'--size':`${i%7===0?2:1}px`,'--duration':`${19+i%19}s`,'--delay':`${-i*2.7}s`,'--alpha':.1+(i%5)*.065}}/>)}</div>
  <main className="workspace">
   <aside className={`tools ${phase==='editing'?'':'muted'}`} aria-label="书写工具">
    <button aria-label="打字" title="打字" disabled={phase!=='editing'} className={mode==='type'?'selected':''} onClick={()=>setMode('type')}><Keyboard size={19}/></button>
    <button aria-label="手写" title="手写" disabled={phase!=='editing'} className={mode==='draw'?'selected':''} onClick={()=>setMode('draw')}><Pencil size={19}/></button>
    {mode==='draw'&&<ColorPicker color={color} onChange={setColor}/>}
    <div className="tool-divider"/>
    <button aria-label="橡皮" title="橡皮" disabled={phase!=='editing'} className={mode==='erase'?'selected':''} onClick={()=>setMode('erase')}><Eraser size={18}/></button>
    <button aria-label="撤销笔迹" title="撤销笔迹" disabled={phase!=='editing'||!doc?.strokes.length} onClick={undo}><Undo2 size={18}/></button>
    {mode!=='type'&&<label className="pen-control"><input aria-label="笔触粗细" type="range" min="1" max="8" step=".5" value={pen} style={{'--value':`${(pen-1)/7*100}%`}} onChange={e=>setPen(+e.target.value)}/></label>}
   </aside>
   <div className="sheet-column">
    <div ref={paper} className={`paper ${phase==='editing'||phase==='view'?'visible':''} mode-${mode} ${doc?.creased?'creased':''}`} onPointerDown={e=>{if(phase==='view'){api.current?.ready(doc,paper.current.getBoundingClientRect());setPhase('ready');requestAnimationFrame(()=>api.current?.crumple());}else startStroke(e)}} onPointerMove={moveStroke} onPointerUp={endStroke} onPointerCancel={endStroke}>
     {doc&&<><canvas ref={draw} className="written-paper"/>{phase==='editing'&&mode==='type'&&<textarea ref={input} aria-label="在纸上写字" value={doc.text} maxLength={280} spellCheck="false" onChange={e=>{if(fitsOnPaper(e.target.value))update({text:e.target.value});else setNotice('这张纸写满了，可以再拿一张。')}}/>}<div className="paper-edge"/></>}
    </div>
    {phase==='empty'&&!paperMoving&&!sweeping&&<div className="empty-sheet"><button className="primary new-paper" onClick={takeNew}>拿一张纸</button></div>}
    <div className="below-paper">
     {phase==='editing'&&<button className="primary finish" onClick={finish} disabled={failed}>写完了</button>}
    </div>
   </div>
   <aside className={`style-panel ${phase==='editing'?'':'muted'}`}>
    <input onPointerDown={e=>{e.stopPropagation();input.current?.blur();e.currentTarget.focus({preventScroll:true});}} aria-label="字体从工整到凌乱" disabled={phase!=='editing'} type="range" min="0" max="100" value={doc?.mess||0} onChange={e=>update({mess:+e.target.value})} style={{'--value':`${doc?.mess||0}%`}}/>
    <div className="range-labels"><span>工整</span><span>凌乱</span></div>
   </aside>
  </main>
  <PaperScene apiRef={api} onGround={groundDone} onOpen={id=>{if(currentRef.current===id)setPhase('ready')}} onSweepEnd={ids=>{setDocs(ds=>ds.filter(d=>!ids.includes(d.id)));setSweeping(false)}} onHold={setHolding} onMotion={setPaperMoving} onThrow={thrown} onError={()=>{setFailed(true);setNotice('当前浏览器无法启用立体纸张，请换用支持 WebGL 的浏览器。')}}/>
  <div className={`ground-picks ${sweeping?'sweeping':''}`}>{ground.map(d=><button key={d.id} className="ground-pick" aria-label={`捡起第 ${d.number} 张纸`} style={{left:`${d.ground?.x*100||20}%`,bottom:(d.ground?.bottom||70)-38}} onPointerDown={e=>startGround(e,d)} onPointerMove={moveGround} onPointerUp={e=>endGround(e)} onPointerCancel={e=>endGround(e,true)} onLostPointerCapture={e=>endGround(e,true)} onClick={e=>{if(e.detail===0)pickup(d)}}></button>)}</div>
  <footer><div className="footer-actions"><button aria-label="清扫地面" title="清扫地面" disabled={!ground.length||sweeping||phase==='throwing'||phase==='opening'||holding} onClick={()=>setClean(true)}><Wind size={19}/></button></div></footer>
  {notice&&<div className="toast" role="status">{notice}</div>}
  {clean&&<div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="清扫地面"><Wind size={26}/><h2>清扫地面？</h2><p>清除 {ground.length} 张纸，无法撤销。</p><div className="modal-actions"><button onClick={()=>setClean(false)}>取消</button><button className="primary" onClick={()=>{setSweeping(true);api.current?.sweep(ground.map(d=>d.id));setClean(false)}}>清扫地面</button></div></div></div>}
 </div>
}
