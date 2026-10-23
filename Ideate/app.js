/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Ideate (Step 02)
   Describe a video → search the whole footage archive (clips.jsonl from the
   Library) → build a shot list → send it to the Video Pipeline as a new card.
   Optional: the Library's local chat server (127.0.0.1:8766) for AI suggestions
   and in-page playback.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const LIB='../Sean (DON\'T TOUCH)/';
const SHEETS='../Contact Sheets/';
const API='http://127.0.0.1:8766';
const ME='Sean Rogers';
const EMBED=new URLSearchParams(location.search).has('embed');
if(EMBED)document.body.classList.add('embed');

/* ── content types (same options as the pipeline's Content Type) ── */
const TYPES=['Podcast','Reel','YouTube','VSL','Short','Ads','Carousel','B-Roll Text','Talking Head','Webinar','Marketing','Challenges','Community','Single Thread'];
/* what each type usually wants from the archive — seeds the search */
const TYPE_HINT={Podcast:'podcast interview talking-head',Reel:'broll lifestyle event-crowd event-stage',YouTube:'talking-head interview broll',VSL:'talking-head testimonial product',Short:'event-stage event-crowd broll',Ads:'product lifestyle testimonial',Carousel:'lifestyle event-networking',"B-Roll Text":'broll lifestyle drone',"Talking Head":'talking-head',Webinar:'event-stage talking-head',Marketing:'lifestyle broll product',Challenges:'event-crowd event-stage',Community:'event-networking event-dinner',"Single Thread":'talking-head'};
/* words people use → the archive's own vocabulary */
const SYN={'b-roll':'broll','broll':'broll','broll':'broll','b':'','roll':'','aerial':'drone','aerials':'drone','drone':'drone','drones':'drone','crowd':'event-crowd crowd','audience':'event-crowd','stage':'event-stage stage','keynote':'event-stage speaking','speaking':'event-stage speaking','speaker':'event-stage','talk':'event-stage talking','talking':'talking-head','head':'talking-head','interview':'interview talking-head','interviews':'interview','podcast':'podcast','podcasts':'podcast','testimonial':'testimonial','testimonials':'testimonial','networking':'event-networking','mingling':'event-networking','dinner':'event-dinner','meal':'event-dinner','food':'event-dinner','house':'real-estate house','home':'real-estate home','property':'real-estate property','properties':'real-estate','listing':'real-estate','lifestyle':'lifestyle','product':'product','products':'product','travel':'travel','sports':'sports','gym':'sports gym','workout':'sports','exterior':'exterior','outside':'exterior','outdoor':'exterior','outdoors':'exterior','interior':'interior','inside':'interior','indoor':'interior','closeup':'close','close-up':'close','close':'close','wide':'wide','detail':'detail','details':'detail','pov':'pov','vertical':'vertical','9:16':'vertical','horizontal':'horizontal','16:9':'horizontal','sunset':'sunset golden-hour dusk','golden':'golden-hour','hour':'','dusk':'dusk','night':'night','reaction':'reaction applause','reactions':'reaction applause','applause':'applause','clapping':'applause','laughing':'laughing','hype':'energy applause crowd','energy':'energy','energetic':'energy','pace':'pace morby','morby':'morby','brian':'brian','karlton':'karlton dennis','dean':'dean graziosi','jesse':'jesse ray','chad':'chad willardson','vic':'vic keller','owners':'owners club','club':'club','montana':'montana','miami':'miami','yacht':'yacht','mastermind':'mastermind','immersion':'immersion','workshop':'workshop','recap':'event-stage event-crowd event-networking','highlights':'event-stage event-crowd','highlight':'event-stage event-crowd','trailer':'event-stage event-crowd drone','hook':'talking-head','intro':'talking-head drone'};
const STOP=new Set('a an the and or of to in on at for with from by as is are be been it its this that these those i we you they he she them our your my me us about into over under up down out very really just like want need make making made video videos clip clips footage shot shots scene scenes looking show showing get some any few lot lots sec secs second seconds minute minutes min mins long short edit edited piece content idea ideas kind type style look feel'.split(' '));

/* ── state ── */
let D=[],IDX=new Map(),BYID=new Map(),KEYS=[];
let RES=[],shown=0,lastHits=new Map(),openAt=null;const PAGE=48;
let filters={who:new Set(),client:new Set(),shoot:new Set(),year:new Set(),content:new Set(),shot:new Set(),setting:new Set(),people:new Set(),orientation:new Set(),drive:new Set()};
const KEY='bm.ideate.v1';
let S={draft:{prompt:'',type:'',fmt:'',len:'',title:'',sel:[]},ideas:[]};
try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.draft)S=s}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._k);t._k=setTimeout(()=>t.classList.remove('on'),1800)};
const mmss=s=>{s=Math.round(s||0);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const thumb=c=>LIB+'_thumbs/'+c.id+'.jpg';
const sheet=c=>SHEETS+(c.drive==='Expansion'?'Expansion/':'')+c.sheet;
const libLink=c=>LIB+'index.html#c='+encodeURIComponent(c.client)+(c.brand&&c.brand!==c.client?'&b='+encodeURIComponent(c.brand):'')+'&s='+encodeURIComponent(c.shoot);
const nice=s=>String(s||'').replace(/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}\s*/,'').replace(/\s*\|\s*Bahlman$/,'');
const dshort=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';

/* ── load the archive ── */
async function load(){const bar=$('#lbar'),num=$('#lnum');
 // Opened as a plain file (the Dock app / double-click)? Browsers won't fetch() local files, so load the archive as a script.
 if(location.protocol==='file:'||!window.fetch){return loadScript()}
 try{const r=await fetch(LIB+'clips.jsonl');if(!r.ok)throw new Error('HTTP '+r.status);const total=+r.headers.get('content-length')||26e6;
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='',got=0,n=0;
  while(true){const {done,value}=await reader.read();if(done)break;got+=value.length;buf+=dec.decode(value,{stream:true});let i;
   while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(line.trim()){try{D.push(slim(JSON.parse(line)));n++}catch(e){}}}
   bar.style.width=Math.min(100,got/total*100)+'%';num.textContent=n.toLocaleString()+' clips'}
  if(buf.trim()){try{D.push(slim(JSON.parse(buf)))}catch(e){}}
 }catch(e){return loadScript(e)}
 ready()}
function loadScript(prevErr){const bar=$('#lbar'),num=$('#lnum');bar.style.width='30%';num.textContent='reading archive…';
 const sc=document.createElement('script');sc.src=LIB+'clips.js';
 sc.onload=()=>{const rows=window.BM_CLIPS||[];D=rows.map(slim);bar.style.width='100%';num.textContent=D.length.toLocaleString()+' clips';if(!D.length)return fail('clips.js is empty');ready()};
 sc.onerror=()=>fail((prevErr?prevErr.message+' · ':'')+'clips.js not found');document.head.appendChild(sc)}
function fail(msg){$('#loading').innerHTML=`<div class="err">Couldn't load the archive (${esc(msg)}).<br>Rebuild the Library (build.py writes <b>clips.js</b> next to clips.jsonl), or open the app through <b>Start Pipeline.command</b>.</div>`}
function ready(){ buildIndex();$('#archiveCount').textContent=D.length.toLocaleString()+' clips, '+Math.round(D.reduce((a,c)=>a+(c.duration||0),0)/3600).toLocaleString()+' hours';
 starters();restore();$('#loading').classList.add('off');setTimeout(()=>$('#loading').remove(),600)}
