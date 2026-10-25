/* ═══ Bahlman Media · People
   Names, merges and corrections for the faces found by faces_run.py. Clip details come from the Library's clips.js. ═══ */
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const LIB='../Sean (DON\'T TOUCH)/',SHEETS='../Contact Sheets/';
const phImg=(k,size)=>LIB+'_photos/'+(size||'thumb')+'/'+k.slice(3)+'.jpg';
const appears=p=>[p.clips?`${p.clips.toLocaleString()} clip${p.clips>1?'s':''}`:'',p.photos?`${p.photos.toLocaleString()} photo${p.photos>1?'s':''}`:''].filter(Boolean).join(' · ');
const EMBED=new URLSearchParams(location.search).has('embed');if(EMBED)document.body.classList.add('embed');
const thumb=c=>LIB+'_thumbs/'+c.id+'.jpg';
const sheet=c=>SHEETS+(c.drive==='Expansion'?'Expansion/':'')+c.sheet;
const crop=fid=>BMP.crop(fid,'');
const nice=s=>String(s||'').replace(/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}\s*/,'').replace(/\s*\|\s*Bahlman$/,'');
const mmss=s=>{s=Math.round(s||0);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const libLink=c=>LIB+'index.html#c='+encodeURIComponent(c.client)+(c.brand&&c.brand!==c.client?'&b='+encodeURIComponent(c.brand):'')+'&s='+encodeURIComponent(c.shoot);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._k);t._k=setTimeout(()=>t.classList.remove('on'),2000)};
const label=p=>BMP.label(p);
let CL=new Map();                 // clip id -> clip
let CLIENT_NAMES=new Set();       // clients that are people (their name could be a face's name)
let view={tab:'todo',q:'',sort:'clips'};try{Object.assign(view,JSON.parse(localStorage.getItem('bm.people.view'))||{})}catch(e){}
const saveView=()=>{try{localStorage.setItem('bm.people.view',JSON.stringify(view))}catch(e){}};
let openId=null,selFaces=new Set();

