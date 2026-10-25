/* ═══ Bahlman People — shared data layer (People page, Ideate, Library)
   Reads People/people.js (written by faces_run.py) + People/edits.js (names & corrections saved on this Mac)
   + edits made in this browser that haven't reached the Mac yet. Edits replay in order, exactly like faces_run.py. ═══ */
(function(){
'use strict';
const API='http://127.0.0.1:8766';
const LKEY='bm.people.edits';
const base=window.BM_PEOPLE||null;
const saved=Array.isArray(window.BM_PEOPLE_EDITS)?window.BM_PEOPLE_EDITS:[];
let local=[];try{local=JSON.parse(localStorage.getItem(LKEY))||[]}catch(e){}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
let state=null;const subs=new Set();
function allEdits(){const seen=new Set(saved.map(e=>e.id));return saved.concat(local.filter(e=>!seen.has(e.id)))}
// a "reset" wipes every name/correction made before it, in every browser (older edits are ignored by their time)
function liveEdits(){const all=allEdits();const r=all.filter(e=>e.op==='reset').map(e=>e.at||'').sort().pop()||'';return all.filter(e=>e.op!=='reset'&&(!r||(e.at||'')>r))}
function compute(){
 if(!base){state={ready:false,people:[],byId:new Map(),faces:{},byClip:new Map()};return}
 const people=new Map(base.people.map(p=>[p.id,Object.assign({},p)]));
 const faces={};for(const k in base.faces)faces[k]=base.faces[k].slice();
 const alias=new Map();const root=p=>{let n=0;while(alias.has(p)&&n++<50)p=alias.get(p);return p};
 let nextNew=Math.max(0,...base.people.map(p=>p.id))+1e6;
 for(const e of liveEdits()){
  if(e.op==='name'){const p=people.get(root(e.pid));if(p)p.name=(e.name||'').trim()||null}
  else if(e.op==='hide'){const p=people.get(root(e.pid));if(p)p.hidden=e.hidden!==false}
  else if(e.op==='merge'&&e.from!==e.into){alias.set(e.from,e.into);const a=people.get(e.from),b=people.get(root(e.into));if(a&&b&&!b.name&&a.name)b.name=a.name;people.delete(e.from)}
  else if(e.op==='move'&&faces[e.face]){let to=e.to;if(to!=null&&!people.has(root(to))&&!alias.has(to)){if(!people.has(to))people.set(to,{id:to,name:e.name||null,hidden:false,clips:0,faces:0,cover:String(e.face),hint:[],shoots:[],similar:[]})}faces[e.face][2]=to==null?null:root(to)}
 }
 for(const k in faces){const f=faces[k];if(f[2]!=null&&alias.has(f[2]))f[2]=root(f[2])}
 // recount from the faces so merges/moves show up immediately
 const byClip=new Map(),agg=new Map();
 for(const k in faces){const [clip,,pid]=faces[k];if(pid==null||!people.has(pid))continue;let a=agg.get(pid);if(!a){a={clips:new Set(),faces:[]};agg.set(pid,a)}a.clips.add(clip);a.faces.push(k);let s=byClip.get(clip);if(!s){s=new Set();byClip.set(clip,s)}s.add(pid)}
 for(const [pid,p] of people){const a=agg.get(pid);if(!a){people.delete(pid);continue}const all=[...a.clips];p.photoIds=all.filter(c=>c.startsWith('ph_'));p.clips=all.length-p.photoIds.length;p.photos=p.photoIds.length;p.faces=a.faces.length;p.faceIds=a.faces;if(!a.faces.includes(String(p.cover)))p.cover=a.faces.slice().sort((x,y)=>(faces[y][3]||0)-(faces[x][3]||0))[0];p.similar=(p.similar||[]).map(root).filter(x=>x!==pid&&people.has(x));p.similar=[...new Set(p.similar)]}
 const list=[...people.values()].sort((a,b)=>(b.clips+b.photos)-(a.clips+a.photos));
 state={ready:true,people:list,byId:people,faces,byClip,photos:base.photos||{},generated:base.generated,scanned:base.scanned,found:base.found||0}}
compute();
function persistLocal(){try{localStorage.setItem(LKEY,JSON.stringify(local))}catch(e){}}
let syncing=null,lastSync={ok:null,at:0};
async function sync(){if(syncing)return syncing;const pending=local.filter(e=>!saved.some(s=>s.id===e.id));if(!pending.length){lastSync={ok:true,at:Date.now()};return true}
 syncing=(async()=>{try{const r=await fetch(API+'/people/edits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edits:allEdits()})});if(!r.ok)throw new Error(r.status);const j=await r.json();if(j.ok){saved.splice(0,saved.length,...(j.edits||allEdits()));local=local.filter(e=>!saved.some(s=>s.id===e.id));persistLocal();lastSync={ok:true,at:Date.now()};return true}throw new Error('bad')}catch(e){lastSync={ok:false,at:Date.now()};return false}finally{syncing=null;subs.forEach(f=>{try{f(state,'sync')}catch(e){}})}})();return syncing}
function edit(op){const e=Object.assign({id:uid(),at:new Date().toISOString()},op);if(e.op==='move'&&e.to==='new')e.to=1e6+Math.floor(Math.random()*8e6);local.push(e);persistLocal();compute();subs.forEach(f=>{try{f(state,'edit')}catch(err){}});sync();return e}
addEventListener('storage',ev=>{if(ev.key===LKEY){try{local=JSON.parse(ev.newValue)||[]}catch(e){}compute();subs.forEach(f=>{try{f(state,'remote')}catch(err){}})}});
window.BMP={
 get ready(){return state.ready},get photos(){return state.photos||{}},get people(){return state.people},get faces(){return state.faces},get state(){return state},
 person:id=>state.byId.get(+id)||state.byId.get(id),
 inClip:id=>[...(state.byClip.get(id)||[])].map(p=>state.byId.get(p)).filter(Boolean),
 namesFor:id=>[...(state.byClip.get(id)||[])].map(p=>state.byId.get(p)).filter(p=>p&&p.name&&!p.hidden).map(p=>p.name),
 named:()=>state.people.filter(p=>p.name&&!p.hidden),
 label:p=>p?(p.name||('Person '+p.id)):'',
 crop:(fid,prefix)=>(prefix||'../People/')+'_faces/'+(state.faces[fid]?state.faces[fid][4]:''),
 edit,sync,status:()=>Object.assign({pending:local.filter(e=>!saved.some(s=>s.id===e.id)).length},lastSync),
 on:f=>{subs.add(f);return()=>subs.delete(f)},
 exportEdits:()=>JSON.stringify(allEdits(),null,1),
 // ask the Mac for its latest names (e.g. after a reference photo was matched there)
 pull:async()=>{try{const r=await fetch(API+'/people/edits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({edits:allEdits()})});const j=await r.json();if(j.ok){saved.splice(0,saved.length,...j.edits);local=local.filter(e=>!saved.some(x=>x.id===e.id));persistLocal();compute();subs.forEach(f=>{try{f(state,'edit')}catch(err){}});return true}}catch(e){}return false},
 api:API,
 importEdits:arr=>{const have=new Set(allEdits().map(e=>e.id));arr.filter(e=>e&&e.op&&!have.has(e.id)).forEach(e=>local.push(e));persistLocal();compute();subs.forEach(f=>f(state,'edit'));sync()},
};
if(state.ready)setTimeout(sync,800);
})();