function slim(c){return {who:(window.BMP&&BMP.ready)?BMP.namesFor(c.id):[],id:c.id,file:c.file,drive:c.drive,folder:c.folder,client:c.client,brand:c.brand,shoot:c.shoot,date:c.shoot_date||'',year:(c.shoot_date||'').slice(0,4)||'?',duration:c.duration||0,orientation:c.orientation||'',content:c.content||'',shot:c.shot||'',setting:c.setting||'',people:c.people||'',audio:!!c.has_audio,description:c.description||'',tags:(c.tags||'').split(/,\s*/).filter(Boolean),sheet:c.sheet||'',w:c.width,h:c.height}}
const tok=s=>String(s||'').toLowerCase().replace(/[’']/g,'').split(/[^a-z0-9\-:]+/).filter(Boolean);
const stem=w=>w.length>4?w.replace(/(ings?|ed|es|s)$/,''):w;
function buildIndex(){const add=(k,i,wt)=>{let e=IDX.get(k);if(!e){e=new Map();IDX.set(k,e)}e.set(i,(e.get(i)||0)+wt)};
 D.forEach((c,i)=>{BYID.set(c.id,c);const seen=new Set();
  const put=(text,wt)=>{for(const w of tok(text)){if(STOP.has(w))continue;add(w,i,wt);const s=stem(w);if(s!==w)add(s,i,wt*.9);if(w.includes('-'))w.split('-').forEach(p=>p.length>2&&add(p,i,wt*.6))}};
  put(c.description,1);c.tags.forEach(t=>put(t,2.2));put(c.content,3);put(c.shot,1.5);put(c.setting,1);put(c.client,2);put(c.brand,1.5);put(c.shoot,1.2);put(c.folder,.5);put(c.file.replace(/\.\w+$/,''),.4)});
 KEYS=[...IDX.keys()].sort();CLIENTS=[...new Set(D.map(c=>c.client))].sort((a,b)=>b.length-a.length)}
function expand(q){const out=[];for(const w of tok(q)){if(STOP.has(w))continue;const syn=SYN[w];if(syn!=null){syn.split(' ').filter(Boolean).forEach(x=>out.push(x));if(syn!=='')continue}out.push(w);const s=stem(w);if(s!==w)out.push(s)}return [...new Set(out)]}
function prefixKeys(p){if(p.length<4)return [];let lo=0,hi=KEYS.length;while(lo<hi){const m=(lo+hi)>>1;KEYS[m]<p?lo=m+1:hi=m}const r=[];for(let i=lo;i<KEYS.length&&KEYS[i].startsWith(p)&&r.length<12;i++)r.push(KEYS[i]);return r}
function search(q,hint){const terms=expand(q),hterms=expand(hint||'').filter(t=>!terms.includes(t));const score=new Map(),hits=new Map();
 const scan=(t,tw)=>{const keys=IDX.has(t)?[t]:prefixKeys(t);const w=(IDX.has(t)?1:.55)*tw;for(const k of keys){const e=IDX.get(k);const idf=Math.log(1+D.length/(e.size+1));for(const [i,v] of e){score.set(i,(score.get(i)||0)+v*w*idf);if(tw===1)hits.set(i,(hits.get(i)||0)+1)}}};
 terms.forEach(t=>scan(t,1));hterms.forEach(t=>scan(t,.3));
 let res=[];for(const [i,sc] of score)res.push({i,s:sc*(1+0.45*((hits.get(i)||0)-1))});res.sort((a,b)=>b.s-a.s);
 // keep the meaningful part of the ranking: several of your words, or a score near the top
 if(res.length){const top=res[0].s;const need=Math.min(2,terms.length);res=res.filter(r=>(hits.get(r.i)||0)>=need||r.s>=top*.33)}
 return {res,terms:[...terms,...hterms]}}

/* ── prompt UI ── */
$('#typeChips').innerHTML=TYPES.map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
$('#typeChips').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;const on=b.classList.contains('on');$$('#typeChips .chip').forEach(x=>x.classList.remove('on'));if(!on)b.classList.add('on');S.draft.type=on?'':b.dataset.t;save()};
for(const id of ['fmtSeg','lenSeg'])$('#'+id).onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#'+id+' button').forEach(x=>x.classList.toggle('on',x===b));S.draft[id==='fmtSeg'?'fmt':'len']=b.dataset.v;save();if(!$('#ws').hidden)run()};
$('#prompt').addEventListener('input',()=>{S.draft.prompt=$('#prompt').value;save()});
$('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();go()}});
$('#go').onclick=go;
function starters(){const byShoot=new Map();D.forEach(c=>{const k=c.client+'|'+c.shoot;const e=byShoot.get(k)||{client:c.client,shoot:c.shoot,n:0,date:c.date};e.n++;if(c.date>e.date)e.date=c.date;byShoot.set(k,e)});
 const top=[...byShoot.values()].filter(x=>x.n>60).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const ideas=[...top.map(s=>`A 60-second recap of ${nice(s.shoot)} (${s.client}) — stage moments, crowd reactions, drone`),'A vertical hype reel from the best keynote applause moments','A 30-second drone-only opener for a mastermind trailer','Testimonial montage: happy attendees talking to camera','Podcast intro b-roll: handshakes, networking, dinners'];
 $('#starters').innerHTML='<small>Try</small>'+ideas.slice(0,6).map(t=>`<button>${esc(t)}</button>`).join('');
 $('#starters').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('#prompt').value=b.textContent;S.draft.prompt=b.textContent;save();go()}}
function restore(){let who=new URLSearchParams(location.search).get('who');try{who=who||localStorage.getItem('bm.ideate.who');localStorage.removeItem('bm.ideate.who')}catch(e){}
 if(who){filters.who.clear();filters.who.add(who);$('#ws').hidden=false;run(true);$('#ws').scrollIntoView({block:'start'});toast('Showing clips with '+who);renderTray();return}
 const d=S.draft;$('#prompt').value=d.prompt||'';if(d.type)$(`#typeChips [data-t="${d.type}"]`)?.classList.add('on');
 $$('#fmtSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===(d.fmt||'')));$$('#lenSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===(d.len||'')));
 renderTray();if(d.prompt||d.sel.length){$('#ws').hidden=false;run(true)}}
function go(){const p=$('#prompt').value.trim();if(!p&&!S.draft.type){$('#prompt').focus();return toast('Describe the video first')}S.draft.prompt=p;if(!S.draft.titleSet){S.draft.title=autoTitle(p);const ti=$('#title');if(ti)ti.value=S.draft.title}save();$('#ws').hidden=false;$('#q').value='';run();$('#ws').scrollIntoView({behavior:'smooth',block:'start'});aiHealth()}
/* A short card title from what was asked: "a 30 second recap of Jerry Norton" → "Jerry Norton — 30s Recap".
   Follows the latest search until the title is typed by hand. */
const KINDS=[['hype reel','Hype Reel'],['highlight reel','Highlight Reel'],['sizzle reel','Sizzle Reel'],['sizzle','Sizzle Reel'],['highlights','Highlights'],['highlight','Highlights'],['recap','Recap'],['trailer','Trailer'],['teaser','Teaser'],['promo','Promo'],['testimonials?','Testimonial'],['montage','Montage'],['intro','Intro'],['vsl','VSL'],['ad','Ad'],['ads','Ad'],['commercial','Ad'],['podcast clip','Podcast Clip'],['podcast','Podcast'],['interview','Interview'],['talking head','Talking Head'],['webinar','Webinar'],['carousel','Carousel'],['b-?roll','B-Roll'],['reels?','Reel'],['shorts?','Short'],['tiktoks?','TikTok'],['youtube video','YouTube Video'],['thumbnail','Thumbnail']];
const TSTOP=new Set('a an the of from with for to in on at by and or best some few my our me us please video videos clip clips footage using featuring showing show make create build cut edit put together give get want need like would could can you i we let lets let\'s quick short little nice good great cool new all every really just about that this'.split(' '));
const tcase=w=>w.replace(/\b([a-z])/g,(m,c)=>c.toUpperCase());
function autoTitle(p){const d=S.draft;const w=String(p||'').replace(/\s+/g,' ').trim();if(!w)return d.type||'New idea';const low=w.toLowerCase();
 let len='';const m=low.match(/(\d+(?:\.\d+)?)\s*-?\s*(seconds?|secs?|s|minutes?|mins?|m)\b/);
 if(m){const n=+m[1];len=/^m/.test(m[2])?n+' min':n+'s'}else if(d.len){const L=+d.len;len=L>=600?'10 min+':L>=60?L/60+' min':L+'s'}
 const k=KINDS.find(([a])=>new RegExp('\\b'+a+'\\b').test(low));let kind=k?k[1]:(d.type||'');
 const vert=d.fmt==='vertical'||/\b(vertical|9:16)\b/.test(low);if(kind&&vert&&!/Reel|Short|TikTok|Carousel/.test(kind))kind='Vertical '+kind;else if(!kind&&vert)kind='Vertical';else if(kind&&vert&&/Reel/.test(kind)&&/\bvertical\b/.test(low))kind='Vertical '+kind;
 const tail=[len,kind||(len?'Video':'')].filter(Boolean).join(' ');
 const who=whoIn(w);const cl=clientsIn(w).filter(c=>!who.some(n=>n.toLowerCase().split(' ')[0]===c.toLowerCase().split(' ')[0]));
 const subj=[...who,...cl].slice(0,2).join(' & ');
 if(subj)return tail?`${subj} — ${tail}`:subj;
 // no person or client named: keep the subject words of the first phrase ("keynote applause moments")
 let first=low.split(/[.,;:!?—–]|\s-\s/)[0];if(m)first=first.replace(m[0],' ');if(k)first=first.replace(new RegExp('\\b'+k[0]+'\\b'),' ');
 const words=first.replace(/[^a-z0-9' &-]+/g,' ').split(/\s+/).filter(x=>x&&!TSTOP.has(x)&&!/^(vertical|horizontal|9:16|16:9|seconds?|minutes?|mins?|secs?)$/.test(x)).slice(0,5);
 const topic=tcase(words.join(' '));
 const t=topic&&tail?`${topic} — ${tail}`:topic||tail||'New idea';return t.length>70?t.slice(0,67)+'…':t}

/* ── run a search with the current prompt + refinement + filters ── */
let lastTerms=[];
let CLIENTS=[];
function clientsIn(text){const t=' '+text.toLowerCase()+' ';return CLIENTS.filter(c=>{const full=c.toLowerCase();if(t.includes(' '+full+' '))return true;const first=full.split(' ')[0];return first.length>3&&new RegExp('\\b'+first.replace(/[^a-z0-9]/g,'')+'\\b').test(t)&&!['the','owners','personal'].includes(first)})}
function stripClients(text,names){let t=' '+text+' ';names.forEach(c=>{t=t.replace(new RegExp('\\b'+c.replace(/[^\w ]/g,'')+'\\b','ig'),' ');const first=c.split(' ')[0];if(first.length>3)t=t.replace(new RegExp('\\b'+first+'\\b','ig'),' ')});return t.replace(/\s+/g,' ').trim()}
let autoClients=[],autoWho=[];const noWho=new Set();
/* Sift-style search controls: Visual (what's seen) vs Spoken (what's said), extra filters, match strength */
let MODE='visual';const XF={from:'',to:'',types:new Set(),strength:'any'};
const STRENGTH={any:0,possible:.18,good:.38,strong:.62};
const ftype=c=>{const e=(c.file.split('.').pop()||'').toUpperCase();return ['MXF','MOV','MP4','MTS'].includes(e)?e:'Other'};
const fmtT=t=>{t=Math.max(0,Math.floor(t||0));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
function spokenSearch(q){const SP=window.BM_SPOKEN||{};const terms=expand(q).filter(t=>t.length>1);const phrase=q.toLowerCase().replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();if(!terms.length)return [];const out=[];
 for(const id in SP){const c=BYID.get(id);if(!c)continue;let best=null;
  for(const [st,en,tx] of SP[id]){const low=tx.toLowerCase();let sc=0;for(const t of terms)if(low.includes(t))sc+=1;if(!sc)continue;if(phrase.length>3&&low.includes(phrase))sc+=terms.length*1.5;const r=sc/terms.length;if(!best||r>best.s)best={s:r,t:st,text:tx}}
  if(best)out.push({c,...best})}
 return out.sort((a,b)=>b.s-a.s)}
function whoIn(text){if(!window.BMP||!BMP.ready)return [];const t=' '+text.toLowerCase()+' ';return [...new Set(BMP.named().map(p=>p.name))].filter(n=>!noWho.has(n)).filter(n=>{const full=n.toLowerCase();if(t.includes(' '+full+' '))return true;const first=full.split(' ')[0];return first.length>3&&new RegExp('\\b'+first.replace(/[^a-z0-9]/g,'')+'\\b').test(t)})}
function run(keep){const d=S.draft;const who=whoIn(d.prompt+' '+$('#q').value);
 if(who.join('|')!==autoWho.join('|')){autoWho.forEach(n=>filters.who.delete(n));who.forEach(n=>filters.who.add(n));autoWho=who}
 const named=clientsIn(d.prompt+' '+$('#q').value).filter(c=>!who.some(n=>n.toLowerCase()===c.toLowerCase()||n.split(' ')[0].toLowerCase()===c.split(' ')[0].toLowerCase()));
 // a client named in the prompt becomes a filter rather than a search word
 if(named.join('|')!==autoClients.join('|')){autoClients.forEach(c=>filters.client.delete(c));named.forEach(c=>filters.client.add(c));autoClients=named}
 const q=stripClients([d.prompt,$('#q').value].filter(Boolean).join(' '),named.concat(who));const hint=TYPE_HINT[d.type]||'';
 let base;lastHits=new Map();
 if(MODE==='spoken'){const raw=[d.prompt,$('#q').value].filter(Boolean).join(' ');const qq=stripClients(raw,named.concat(who));const hits=spokenSearch(qq||raw);lastTerms=expand(qq||raw);
  const top=hits.length?hits[0].s:1;base=hits.filter(h=>h.s>=top*STRENGTH[XF.strength]).map(h=>{lastHits.set(h.c.id,h);return h.c})}
 else if(filters.who.size){const names=[...filters.who];const fr=whoFrames(names);const pool=D.filter(c=>names.every(n=>c.who.includes(n)));let rank=new Map();
  if((q+hint).trim()){const r=search(q,hint);lastTerms=r.terms;const top=r.res.length?r.res[0].s:1;r.res.filter(x=>x.s>=top*STRENGTH[XF.strength]).forEach((x,k)=>rank.set(D[x.i],k))}else lastTerms=[];
  // clips that also match the description first, then the ones where they're on camera the most
  base=pool.sort((a,b)=>((rank.has(a)?rank.get(a):1e9)-(rank.has(b)?rank.get(b):1e9))||((fr.get(b.id)||0)-(fr.get(a.id)||0))||b.date.localeCompare(a.date))}
 else if((q+hint).trim()){const r=search(q,hint);lastTerms=r.terms;const top=r.res.length?r.res[0].s:1;base=r.res.filter(x=>x.s>=top*STRENGTH[XF.strength]).map(x=>D[x.i])}else{lastTerms=[];base=[...D].sort((a,b)=>b.date.localeCompare(a.date))}
 if(XF.from)base=base.filter(c=>c.date&&c.date>=XF.from);if(XF.to)base=base.filter(c=>c.date&&c.date<=XF.to);if(XF.types.size)base=base.filter(c=>XF.types.has(ftype(c)));
 if(d.fmt)base=base.filter(c=>c.orientation===d.fmt);
 if(d.len){const L=+d.len;base=base.filter(c=>L>=600?c.duration>=120:c.duration>=Math.min(3,L/8)&&c.duration<=Math.max(90,L*3))}
 renderFacets(base);
 RES=base.filter(c=>Object.entries(filters).every(([k,set])=>!set.size||(Array.isArray(c[k])?[...set].every(v=>c[k].includes(v)):set.has(String(c[k])))));
 const sort=$('#sort').value;if(sort==='new')RES.sort((a,b)=>b.date.localeCompare(a.date));else if(sort==='old')RES.sort((a,b)=>a.date.localeCompare(b.date));else if(sort==='long')RES.sort((a,b)=>b.duration-a.duration);else if(sort==='short')RES.sort((a,b)=>a.duration-b.duration);
 PRES=photoMatch(q);TAB='clips';$('#more').onclick=()=>more();shown=0;$('#grid').innerHTML='';more();whoBar();chipsBar();renderCount();
 if(!keep)$('#ai').hidden=false}
$('#q').addEventListener('input',()=>{clearTimeout(window._qt);window._qt=setTimeout(run,180)});
$('#sort').onchange=()=>run(true);
function more(){const first=!shown;const slice=RES.slice(shown,shown+PAGE);$('#grid').insertAdjacentHTML('beforeend',(first?photoStrip():'')+slice.map(tile).join(''));shown+=slice.length;$('#more').hidden=shown>=RES.length;if(!RES.length)$('#grid').innerHTML=PRES.length?photoStrip()+`<div class="empty">No clips match — but the photos above do.</div>`:`<div class="empty">Nothing in the archive matches that yet — loosen a filter or try other words (the archive speaks in tags like <i>broll, event-stage, drone, talking-head, applause</i>).</div>`}
$('#more').onclick=()=>more();
function tile(c){const sel=S.draft.sel.some(x=>x.id===c.id);const hit=t=>lastTerms.some(x=>t.includes(x)||x.includes(t));
 return `<div class="tile${sel?' sel':''}${c.orientation==='vertical'?' v':''}" data-id="${c.id}"><div class="im" data-scrub="${esc(sheet(c))}" data-dur="${c.duration}"><img loading="lazy" src="${thumb(c)}" alt=""><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><span class="id">${c.id}</span><span class="dur">${mmss(c.duration)}</span></div><button class="add" data-add="${c.id}" title="${sel?'Remove from shot list':'Add to shot list'}">${sel?'✓':'+'}</button>
 <div class="in"><div class="meta">${esc(c.client)} · ${esc(nice(c.shoot))}${c.date?' · '+c.date.slice(0,4):''}</div>${c.who.length?`<div class="who">${c.who.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:''}${lastHits.has(c.id)?`<div class="said"><b data-said="${c.id}">${fmtT(lastHits.get(c.id).t)}</b>“${esc(lastHits.get(c.id).text)}”</div>`:''}<div class="desc">${esc(c.description)}</div><div class="tags">${[c.content,c.shot,...c.tags.slice(0,5)].filter(Boolean).map(t=>`<span class="${hit(t)?'hit':''}">${esc(t)}</span>`).join('')}</div></div></div>`}
$('#grid').onclick=e=>{const a=e.target.closest('[data-add]');if(a){toggle(a.dataset.add);return}const t=e.target.closest('.tile');if(!t)return;const h=lastHits.get(t.dataset.id);openClip(t.dataset.id,h?h.t:null)};

/* ── facets ── */
const FACETS=[['who','People'],['client','Client'],['shoot','Shoot'],['year','Year'],['content','Content'],['shot','Shot'],['setting','Setting'],['people','People'],['orientation','Format'],['drive','Drive']];
const open={who:true,client:true,content:true,year:true};
function renderFacets(base){const el=$('#facets');el.innerHTML=FACETS.map(([k,n])=>{const cnt=new Map();for(const c of base){const vs=Array.isArray(c[k])?c[k]:[String(c[k]||'')];for(const v of vs){if(!v||v==='?')continue;cnt.set(v,(cnt.get(v)||0)+1)}}
  let items=[...cnt.entries()].sort((a,b)=>b[1]-a[1]);filters[k].forEach(v=>{if(!cnt.has(v))items.unshift([v,0])});const max=open['_'+k]?200:8;
  return `<div class="facet${open[k]?'':' closed'}" data-f="${k}"><h4><span>${n}${filters[k].size?` <span class="clr" data-clr="${k}">· clear</span>`:''}</span><i>▼</i></h4><div class="fl">${items.slice(0,max).map(([v,c])=>`<button class="${filters[k].has(v)?'on':''}" data-v="${esc(v)}"><span>${esc(k==='shoot'?nice(v):v)}</span><em>${c.toLocaleString()}</em></button>`).join('')}${items.length>max?`<button class="mo" data-more="${k}">+ ${items.length-max} more</button>`:''}</div></div>`}).join('')}
$('#facets').onclick=e=>{const f=e.target.closest('.facet');if(!f)return;const k=f.dataset.f;
 if(e.target.closest('[data-clr]')){e.stopPropagation();filters[k].clear();run(true);return}
 if(e.target.closest('h4')){open[k]=!open[k];f.classList.toggle('closed');return}
 const mo=e.target.closest('[data-more]');if(mo){open['_'+k]=true;run(true);return}
 const b=e.target.closest('[data-v]');if(!b)return;const v=b.dataset.v;filters[k].has(v)?filters[k].delete(v):filters[k].add(v);run(true)};

/* ── shot list ── */
function toggle(id,ph){ph=ph?1:0;const i=S.draft.sel.findIndex(x=>x.id===id&&!!x.ph===!!ph);if(i>=0){S.draft.sel.splice(i,1);toast('Removed')}else{S.draft.sel.push(ph?{id,note:'',ph:1}:{id,note:''});toast(ph?'Photo added to shot list':'Added to shot list')}save();
 if(ph){$$(`[data-phid="${id}"]`).forEach(t=>{t.classList.toggle('sel',i<0);const a=t.querySelector('.add');if(a){a.textContent=i<0?'✓':'+';a.title=i<0?'Remove from shot list':'Add to shot list'}});renderTray();return}
 $$(`.tile[data-id="${id}"]`).forEach(t=>{t.classList.toggle('sel',i<0);const a=t.querySelector('.add');a.textContent=i<0?'✓':'+'});$$(`.airefs [data-ref="${id}"]`).forEach(b=>b.classList.toggle('sel',i<0));renderTray();const m=$('#modal [data-mt]');if(m&&m.dataset.mt===id){m.classList.toggle('sel',i<0);m.textContent=i<0?'✓ In shot list':'+ Add to shot list'}}
function renderTray(){const d=S.draft;const items=d.sel.map((s,k)=>({...s,k,c:s.ph?null:BYID.get(s.id),p:s.ph?phById(s.id):null})).filter(x=>x.c||x.p);const clips=items.filter(x=>x.c),phs=items.filter(x=>x.p);const dur=clips.reduce((a,x)=>a+x.c.duration,0);
 const who=x=>x.c||x.p;
 $('#tray').innerHTML=`<div class="thd"><div class="rec"><b></b>Shot list<span class="tc">${mmss(dur)}</span></div><input id="title" placeholder="Name this idea…" value="${esc(d.title)}"><div class="sub"><span><b>${clips.length}</b> clips</span>${phs.length?`<span><b>${phs.length}</b> photos</span>`:''}${d.type?`<span>${esc(d.type)}</span>`:''}${d.fmt?`<span>${d.fmt==='vertical'?'9:16':'16:9'}</span>`:''}<span>${[...new Set(items.map(x=>who(x).client))].slice(0,3).join(', ')}</span></div></div>
 <div class="tlist">${items.length?items.map((x,i)=>`<div class="titem${x.p?' ph':''}" data-id="${x.id}"><img src="${x.p?pthumb(x.p):thumb(x.c)}" alt=""${x.p?` data-trph="${x.id}" title="View photo"`:''}><div><div class="m">${x.p?`Photo · ${x.p.id} · ${esc(x.p.client)}`:`${x.c.id} · ${esc(x.c.client)} · ${mmss(x.c.duration)}`}</div><div class="t">${x.p?esc([x.p.who.join(', '),nice(x.p.shoot),x.p.set!==nice(x.p.shoot)?x.p.set:''].filter(Boolean).join(' · ')):esc(x.c.description)}</div><input placeholder="Note (what to use it for)…" value="${esc(x.note||'')}" data-note="${x.k}"></div><div class="ops"><button data-up="${x.k}" title="Move up">▲</button><button data-dn="${x.k}" title="Move down">▼</button><button data-rm="${x.k}" title="Remove">✕</button></div></div>`).join(''):`<div class="tempty">Nothing picked yet.<br>Hit <b>+</b> on any clip or photo to build the shot list for this idea.</div>`}
 ${S.ideas.length?`<div class="ideas"><h5>Saved ideas</h5>${S.ideas.map((x,i)=>`<button data-load="${i}"><span>${esc(x.title||'Untitled')}</span><em>${x.sel.length} clips</em></button>`).join('')}</div>`:''}</div>
 <div class="tft"><button class="btn lux" id="send" title="Saves this as a Pipeline card, then step 03 · Style to pick its look" ${items.length||d.prompt?'':'disabled'}>Next: pick the style →</button><div class="row"><button id="saveIdea">Save idea</button><button id="copyList">Copy list</button><button id="newIdea">New</button></div></div>`;
 $('#title').oninput=e=>{d.title=e.target.value;d.titleSet=!!d.title.trim();save()};
 $('#tray').onclick=e=>{const t=e.target;const up=t.closest('[data-up]'),dn=t.closest('[data-dn]'),rm=t.closest('[data-rm]'),ld=t.closest('[data-load]');
  if(up){const i=+up.dataset.up;if(i>0){[d.sel[i-1],d.sel[i]]=[d.sel[i],d.sel[i-1]];save();renderTray()}}
  else if(dn){const i=+dn.dataset.dn;if(i<d.sel.length-1){[d.sel[i+1],d.sel[i]]=[d.sel[i],d.sel[i+1]];save();renderTray()}}
  else if(rm){const x=d.sel[+rm.dataset.rm];if(x)toggle(x.id,x.ph)}
  else if(t.closest('[data-trph]')){const L=d.sel.filter(x=>x.ph).map(x=>phById(x.id)).filter(Boolean);openPhoto(Math.max(0,L.findIndex(p=>p.id===t.closest('[data-trph]').dataset.trph)),L)}
  else if(ld){const x=S.ideas[+ld.dataset.load];S.draft=JSON.parse(JSON.stringify(x));if(S.draft.title)S.draft.titleSet=true;save();restore();toast('Loaded '+(x.title||'idea'))}
  else if(t.id==='send')sendToPipeline();
  else if(t.id==='saveIdea'){if(!d.titleSet||!d.title)d.title=autoTitle(d.prompt);const i=S.ideas.findIndex(x=>x.title===d.title);const copy=JSON.parse(JSON.stringify(d));i>=0?S.ideas[i]=copy:S.ideas.unshift(copy);save();renderTray();toast('Idea saved')}
  else if(t.id==='copyList'){navigator.clipboard?.writeText(listText());toast('Shot list copied')}
  else if(t.id==='newIdea'){S.draft={prompt:'',type:'',fmt:'',len:'',title:'',sel:[]};save();restore();$('#ws').hidden=true;$('#prompt').focus()}};
 $('#tray').oninput=e=>{const n=e.target.closest('[data-note]');if(n){const s=d.sel[+n.dataset.note];if(s){s.note=n.value;save()}}}}
function listText(){const d=S.draft;return (d.title||'Idea')+'\n'+(d.prompt||'')+'\n\n'+d.sel.map((s,i)=>{if(s.ph){const p=phById(s.id);return p?`${i+1}. [Photo ${p.id}] ${p.client} · ${nice(p.shoot)}${p.who.length?' · '+p.who.join(', '):''}${s.note?' → '+s.note:''}\n   ${p.abs||p.file}`:''}const c=BYID.get(s.id);return c?`${i+1}. [${c.id}] ${c.client} · ${nice(c.shoot)} · ${mmss(c.duration)} — ${c.description}${s.note?' → '+s.note:''}\n   ${c.folder}/${c.file}`:''}).join('\n')}

/* ── hand-off to the Video Pipeline (same browser, shared localStorage) ── */
function sendToPipeline(){const d=S.draft;const clips=d.sel.filter(s=>!s.ph).map(s=>({...s,c:BYID.get(s.id)})).filter(x=>x.c);const phs=d.sel.filter(s=>s.ph).map(s=>({...s,p:phById(s.id)})).filter(x=>x.p);const now=new Date().toISOString();
 const card={id:'i'+Date.now().toString(36),title:(d.titleSet&&d.title.trim())||autoTitle(d.prompt)||'New idea',assigned:[ME],deadline:'',publish:'',type:d.type?[d.type]:[],pipeline:'Ideas',project:'Not started',raw:'',doc:'',edited:'',frameio:'',archived:false,plan:'',createdBy:ME,createdAt:now,editedBy:ME,editedAt:now,comments:[],url:'',
  body:`IDEA\n${d.prompt}\n${d.fmt?'Format: '+(d.fmt==='vertical'?'9:16':'16:9')+'\n':''}${d.len?'Target length: '+mmss(+d.len)+'\n':''}\nSHOT LIST (${clips.length} clips · ${mmss(clips.reduce((a,x)=>a+x.c.duration,0))})\n`+clips.map((x,i)=>`${i+1}. [${x.c.id}] ${x.c.client} · ${nice(x.c.shoot)} · ${mmss(x.c.duration)} — ${x.c.description}${x.note?' → '+x.note:''}`).join('\n')+(phs.length?`\n\nPHOTOS (${phs.length})\n`+phs.map((x,i)=>`${i+1}. [${x.p.id}] ${x.p.client} · ${nice(x.p.shoot)}${x.p.who.length?' · '+x.p.who.join(', '):''}${x.note?' → '+x.note:''}`).join('\n'):''),
  photos:phs.map(x=>({id:x.p.id,file:x.p.file,client:x.p.client,shoot:x.p.shoot,set:x.p.set,date:x.p.date,who:x.p.who,orientation:x.p.orientation,path:x.p.abs,note:x.note||''})),
  clips:clips.map(x=>({id:x.c.id,file:x.c.file,client:x.c.client,shoot:x.c.shoot,date:x.c.date,duration:x.c.duration,description:x.c.description,note:x.note||'',folder:x.c.folder,drive:x.c.drive,orientation:x.c.orientation,who:x.c.who||[]}))};
 try{const raw=localStorage.getItem('bm.pipeline.v2');if(raw){const P=JSON.parse(raw);P.cards.push(card);localStorage.setItem('bm.pipeline.v2',JSON.stringify(P))}else{const inbox=JSON.parse(localStorage.getItem('bm.pipeline.inbox')||'[]');inbox.push(card);localStorage.setItem('bm.pipeline.inbox',JSON.stringify(inbox))}
  localStorage.setItem('bm.pipeline.open',card.id);localStorage.setItem('bm.pipeline.ping',String(Date.now()))}catch(e){return toast('Could not hand off to the pipeline')}
 if(!S.ideas.some(x=>x.title===card.title))S.ideas.unshift(JSON.parse(JSON.stringify(d)));S.draft={prompt:'',type:'',fmt:'',len:'',title:'',sel:[]};save();
 toast('Saved as “'+card.title+'” — now pick its look');
 // next stop: step 03 · Style — pick the look, and it lands on this card
 try{localStorage.setItem('bm.style.for',card.id)}catch(e){}
 setTimeout(()=>{if(toStep('style',{reload:true}))return;location.href='../Motion/atlas.html?for='+encodeURIComponent(card.id)},500)}
const toStep=(step,x)=>{if(window.parent===window)return false;try{parent.postMessage(Object.assign({bm:'step',step},x||{}),'*')}catch(e){}return true};


/* ── clip modal ── */
let modalId=null;
async function openClip(id,at){const c=BYID.get(id);if(!c)return;openAt=at;modalId=id;const m=$('#modal');const sel=S.draft.sel.some(x=>x.id===id);const idx=RES.indexOf(c);
 m.innerHTML=`<div class="mbox"><div class="vis" data-vis><img src="${sheet(c)}" alt="" data-fallback="${esc(thumb(c))}"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><div class="rec"><b></b>REC · ${c.id}</div><button class="play" data-play hidden>▶ Play here</button></div>
 <div class="mside"><div class="id">${c.id} · ${esc(c.drive)}</div><h3>${esc(c.file)}</h3><p>${esc(c.description)}</p>
  <dl><dt>Client</dt><dd>${esc(c.client)}${c.brand&&c.brand!==c.client?' · '+esc(c.brand):''}</dd><dt>Shoot</dt><dd>${esc(c.shoot)}</dd><dt>Date</dt><dd>${dshort(c.date)||'?'}</dd><dt>Length</dt><dd>${mmss(c.duration)}</dd><dt>Frame</dt><dd>${c.w}×${c.h} · ${c.orientation}${c.audio?' · audio':' · no audio'}</dd><dt>Type</dt><dd>${esc(c.content)} · ${esc(c.shot)} · ${esc(c.setting)} · ${esc(c.people)} people</dd><dt>Folder</dt><dd title="${esc(c.folder)}">${esc(c.folder)}</dd></dl>
  <div class="tags">${c.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
  <div class="acts"><button class="btn gold${sel?' sel':''}" data-mt="${c.id}">${sel?'✓ In shot list':'+ Add to shot list'}</button><a class="btn" href="${libLink(c)}" target="_blank" rel="noopener">Open in the Library ↗</a></div></div></div>
 <button class="x" data-x>✕</button>${idx>0?'<button class="nav2 p" data-nav="-1">‹</button>':''}${idx>=0&&idx<RES.length-1?'<button class="nav2 n" data-nav="1">›</button>':''}`;
 m.classList.add('on');const im=$('[data-vis] img',m);im.onerror=()=>{im.onerror=null;im.src=im.dataset.fallback};
 m.onclick=e=>{const t=e.target;if(t.closest('[data-x]')||t===m){closeModal();return}const nv=t.closest('[data-nav]');if(nv){openClip(RES[idx+ +nv.dataset.nav].id);return}const mt=t.closest('[data-mt]');if(mt){toggle(mt.dataset.mt);return}if(t.closest('[data-play]'))play(c,openAt||0)};
 if(AI.player){const b=$('[data-play]',m);b.hidden=false}}
function closeModal(){$('#modal').classList.remove('on');$('#modal').innerHTML='';modalId=null}
async function play(c,at){at=at||0;const vis=$('#modal [data-vis]');let direct=false;try{const r=await fetch(API+'/probe/'+c.id);const j=await r.json();direct=!!j.direct}catch(e){}
 const src=direct?API+'/clip/'+c.id+(at?'#t='+at:''):API+'/play/'+c.id+'?t='+Math.floor(at);vis.innerHTML=`<video src="${src}" controls autoplay playsinline></video>`}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#modal').classList.contains('on'))closeModal()}if($('#modal').classList.contains('on')&&!/INPUT|TEXTAREA/.test(e.target.tagName)){if(e.key==='ArrowRight')$('#modal [data-nav="1"]')?.click();if(e.key==='ArrowLeft')$('#modal [data-nav="-1"]')?.click();if(e.key===' '&&modalId){e.preventDefault();toggle(modalId)}}});

/* ── Library AI (local chat server) ── */
const AI={ok:false,player:false};
async function aiHealth(){const st=$('#aist');try{const r=await fetch(API+'/',{signal:AbortSignal.timeout(2500)});const j=await r.json();AI.ok=!!j.ollama;AI.player=!!j.player;st.className='cs '+(AI.ok?'on':'off');st.querySelector('span').textContent=AI.ok?'Library AI · '+j.model:'Library AI · model not running';$('#aiAsk').disabled=!AI.ok}catch(e){AI.ok=false;st.className='cs off';st.querySelector('span').textContent='Library AI offline — open Start Library Chat.command';$('#aiAsk').disabled=true}}
$('#aiAsk').onclick=async()=>{const d=S.draft;const q=`I'm making a ${d.type||'video'}${d.fmt?' ('+(d.fmt==='vertical'?'9:16 vertical':'16:9')+')':''}${d.len?' about '+mmss(+d.len)+' long':''}: ${d.prompt}\n\nSuggest the best clips from the library for this, in a short list. Reference every clip you suggest by its id in square brackets like [X0123], say what it would be used for, and note anything said on camera that fits.`;
 const tx=$('#aitext'),refs=$('#airefs');tx.textContent='Thinking…';refs.innerHTML='';$('#aiAsk').disabled=true;$('#aiClear').hidden=false;
 try{const r=await fetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:q}],client:''})});const reader=r.body.getReader();const dec=new TextDecoder();let buf='',text='';
  while(true){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch(e){continue}
   if(o.refs)showRefs(o.refs);if(o.t){text+=o.t;tx.textContent=text}if(o.error)tx.textContent=o.error}}
  const ids=[...new Set([...text.matchAll(/\[([A-Z]{1,2}\d{4,5})\]/g)].map(m=>m[1]))];if(ids.length)showRefs(ids,true)}
 catch(e){tx.textContent='The Library AI did not answer. Is Start Library Chat.command running?'}
 $('#aiAsk').disabled=false};