/* ── boot ── */
function boot(){
 if(!BMP.ready){$('#loading').remove();renderEmpty();return}
 const sc=document.createElement('script');sc.src=LIB+'clips.js';
 sc.onload=()=>{(window.BM_CLIPS||[]).forEach(c=>CL.set(c.id,c));CLIENT_NAMES=new Set([...CL.values()].map(c=>c.client).filter(n=>/^[A-Z][a-z]+ [A-Z][a-z'-]+$/.test(n||'')));done()};
 sc.onerror=done;document.head.appendChild(sc);
 function done(){$('#loading').classList.add('off');setTimeout(()=>$('#loading').remove(),500);render();const h=location.hash.match(/^#p=(\d+)/);if(h)openPerson(+h[1])}}
BMP.on((s,why)=>{if(why==='sync'){renderStats();return}BEST=null;render();if(openId!=null){if(BMP.person(openId))openPerson(openId,true);else closeModal()}});

function renderEmpty(){$('#stats').innerHTML='';$('#body').innerHTML=`<div class="pp-empty"><h3>No faces scanned yet</h3><p>Faces are found automatically the first time <b>Siftor Ingest</b> runs over your footage. It reads the contact sheets, so the footage drives don't need to be plugged in. When it finishes, reload this page.</p><p class="mut">Everything runs on this Mac. No footage or faces leave the computer.</p></div>`}
function renderNobody(){renderStats();const st=BMP.state,n=st.found||0;$('#body').innerHTML=`<div class="pp-empty"><h3>${n?`${n.toLocaleString()} face${n===1?'':'s'} found, but none clear enough to show`:'No faces found in these clips'}</h3><p>${n?'The faces in these clips were too small or blurred on the contact sheet to tell people apart (about 28 pixels across is the minimum, unless a face stays in shot for several frames).':'Faces need to be at least about 16 pixels across on the contact sheet. Wide stage shots, crowds and drone footage are too small to recognise.'}</p><p class="mut">Everything runs on this Mac. No footage or faces leave the computer.</p></div>`}

/* ── stats + sync status ── */
function renderStats(){const ps=BMP.people,named=ps.filter(p=>p.name&&!p.hidden).length,st=BMP.status();
 const sync=st.pending?`<span class="pp-sync warn" title="Names are saved in this browser. Start the Library server (Start Library Chat) to save them to the Mac so Ideate and future scans keep them.">● ${st.pending} change${st.pending>1?'s':''} saved in this browser only</span>`:`<span class="pp-sync ok">● Saved on this Mac</span>`;
 $('#stats').innerHTML=`<div><b>${ps.filter(p=>!p.hidden&&!p.once).length.toLocaleString()}</b><span>people found</span></div><div><b>${ps.filter(p=>!p.hidden&&p.once).length.toLocaleString()}</b><span>seen once</span></div><div><b>${named.toLocaleString()}</b><span>named</span></div><div><b>${(BMP.state.scanned||0).toLocaleString()}</b><span>clips scanned</span></div>${sync}`}

/* ── grid ── */
// only the person seen most at a client's shoots gets the "Is this <client>?" suggestion
let BEST=null;function bestByClient(){const m=new Map();for(const p of BMP.people){if(p.hidden||!p.hint||!p.hint.length)continue;const [top,n]=p.hint[0];if(!CLIENT_NAMES.has(top)||n/Math.max(1,p.clips)<.6)continue;const b=m.get(top);if(!b||n>b.n)m.set(top,{id:p.id,n})}return m}
function suggestion(p){if(p.name||!p.hint||!p.hint.length)return null;const top=p.hint[0][0];if(BMP.named().some(x=>x.name===top))return null;BEST=BEST||bestByClient();const b=BEST.get(top);return b&&b.id===p.id?top:null}
function list(){let ps=BMP.people;const q=view.q.trim().toLowerCase();
 if(view.tab==='todo')ps=ps.filter(p=>!p.name&&!p.hidden&&!p.once);else if(view.tab==='once')ps=ps.filter(p=>!p.name&&!p.hidden&&p.once);else if(view.tab==='named')ps=ps.filter(p=>p.name&&!p.hidden);else if(view.tab==='hidden')ps=ps.filter(p=>p.hidden);
 if(q)ps=ps.filter(p=>label(p).toLowerCase().includes(q)||(p.hint||[]).some(([h])=>h.toLowerCase().includes(q))||(p.shoots||[]).some(([s])=>s.toLowerCase().includes(q)));
 ps=ps.slice();if(view.sort==='name')ps.sort((a,b)=>label(a).localeCompare(label(b),undefined,{numeric:true}));else if(view.sort==='few')ps.sort((a,b)=>a.clips-b.clips);
 return ps}
let shown=0;const PAGE=120;
function render(){if(!BMP.people.length){renderNobody();return}renderStats();const all=BMP.people;const c={todo:all.filter(p=>!p.name&&!p.hidden&&!p.once).length,once:all.filter(p=>!p.name&&!p.hidden&&p.once).length,named:all.filter(p=>p.name&&!p.hidden).length,hidden:all.filter(p=>p.hidden).length,all:all.length};
 const body=$('#body');const keepFocus=document.activeElement&&document.activeElement.id==='ppq';
 body.innerHTML=`<div class="pp-bar"><div class="pp-tabs">${[['todo','To name'],['once','Seen once'],['named','Named'],['hidden','Hidden'],['all','All']].map(([k,n])=>`<button data-tab="${k}" class="${view.tab===k?'on':''}">${n}<em>${c[k].toLocaleString()}</em></button>`).join('')}</div>
  <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ppq" placeholder="Find a person, client or shoot…" value="${esc(view.q)}" autocomplete="off"></label>
  <button class="btn2" id="ppadd" title="Add person from photo">＋ From photo</button>
  <select id="ppsort"><option value="clips">Most appearances</option><option value="name">A–Z</option><option value="few">Fewest clips</option></select>
  <button class="btn2" id="ppmore">⋯</button></div>
  ${view.tab==='todo'&&c.todo?`<p class="pp-tip">Start with the people at the top — they're in the most clips. Type a name and press Enter. Where most of someone's clips come from one client's shoots, there's a one-click suggestion.</p>`:view.tab==='once'&&c.once?`<p class="pp-tip">These faces were clear enough to recognise but have only turned up in one clip so far. Name anyone you know; when the same face appears in another clip they move to the main list.</p>`:''}
  <div class="pp-grid" id="grid"></div><button class="more" id="ppnext" hidden>Show more</button>`;
 $('#ppsort').value=view.sort;shown=0;more();
 if(keepFocus){const i=$('#ppq');i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
function more(){const ps=list();const g=$('#grid');const slice=ps.slice(shown,shown+PAGE);g.insertAdjacentHTML('beforeend',slice.map(card).join(''));shown+=slice.length;$('#ppnext').hidden=shown>=ps.length;
 if(!ps.length)g.innerHTML=`<div class="pp-none">${view.tab==='todo'?(BMP.people.some(p=>p.once&&!p.name&&!p.hidden)?'Everyone seen in more than one clip has a name. The rest are under “Seen once”.':'Everyone has a name. 🎉'):view.tab==='once'?'Nobody seen only once.':view.tab==='named'?'Nobody named yet — start in “To name”.':view.tab==='hidden'?'Nobody hidden.':'No matches.'}</div>`}
function card(p){const s=suggestion(p);return `<div class="pp-card${p.hidden?' hid':''}" data-p="${p.id}"><div class="pp-face"><img loading="lazy" src="${crop(p.cover)}" alt=""></div>
 <input class="pp-name" data-name="${p.id}" value="${esc(p.name||'')}" placeholder="${esc('Person '+p.id)}" spellcheck="false" aria-label="Name">
 <div class="pp-meta">${appears(p)}${p.hint&&p.hint[0]?` · <span title="Most of their clips are from these shoots">${esc(p.hint[0][0])}</span>`:''}</div>
 ${s?`<div class="pp-sug"><span>Is this ${esc(s)}?</span><button data-yes="${p.id}" data-n="${esc(s)}">Yes</button></div>`:''}</div>`}

/* events: grid */
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');if(tab){view.tab=tab.dataset.tab;saveView();render();return}
 if(e.target.id==='ppnext'){more();return}
 if(e.target.id==='ppadd'){addFromPhoto();return}
 if(e.target.id==='ppmore'){menu(e.target,[['Add person from photo',addFromPhoto],['Clear all names & corrections',resetAll],['Export names & corrections',exportEdits],['Import names & corrections',importEdits],['How rescanning works',howTo]]);return}
 const y=e.target.closest('[data-yes]');if(y){BMP.edit({op:'name',pid:+y.dataset.yes,name:y.dataset.n});toast('Named '+y.dataset.n);return}
 const cardEl=e.target.closest('.pp-card');if(cardEl&&!e.target.closest('input,button'))openPerson(+cardEl.dataset.p)});
document.addEventListener('input',e=>{if(e.target.id==='ppq'){view.q=e.target.value;saveView();clearTimeout(window._qt);window._qt=setTimeout(()=>{shown=0;$('#grid').innerHTML='';more()},150)}});
document.addEventListener('change',e=>{if(e.target.id==='ppsort'){view.sort=e.target.value;saveView();render()}});
document.addEventListener('keydown',e=>{const n=e.target.closest&&e.target.closest('[data-name]');if(n&&e.key==='Enter'){e.preventDefault();n.blur()}if(e.key==='Escape'){if($('#pop').classList.contains('on'))closePop();else if($('#modal').classList.contains('on'))closeModal()}});
document.addEventListener('focusout',e=>{const n=e.target.closest&&e.target.closest('[data-name]');if(!n)return;const p=BMP.person(+n.dataset.name);if(!p)return;const v=n.value.trim();if(v===(p.name||''))return;
 const same=BMP.named().find(x=>x.id!==p.id&&x.name.toLowerCase()===v.toLowerCase());
 if(same){confirmMerge(p,same,()=>{n.value=p.name||''});return}
 BMP.edit({op:'name',pid:p.id,name:v});toast(v?'Named '+v:'Name removed')});
function confirmMerge(p,into,cancel){modalBox(`<h3>${esc(into.name)} already exists</h3><p>Are these the same person? Merging puts all ${appears(p)} under <b>${esc(into.name)}</b>.</p><div class="pp-pair"><img src="${crop(p.cover)}"><span>→</span><img src="${crop(into.cover)}"></div><div class="pp-btns"><button class="btn2 ghost" data-x>Cancel</button><button class="btn lux" data-ok>Merge</button></div>`,{small:true});
 $('#modal [data-x]').onclick=()=>{closeModal();cancel&&cancel()};$('#modal [data-ok]').onclick=()=>{BMP.edit({op:'merge',from:p.id,into:into.id});closeModal();toast('Merged into '+into.name)}}

/* ── person detail ── */
function openPerson(id,keep){const p=BMP.person(id);if(!p)return;openId=id;if(!keep)selFaces.clear();history.replaceState(null,'','#p='+id);
 const faces=p.faceIds.map(f=>({fid:f,clip:BMP.faces[f][0],t:BMP.faces[f][1],frames:BMP.faces[f][3]}));
 const phs=[...new Set(faces.map(f=>f.clip).filter(c=>c.startsWith('ph_')))].map(k=>({k,m:BMP.photos[k]||[k.slice(3)]})).sort((a,b)=>String(b.m[3]||'').localeCompare(String(a.m[3]||'')));
 const clips=[...new Set(faces.map(f=>f.clip))].map(id=>CL.get(id)).filter(Boolean).sort((a,b)=>(b.shoot_date||'').localeCompare(a.shoot_date||''));
 const sim=(p.similar||[]).map(x=>BMP.person(x)).filter(Boolean);
 const fsorted=faces.slice().sort((a,b)=>b.frames-a.frames);
 modalBox(`<div class="pp-dhd"><img class="pp-big" src="${crop(p.cover)}" alt=""><div class="pp-dt"><input class="pp-name big" data-name="${p.id}" value="${esc(p.name||'')}" placeholder="${esc('Person '+p.id)} — type a name" spellcheck="false">
  <div class="pp-meta">${appears(p)} · ${p.faces.toLocaleString()} sightings${p.hint&&p.hint.length?' · mostly '+p.hint.map(([h,n])=>`${esc(h)} (${n})`).join(', '):''}</div>
  <div class="pp-acts"><button class="btn2" data-act="merge">Merge with…</button><button class="btn2" data-act="hide">${p.hidden?'Unhide':'Hide (not important)'}</button>${p.name?`<a class="btn2" href="../Ideate/index.html?who=${encodeURIComponent(p.name)}" ${EMBED?'data-ideate':''}>Find footage in Ideate →</a>`:''}</div></div><button class="pp-x" data-close>✕</button></div>
  ${sim.length?`<div class="pp-sim"><span>Same person?</span>${sim.map(s=>`<button data-merge-with="${s.id}" title="Merge ${esc(label(s))} into this person"><img src="${crop(s.cover)}"><b>${esc(label(s))}</b><em>${appears(s)}</em></button>`).join('')}</div>`:''}
  <div class="pp-sec"><h4>Faces <em>${faces.length}</em><span class="sp"></span><span class="pp-selbar" id="selbar"></span></h4><p class="mut">Click any face that isn't ${esc(label(p))} to select it, then remove or move it.</p>
  <div class="pp-faces">${fsorted.slice(0,240).map(f=>`<button class="pp-f${selFaces.has(f.fid)?' on':''}" data-face="${f.fid}" title="${esc(f.clip)} · ${mmss(f.t)} · in ${f.frames} of 12 frames"><img loading="lazy" src="${crop(f.fid)}"></button>`).join('')}${faces.length>240?`<span class="mut">+ ${faces.length-240} more</span>`:''}</div></div>
  ${phs.length?`<div class="pp-sec"><h4>Photos <em>${phs.length}</em></h4><div class="pp-photos">${phs.slice(0,300).map(x=>`<a class="pp-ph" href="${phImg(x.k,'web')}" target="_blank" data-photo="${x.k}" title="${esc((x.m[1]||'')+' · '+nice(x.m[2]||''))}"><img loading="lazy" src="${phImg(x.k)}" alt=""></a>`).join('')}${phs.length>300?`<span class="mut">+ ${phs.length-300} more</span>`:''}</div></div>`:''}
  <div class="pp-sec"><h4>Clips <em>${clips.length}</em></h4><div class="pp-clips">${clips.slice(0,300).map(c=>{const f=faces.find(x=>x.clip===c.id);return `<a class="pp-clip" data-clip="${c.id}" data-t="${f?f.t:0}" href="${libLink(c)}" target="_top"><div class="im${c.orientation==='vertical'?' v':''}"><img loading="lazy" src="${thumb(c)}" alt=""><span class="dur">${mmss(c.duration)}</span></div><div class="in"><b>${esc(c.client)} · ${esc(nice(c.shoot))}</b><span>${esc(c.description||'')}</span></div></a>`}).join('')}${clips.length>300?`<span class="mut">+ ${clips.length-300} more — search for ${esc(label(p))} in Ideate to see all</span>`:''}</div></div>`);
 updateSelbar(p)}
function updateSelbar(p){const el=$('#selbar');if(!el)return;el.innerHTML=selFaces.size?`<b>${selFaces.size} selected</b><button data-act="notthem">Not ${esc(label(p))}</button><button data-act="moveto">Move to…</button><button data-act="clearsel">Clear</button>`:''}
$('#modal').addEventListener('click',e=>{const p=BMP.person(openId);
 if(e.target===$('#modal')||e.target.closest('[data-close]')){closeModal();return}
 if(!p)return;
 const f=e.target.closest('[data-face]');if(f){const id=f.dataset.face;selFaces.has(id)?selFaces.delete(id):selFaces.add(id);f.classList.toggle('on');updateSelbar(p);return}
 const mw=e.target.closest('[data-merge-with]');if(mw){const o=BMP.person(+mw.dataset.mergeWith);const keepName=p.name||o.name;BMP.edit({op:'merge',from:o.id,into:p.id});if(!p.name&&o.name)BMP.edit({op:'name',pid:p.id,name:keepName});toast('Merged');return}
 const id=e.target.closest('[data-ideate]');if(id){e.preventDefault();try{localStorage.setItem('bm.ideate.who',p.name)}catch(err){}if(window.parent!==window)parent.postMessage({bm:'step',step:'ideate'},'*');else location.href=id.href;return}
 const ph=e.target.closest('[data-photo]');if(ph&&!e.metaKey&&!e.ctrlKey){e.preventDefault();showPhoto(ph.dataset.photo,p);return}
 const clip=e.target.closest('[data-clip]');if(clip&&!e.metaKey&&!e.ctrlKey){e.preventDefault();showClip(clip.dataset.clip,+clip.dataset.t,p);return}
 const a=e.target.closest('[data-act]');if(!a)return;const act=a.dataset.act;
 if(act==='hide'){BMP.edit({op:'hide',pid:p.id,hidden:!p.hidden});toast(p.hidden?'Unhidden':'Hidden — they won\'t appear in searches');return}
 if(act==='merge'){pickPerson(a,p.id,'Merge '+label(p)+' into…',o=>{BMP.edit({op:'merge',from:p.id,into:o.id});openId=o.id;toast('Merged into '+label(o))});return}
 if(act==='notthem'){const n=selFaces.size;selFaces.forEach(fid=>BMP.edit({op:'move',face:fid,to:null}));selFaces.clear();toast(`Removed ${n} face${n>1?'s':''} from ${label(p)}`);return}
 if(act==='moveto'){pickPerson(a,p.id,'Move '+selFaces.size+' faces to…',o=>{const n=selFaces.size;selFaces.forEach(fid=>BMP.edit({op:'move',face:fid,to:o==='new'?'new':o.id}));selFaces.clear();toast(`Moved ${n} face${n>1?'s':''}`)},true);return}
 if(act==='clearsel'){selFaces.clear();$$('.pp-f.on').forEach(x=>x.classList.remove('on'));updateSelbar(p)}});
function showClip(id,t,p){const c=CL.get(id);if(!c)return;const pop=document.createElement('div');pop.className='pp-sheet';pop.innerHTML=`<div class="pp-sheetbox"><div class="pp-sheethd"><b>${esc(c.id)} · ${esc(c.client)} · ${esc(nice(c.shoot))}</b><span>${label(p)} at ${mmss(t)}</span><a class="btn2" href="${libLink(c)}" target="_top">Open in Library</a><button class="pp-x" data-x>✕</button></div><img src="${sheet(c)}" alt="Contact sheet" onerror="this.replaceWith(Object.assign(document.createElement('img'),{src:'${thumb(c)}'}))"><p>${esc(c.description||'')}</p></div>`;document.body.appendChild(pop);pop.onclick=e=>{if(e.target===pop||e.target.closest('[data-x]'))pop.remove()}}

function showPhoto(k,p){const m=BMP.photos[k]||[k.slice(3)];const pop=document.createElement('div');pop.className='pp-sheet';pop.innerHTML=`<div class="pp-sheetbox"><div class="pp-sheethd"><b>${esc(m[1]||'')} · ${esc(nice(m[2]||''))}</b><span>${esc(m[6]||'')}</span><a class="btn2" href="${phImg(k,'web')}" target="_blank">Open full size</a><button class="pp-x" data-x>✕</button></div><img src="${phImg(k,'web')}" alt="" style="max-height:78vh;object-fit:contain;background:#000"></div>`;document.body.appendChild(pop);pop.onclick=e=>{if(e.target===pop||e.target.closest('[data-x]'))pop.remove()}}
/* ── person picker (merge / move) ── */
function pickPerson(anchor,exclude,title,fn,allowNew){const draw=q=>{q=(q||'').toLowerCase();const self=BMP.person(exclude);const sim=new Set((self&&self.similar)||[]);let ps=BMP.people.filter(x=>x.id!==exclude&&!x.hidden&&(!q||label(x).toLowerCase().includes(q)));ps.sort((a,b)=>(sim.has(b.id)-sim.has(a.id))||(!!b.name-!!a.name)||b.clips-a.clips);ps=ps.slice(0,60);
  return `<h5>${esc(title)}</h5><input id="pkq" placeholder="Search people" value="${esc(q)}">${allowNew?`<button class="pp-pk new" data-pk="new">＋ A new person</button>`:''}${ps.map(x=>`<button class="pp-pk" data-pk="${x.id}"><img src="${crop(x.cover)}"><b>${esc(label(x))}</b><em>${sim.has(x.id)?'looks similar · ':''}${appears(x)}</em></button>`).join('')}`};
 const pop=$('#pop');pop.innerHTML=draw('');pop.classList.add('on');const r=anchor.getBoundingClientRect();pop.style.left=Math.min(innerWidth-340,r.left)+'px';pop.style.top=Math.min(innerHeight-420,r.bottom+6)+'px';
 const bind=()=>{$('#pkq',pop).oninput=e=>{const v=e.target.value;pop.innerHTML=draw(v);bind();const i=$('#pkq',pop);i.focus();i.setSelectionRange(v.length,v.length)};$$('[data-pk]',pop).forEach(b=>b.onclick=()=>{closePop();fn(b.dataset.pk==='new'?'new':BMP.person(+b.dataset.pk))})};bind();$('#pkq',pop).focus()}
function closePop(){$('#pop').classList.remove('on')}
document.addEventListener('pointerdown',e=>{const p=$('#pop');if(p.classList.contains('on')&&!p.contains(e.target)&&!e.target.closest('[data-act]'))closePop()},true);
function menu(anchor,items){const pop=$('#pop');pop.innerHTML=items.map(([n],i)=>`<button class="pp-mi" data-mi="${i}">${esc(n)}</button>`).join('');pop.classList.add('on');const r=anchor.getBoundingClientRect();pop.style.left=Math.max(8,r.right-300)+'px';pop.style.top=(r.bottom+6)+'px';$$('[data-mi]',pop).forEach(b=>b.onclick=()=>{closePop();items[+b.dataset.mi][1]()})}

/* ── modal helpers ── */
function modalBox(html,o={}){const m=$('#modal');m.innerHTML=`<div class="pp-box${o.small?' small':''}">${html}</div>`;m.classList.add('on');document.body.style.overflow='hidden'}
function closeModal(){const m=$('#modal');m.classList.remove('on');m.innerHTML='';openId=null;document.body.style.overflow='';history.replaceState(null,'',location.pathname+location.search)}

/* ── add person from photo (reference headshot → name) ── */
function addFromPhoto(){modalBox(`<h3>Add person from photo</h3><p>Pick a clear, front-facing photo of someone and type their name. The app finds them among the faces in your footage and names every clip and photo they're in.</p>
 <label class="pp-drop" id="kDrop"><input type="file" accept="image/*" id="kFile" hidden><img id="kPrev" alt="" hidden><span id="kHint">Click to choose a photo — or drop one here</span></label>
 <input class="pp-in" id="kName" placeholder="Their full name" autocomplete="off">
 <div class="pp-kres" id="kRes"></div><div class="pp-btns"><button class="btn2 ghost" data-close>Close</button><button class="btn lux" id="kGo" disabled>Find them</button></div>`,{small:true});
 let data=null;const go=$('#kGo'),nm=$('#kName');const ready=()=>go.disabled=!(data&&nm.value.trim());
 const take=f=>{if(!f)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const k=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);data=c.toDataURL('image/jpeg',.9);$('#kPrev').src=data;$('#kPrev').hidden=false;$('#kHint').hidden=true;if(!nm.value)nm.value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');ready()};img.src=r.result};r.readAsDataURL(f)};
 $('#kFile').onchange=e=>take(e.target.files[0]);const dz=$('#kDrop');dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');take(e.dataTransfer.files[0])};nm.oninput=ready;
 go.onclick=async()=>{const name=nm.value.trim();go.disabled=true;const res=$('#kRes');res.innerHTML='<span class="mut">Uploading…</span>';
  let j;try{const r=await fetch(BMP.api+'/people/known',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,image:data})});j=await r.json()}catch(e){res.innerHTML='<span class="bad">The Library server isn\'t running. Quit and reopen the Bahlman Library app, then try again.</span>';go.disabled=false;return}
  if(!j.ok){res.innerHTML=`<span class="bad">${esc(j.error||'Upload failed')}</span>`;go.disabled=false;return}
  res.innerHTML='<span class="mut">Looking for them in your footage… (about 10–20 seconds)</span>';
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,1500));let k;try{k=(await (await fetch(BMP.api+'/people/known')).json()).known[j.file]}catch(e){}if(!k)continue;
   if(k.ok){await BMP.pull();const p=BMP.person(k.pid);res.innerHTML=`<div class="pp-kok"><img src="${p?crop(p.cover):''}"><div><b>Found ${esc(name)}</b><br><span class="mut">${p?appears(p):''} · match ${Math.round(k.sim*100)}%</span></div></div>`;toast('Named '+name);setTimeout(()=>{if(p)openPerson(p.id)},1600);return}
   const cands=(k.candidates||[]).map(([pid,sm])=>BMP.person(pid)).filter(Boolean);
   res.innerHTML=`<span class="bad">${esc(k.why)}</span>${cands.length?`<div class="pp-kc"><span class="mut">Is it one of these?</span>${cands.map(p=>`<button data-kpick="${p.id}"><img src="${crop(p.cover)}"><em>${esc(appears(p))}</em></button>`).join('')}</div>`:''}`;
   $$('[data-kpick]',res).forEach(b=>b.onclick=()=>{BMP.edit({op:'name',pid:+b.dataset.kpick,name});toast('Named '+name);openPerson(+b.dataset.kpick)});go.disabled=false;return}
  res.innerHTML='<span class="bad">Still working — check back in a minute (the result will show up in People).</span>'}}
/* ── export / import / help ── */
function resetAll(){modalBox(`<h3>Start over?</h3><p>This removes every name, merge, hide and face correction, on this Mac and in every window of the app. The faces themselves stay; you can export a backup first.</p><div class="pp-btns"><button class="btn2 ghost" data-close>Cancel</button><button class="btn2 ghost" id="rsExp">Export backup</button><button class="btn lux" id="rsGo">Clear everything</button></div>`,{small:true});$('#rsExp').onclick=exportEdits;$('#rsGo').onclick=()=>{BMP.edit({op:'reset'});closeModal();toast('All names cleared')}}
function exportEdits(){const b=new Blob([BMP.exportEdits()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='bahlman-people-names.json';a.click();toast('Exported')}
function importEdits(){const i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=async()=>{try{BMP.importEdits(JSON.parse(await i.files[0].text()));toast('Imported')}catch(e){toast('Not a names file')}};i.click()}
function howTo(){modalBox(`<h3>How People works</h3><p><b>Siftor Ingest</b> scans each clip's contact sheet (12 frames), finds faces, and groups the same face across clips into a person. Someone seen in two or more clips is listed under <b>To name</b>; a clear face that has only turned up in one clip is listed under <b>Seen once</b>. Ingest only looks at clips it hasn't scanned before, so new footage is picked up on the next run.</p><p>Your names, merges and corrections are saved on this Mac (People/edits.json) and re-applied after every scan, so nothing you do here gets lost.</p><p class="mut">Faces smaller than about 16 pixels on the contact sheet (wide stage shots, crowds, drone) can't be recognized from the sheets. Those people still show up through clip descriptions and tags.</p><div class="pp-btns"><button class="btn lux" data-close>Got it</button></div>`,{small:true})}

boot();