function showRefs(ids,replace){const refs=$('#airefs');const have=new Set($$('[data-ref]',refs).map(b=>b.dataset.ref));if(replace){refs.innerHTML='';have.clear()}
 ids.forEach(id=>{const c=BYID.get(id);if(!c||have.has(id))return;const sel=S.draft.sel.some(x=>x.id===id);refs.insertAdjacentHTML('beforeend',`<button data-ref="${id}" class="${sel?'sel':''}" title="${esc(c.description)}"><img src="${thumb(c)}" alt="">${id} · ${esc(c.client)} · ${mmss(c.duration)}</button>`)})}
$('#airefs').onclick=e=>{const b=e.target.closest('[data-ref]');if(!b)return;if(e.shiftKey)openClip(b.dataset.ref);else toggle(b.dataset.ref)};
$('#aiClear').onclick=()=>{$('#aitext').textContent='';$('#airefs').innerHTML='';$('#aiClear').hidden=true};

$('#yr').textContent=new Date().getFullYear();
load();

/* ── People (face recognition): keep names fresh when they're edited on the People page ── */
if(window.BMP)BMP.on(()=>{photoWho();if(!D.length)return;for(const c of D)c.who=BMP.namesFor(c.id);if(!$('#ws').hidden)run(true)});
addEventListener('storage',e=>{if(e.key==='bm.ideate.who'&&e.newValue){filters.who.clear();filters.who.add(e.newValue);localStorage.removeItem('bm.ideate.who');$('#ws').hidden=false;run(true);toast('Showing clips with '+e.newValue)}});

/* ── who's in it: face banner for named people in the search ── */
function whoFrames(names){const m=new Map();if(!window.BMP||!BMP.ready)return m;const ids=new Set(BMP.people.filter(p=>names.includes(p.name)).map(p=>p.id));const F=BMP.faces;for(const k in F){const f=F[k];if(ids.has(f[2]))m.set(f[0],Math.max(m.get(f[0])||0,f[3]||1))}return m}
function whoBar(){let el=$('#whoBar');if(!el){el=document.createElement('div');el.id='whoBar';el.className='whobar';$('#ai').before(el)}
 if(!filters.who.size||!window.BMP||!BMP.ready){el.hidden=true;el.innerHTML='';return}el.hidden=false;
 el.innerHTML=[...filters.who].map(n=>{const ps=BMP.people.filter(p=>p.name===n&&!p.hidden);if(!ps.length)return '';const p=ps.sort((a,b)=>b.clips-a.clips)[0];const clips=D.filter(c=>c.who.includes(n));const mins=Math.round(clips.reduce((a,c)=>a+c.duration,0)/60);
  const faces=(p.faceIds||[]).slice().sort((a,b)=>(BMP.faces[b][3]||0)-(BMP.faces[a][3]||0)).slice(0,6);
  const fb=(p.faceIds||[]).slice(0,3).map(f=>BMP.crop(f)).join('|');
  return `<div class="wb"><img class="wbf" src="${BMP.crop(p.cover)}" data-fb="${esc(fb)}" alt="" onerror="const l=this.dataset.fb.split('|').filter(Boolean);if(l.length){this.dataset.fb=l.slice(1).join('|');this.src=l[0]}else this.style.visibility='hidden'"><div class="wbt"><div class="wbn">${esc(n)}</div><div class="wbm">Recognized in <b>${clips.length.toLocaleString()}</b> clips · ${mins.toLocaleString()} min of footage${p.photos?` · <b>${p.photos.toLocaleString()}</b> photos`:''}${clips.length?' · best moments first':''}</div><div class="wbs">${faces.map(f=>`<img src="${BMP.crop(f)}" alt="">`).join('')}</div>${p.photos?`<div class="wbp">${(p.photoIds||[]).slice(0,14).map(k=>`<a href="${LIB}_photos/web/${k.slice(3)}.jpg" data-wbph="${k.slice(3)}" data-wbn="${esc(n)}" title="Open photo"><img loading="lazy" src="${LIB}_photos/thumb/${k.slice(3)}.jpg" alt=""></a>`).join('')}${p.photos>14?`<a class="more" href="../People/index.html#p=${p.id}" target="_top">+${(p.photos-14).toLocaleString()}</a>`:''}</div>`:''}</div><div class="wbtabs"><button data-wbtab="clips" class="${TAB==='clips'?'on':''}">${clips.length.toLocaleString()} clips</button>${p.photos?`<button data-wbtab="photos" data-wbp="${p.id}" class="${TAB==='photos'?'on':''}">${p.photos.toLocaleString()} photos</button>`:''}</div><a class="btn2 ghost" href="../People/index.html#p=${p.id}" target="_top">Open in People</a><button class="wbx" data-wbx="${esc(n)}" title="Search without ${esc(n)}">✕</button></div>`}).join('');
 $$('[data-wbtab]',el).forEach(b=>b.onclick=()=>{b.dataset.wbtab==='photos'?showPhotos():showClips()});
 $$('[data-wbph]',el).forEach(a=>a.onclick=e=>{e.preventDefault();const L=photos().filter(p=>p.who.includes(a.dataset.wbn));L.sort((x,y)=>y.date.localeCompare(x.date));openPhoto(Math.max(0,L.findIndex(p=>p.id===a.dataset.wbph)),L)});
 $$('[data-wbx]',el).forEach(b=>b.onclick=()=>{const n=b.dataset.wbx;noWho.add(n);filters.who.delete(n);autoWho=autoWho.filter(x=>x!==n);run(true)})}

/* ── Visual / Spoken toggle ── */
$('#modeSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;MODE=b.dataset.v;$$('#modeSeg button').forEach(x=>x.classList.toggle('on',x===b));
 $('#prompt').placeholder=MODE==='spoken'?'What was said? e.g. “the biggest mistake new investors make”, “welcome to Montana”…':'e.g. A 60-second hype reel of Pace speaking on stage in Montana, big crowd reactions, a few drone shots, gold-hour exteriors…';
 const n=Object.keys(window.BM_SPOKEN||{}).length;if(MODE==='spoken'&&!n)toast('No transcripts yet — run Run Transcripts.command');else if(MODE==='spoken')toast(`Searching what's said in ${n.toLocaleString()} transcribed clips`);
 if(!$('#ws').hidden)run(true)};
/* ── extra filters (date, file type, match strength) + active-filter chips ── */
function refineBox(){const types=['MXF','MOV','MP4','MTS','Other'];return `<div class="facet xf"><h4><span>Refine</span></h4><div class="xfb">
 <label>Shot date</label><div class="xfd"><input type="date" data-xf="from" value="${XF.from}"><span>to</span><input type="date" data-xf="to" value="${XF.to}"></div>
 <label>File type</label><div class="xft">${types.map(t=>`<button data-xt="${t}" class="${XF.types.has(t)?'on':''}">${t}</button>`).join('')}</div>
 <label>Match strength</label><div class="xft">${[['any','Any'],['possible','Possible+'],['good','Good+'],['strong','Strong']].map(([k,n])=>`<button data-xs="${k}" class="${XF.strength===k?'on':''}">${n}</button>`).join('')}</div></div></div>`}
const _rf=renderFacets;renderFacets=function(base){_rf(base);$('#facets').insertAdjacentHTML('afterbegin',refineBox())};
$('#facets').addEventListener('click',e=>{const t=e.target.closest('[data-xt]');if(t){e.stopPropagation();const v=t.dataset.xt;XF.types.has(v)?XF.types.delete(v):XF.types.add(v);run(true);return}const st=e.target.closest('[data-xs]');if(st){e.stopPropagation();XF.strength=st.dataset.xs;run(true)}},true);
$('#facets').addEventListener('change',e=>{const f=e.target.closest('[data-xf]');if(f){XF[f.dataset.xf]=f.value;run(true)}});
function chipsBar(){let el=$('#chips');if(!el){el=document.createElement('div');el.id='chips';el.className='fchips';$('#grid').before(el)}
 const ch=[];Object.entries(filters).forEach(([k,set])=>set.forEach(v=>ch.push([k==='who'?'Person':k[0].toUpperCase()+k.slice(1),k==='shoot'?nice(v):v,()=>{set.delete(v);if(k==='who'){noWho.add(v);autoWho=autoWho.filter(x=>x!==v)}if(k==='client')autoClients=autoClients.filter(x=>x!==v)}])));
 if(XF.from||XF.to)ch.push(['Shot date',`${XF.from||'…'} → ${XF.to||'…'}`,()=>{XF.from='';XF.to=''}]);
 XF.types.forEach(t=>ch.push(['File type',t,()=>XF.types.delete(t)]));
 if(XF.strength!=='any')ch.push(['Match',{possible:'Possible+',good:'Good+',strong:'Strong'}[XF.strength],()=>{XF.strength='any'}]);
 if(MODE==='spoken')ch.push(['Searching','what’s said',()=>{$('#modeSeg [data-v="visual"]').click()}]);
 el.innerHTML=ch.map(([k,v],i)=>`<span class="fc"><em>${esc(k)}</em>${esc(v)}<button data-fc="${i}">✕</button></span>`).join('')+(ch.length>1?'<button class="fcclr" data-fcall>Clear all</button>':'');el.hidden=!ch.length;
 el.onclick=e=>{const b=e.target.closest('[data-fc]');if(b){ch[+b.dataset.fc][2]();run(true);return}if(e.target.closest('[data-fcall]')){ch.forEach(x=>x[2]());run(true)}}}
/* ── hover to scrub: move across a thumbnail to flip through the clip's 12 contact-sheet frames ── */
document.addEventListener('mousemove',e=>{const im=e.target.closest&&e.target.closest('.tile .im[data-scrub]');if(!im)return;let sc=im.querySelector('.scrub');
 if(!sc){sc=document.createElement('div');sc.className='scrub';sc.innerHTML='<i></i><span></span>';const pre=new Image();pre.onload=()=>{sc.style.backgroundImage=`url("${im.dataset.scrub.replace(/"/g,'%22')}")`;im.classList.add('scrubbing')};pre.onerror=()=>sc.remove();pre.src=im.dataset.scrub;im.appendChild(sc)}
 const r=im.getBoundingClientRect(),f=Math.min(.999,Math.max(0,(e.clientX-r.left)/r.width)),k=Math.floor(f*12),col=k%4,row=Math.floor(k/4),s=r.width/480;
 sc.style.backgroundSize=`${1920*s}px ${906*s}px`;sc.style.backgroundPosition=`${-col*480*s}px ${-(96+row*270)*s}px`;sc.querySelector('i').style.width=(f*100)+'%';sc.querySelector('span').textContent=fmtT(+im.dataset.dur*(k+.5)/12)});
document.addEventListener('mouseout',e=>{const im=e.target.closest&&e.target.closest('.tile .im[data-scrub]');if(im&&!im.contains(e.relatedTarget))im.classList.remove('scrubbing')});
document.addEventListener('mouseover',e=>{const im=e.target.closest&&e.target.closest('.tile .im[data-scrub]');if(im&&im.querySelector('.scrub')&&im.querySelector('.scrub').style.backgroundImage)im.classList.add('scrubbing')});

/* ── photos: the Library's edited photos, searched next to the clips ──
   Photos have no AI descriptions yet, so they match by who's in them (face recognition), client, shoot/set name,
   date and format. Free-text words only narrow photos when no person/client/shoot is picked. */
let PH=null,PRES=[],TAB='clips',pshown=0;
function photos(){if(PH)return PH;PH=(window.BM_PHOTOS||[]).map(r=>({id:r[0],client:r[1],brand:r[2],shoot:r[3],set:r[4],date:r[5],year:(r[5]||'').slice(0,4)||'?',orientation:r[6]==='v'?'vertical':'horizontal',folder:r[7],drive:r[8],file:r[9]||'',abs:r[10]||'',who:[],
  words:' '+[r[1],r[2],nice(r[3]),r[4],r[7]].join(' ').toLowerCase().replace(/[^a-z0-9]+/g,' ')+' '}));photoWho();return PH}
const PHB=new Map();function phById(id){if(!PHB.size)photos().forEach(p=>PHB.set(p.id,p));return PHB.get(id)}
const inSel=(id,ph)=>S.draft.sel.some(x=>x.id===id&&!!x.ph===!!ph);
function photoWho(){if(!PH||!window.BMP||!BMP.ready)return;for(const p of PH)p.who=BMP.namesFor('ph_'+p.id)}
function photoMatch(q){if(MODE==='spoken'||XF.types.size||['content','shot','setting','people'].some(k=>filters[k].size))return [];
 const d=S.draft;let L=photos();
 if(filters.who.size){const names=[...filters.who];L=L.filter(p=>names.every(n=>p.who.includes(n)))}
 for(const k of ['client','shoot','year','orientation','drive'])if(filters[k].size)L=L.filter(p=>filters[k].has(String(p[k]))||(k==='client'&&filters[k].has(p.brand)));
 if(d.fmt)L=L.filter(p=>p.orientation===d.fmt);if(XF.from)L=L.filter(p=>p.date&&p.date>=XF.from);if(XF.to)L=L.filter(p=>p.date&&p.date<=XF.to);
 const terms=[...new Set(String(q||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>(w.length>2||/^\d+$/.test(w))&&!STOP.has(w)))];
 if(!(filters.who.size||filters.client.size||filters.shoot.size)&&terms.length){
  const sc=L.map(p=>[p,terms.reduce((a,t)=>a+(p.words.includes(' '+t)?1:0),0)]).filter(x=>x[1]);const top=sc.reduce((a,x)=>Math.max(a,x[1]),0);
  L=sc.filter(x=>x[1]>=Math.max(1,Math.ceil(top*.67))).sort((a,b)=>b[1]-a[1]||b[0].date.localeCompare(a[0].date)).map(x=>x[0])}
 else L=L.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const sort=$('#sort').value;if(sort==='old')L.sort((a,b)=>a.date.localeCompare(b.date));else if(sort==='new')L.sort((a,b)=>b.date.localeCompare(a.date));
 return L}
const pthumb=p=>`${LIB}_photos/thumb/${p.id}.jpg`, pweb=p=>`${LIB}_photos/web/${p.id}.jpg`;
const ptile=(p,i)=>`<div class="ptile${p.orientation==='vertical'?' v':''}${inSel(p.id,1)?' sel':''}" data-ph="${i}" data-phid="${p.id}" title="${esc(p.client+' · '+nice(p.shoot))}"><img loading="lazy" src="${pthumb(p)}" alt=""><button class="add" data-addph="${p.id}" title="${inSel(p.id,1)?'Remove from shot list':'Add to shot list'}">${inSel(p.id,1)?'✓':'+'}</button><span>${esc(p.who.length?p.who.join(', '):nice(p.shoot)||p.client)}</span></div>`;
function photoStrip(){if(!PRES.length)return '';return `<div class="pstrip"><div class="psh"><b>${PRES.length.toLocaleString()}</b> photo${PRES.length>1?'s':''} match too<button data-rt="photos">See all →</button></div><div class="psr">${PRES.slice(0,14).map((p,i)=>`<button data-ph="${i}" title="${esc(p.client+' · '+nice(p.shoot))}"><img loading="lazy" src="${pthumb(p)}" alt=""></button>`).join('')}${PRES.length>14?`<button class="more" data-rt="photos">+${(PRES.length-14).toLocaleString()}</button>`:''}</div></div>`}
function renderCount(){const min=Math.round(RES.reduce((a,c)=>a+c.duration,0)/60);
 $('#count').innerHTML=`<span class="rtabs"><button data-rt="clips" class="${TAB==='clips'?'on':''}"><b>${RES.length.toLocaleString()}</b> clips</button>${PRES.length?`<button data-rt="photos" class="${TAB==='photos'?'on':''}"><b>${PRES.length.toLocaleString()}</b> photos</button>`:''}</span>${TAB==='clips'&&lastTerms.length&&RES.length?`<span class="rmin">${min.toLocaleString()} min</span>`:''}`}
function showClips(){TAB='clips';shown=0;$('#grid').innerHTML='';$('#more').onclick=()=>more();more();renderCount();whoBar()}
function showPhotos(){if(!PRES.length&&filters.who.size){const names=[...filters.who];PRES=photos().filter(p=>names.every(n=>p.who.includes(n)))}
 TAB='photos';pshown=0;const g=$('#grid');g.innerHTML=PRES.length?'':'<div class="empty">No photos match this search.</div>';
 const page=()=>{g.insertAdjacentHTML('beforeend',PRES.slice(pshown,pshown+60).map((p,k)=>ptile(p,pshown+k)).join(''));pshown+=60;$('#more').hidden=pshown>=PRES.length};
 $('#more').onclick=page;page();renderCount();whoBar();const r=$('.rhd');if(r&&r.getBoundingClientRect().top<0)r.scrollIntoView({behavior:'smooth',block:'start'})}
function photoGrid(){showPhotos()}
document.addEventListener('click',e=>{const t=e.target.closest('[data-rt]');if(!t||!t.closest('#count,#grid'))return;e.preventDefault();t.dataset.rt==='photos'?showPhotos():showClips()});
$('#grid').addEventListener('click',e=>{const a=e.target.closest('[data-addph]');if(a){e.stopPropagation();toggle(a.dataset.addph,1);return}const t=e.target.closest('[data-ph]');if(!t)return;e.stopPropagation();openPhoto(+t.dataset.ph)},true);
/* ── photo viewer: ← → to flip through the matches, Esc to close ── */
let PLB=null,pli=0,plist=[];
function openPhoto(i,list){plist=list||PRES;pli=i;if(!PLB){PLB=document.createElement('div');PLB.className='plb';PLB.innerHTML='<button class="x" data-pl="x" title="Close (Esc)">✕</button><button class="nav2 p" data-pl="p" title="Previous (←)">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="nav2 n" data-pl="n" title="Next (→)">›</button>';document.body.appendChild(PLB);
  PLB.onclick=e=>{const b=e.target.closest('[data-pl]');if(b){const a=b.dataset.pl;if(a==='add'){toggle(plist[pli].id,1);drawPhoto()}else a==='x'?closePhoto():stepPhoto(a==='n'?1:-1)}else if(e.target===PLB)closePhoto()}}
 drawPhoto();PLB.classList.add('on')}
function drawPhoto(){const p=plist[pli];if(!p)return;const im=PLB.querySelector('img');im.src=pthumb(p);const hi=new Image();hi.onload=()=>{if(plist[pli]===p)im.src=hi.src};hi.src=pweb(p);
 PLB.querySelector('figcaption').innerHTML=`<div class="pm">${p.who.length?`<span class="pw">${p.who.map(esc).join(', ')}</span>`:''}<span>${esc(p.client)}</span><span>${esc(nice(p.shoot))}${p.set&&p.set!==nice(p.shoot)?' · '+esc(p.set):''}</span>${p.date?`<span>${dshort(p.date)}</span>`:''}<span class="pc">${pli+1} / ${plist.length.toLocaleString()}</span></div><div class="pa"><button class="padd${inSel(p.id,1)?' sel':''}" data-pl="add">${inSel(p.id,1)?'✓ In shot list':'+ Add to shot list'}</button><a href="${pweb(p)}" target="_blank" rel="noopener">Open full size ↗</a><span class="pf">${esc(p.id)} · ${esc(p.folder)}</span></div>`;
 PLB.querySelector('.p').disabled=pli<=0;PLB.querySelector('.n').disabled=pli>=plist.length-1}
function stepPhoto(d){const j=pli+d;if(j<0||j>=plist.length)return;pli=j;drawPhoto()}
function closePhoto(){if(PLB)PLB.classList.remove('on')}
document.addEventListener('keydown',e=>{if(!PLB||!PLB.classList.contains('on'))return;if(e.key==='Escape'){e.stopPropagation();closePhoto()}else if(e.key==='ArrowRight')stepPhoto(1);else if(e.key==='ArrowLeft')stepPhoto(-1)},true);
/* after a search that matched a person, bring the results into view */
const _go=go;go=function(){_go();setTimeout(()=>{if(filters.who.size){const wb=$('#whoBar');if(wb&&!wb.hidden)wb.scrollIntoView({behavior:'smooth',block:'start'})}},350)};$('#go').onclick=go;
