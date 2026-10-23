/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Video Pipeline
   A working mirror of the Notion "Media Master Database" (Sean's Video
   Pipeline view): board / table / list / calendar / gallery views, Notion-style
   filters, sorts, grouping, view settings, side-peek pages with every property,
   automations, comments, drag-and-drop, multi-select, undo, import/export.
   Data lives in data.js (SNAPSHOT) and in this browser (localStorage).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const uid=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const ME='Sean Rogers';

/* ── Notion dark-theme select palette (exact values captured from the page) ── */
const COLORS={
 default:{pill:'rgba(255,255,243,.082)',pfg:'#f0efed',cnt:'rgb(188,186,182)'},
 gray:   {pill:'rgba(255,252,235,.306)',pfg:'#f0efed',cnt:'rgb(142,139,134)'},
 brown:  {pill:'rgba(255,184,132,.365)',pfg:'#f5ede9',cnt:'rgb(182,137,101)'},
 orange: {pill:'rgba(255,143,71,.482)', pfg:'#fbebde',cnt:'rgb(213,128,59)'},
 yellow: {pill:'rgba(255,188,53,.46)',  pfg:'#f9f3dc',cnt:'rgb(216,163,47)'},
 green:  {pill:'rgba(113,255,175,.337)',pfg:'#e8f1ec',cnt:'rgb(98,190,135)'},
 blue:   {pill:'rgba(81,166,255,.494)', pfg:'#e5f2fc',cnt:'rgb(88,150,220)'},
 purple: {pill:'rgba(208,147,255,.427)',pfg:'#f3ebf9',cnt:'rgb(181,119,214)'},
 pink:   {pill:'rgba(255,133,192,.427)',pfg:'#fae9f1',cnt:'rgb(214,112,165)'},
 red:    {pill:'rgba(255,116,105,.525)',pfg:'#fce9e7',cnt:'rgb(229,100,88)'},
};
/* column + card tints: measured where Notion showed them, derived for the rest */
const TINT={
 default:{gbg:'rgba(252,252,252,.03)',cbg:'rgb(44,44,43)',cbgh:'rgb(52,52,50)',ring:'rgba(255,255,243,.082)'},
 gray:   {gbg:'rgba(252,252,252,.03)',cbg:'rgb(44,44,43)',cbgh:'rgb(52,52,50)',ring:'rgba(255,255,243,.082)'},
 brown:  {gbg:'rgba(253,158,101,.05)',cbg:'rgb(56,45,38)',cbgh:'rgb(64,52,44)',ring:'rgba(255,174,122,.133)'},
 orange: {gbg:'rgba(254,139,71,.043)',cbg:'rgb(61,42,29)',cbgh:'rgb(70,49,34)',ring:'rgba(255,134,51,.157)'},
 yellow: {gbg:'rgba(255,232,48,.043)',cbg:'rgb(55,51,37)',cbgh:'rgb(63,58,43)',ring:'rgba(255,225,117,.13)'},
 green:  {gbg:'rgba(113,255,175,.045)',cbg:'rgb(36,55,44)',cbgh:'rgb(42,63,51)',ring:'rgba(113,255,175,.15)'},
 blue:   {gbg:'rgba(81,166,255,.05)',cbg:'rgb(33,46,63)',cbgh:'rgb(39,53,72)',ring:'rgba(81,166,255,.17)'},
 purple: {gbg:'rgba(196,101,253,.05)',cbg:'rgb(54,41,63)',cbgh:'rgb(62,48,72)',ring:'rgba(201,122,255,.165)'},
 pink:   {gbg:'rgba(255,133,192,.045)',cbg:'rgb(63,41,52)',cbgh:'rgb(72,48,60)',ring:'rgba(255,133,192,.16)'},
 red:    {gbg:'rgba(251,107,107,.047)',cbg:'rgb(63,41,41)',cbgh:'rgb(72,48,48)',ring:'rgba(255,116,105,.16)'},
};
const COLOR_NAMES=Object.keys(COLORS);

/* ── Schema: the Media Master Database properties, in Notion's order ── */
const PIPE_OPTS=[['Ideas','default'],['Approved Ideas','green'],['Ready to Film','blue'],['Filmed/Ready To Edit','purple'],['Editing','yellow'],['Ready For Review','orange'],['Needs Revisions','red'],['Not Approved/Do Not Use','red'],['Ready To Post','gray'],['Posted','brown']].map(([n,c])=>({n,c}));
const TYPE_OPTS=[['Podcast','orange'],['Reel','default'],['Carousel','purple'],['B-Roll Text','brown'],['Ads','red'],['Marketing','gray'],['Challenges','yellow'],['Community','blue'],['Talking Head','brown'],['Webinar','green'],['Short','red'],['Single Thread','gray'],['VSL','pink'],['YouTube','pink']].map(([n,c])=>({n,c}));
const PROJ_OPTS=[['Not started','default'],['In progress','blue'],['Done','green'],['Stuck','red']].map(([n,c])=>({n,c}));
const PEOPLE=['Sean Rogers','Brian Luebben','Nathalia A. Lopez','Estefania','Gizel','Max Edge Media','Saif Ahmad'];
const ICON={
 photo:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/></svg>',
 title:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h14"/></svg>',
 people:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/></svg>',
 date:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
 select:'<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/><rect x="3" y="4" width="18" height="16" rx="3"/></svg>',
 multi:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="19" cy="17" r="2"/></svg>',
 status:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8h-8z" fill="currentColor" stroke="none" opacity=".5"/></svg>',
 url:'<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 checkbox:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
 relation:'<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
 person_ro:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/></svg>',
 time_ro:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
 button:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h8"/></svg>',
 clips:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
 comment:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 bolt:'<svg viewBox="0 0 24 24"><path d="M13 3 4 14h7l-1 7 9-11h-7z"/></svg>',
 board:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>',
 table:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 14h18M9 5v14M15 5v14"/></svg>',
 list:'<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
 calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/></svg>',
 gallery:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
 video:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
 eye:'<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 eyeoff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.2A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1"/></svg>',
 trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
 copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
 open:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8M11 6H5v13h13v-6"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
 expand:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
 chevL:'<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',chevR:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
 close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>',
 filter:'<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
 sort:'<svg viewBox="0 0 24 24"><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/></svg>',
 grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
 palette:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/><path d="M12 21a3 3 0 0 1 0-6h2a2 2 0 0 0 0-4"/></svg>',
 pencil:'<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4"/></svg>',
 download:'<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>',
 undo:'<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
};
const PROPS=[
 {k:'title',n:'Name',t:'title'},
 {k:'assigned',n:'Assigned To',t:'people'},
 {k:'deadline',n:'Deadline',t:'date'},
 {k:'publish',n:'Publish Date',t:'date'},
 {k:'type',n:'Content Type',t:'multi',opts:TYPE_OPTS},
 {k:'pipeline',n:'Content Pipeline',t:'select',opts:PIPE_OPTS},
 {k:'project',n:'Project Pipeline',t:'status',opts:PROJ_OPTS},
 {k:'raw',n:'Raw Footage',t:'url'},
 {k:'doc',n:'Document',t:'url'},
 {k:'edited',n:'Edited Footage',t:'url'},
 {k:'frameio',n:'Frame IO LInk',t:'url'},
 {k:'archived',n:'Archived',t:'checkbox'},
 {k:'plan',n:'Content Plan',t:'relation'},
 {k:'clips',n:'Footage',t:'clips'},
 {k:'editedBy',n:'Last edited by',t:'person_ro',ro:true,sec:'edits'},
 {k:'editedAt',n:'Last edited time',t:'time_ro',ro:true,sec:'edits'},
 {k:'createdBy',n:'Created by',t:'person_ro',ro:true,sec:'edits'},
 {k:'createdAt',n:'Created time',t:'time_ro',ro:true,sec:'edits'},
];
const P=Object.fromEntries(PROPS.map(p=>[p.k,p]));
const GROUPABLE=['pipeline','type','project','assigned','archived'];
const LIB='../Sean (DON\'T TOUCH)/';const libLink=c=>LIB+'index.html#c='+encodeURIComponent(c.client)+'&s='+encodeURIComponent(c.shoot);const mmss=x=>{x=Math.round(x||0);return `${Math.floor(x/60)}:${String(x%60).padStart(2,'0')}`};
const TEMPLATES=[
 {n:'Podcast episode',type:['Podcast'],body:'Thumbnail Option 1:\nThumbnail Option 2:'},
 {n:'YouTube video',type:['YouTube'],body:'Thumbnail Option 1:\nThumbnail Option 2:'},
 {n:'Reel',type:['Reel'],body:''},
 {n:'VSL',type:['VSL'],body:''},
 {n:'Short',type:['Short'],body:''},
];

/* ── State ───────────────────────────────────────────────────────────── */
const KEY='bm.pipeline.v2';
const DEFAULT_VIEW={
 layout:'board',groupBy:'pipeline',colorCols:true,hideEmpty:false,cardSize:'medium',wrap:true,openAs:'side',
 cardProps:['type','clips'],tableProps:['assigned','type','pipeline','project','frameio','edited','raw','deadline','publish'],
 hidden:['Ideas','Approved Ideas','Ready to Film'],order:[],filters:[],filterOp:'and',sorts:[],search:'',
 calProp:'deadline',calMonth:null,
 automations:{approved:{pipeline:'Ready To Post',project:'Done'},needsEdits:{pipeline:'Needs Revisions',project:'In progress'}},
};
let S; const clone=o=>JSON.parse(JSON.stringify(o));
function fresh(){return {cards:clone(SNAPSHOT),view:clone(DEFAULT_VIEW),opts:{pipeline:clone(PIPE_OPTS),type:clone(TYPE_OPTS),project:clone(PROJ_OPTS)},people:[...PEOPLE]}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Array.isArray(s.cards)){s.view=Object.assign(clone(DEFAULT_VIEW),s.view||{});return s}}catch(e){}return fresh()}
S=load();
/* ideas handed off from Ideate (step 02) */
function takeInbox(){try{const inbox=JSON.parse(localStorage.getItem('bm.pipeline.inbox')||'[]');if(inbox.length){inbox.forEach(c=>{if(!S.cards.some(x=>x.id===c.id))S.cards.push(c)});localStorage.removeItem('bm.pipeline.inbox');save();return true}}catch(e){}return false}
takeInbox();
/* Deleted pages are remembered (S.gone: id → when). Every save merges what other open copies of the board deleted,
   so an older copy (another window, or a frame) can't write deleted pages back. */
function mergeGone(st){const g=Object.assign({},S.gone||{});const o=(st&&st.gone)||{};for(const k in o)if(!g[k]||o[k]>g[k])g[k]=o[k];
 const cut=new Date(Date.now()-60*864e5).toISOString();for(const k in g)if(g[k]<cut)delete g[k];S.gone=g;
 S.cards=S.cards.filter(c=>!(g[c.id]&&g[c.id]>=(c.editedAt||'')))}
const save=()=>{try{let st=null;try{st=JSON.parse(localStorage.getItem(KEY))}catch(e){}mergeGone(st);localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
/* undo stack */
const hist=[],redo=[];
function snap(label){hist.push({label,s:JSON.stringify({cards:S.cards,opts:S.opts,people:S.people})});if(hist.length>60)hist.shift();redo.length=0}
function undo(){const h=hist.pop();if(!h)return toast('Nothing to undo');redo.push({label:h.label,s:JSON.stringify({cards:S.cards,opts:S.opts,people:S.people})});const had=new Set(S.cards.map(c=>c.id));Object.assign(S,JSON.parse(h.s));S.cards.forEach(c=>{if(!had.has(c.id)&&S.gone&&S.gone[c.id]){delete S.gone[c.id];c.editedAt=nowISO()}});save();render();toast('Undid: '+h.label)}
function redoIt(){const h=redo.pop();if(!h)return;hist.push({label:h.label,s:JSON.stringify({cards:S.cards,opts:S.opts,people:S.people})});Object.assign(S,JSON.parse(h.s));save();render();toast('Redid: '+h.label)}
const opts=k=>S.opts[k]||P[k].opts||[];
const optColor=(k,n)=>(opts(k).find(o=>o.n===n)||{}).c||'default';
const V=()=>S.view;

/* ── helpers ── */
const initials=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const avCls=n=>/brian/i.test(n)?'b':/nathalia/i.test(n)?'n':/sean/i.test(n)?'':'o';
const avatar=n=>`<i class="av ${avCls(n)}" title="${esc(n)}">${esc(initials(n))}</i>`;
const chip=(k,n,big)=>{const c=COLORS[optColor(k,n)]||COLORS.default;return `<span class="chip${big?' big':''}" style="--tbg:${c.pill};--tfg:${c.pfg}">${esc(n)}</span>`};
const person=n=>`<span class="chip person">${avatar(n)}${esc(n)}</span>`;
const fmtDate=s=>{if(!s)return'';const d=new Date(s.length===10?s+'T12:00:00':s);return isNaN(d)?s:d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})};
const fmtDT=s=>{if(!s)return'';const d=new Date(s);return isNaN(d)?s:d.toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})};
const shortUrl=u=>{try{const x=new URL(u);const p=x.pathname.replace(/\/$/,'');return x.host.replace(/^www\./,'')+(p.length>22?p.slice(0,12)+'…'+p.slice(-6):p)}catch(e){return u}};
const nowISO=()=>new Date().toISOString();
const touch=c=>{c.editedAt=nowISO();c.editedBy=ME};
function toast(m,undoable){const t=$('#toast');t.innerHTML=esc(m)+(undoable?' <button id="tUndo">Undo</button>':'');t.classList.add('on');clearTimeout(t._k);t._k=setTimeout(()=>t.classList.remove('on'),undoable?4200:1800);if(undoable)$('#tUndo').onclick=()=>{undo();t.classList.remove('on')}}
function valueOf(c,k){const v=c[k];if(k==='comments')return (c.comments||[]).length;return v}
function textOf(c,k){const p=P[k],v=c[k];if(v==null||v==='')return'';if(p.t==='people'||p.t==='multi')return (v||[]).join(', ');if(p.t==='checkbox')return v?'Checked':'Unchecked';if(p.t==='date')return fmtDate(v);if(p.t==='time_ro')return fmtDT(v);if(p.t==='clips')return (v||[]).map(x=>x.id).join(', ');return String(v)}

/* ── filtering / sorting ── */
const OPS={
 select:['is','is not','is empty','is not empty'],status:['is','is not','is empty','is not empty'],
 multi:['contains','does not contain','is empty','is not empty'],people:['contains','does not contain','is empty','is not empty'],
 title:['contains','does not contain','is','is not','is empty','is not empty'],url:['contains','does not contain','is empty','is not empty'],relation:['contains','is empty','is not empty'],
 date:['is','is before','is after','is on or before','is on or after','is empty','is not empty'],time_ro:['is before','is after'],
 checkbox:['is checked','is unchecked'],person_ro:['is','is not'],clips:['is empty','is not empty'],
};
function matchRule(c,r){const p=P[r.k],v=c[r.k];const isEmpty=v==null||v===''||(Array.isArray(v)&&!v.length);const val=(r.v||'');
 switch(r.op){
  case 'is empty':return isEmpty;case 'is not empty':return !isEmpty;
  case 'is checked':return !!v;case 'is unchecked':return !v;
  case 'is':return p.t==='date'?String(v).slice(0,10)===val:String(v??'').toLowerCase()===val.toLowerCase();
  case 'is not':return p.t==='date'?String(v).slice(0,10)!==val:String(v??'').toLowerCase()!==val.toLowerCase();
  case 'contains':return Array.isArray(v)?v.some(x=>x.toLowerCase().includes(val.toLowerCase())):String(v??'').toLowerCase().includes(val.toLowerCase());
  case 'does not contain':return !(Array.isArray(v)?v.some(x=>x.toLowerCase().includes(val.toLowerCase())):String(v??'').toLowerCase().includes(val.toLowerCase()));
  case 'is before':return !!v&&String(v).slice(0,10)<val;case 'is after':return !!v&&String(v).slice(0,10)>val;
  case 'is on or before':return !!v&&String(v).slice(0,10)<=val;case 'is on or after':return !!v&&String(v).slice(0,10)>=val;
 }return true}
function visibleCards(){const v=V();let list=S.cards.filter(c=>{
  if(v.filters.length){const rs=v.filters.map(r=>matchRule(c,r));if(v.filterOp==='and'?!rs.every(Boolean):!rs.some(Boolean))return false}
  if(v.search){const q=v.search.toLowerCase();const hay=[c.title,c.body,(c.type||[]).join(' '),(c.assigned||[]).join(' '),c.pipeline,c.project,...(c.comments||[]).map(x=>x.text)].join(' ').toLowerCase();if(!hay.includes(q))return false}
  return true});
 if(v.sorts.length){const cmp=(a,b,k)=>{const p=P[k];let x=a[k],y=b[k];if(p.t==='multi'||p.t==='people'){x=(x||[]).join(',');y=(y||[]).join(',')}if(p.t==='select'||p.t==='status'){const o=opts(k).map(z=>z.n);x=o.indexOf(x);y=o.indexOf(y);if(x<0)x=999;if(y<0)y=999;return x-y}if(p.t==='checkbox')return (x?1:0)-(y?1:0);return String(x??'').localeCompare(String(y??''),undefined,{numeric:true})};
  list=[...list].sort((a,b)=>{for(const s of v.sorts){const r=cmp(a,b,s.k);if(r)return s.dir==='desc'?-r:r}return 0})}
 return list}
function groupsFor(k){const p=P[k];let names;
 if(p.t==='select'||p.t==='status'||p.t==='multi')names=opts(k).map(o=>o.n);
 else if(p.t==='people')names=[...S.people];
 else if(p.t==='checkbox')names=['Checked','Unchecked'];
 else names=[...new Set(S.cards.map(c=>String(c[k]||'')).filter(Boolean))];
 const noName=p.t==='checkbox'?null:'No '+p.n;
 const v=V();const order=v.groupBy===k&&v.order.length?v.order:null;
 let all=names.map(n=>({n,c:p.t==='checkbox'?(n==='Checked'?'green':'default'):(p.t==='people'?'default':optColor(k,n))}));
 if(noName)all.push({n:noName,c:'default',none:true});
 if(order){all.sort((a,b)=>{const i=order.indexOf(a.n),j=order.indexOf(b.n);return (i<0?999:i)-(j<0?999:j)})}
 return all}
function inGroup(c,k,g){const p=P[k],v=c[k];if(g.none)return v==null||v===''||(Array.isArray(v)&&!v.length);if(p.t==='checkbox')return g.n==='Checked'?!!v:!v;if(Array.isArray(v))return v.includes(g.n);return v===g.n}
function setGroup(c,k,g){const p=P[k];if(g.none){c[k]=(p.t==='multi'||p.t==='people')?[]:(p.t==='checkbox'?false:'');return}if(p.t==='checkbox'){c[k]=g.n==='Checked';return}if(p.t==='multi'||p.t==='people'){c[k]=[g.n];return}c[k]=g.n}

/* ── render root ── */
const host=$('#viewhost');
let selection=new Set();
function render(){renderTabs();renderRules();const v=V();host.className='viewhost';
 ({board:renderBoard,table:renderTable,list:renderList,calendar:renderCalendar,gallery:renderGallery}[v.layout]||renderBoard)();
 {const tt=$('#total');if(tt)tt.textContent=visibleCards().length+' of '+S.cards.length+' items'}
 $('#bFilter').classList.toggle('on',!!v.filters.length);$('#bSort').classList.toggle('on',!!v.sorts.length);
 $('#q').value=v.search;$('#search').classList.toggle('on',!!v.search||$('#search').classList.contains('on'));
 $('#crumbView').textContent='Video Pipeline · '+v.layout[0].toUpperCase()+v.layout.slice(1);
 updateSelbar();save()}
function renderTabs(){const v=V();const tabs=[['board','Video Pipeline',ICON.video],['table','Table',ICON.table],['list','List',ICON.list],['calendar','Calendar',ICON.calendar],['gallery','Gallery',ICON.gallery]];
 $('#vtabs').innerHTML=tabs.map(([k,n,i])=>`<button class="vtab${v.layout===k?' on':''}" data-layout="${k}">${i}${n}</button>`).join('');}
$('#vtabs').addEventListener('click',e=>{const b=e.target.closest('[data-layout]');if(!b)return;V().layout=b.dataset.layout;render()});

/* ── rules bar (filters + sorts) ── */
function renderRules(){const v=V();const el=$('#rules');const parts=[];
 if(v.filters.length){v.filters.forEach((r,i)=>{if(i)parts.push(`<span class="andor" data-andor>${v.filterOp}</span>`);parts.push(`<span class="rule" data-frule="${i}"><b>${esc(P[r.k].n)}</b><em>${esc(r.op)}</em>${r.v?`<strong>${esc(r.v)}</strong>`:''}<span class="x" data-fdel="${i}">✕</span></span>`)});parts.push(`<span class="rule add" data-fadd>+ Add filter</span>`)}
 if(v.sorts.length){v.sorts.forEach((s,i)=>parts.push(`<span class="rule sort" data-srule="${i}">${ICON.sort.replace('<svg','<svg width=12 height=12 fill=none stroke=currentColor stroke-width=2')}<b>${esc(P[s.k].n)}</b><em>${s.dir==='asc'?'Ascending':'Descending'}</em><span class="x" data-sdel="${i}">✕</span></span>`));parts.push(`<span class="rule add" data-sadd>+ Add sort</span>`)}
 el.innerHTML=parts.join('')}
$('#rules').addEventListener('click',e=>{const v=V();const t=e.target;
 if(t.dataset.fdel!=null){v.filters.splice(+t.dataset.fdel,1);render();return}
 if(t.dataset.sdel!=null){v.sorts.splice(+t.dataset.sdel,1);render();return}
 if(t.hasAttribute('data-andor')){v.filterOp=v.filterOp==='and'?'or':'and';render();return}
 if(t.closest('[data-fadd]')){filterPicker(t);return}if(t.closest('[data-sadd]')){sortPicker(t);return}
 const fr=t.closest('[data-frule]');if(fr){editFilter(fr,+fr.dataset.frule);return}
 const sr=t.closest('[data-srule]');if(sr){editSort(sr,+sr.dataset.srule);return}});

/* ── popover system ── */
const pop=$('#pop');let popAnchor=null;
function openPop(anchor,html,opts={}){pop.innerHTML=html;pop.classList.add('on');popAnchor=anchor;const r=anchor.getBoundingClientRect();pop.style.minWidth=(opts.w||220)+'px';
 const pw=Math.min(opts.w||260,window.innerWidth-20),ph=pop.offsetHeight;let x=opts.alignRight?r.right-pw:r.left,y=r.bottom+6;
 if(x+pw>window.innerWidth-10)x=window.innerWidth-pw-10;if(x<10)x=10;if(y+ph>window.innerHeight-10)y=Math.max(10,r.top-ph-6);pop.style.left=x+'px';pop.style.top=y+'px';
 if(opts.focus){const f=pop.querySelector(opts.focus);f&&f.focus()}return pop}
function closePop(){pop.classList.remove('on');pop.innerHTML='';popAnchor=null}
document.addEventListener('mousedown',e=>{if(pop.classList.contains('on')&&!pop.contains(e.target)&&!(popAnchor&&popAnchor.contains(e.target)))closePop()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(pop.classList.contains('on')){closePop();return}if($('#peekwrap').classList.contains('on')){closePeek();return}if(selection.size){selection.clear();render()}}
 const mod=e.metaKey||e.ctrlKey;const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
 if(mod&&e.key.toLowerCase()==='z'){if(typing)return;e.preventDefault();e.shiftKey?redoIt():undo();return}
 if(mod&&e.key==='f'){e.preventDefault();$('#search').classList.add('on');$('#q').focus();return}
 if(!typing&&!mod&&e.key.toLowerCase()==='n'&&!$('#peekwrap').classList.contains('on')){e.preventDefault();newCard();return}
 if(!typing&&(e.key==='Delete'||e.key==='Backspace')&&selection.size){e.preventDefault();bulk('del')}
 if($('#peekwrap').classList.contains('on')&&!typing&&!mod){if(e.key==='ArrowLeft'||e.key==='k')peekNav(-1);if(e.key==='ArrowRight'||e.key==='j')peekNav(1)}});
const mi=(label,attrs='',icon='',extra='')=>`<div class="mi" ${attrs}>${icon}<span>${label}</span>${extra}</div>`;

/* ── Filter UI ── */
function filterPicker(anchor){openPop(anchor,`<h5>Filter by</h5><input type="search" placeholder="Search properties…" data-q>`+PROPS.filter(p=>!p.ro).map(p=>mi(esc(p.n),`data-pick="${p.k}"`,ICON[p.t]||'')).join(''),{focus:'[data-q]'});
 pop.querySelector('[data-q]').oninput=e=>{const q=e.target.value.toLowerCase();$$('.mi',pop).forEach(m=>m.style.display=m.textContent.toLowerCase().includes(q)?'':'none')};
 pop.onclick=e=>{const m=e.target.closest('[data-pick]');if(!m)return;const k=m.dataset.pick;const op=OPS[P[k].t][0];V().filters.push({k,op,v:''});render();const el=$$('[data-frule]').pop();editFilter(el,V().filters.length-1)}}
function editFilter(anchor,i){const r=V().filters[i],p=P[r.k];const ops=OPS[p.t];const needsVal=!/empty|checked/.test(r.op);
 let valHtml='';
 if(needsVal){if(p.t==='select'||p.t==='status'||p.t==='multi')valHtml=`<select data-v>${opts(r.k).map(o=>`<option ${o.n===r.v?'selected':''}>${esc(o.n)}</option>`).join('')}</select>`;
  else if(p.t==='people'||p.t==='person_ro')valHtml=`<select data-v>${S.people.map(o=>`<option ${o===r.v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(p.t==='date'||p.t==='time_ro')valHtml=`<input type="date" data-v value="${esc(r.v)}">`;
  else valHtml=`<input type="text" data-v placeholder="Type a value…" value="${esc(r.v)}">`}
 openPop(anchor,`<h5>${esc(p.n)}</h5><select data-op>${ops.map(o=>`<option ${o===r.op?'selected':''}>${o}</option>`).join('')}</select>${valHtml}<hr>${mi('Delete filter','data-del',ICON.trash)}`,{w:280,focus:'[data-v]'});
 const sync=()=>{r.op=pop.querySelector('[data-op]').value;const v=pop.querySelector('[data-v]');if(v)r.v=v.value;if(!r.v&&v&&v.tagName==='SELECT')r.v=v.value;render()};
 pop.querySelector('[data-op]').onchange=()=>{sync();editFilter($$('[data-frule]')[i],i)};const v=pop.querySelector('[data-v]');if(v){v.oninput=sync;if(v.tagName==='SELECT'&&!r.v){r.v=v.value;render()}}
 pop.onclick=e=>{if(e.target.closest('[data-del]')){V().filters.splice(i,1);closePop();render()}}}
/* ── Sort UI ── */
function sortPicker(anchor){openPop(anchor,`<h5>Sort by</h5>`+PROPS.map(p=>mi(esc(p.n),`data-pick="${p.k}"`,ICON[p.t]||'')).join(''));
 pop.onclick=e=>{const m=e.target.closest('[data-pick]');if(!m)return;V().sorts.push({k:m.dataset.pick,dir:'asc'});closePop();render()}}
function editSort(anchor,i){const s=V().sorts[i];openPop(anchor,`<h5>${esc(P[s.k].n)}</h5><div class="seg"><button data-dir="asc" class="${s.dir==='asc'?'on':''}">Ascending</button><button data-dir="desc" class="${s.dir==='desc'?'on':''}">Descending</button></div><hr>${mi('Remove sort','data-del',ICON.trash)}`);
 pop.onclick=e=>{const d=e.target.closest('[data-dir]');if(d){s.dir=d.dataset.dir;closePop();render()}if(e.target.closest('[data-del]')){V().sorts.splice(i,1);closePop();render()}}}
$('#bFilter').onclick=e=>{if(V().filters.length){V().filters=[];render();toast('Filters cleared')}else filterPicker(e.currentTarget)};
$('#bSort').onclick=e=>{if(V().sorts.length){V().sorts=[];render();toast('Sorts cleared')}else sortPicker(e.currentTarget)};
$('#bSearch').onclick=()=>{const s=$('#search');s.classList.toggle('on');if(s.classList.contains('on'))$('#q').focus();else{V().search='';render()}};
$('#q').addEventListener('input',e=>{V().search=e.target.value.trim();render()});
$('#qClear').onclick=()=>{V().search='';$('#search').classList.remove('on');render()};
$('#bFull').onclick=()=>{document.body.classList.toggle('full');$('#bFull').classList.toggle('on',document.body.classList.contains('full'))};

/* ── Automations menu ── */
$('#bAuto').onclick=e=>{const a=V().automations;openPop(e.currentTarget,`<h5>Automations</h5>
 ${mi('<b>Approved</b> → '+esc(a.approved.pipeline)+' · '+esc(a.approved.project),'data-cfg="approved"',ICON.bolt,'<span class="sub">edit</span>')}
 ${mi('<b>Needs Edits</b> → '+esc(a.needsEdits.pipeline)+' · '+esc(a.needsEdits.project),'data-cfg="needsEdits"',ICON.bolt,'<span class="sub">edit</span>')}
 <div class="note">These are the two button properties on every card in Notion. Here they move the card to the Content Pipeline stage and Project Pipeline status set below, and stamp it as edited by you.</div>`,{w:360,alignRight:true});
 pop.onclick=ev=>{const c=ev.target.closest('[data-cfg]');if(c)cfgAutomation(c,c.dataset.cfg)}};
function cfgAutomation(anchor,key){const a=V().automations[key];openPop(anchor,`<h5>${key==='approved'?'Approved':'Needs Edits'} sets…</h5><div class="note">Content Pipeline</div><select data-p>${opts('pipeline').map(o=>`<option ${o.n===a.pipeline?'selected':''}>${esc(o.n)}</option>`).join('')}</select><div class="note">Project Pipeline</div><select data-s><option value="">(leave as is)</option>${opts('project').map(o=>`<option ${o.n===a.project?'selected':''}>${esc(o.n)}</option>`).join('')}</select>`,{w:300});
 pop.querySelector('[data-p]').onchange=e=>{a.pipeline=e.target.value;save()};pop.querySelector('[data-s]').onchange=e=>{a.project=e.target.value;save()}}
function runAutomation(c,key){snap(key==='approved'?'Approved':'Needs Edits');const a=V().automations[key];c.pipeline=a.pipeline;if(a.project)c.project=a.project;touch(c);
 c.comments=c.comments||[];c.comments.push({id:uid(),by:ME,date:shortDate(new Date()),text:key==='approved'?'✅ Approved':'✏️ Needs edits',auto:true});save();render();openPeek(c.id);toast((key==='approved'?'Approved → ':'Needs edits → ')+a.pipeline,true)}
const shortDate=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});

/* ── View settings ── */
$('#bSettings').onclick=e=>viewSettings(e.currentTarget);
function viewSettings(anchor,page){const v=V();let html='';
 if(!page){html=`<h5>View settings</h5>
 ${mi('Layout','data-pg="layout"',ICON.board,`<span class="sub">${v.layout}</span>`)}
 ${mi('Group by','data-pg="group"',ICON.grid,`<span class="sub">${esc(P[v.groupBy].n)}</span>`)}
 ${mi('Properties','data-pg="props"',ICON.list,`<span class="sub">${v.layout==='table'?v.tableProps.length:v.cardProps.length} shown</span>`)}
 ${mi('Filter','data-pg="filter"',ICON.filter,`<span class="sub">${v.filters.length||'None'}</span>`)}
 ${mi('Sort','data-pg="sort"',ICON.sort,`<span class="sub">${v.sorts.length||'None'}</span>`)}
 <hr>
 ${mi('Color columns','data-tog="colorCols"',ICON.palette,`<span class="tog"></span>`).replace('class="mi"',`class="mi${v.colorCols?' on':''}"`)}
 ${mi('Hide empty groups','data-tog="hideEmpty"',ICON.eyeoff,`<span class="tog"></span>`).replace('class="mi"',`class="mi${v.hideEmpty?' on':''}"`)}
 ${mi('Wrap card titles','data-tog="wrap"',ICON.title,`<span class="tog"></span>`).replace('class="mi"',`class="mi${v.wrap?' on':''}"`)}
 ${mi('Card size','data-pg="size"',ICON.expand,`<span class="sub">${v.cardSize}</span>`)}
 ${mi('Open pages in','data-pg="open"',ICON.open,`<span class="sub">${{side:'Side peek',center:'Center peek',full:'Full page'}[v.openAs]}</span>`)}
 <hr>${mi('Reset view settings','data-resetview',ICON.undo)}`}
 else if(page==='layout'){html=`<h5>Layout</h5>`+[['board','Board'],['table','Table'],['list','List'],['calendar','Calendar'],['gallery','Gallery']].map(([k,n])=>mi(n,`data-set="layout:${k}"`,ICON[k],`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${v.layout===k?' on':''}"`)).join('')}
 else if(page==='group'){html=`<h5>Group by</h5>`+GROUPABLE.map(k=>mi(esc(P[k].n),`data-set="groupBy:${k}"`,ICON[P[k].t],`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${v.groupBy===k?' on':''}"`)).join('')+`<hr>${mi('Show all hidden groups','data-showall',ICON.eye)}`}
 else if(page==='props'){const list=v.layout==='table'?v.tableProps:v.cardProps;const key=v.layout==='table'?'tableProps':'cardProps';
  html=`<h5>${v.layout==='table'?'Table columns':'Properties shown on cards'}</h5><div class="note">Toggle what each card shows. Order follows this list.</div>`+PROPS.filter(p=>p.k!=='title').map(p=>mi(esc(p.n),`data-ptog="${key}:${p.k}"`,ICON[p.t],`<span class="tog"></span>`).replace('class="mi"',`class="mi${list.includes(p.k)?' on':''}"`)).join('')+`<hr>`+mi('Comments count','data-ptog="'+key+':comments"',ICON.comment,'<span class="tog"></span>').replace('class="mi"',`class="mi${list.includes('comments')?' on':''}"`)}
 else if(page==='size'){html=`<h5>Card size</h5>`+['small','medium','large'].map(k=>mi(k[0].toUpperCase()+k.slice(1),`data-set="cardSize:${k}"`,'',`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${v.cardSize===k?' on':''}"`)).join('')}
 else if(page==='open'){html=`<h5>Open pages in</h5>`+[['side','Side peek'],['center','Center peek'],['full','Full page']].map(([k,n])=>mi(n,`data-set="openAs:${k}"`,'',`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${v.openAs===k?' on':''}"`)).join('')}
 else if(page==='filter'){closePop();filterPicker(anchor);return}else if(page==='sort'){closePop();sortPicker(anchor);return}
 if(page)html=`<div class="mi" data-pg="">${ICON.chevL}<span>Back</span></div><hr>`+html;
 openPop(anchor,html,{w:300,alignRight:true});
 pop.onclick=e=>{const t=e.target.closest('.mi');if(!t)return;
  if(t.dataset.pg!=null){viewSettings(anchor,t.dataset.pg||null);return}
  if(t.dataset.set){const [k,val]=t.dataset.set.split(':');v[k]=val;if(k==='groupBy')v.order=[];render();viewSettings(anchor,page);return}
  if(t.dataset.tog){v[t.dataset.tog]=!v[t.dataset.tog];render();viewSettings(anchor,page);return}
  if(t.dataset.ptog){const [key,k]=t.dataset.ptog.split(':');const l=v[key];const i=l.indexOf(k);i<0?l.push(k):l.splice(i,1);render();viewSettings(anchor,page);return}
  if(t.hasAttribute('data-showall')){v.hidden=[];render();viewSettings(anchor,page);return}
  if(t.hasAttribute('data-resetview')){S.view=clone(DEFAULT_VIEW);closePop();render();toast('View settings reset')}}}

/* ── New ▾ ── */
$('#bNewMain').onclick=()=>newCard();
$('#bNewMore').onclick=e=>{e.stopPropagation();openPop($('#bNew'),`<h5>New</h5>${mi('Empty page','data-new',ICON.plus)}<hr><h5>Templates</h5>`+TEMPLATES.map((t,i)=>mi(esc(t.n),`data-tpl="${i}"`,ICON.copy)).join('')+`<hr>${mi('Add a group (pipeline stage)','data-addgroup',ICON.grid)}`,{alignRight:true,w:260});
 pop.onclick=ev=>{const t=ev.target.closest('.mi');if(!t)return;if(t.hasAttribute('data-new')){closePop();newCard()}else if(t.dataset.tpl){closePop();newCard(null,TEMPLATES[+t.dataset.tpl])}else if(t.hasAttribute('data-addgroup')){closePop();addOption('pipeline',$('#bNew'))}}};
function newCard(groupVal,tpl){snap('New page');const v=V();const first=groupsFor(v.groupBy).find(g=>!v.hidden.includes(g.n));
 const c={id:uid(),title:'',assigned:[ME],deadline:'',publish:'',type:tpl?[...tpl.type]:[],pipeline:'',project:'',raw:'',doc:'',edited:'',frameio:'',archived:false,plan:'',createdBy:ME,createdAt:nowISO(),editedBy:ME,editedAt:nowISO(),comments:[],body:tpl?tpl.body:'',url:''};
 if(groupVal!=null)setGroup(c,v.groupBy,groupVal);else if(v.groupBy==='pipeline'&&first&&!first.none)c.pipeline=first.n;
 S.cards.push(c);save();render();openPeek(c.id,true)}

/* ═══ BOARD ═══════════════════════════════════════════════════════════════ */
function renderBoard(){const v=V();const k=v.groupBy;const list=visibleCards();const groups=groupsFor(k);
 const vis=groups.filter(g=>!v.hidden.includes(g.n)),hid=groups.filter(g=>v.hidden.includes(g.n));
 const cls=['board',v.colorCols?'':'nocolor',v.cardSize,v.wrap?'':'nowrap'].join(' ');
 host.innerHTML=`<div class="scroller"><div class="${cls}" id="board">`+vis.map(g=>{const cs=list.filter(c=>inGroup(c,k,g));if(v.hideEmpty&&!cs.length)return'';const C=COLORS[g.c],T=TINT[g.c];
  return `<div class="grp" data-g="${esc(g.n)}" draggable="true" style="--gbg:${T.gbg};--pbg:${C.pill};--pfg:${C.pfg};--cnt:${C.cnt};--cbg:${T.cbg};--cbg-h:${T.cbgh};--ring:${T.ring}">
   <div class="gh"><span class="pill${g.none?' none':''}">${esc(g.n)}</span><span class="n">${cs.length}</span>
    <span class="more"><button title="Group options" data-gmenu>${ICON.more}</button><button title="Add a page" data-add>${ICON.plus}</button></span></div>
   <div class="cards" data-g="${esc(g.n)}">${cs.map(cardHtml).join('')}</div>
   <div class="draft"><input placeholder="Untitled" data-draft><div class="tags">${opts('type').slice(0,6).map(o=>`<span class="chip" data-tag="${esc(o.n)}" style="--tbg:${COLORS[o.c].pill};--tfg:${COLORS[o.c].pfg}">${esc(o.n)}</span>`).join('')}</div><div class="acts"><button class="go" data-save>Add</button><button data-cancel>Cancel</button></div></div>
   <button class="newp" data-add>${ICON.plus}New page</button></div>`}).join('')
  +(hid.length?`<div class="hidden-groups"><h4>Hidden groups</h4>${hid.map(g=>`<div class="hg" data-show="${esc(g.n)}">${ICON.eyeoff}<span>${esc(g.n)}</span><span class="n">${list.filter(c=>inGroup(c,k,g)).length}</span></div>`).join('')}</div>`:'')
  +((P[k].t==='select'||P[k].t==='multi'||P[k].t==='status')?`<button class="addgrp" data-addgroup>${ICON.plus}Add a group</button>`:'')+`</div></div>`;
 if(!vis.length)host.innerHTML+=`<div class="empty">All groups are hidden — open view settings → Group by → “Show all hidden groups”.</div>`}
function cardHtml(c){const v=V();const props=v.cardProps.map(k=>propOnCard(c,k)).filter(Boolean).join('');
 return `<div class="card${selection.has(c.id)?' sel':''}" draggable="true" data-id="${c.id}"><div class="in"><div class="t">${esc(c.title)||'<span style="color:#6b6963">Untitled</span>'}</div>${props?`<div class="pr">${props}</div>`:''}</div>
  <div class="hov">${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener" title="Open in Notion">↗</a>`:''}<button data-cmenu title="More">⋯</button></div></div>`}
function propOnCard(c,k){if(k==='clips'){const n=(c.clips||[]).length,m=(c.photos||[]).length;return (c.look?`<span class="meta lookchip" title="Look: ${esc(c.look.name)}">${(c.look.palette||[]).slice(0,3).map(x=>`<i style="background:${esc(x)}"></i>`).join('')}${esc(c.look.name)}</span>`:'')+(n?`<span class="meta" title="${n} clips from the Library">${ICON.clips}${n}</span>`:'')+(m?`<span class="meta" title="${m} photos from the Library">${ICON.photo}${m}</span>`:'')}if(k==='comments'){const n=(c.comments||[]).length;return n?`<span class="meta">${ICON.comment}${n}</span>`:''}
 const p=P[k],val=c[k];if(val==null||val===''||(Array.isArray(val)&&!val.length))return'';
 if(p.t==='multi')return val.map(x=>chip(k,x)).join('');if(p.t==='select'||p.t==='status')return chip(k,val);
 if(p.t==='people')return val.map(person).join('');if(p.t==='checkbox')return `<span class="kv"><span class="chk${val?' on':''}">${val?'✓':''}</span>${esc(p.n)}</span>`;
 if(p.t==='url')return `<span class="kv">${ICON[p.t]}<a href="${esc(val)}" target="_blank" rel="noopener">${esc(shortUrl(val))}</a></span>`;
 if(p.t==='date')return `<span class="kv">${ICON.date}${esc(fmtDate(val))}</span>`;if(p.t==='time_ro')return `<span class="kv">${ICON.time_ro}${esc(fmtDT(val))}</span>`;
 if(p.t==='person_ro')return person(val);return `<span class="kv">${esc(String(val))}</span>`}

/* board interactions (delegated) */
let dragId=null,dragCol=null;
let overGrp=null,rectCache=null,lastOver=0;
host.addEventListener('dragstart',e=>{const col=e.target.closest('.grp');const card=e.target.closest('.card');document.body.classList.add('dragging');overGrp=null;rectCache=null;
 if(card){dragId=card.dataset.id;card.classList.add('drag');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);const g=card.closest('.grp');if(g)g.classList.add('src')}
 else if(col&&e.target.closest('.gh')){dragCol=col.dataset.g;col.classList.add('dragcol');e.dataTransfer.effectAllowed='move'}else e.preventDefault()});
host.addEventListener('dragend',()=>{document.body.classList.remove('dragging');$$('.card.drag',host).forEach(x=>x.classList.remove('drag'));$$('.grp.over,.grp.dragcol,.grp.src',host).forEach(x=>x.classList.remove('over','dragcol','src'));$$('.ph-drop',host).forEach(x=>x.remove());$$('.day.over',host).forEach(x=>x.classList.remove('over'));dragId=null;dragCol=null;overGrp=null;rectCache=null});
host.addEventListener('dragover',e=>{const g=e.target.closest('.grp');const day=e.target.closest('.day');if(day&&dragId){e.preventDefault();if(!day.classList.contains('over')){$$('.day.over',host).forEach(x=>x.classList.remove('over'));day.classList.add('over')}return}
 if(!g)return;e.preventDefault();
 if(dragId){
  if(g!==overGrp){if(overGrp)overGrp.classList.remove('over');overGrp=g;g.classList.add('over');
   // measure once per column: card midpoints (the placeholder is ~0px tall so these stay valid while it moves)
   rectCache=[...g.querySelectorAll('.cards .card:not(.drag)')].map(c=>({el:c,mid:c.getBoundingClientRect().top+c.offsetHeight/2}))}
  const now=performance.now();if(now-lastOver<40)return;lastOver=now;
  const cards=g.querySelector('.cards');let ph=cards.querySelector('.ph-drop');if(!ph){ph=document.createElement('div');ph.className='ph-drop'}
  const over=rectCache.find(r=>e.clientY<r.mid);const target=over?over.el:null;
  if(target?ph.nextElementSibling!==target||ph.parentNode!==cards:cards.lastElementChild!==ph){target?cards.insertBefore(ph,target):cards.appendChild(ph)}}
 else if(dragCol&&g.dataset.g!==dragCol&&!g.classList.contains('over')){g.classList.add('over')}});
host.addEventListener('dragleave',e=>{const g=e.target.closest('.grp');if(g&&!g.contains(e.relatedTarget)){g.classList.remove('over');if(overGrp===g){overGrp=null;rectCache=null}const ph=g.querySelector('.ph-drop');ph&&ph.remove()}});
host.addEventListener('drop',e=>{const day=e.target.closest('.day');if(day&&dragId){e.preventDefault();snap('Move date');const c=S.cards.find(x=>x.id===dragId);c[V().calProp]=day.dataset.date;touch(c);save();render();toast('Moved to '+fmtDate(day.dataset.date),true);return}
 const g=e.target.closest('.grp');if(!g)return;e.preventDefault();const v=V();
 if(dragId){snap('Move card');const ids=selection.has(dragId)?[...selection]:[dragId];const grp=groupsFor(v.groupBy).find(x=>x.n===g.dataset.g);
  const ph=g.querySelector('.ph-drop');const beforeEl=ph?ph.nextElementSibling:null;const beforeId=beforeEl&&beforeEl.classList.contains('card')?beforeEl.dataset.id:null;
  const moving=ids.map(id=>S.cards.find(c=>c.id===id));moving.forEach(c=>{setGroup(c,v.groupBy,grp);touch(c)});
  S.cards=S.cards.filter(c=>!ids.includes(c.id));let idx=beforeId?S.cards.findIndex(c=>c.id===beforeId):-1;
  if(idx<0){let last=-1;S.cards.forEach((c,i)=>{if(inGroup(c,v.groupBy,grp))last=i});idx=last+1}S.cards.splice(idx,0,...moving);
  save();render();toast(`Moved ${ids.length>1?ids.length+' cards':'card'} to ${grp.n}`,true)}
 else if(dragCol&&g.dataset.g!==dragCol){const names=groupsFor(v.groupBy).map(x=>x.n);const from=names.indexOf(dragCol),to=names.indexOf(g.dataset.g);names.splice(from,1);names.splice(to,0,dragCol);v.order=names;render()}});
host.addEventListener('click',e=>{const t=e.target;const v=V();
 const add=t.closest('[data-add]');if(add){const g=add.closest('.grp');g.classList.add('adding');g.querySelector('[data-draft]').focus();return}
 if(t.closest('[data-cancel]')){t.closest('.grp').classList.remove('adding');return}
 const tag=t.closest('.draft .chip');if(tag){tag.classList.toggle('on');return}
 if(t.closest('[data-save]')){commitDraft(t.closest('.grp'));return}
 const gm=t.closest('[data-gmenu]');if(gm){groupMenu(gm,gm.closest('.grp').dataset.g);return}
 const show=t.closest('[data-show]');if(show){v.hidden=v.hidden.filter(x=>x!==show.dataset.show);render();return}
 if(t.closest('[data-addgroup]')){addOption(v.groupBy,t.closest('[data-addgroup]'));return}
 const cm=t.closest('[data-cmenu]');if(cm){e.stopPropagation();cardMenu(cm,cm.closest('.card').dataset.id);return}
 if(t.closest('.hov a'))return;
 const card=t.closest('.card,[data-open]');if(card){const id=card.dataset.id||card.dataset.open;if(e.metaKey||e.ctrlKey||e.shiftKey){toggleSel(id);return}if(selection.size){selection.clear();render()}openPeek(id);return}});
host.addEventListener('keydown',e=>{if(e.target.matches('[data-draft]')){if(e.key==='Enter'){e.preventDefault();commitDraft(e.target.closest('.grp'))}if(e.key==='Escape'){e.stopPropagation();e.target.closest('.grp').classList.remove('adding')}}});
function commitDraft(g){const inp=g.querySelector('[data-draft]');const t=inp.value.trim();if(!t){g.classList.remove('adding');return}snap('Add page');
 const v=V();const grp=groupsFor(v.groupBy).find(x=>x.n===g.dataset.g);const types=$$('.draft .chip.on',g).map(x=>x.dataset.tag);
 const c={id:uid(),title:t,assigned:[ME],deadline:'',publish:'',type:types,pipeline:'',project:'',raw:'',doc:'',edited:'',frameio:'',archived:false,plan:'',createdBy:ME,createdAt:nowISO(),editedBy:ME,editedAt:nowISO(),comments:[],body:'',url:''};
 setGroup(c,v.groupBy,grp);S.cards.push(c);save();inp.value='';render();toast('Added to '+grp.n,true)}
function groupMenu(anchor,name){const v=V();const k=v.groupBy;const g=groupsFor(k).find(x=>x.n===name);const canColor=!g.none&&(P[k].t==='select'||P[k].t==='multi'||P[k].t==='status');const count=S.cards.filter(c=>inGroup(c,k,g)).length;
 openPop(anchor,`<h5>${esc(name)}</h5>${mi('Hide group','data-hide',ICON.eyeoff)}${canColor?mi('Rename','data-rename',ICON.pencil)+`<div class="mi" data-color>${ICON.palette}<span>Color</span></div><div class="swatches">${COLOR_NAMES.map(c=>`<div class="sw${g.c===c?' on':''}" data-sw="${c}" style="background:${COLORS[c].pill};color:${COLORS[c].pfg}">${c.slice(0,3)}</div>`).join('')}</div>`:''}<hr>${mi('Select all cards','data-selall',ICON.grid)}${canColor?mi('Delete group','data-delgrp'+(count?' ':''),ICON.trash).replace('class="mi"','class="mi danger'+(count?' dis':'')+'"'):''}`,{w:240});
 pop.onclick=e=>{const t=e.target;if(t.closest('[data-hide]')){v.hidden.push(name);closePop();render()}
  else if(t.closest('[data-sw]')){const o=opts(k).find(x=>x.n===name);if(o){o.c=t.closest('[data-sw]').dataset.sw;save();render();groupMenu($(`.grp[data-g="${CSS.escape(name)}"] [data-gmenu]`)||anchor,name)}}
  else if(t.closest('[data-rename]')){const nn=prompt('Rename option',name);if(nn&&nn!==name){snap('Rename option');const o=opts(k).find(x=>x.n===name);o.n=nn;S.cards.forEach(c=>{if(Array.isArray(c[k])){c[k]=c[k].map(x=>x===name?nn:x)}else if(c[k]===name)c[k]=nn});v.hidden=v.hidden.map(x=>x===name?nn:x);closePop();render()}}
  else if(t.closest('[data-selall]')){S.cards.filter(c=>inGroup(c,k,g)).forEach(c=>selection.add(c.id));closePop();render()}
  else if(t.closest('[data-delgrp]')){snap('Delete group');S.opts[k]=opts(k).filter(x=>x.n!==name);closePop();render();toast('Group deleted',true)}}}
function addOption(k,anchor){openPop(anchor,`<h5>New ${esc(P[k].n)} option</h5><input type="text" data-n placeholder="Name"><div class="swatches">${COLOR_NAMES.map(c=>`<div class="sw${c==='default'?' on':''}" data-sw="${c}" style="background:${COLORS[c].pill};color:${COLORS[c].pfg}">${c.slice(0,3)}</div>`).join('')}</div><div class="row"><button class="btn2 gold" data-ok>Add</button></div>`,{w:260,focus:'[data-n]'});
 let col='default';pop.onclick=e=>{const sw=e.target.closest('[data-sw]');if(sw){col=sw.dataset.sw;$$('.sw',pop).forEach(x=>x.classList.toggle('on',x===sw))}if(e.target.closest('[data-ok]'))go()};pop.querySelector('[data-n]').onkeydown=e=>{if(e.key==='Enter')go()};
 function go(){const n=pop.querySelector('[data-n]').value.trim();if(!n)return;if(opts(k).some(o=>o.n===n))return toast('That option already exists');snap('Add option');S.opts[k]=[...opts(k),{n,c:col}];closePop();render();toast('Added '+n)}}
function cardMenu(anchor,id){const c=S.cards.find(x=>x.id===id);const ids=selection.has(id)&&selection.size>1?[...selection]:[id];const many=ids.length>1;openPop(anchor,`<h5>${many?ids.length+' pages selected':esc(c.title||'Untitled')}</h5>${mi('Open','data-open',ICON.open)}${mi('Open as full page','data-full',ICON.expand)}${c.url?`<a class="mi" href="${esc(c.url)}" target="_blank" rel="noopener">${ICON.open}<span>Open in Notion</span></a>`:''}<hr>${mi('Approved','data-auto="approved"',ICON.bolt)}${mi('Needs Edits','data-auto="needsEdits"',ICON.bolt)}<hr>${mi('Move to…','data-move',ICON.board)}${mi('Duplicate','data-dup',ICON.copy)}${mi('Copy title','data-copyt',ICON.copy)}${mi(c.archived?'Unarchive':'Archive','data-arch',ICON.checkbox)}<hr>${mi('Delete','data-del',ICON.trash).replace('class="mi"','class="mi danger"')}`,{w:220});
 pop.onclick=e=>{const t=e.target.closest('.mi');if(!t)return;
  if(t.hasAttribute('data-open')){closePop();openPeek(id)}else if(t.hasAttribute('data-full')){closePop();openPeek(id,false,'full')}
  else if(t.dataset.auto){closePop();runAutomation(c,t.dataset.auto)}else if(t.hasAttribute('data-move')){movePicker(anchor,ids)}
  else if(t.hasAttribute('data-dup')){closePop();dup(ids)}else if(t.hasAttribute('data-copyt')){navigator.clipboard?.writeText(c.title);closePop();toast('Copied')}
  else if(t.hasAttribute('data-arch')){snap('Archive');const v=!c.archived;ids.forEach(i=>{const x=S.cards.find(y=>y.id===i);if(x){x.archived=v;touch(x)}});closePop();save();render()}else if(t.hasAttribute('data-del')){del(ids,anchor)}}}
function movePicker(anchor,ids){const v=V();const k=v.groupBy;openPop(anchor,`<h5>Move to ${esc(P[k].n)}</h5>`+groupsFor(k).map(g=>mi(g.none?esc(g.n):chip(k,g.n,true),`data-g="${esc(g.n)}"`)).join(''),{w:240});
 pop.onclick=e=>{const t=e.target.closest('[data-g]');if(!t)return;snap('Move');const g=groupsFor(k).find(x=>x.n===t.dataset.g);ids.forEach(id=>{const c=S.cards.find(x=>x.id===id);setGroup(c,k,g);touch(c)});selection.clear();closePop();render();toast('Moved to '+g.n,true)}}
function dup(ids){snap('Duplicate');const copies=ids.map(id=>{const c=S.cards.find(x=>x.id===id);const n=clone(c);n.id=uid();n.title=c.title+' (copy)';n.url='';n.createdAt=nowISO();n.createdBy=ME;touch(n);n.comments=[];return n});S.cards.push(...copies);selection.clear();save();render();toast(`Duplicated ${copies.length}`,true)}
function askConfirm(anchor,msg,label,onYes){openPop(anchor||$('#bNew'),`<div class="note" style="font-size:14px;color:var(--fg);padding:8px 10px 6px">${esc(msg)}</div><div class="row"><button class="btn2" data-no>Cancel</button><button class="btn2 gold" data-yes style="background:#e5383b;color:#fff">${esc(label)}</button></div>`,{w:280});
 pop.onclick=e=>{if(e.target.closest('[data-yes]')){closePop();onYes()}else if(e.target.closest('[data-no]'))closePop()};pop.querySelector('[data-yes]').focus()}
function del(ids,anchor){askConfirm(anchor,`Delete ${ids.length>1?ids.length+' pages':'this page'} from the board?`,'Delete',()=>{snap('Delete');const now=nowISO();S.gone=S.gone||{};ids.forEach(id=>S.gone[id]=now);S.cards=S.cards.filter(c=>!ids.includes(c.id));selection.clear();closePeek();save();try{localStorage.setItem('bm.pipeline.ping',String(Date.now()))}catch(e){}render();toast('Deleted',true)})}
function toggleSel(id){selection.has(id)?selection.delete(id):selection.add(id);render()}
function updateSelbar(){const b=$('#selbar');b.classList.toggle('on',selection.size>0);$('#selCount').textContent=selection.size+' selected'}
$('#selbar').onclick=e=>{const a=e.target.dataset.act;if(a)bulk(a,e.target)};
function bulk(a,anchor){const ids=[...selection];if(a==='clear'){selection.clear();render()}else if(a==='del')del(ids,anchor||$('#selbar'));else if(a==='dup')dup(ids);else if(a==='move')movePicker(anchor||$('#selbar'),ids)}

/* ═══ TABLE ═══════════════════════════════════════════════════════════════ */
function renderTable(){const v=V();const list=visibleCards();const cols=v.tableProps.filter(k=>k==='comments'||P[k]);
 const sortOf=k=>v.sorts.find(s=>s.k===k);
 host.innerHTML=`<div class="tablewrap"><table class="tv"><thead><tr><th data-col="title">${ICON.title}Name${sortOf('title')?`<span class="sa">${sortOf('title').dir==='asc'?'▲':'▼'}</span>`:''}</th>${cols.map(k=>`<th data-col="${k}">${k==='comments'?ICON.comment+'Comments':(ICON[P[k].t]||'')+esc(P[k].n)}${sortOf(k)?`<span class="sa">${sortOf(k).dir==='asc'?'▲':'▼'}</span>`:''}</th>`).join('')}<th data-addcol style="color:var(--mut)">+</th></tr></thead><tbody>`+
  list.map(c=>`<tr data-id="${c.id}" class="${selection.has(c.id)?'sel':''}"><td class="ttl" data-open="${c.id}">${esc(c.title)||'<span style="color:#6b6963">Untitled</span>'}<span class="open">OPEN</span></td>${cols.map(k=>cellHtml(c,k)).join('')}<td></td></tr>`).join('')+
  `</tbody><tfoot><tr><td data-newrow>+ New</td>${cols.map(k=>`<td class="calc">${calc(list,k)}</td>`).join('')}<td></td></tr></tfoot></table></div>`;
 host.querySelector('thead').onclick=e=>{const th=e.target.closest('th');if(!th)return;if(th.hasAttribute('data-addcol')){viewSettings(th,'props');return}const k=th.dataset.col;const s=v.sorts.find(x=>x.k===k);if(!s)v.sorts=[{k,dir:'asc'}];else if(s.dir==='asc')s.dir='desc';else v.sorts=v.sorts.filter(x=>x.k!==k);render()};
 host.querySelector('tbody').onclick=e=>{const td=e.target.closest('td');if(!td)return;const id=td.closest('tr').dataset.id;if(e.target.closest('a'))return;
  if(td.classList.contains('ttl')){if(e.metaKey||e.ctrlKey){toggleSel(id);return}openPeek(id);return}const k=td.dataset.k;if(k&&k!=='comments')editProp(td,S.cards.find(c=>c.id===id),k)};
 host.querySelector('tfoot').onclick=e=>{if(e.target.closest('[data-newrow]'))newCard()}}
function cellHtml(c,k){if(k==='clips'){const n=(c.clips||[]).length,m=(c.photos||[]).length;return `<td data-k="clips" class="${n||m?'':'emp'}">${[n?n+' clips':'',m?m+' photos':''].filter(Boolean).join(' · ')||'—'}</td>`}if(k==='comments'){const n=(c.comments||[]).length;return `<td data-k="comments" class="${n?'':'emp'}">${n||'—'}</td>`}
 const p=P[k],val=c[k];const empty=val==null||val===''||(Array.isArray(val)&&!val.length);if(empty&&p.t!=='checkbox')return `<td data-k="${k}" class="emp">${p.ro?'':'—'}</td>`;
 let h='';if(p.t==='multi')h=`<div class="chips">${val.map(x=>chip(k,x)).join('')}</div>`;else if(p.t==='select'||p.t==='status')h=chip(k,val);else if(p.t==='people')h=`<div class="chips">${val.map(person).join('')}</div>`;
 else if(p.t==='checkbox')h=`<span class="chk${val?' on':''}">${val?'✓':''}</span>`;else if(p.t==='url')h=`<a class="u" href="${esc(val)}" target="_blank" rel="noopener">${esc(shortUrl(val))}</a>`;
 else if(p.t==='date')h=esc(fmtDate(val));else if(p.t==='time_ro')h=esc(fmtDT(val));else if(p.t==='person_ro')h=person(val);else h=esc(String(val));
 return `<td data-k="${k}">${h}</td>`}
function calc(list,k){if(k==='comments')return list.reduce((a,c)=>a+(c.comments||[]).length,0)+' total';const p=P[k];const filled=list.filter(c=>{const v=c[k];return !(v==null||v===''||(Array.isArray(v)&&!v.length)||v===false)}).length;if(p.t==='checkbox')return filled+' checked';return filled?`${Math.round(filled/list.length*100)}% filled`:'empty'}

/* ═══ LIST ════════════════════════════════════════════════════════════════ */
function renderList(){const v=V();const list=visibleCards();const k=v.groupBy;const groups=groupsFor(k).filter(g=>!v.hidden.includes(g.n));
 host.innerHTML=`<div class="listwrap">`+groups.map(g=>{const cs=list.filter(c=>inGroup(c,k,g));if(!cs.length&&v.hideEmpty)return'';const C=COLORS[g.c];
  return `<div class="lgroup"><h3><span class="pill" style="display:inline-flex;height:20px;padding:0 6px;border-radius:4px;background:${g.none?'none':C.pill};color:${C.pfg}">${esc(g.n)}</span><span style="color:${C.cnt};font-size:13px">${cs.length}</span></h3>`+
  cs.map(c=>`<div class="lrow${selection.has(c.id)?' sel':''}" data-open="${c.id}"><span class="t">${esc(c.title)||'Untitled'}</span><span class="pr">${v.cardProps.map(kk=>propOnCard(c,kk)).filter(Boolean).join('')}${(c.comments||[]).length?`<span class="meta">${ICON.comment}${c.comments.length}</span>`:''}</span></div>`).join('')+`<button class="newp" style="width:auto;margin:0" data-addlist="${esc(g.n)}">${ICON.plus}New page</button></div>`}).join('')+`</div>`;
 host.querySelector('.listwrap').addEventListener('click',e=>{const a=e.target.closest('[data-addlist]');if(a){const g=groupsFor(k).find(x=>x.n===a.dataset.addlist);newCard(g)}})}

/* ═══ CALENDAR ════════════════════════════════════════════════════════════ */
function renderCalendar(){const v=V();const list=visibleCards();const k=v.calProp;const base=v.calMonth?new Date(v.calMonth+'-01T12:00:00'):new Date();const y=base.getFullYear(),m=base.getMonth();
 const first=new Date(y,m,1),start=new Date(first);start.setDate(1-first.getDay());const today=new Date().toISOString().slice(0,10);
 const byDay={};list.forEach(c=>{const d=(c[k]||'').slice(0,10);if(d)(byDay[d]=byDay[d]||[]).push(c)});const undated=list.filter(c=>!c[k]).length;
 let cells='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.toISOString().slice(0,10);const out=d.getMonth()!==m;
  cells+=`<div class="day${out?' out':''}${iso===today?' today':''}" data-date="${iso}"><div class="d"><b>${d.getDate()}</b><span class="add" data-newday="${iso}">+</span></div>${(byDay[iso]||[]).map(c=>{const col=optColor('pipeline',c.pipeline);const T=TINT[col];return `<span class="ev" data-open="${c.id}" style="--cbg:${T.cbg};--ring:${T.ring}">${esc(c.title)||'Untitled'}</span>`}).join('')}</div>`}
 host.innerHTML=`<div class="calwrap"><div class="calhd"><b>${first.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</b><select data-calprop><option value="deadline" ${k==='deadline'?'selected':''}>By Deadline</option><option value="publish" ${k==='publish'?'selected':''}>By Publish Date</option><option value="createdAt" ${k==='createdAt'?'selected':''}>By Created time</option><option value="editedAt" ${k==='editedAt'?'selected':''}>By Last edited</option></select><div class="nav2"><button data-cal="-1">‹</button><button data-cal="0">Today</button><button data-cal="1">›</button></div></div>
  <div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div><div class="calnote">${undated} ${undated===1?'item has':'items have'} no ${esc(P[k].n)} yet — drag a card from the board onto a day, or set it in the page. Drag events between days to reschedule.</div></div>`;
 host.querySelector('[data-calprop]').onchange=e=>{v.calProp=e.target.value;render()};
 host.querySelector('.calhd').onclick=e=>{const b=e.target.closest('[data-cal]');if(!b)return;const n=+b.dataset.cal;if(n===0){v.calMonth=null}else{const d=new Date(y,m+n,1);v.calMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}render()};
 host.querySelector('.cal').addEventListener('click',e=>{const nd=e.target.closest('[data-newday]');if(nd&&/^(deadline|publish)$/.test(k)){e.stopPropagation();snap('New page');const c={id:uid(),title:'',assigned:[ME],deadline:'',publish:'',type:[],pipeline:'Ideas',project:'',raw:'',doc:'',edited:'',frameio:'',archived:false,plan:'',createdBy:ME,createdAt:nowISO(),editedBy:ME,editedAt:nowISO(),comments:[],body:'',url:''};c[k]=nd.dataset.newday;S.cards.push(c);save();render();openPeek(c.id,true)}});
 $$('.ev',host).forEach(ev=>{ev.draggable=true;ev.addEventListener('dragstart',e=>{dragId=ev.dataset.open;e.dataTransfer.effectAllowed='move'})})}

/* ═══ GALLERY ═════════════════════════════════════════════════════════════ */
function renderGallery(){const v=V();const list=visibleCards();
 host.innerHTML=`<div class="galwrap">`+list.map(c=>{const col=optColor('pipeline',c.pipeline);const T=TINT[col],C=COLORS[col];return `<div class="gcard${selection.has(c.id)?' sel':''}" data-open="${c.id}" style="--cbg:${T.cbg};--ring:${T.ring};--pbg:${C.pill}"><div class="cov">${esc(initials(c.title||'U'))}</div><div class="in"><div class="t">${esc(c.title)||'Untitled'}</div><div class="pr">${c.pipeline?chip('pipeline',c.pipeline):''}${(c.type||[]).map(x=>chip('type',x)).join('')}${(c.comments||[]).length?`<span class="meta">${ICON.comment}${c.comments.length}</span>`:''}</div></div></div>`}).join('')+`</div>`}

/* ═══ PAGE PEEK ═══════════════════════════════════════════════════════════ */
let peekId=null;
function openPeek(id,focusTitle,mode){peekId=id;const w=$('#peekwrap');w.className='peekwrap on '+(mode||V().openAs);renderPeek();if(focusTitle)setTimeout(()=>$('.pk-title',w)?.focus(),50)}
function closePeek(){$('#peekwrap').classList.remove('on');peekId=null;closePop()}
$('#peekmask').onclick=closePeek;
function peekNav(d){const list=visibleCards();const i=list.findIndex(c=>c.id===peekId);const n=list[(i+d+list.length)%list.length];if(n)openPeek(n.id)}
function renderPeek(){const c=S.cards.find(x=>x.id===peekId);if(!c)return closePeek();const el=$('#peek');const list=visibleCards();const i=list.findIndex(x=>x.id===c.id);
 const propRow=p=>{const val=c[p.k];const empty=val==null||val===''||(Array.isArray(val)&&!val.length);let h='';
  if(p.t==='checkbox')h=`<span class="chk${val?' on':''}">${val?'✓':''}</span>`;
  else if(empty&&p.k==='frameio')h=`Empty <a class="u" href="../Review/index.html?card=${encodeURIComponent(c.id)}#/" style="margin-left:8px;color:var(--acc);font-size:12px" data-review>↑ Upload for review</a>`;
  else if(empty)h='Empty';
  else if(p.t==='multi')h=val.map(x=>chip(p.k,x,true)).join('');else if(p.t==='select'||p.t==='status')h=chip(p.k,val,true);
  else if(p.t==='people')h=val.map(person).join('');else if(p.t==='url')h=`<a href="${esc(val)}" target="_blank" rel="noopener">${esc(shortUrl(val))}</a>`;
  else if(p.t==='date')h=esc(fmtDate(val));else if(p.t==='time_ro')h=esc(fmtDT(val));else if(p.t==='person_ro')h=person(val);else if(p.t==='clips')h=`${val.length} clips · ${mmss(val.reduce((a,x)=>a+(x.duration||0),0))}${(c.photos||[]).length?` · ${c.photos.length} photos`:''} <span style="color:var(--mut)">↓ see Footage</span>`;else h=esc(String(val));
  return `<div class="prop" data-k="${p.k}"><div class="k" data-kmenu="${p.k}">${ICON[p.t]||''}<span>${esc(p.n)}</span></div><div class="v${empty&&p.t!=='checkbox'?' emp':''}${p.ro?' ro':''}" data-edit="${p.k}">${h}</div></div>`};
 const main=PROPS.filter(p=>p.k!=='title'&&!p.sec),edits=PROPS.filter(p=>p.sec==='edits');
 el.innerHTML=`<div class="pk-top"><button class="ic" data-pk="close" title="Close">${ICON.close}</button><button class="ic" data-pk="prev" title="Previous (←)">${ICON.chevL}</button><button class="ic" data-pk="next" title="Next (→)">${ICON.chevR}</button><button class="ic" data-pk="expand" title="Open as full page">${ICON.expand}</button><span class="crumb">Media Hub / Sean / ${esc(c.title||'Untitled')}</span><span class="sp"></span><span class="crumb">${i+1} of ${list.length}</span>${c.url?`<a class="ic" href="${esc(c.url)}" target="_blank" rel="noopener" title="Open in Notion">${ICON.open}</a>`:''}<button class="ic" data-pk="menu" title="More">${ICON.more}</button></div>
 <div class="pk-body">
  <div class="pk-ctl"><button data-pk="icon">☺ Add icon</button><button data-pk="cover">▭ Add cover</button><button data-pk="layout">⚙ Customize layout</button></div>
  <h1 class="pk-title" contenteditable="true" spellcheck="false" data-title>${esc(c.title)}</h1>
  <div class="props">${main.map(propRow).join('')}<div class="addp" data-addprop>${ICON.plus}<span>Add a property</span></div></div>
  ${(c.clips||[]).length||(c.photos||[]).length?`<div class="sec"><h4 data-sec><i>▼</i>Footage <span style="color:var(--fg2);letter-spacing:0;text-transform:none;font-weight:500">${[(c.clips||[]).length?`${c.clips.length} clips · ${mmss(c.clips.reduce((a,x)=>a+(x.duration||0),0))}`:'',(c.photos||[]).length?`${c.photos.length} photos`:''].filter(Boolean).join(' · ')}</span></h4><div class="secb footage">${(c.clips||[]).map((x,i)=>`<a class="fclip" href="${libLink(x)}" target="_blank" rel="noopener" title="Open in the Library"><img loading="lazy" src="${LIB}_thumbs/${x.id}.jpg" alt=""><div><div class="fm">${i+1} · ${x.id} · ${esc(x.client)} · ${mmss(x.duration)}</div><div class="ft2">${esc(x.description)}</div>${x.note?`<div class="fn">→ ${esc(x.note)}</div>`:''}</div></a>`).join('')}${(c.photos||[]).length?`<div class="fphotos">${c.photos.map((x,i)=>`<div class="fph${x.orientation==='vertical'?' v':''}" data-fph="${i}" title="${esc([x.client,(x.who||[]).join(', '),x.note].filter(Boolean).join(' · '))}"><img loading="lazy" src="${LIB}_photos/thumb/${x.id}.jpg" alt=""><button data-rmph="${i}" title="Remove from this card">✕</button>${x.note?`<span>${esc(x.note)}</span>`:''}</div>`).join('')}</div>`:''}<a class="addp" href="../Ideate/index.html" target="_blank">${ICON.plus}<span>Find more footage & photos in Ideate</span></a></div></div>`:''}
  ${window.SB?SB.html(c):''}
  <div class="sec"><h4 data-sec><i>▼</i>Automations</h4><div class="secb autos">
   <div class="auto"><div class="k">${ICON.button}<span>Approved</span></div><div><button class="b ok" data-auto="approved">${ICON.bolt}Approved</button><span class="cfg" data-cfga="approved">→ ${esc(V().automations.approved.pipeline)}</span></div></div>
   <div class="auto"><div class="k">${ICON.button}<span>Needs Edits</span></div><div><button class="b bad" data-auto="needsEdits">${ICON.bolt}Needs Edits</button><span class="cfg" data-cfga="needsEdits">→ ${esc(V().automations.needsEdits.pipeline)}</span></div></div>
   <div class="addp" data-addprop>${ICON.plus}<span>Add a property</span></div></div></div>
  <div class="sec closed"><h4 data-sec><i>▼</i>Page Edits</h4><div class="secb props">${edits.map(propRow).join('')}</div></div>
  <div class="sec"><h4 data-sec><i>▼</i>Comments <span style="color:var(--fg2);letter-spacing:0;text-transform:none;font-weight:500">${(c.comments||[]).length||''}</span></h4><div class="secb comments">${(c.comments||[]).map(m=>`<div class="cmt" data-cid="${m.id}">${avatar(m.by)}<div style="flex:1"><div class="who">${esc(m.by)}<span>${esc(m.date)}${m.auto?' · automation':''}</span></div><div class="tx">${esc(m.text).replace(/@([A-Z][\w.]*(?: [A-Z][\w.]*){0,2})/g,'<span class="mention">@$1</span>')}</div></div>${m.by===ME||m.auto?`<button class="del" data-cdel="${m.id}">Delete</button>`:''}</div>`).join('')}
   <div class="cmtin">${avatar(ME)}<textarea rows="1" placeholder="Add a comment…" data-cin></textarea><button data-csend disabled>Send</button></div></div></div>
  <div class="body" contenteditable="true" spellcheck="false" data-body>${esc(c.body)}</div>
 </div>
 <div class="pk-foot"><span>Created ${esc(fmtDT(c.createdAt))}</span><span class="sp"></span><span><kbd>←</kbd> <kbd>→</kbd> switch page · <kbd>Esc</kbd> close</span></div>`;
 /* wire */
 if(window.SB)SB.wire(el,c);
 el.onclick=e=>{const t=e.target;const pk=t.closest('[data-pk]');
  if(pk){const a=pk.dataset.pk;if(a==='close')closePeek();else if(a==='prev')peekNav(-1);else if(a==='next')peekNav(1);else if(a==='expand'){const w=$('#peekwrap');w.classList.toggle('full');w.classList.remove('side','center');if(!w.classList.contains('full'))w.classList.add(V().openAs)}
   else if(a==='menu')peekMenu(pk,c);else toast('Icons, covers and layouts live in Notion — this board mirrors the data.');return}
  if(t.closest('[data-sec]')){t.closest('.sec').classList.toggle('closed');return}
  const ap=t.closest('a.addp');if(ap&&window.parent!==window){e.preventDefault();parent.postMessage({bm:'step',step:'ideate'},'*');return}
  const rp=t.closest('[data-rmph]');if(rp){snap('Remove photo');c.photos.splice(+rp.dataset.rmph,1);touch(c);save();render();renderPeek();toast('Photo removed from the card');return}
  const fp=t.closest('[data-fph]');if(fp){photoView(c,+fp.dataset.fph);return}
  const rv=t.closest('[data-review]');if(rv){try{localStorage.setItem('bm.review.card',c.id)}catch(err){}if(window.parent!==window){e.preventDefault();parent.postMessage({bm:'step',step:'review'},'*')}return}
  const ed=t.closest('[data-edit]');if(ed&&!t.closest('a')){const k=ed.dataset.edit;if(!P[k].ro)editProp(ed,c,k);return}
  const km=t.closest('[data-kmenu]');if(km){propMenu(km,P[km.dataset.kmenu]);return}
  if(t.closest('[data-addprop]')){openPop(t.closest('[data-addprop]'),`<h5>Add a property</h5><div class="note">The Media Master Database schema is fixed to match Notion. New properties would need to be added in Notion first so both stay in sync.</div>`,{w:300});return}
  const au=t.closest('[data-auto]');if(au){runAutomation(c,au.dataset.auto);return}
  const cfg=t.closest('[data-cfga]');if(cfg){cfgAutomation(cfg,cfg.dataset.cfga);return}
  const cd=t.closest('[data-cdel]');if(cd){snap('Delete comment');c.comments=c.comments.filter(m=>m.id!==cd.dataset.cdel);save();renderPeek();render();return}
  if(t.closest('[data-csend]')){sendComment(c);return}};
 const title=$('[data-title]',el);title.onblur=()=>{const v=title.textContent.trim();if(v!==c.title){snap('Rename');c.title=v;touch(c);save();render()}};title.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();title.blur();$('[data-body]',el).focus()}};
 const body=$('[data-body]',el);body.onblur=()=>{const v=body.innerText.replace(/\n$/,'');if(v!==c.body){snap('Edit notes');c.body=v;touch(c);save()}};
 const cin=$('[data-cin]',el),cs=$('[data-csend]',el);cin.oninput=()=>{cs.disabled=!cin.value.trim();cin.style.height='auto';cin.style.height=cin.scrollHeight+'px'};cin.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();sendComment(c)}}}
function sendComment(c){const cin=$('[data-cin]');const t=cin.value.trim();if(!t)return;snap('Comment');c.comments=c.comments||[];c.comments.push({id:uid(),by:ME,date:shortDate(new Date()),text:t});touch(c);save();renderPeek();render();$('[data-cin]').focus()}
function peekMenu(anchor,c){openPop(anchor,`${c.url?`<a class="mi" href="${esc(c.url)}" target="_blank" rel="noopener">${ICON.open}<span>Open in Notion</span></a>`:''}${mi('Copy link','data-copy',ICON.copy)}${mi('Duplicate','data-dup',ICON.copy)}${mi('Move to…','data-move',ICON.board)}${mi(c.archived?'Unarchive':'Archive','data-arch',ICON.checkbox)}<hr>${mi('Delete','data-del',ICON.trash).replace('class="mi"','class="mi danger"')}<hr><div class="note">Last edited by ${esc(c.editedBy)} · ${esc(fmtDT(c.editedAt))}</div>`,{alignRight:true,w:240});
 pop.onclick=e=>{const t=e.target.closest('.mi');if(!t)return;if(t.hasAttribute('data-copy')){navigator.clipboard?.writeText(c.url||location.href);closePop();toast('Link copied')}else if(t.hasAttribute('data-dup')){closePop();dup([c.id])}else if(t.hasAttribute('data-move'))movePicker(anchor,[c.id]);else if(t.hasAttribute('data-arch')){snap('Archive');c.archived=!c.archived;touch(c);closePop();renderPeek();render()}else if(t.hasAttribute('data-del')){del([c.id],anchor)}}}
function propMenu(anchor,p){openPop(anchor,`<h5>${esc(p.n)}</h5><div class="note">Type: ${p.t.replace('_ro',' (read-only)')}</div>${mi('Filter by this property','data-f',ICON.filter)}${mi('Sort ascending','data-sa',ICON.sort)}${mi('Sort descending','data-sd',ICON.sort)}<hr>${mi('Show on cards','data-show',ICON.eye,'<span class="tog"></span>').replace('class="mi"',`class="mi${V().cardProps.includes(p.k)?' on':''}"`)}${GROUPABLE.includes(p.k)?mi('Group board by this','data-g',ICON.grid):''}`,{w:260});
 pop.onclick=e=>{const t=e.target.closest('.mi');if(!t)return;const v=V();if(t.hasAttribute('data-f')){v.filters.push({k:p.k,op:OPS[p.t][0],v:''});closePop();render()}else if(t.hasAttribute('data-sa')){v.sorts=[{k:p.k,dir:'asc'}];closePop();render()}else if(t.hasAttribute('data-sd')){v.sorts=[{k:p.k,dir:'desc'}];closePop();render()}else if(t.hasAttribute('data-show')){const i=v.cardProps.indexOf(p.k);i<0?v.cardProps.push(p.k):v.cardProps.splice(i,1);closePop();render()}else if(t.hasAttribute('data-g')){v.groupBy=p.k;v.order=[];v.layout='board';closePop();closePeek();render()}}}

/* ── property editors (used by peek + table) ── */
function editProp(anchor,c,k){const p=P[k];if(p.t==='clips'){window.open('../Ideate/index.html','_blank');return}const done=(label)=>{touch(c);save();render();if(peekId)renderPeek()};
 if(p.t==='checkbox'){snap('Toggle '+p.n);c[k]=!c[k];done();return}
 if(p.t==='select'||p.t==='status'){const o=opts(k);const html=`<input type="search" placeholder="Search or create…" data-q>${mi('<span style="color:var(--mut)">Empty</span>','data-v=""','',`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${!c[k]?' on':''}"`)}${o.map(x=>mi(chip(k,x.n,true),`data-v="${esc(x.n)}"`,'',`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${c[k]===x.n?' on':''}"`)).join('')}`;
  openPop(anchor,html,{w:260,focus:'[data-q]'});wireOptionSearch(k,q=>{snap('Set '+p.n);c[k]=q;done()});
  pop.onclick=e=>{const t=e.target.closest('[data-v]');if(!t)return;snap('Set '+p.n);c[k]=t.dataset.v;closePop();done()};return}
 if(p.t==='multi'||p.t==='people'){const cur=c[k]||[];const o=p.t==='people'?S.people.map(n=>({n,c:'default'})):opts(k);
  const html=`<input type="search" placeholder="${p.t==='people'?'Search people or add…':'Search or create…'}" data-q>${o.map(x=>mi(p.t==='people'?person(x.n):chip(k,x.n,true),`data-v="${esc(x.n)}"`,'',`<span class="tick">✓</span>`).replace('class="mi"',`class="mi${cur.includes(x.n)?' on':''}"`)).join('')}`;
  openPop(anchor,html,{w:260,focus:'[data-q]'});wireOptionSearch(k,q=>{snap('Add '+p.n);c[k]=[...cur,q];done();editProp(anchor,c,k)});
  pop.onclick=e=>{const t=e.target.closest('[data-v]');if(!t)return;snap('Set '+p.n);const v=c[k]||[];const i=v.indexOf(t.dataset.v);i<0?v.push(t.dataset.v):v.splice(i,1);c[k]=[...v];t.classList.toggle('on');touch(c);save();render();if(peekId)renderPeek()};return}
 if(p.t==='date'){openPop(anchor,`<h5>${esc(p.n)}</h5><input type="date" data-d value="${esc((c[k]||'').slice(0,10))}"><div class="row"><button class="btn2" data-today>Today</button><button class="btn2" data-clear>Clear</button></div>`,{w:250,focus:'[data-d]'});
  pop.querySelector('[data-d]').onchange=e=>{snap('Set '+p.n);c[k]=e.target.value;done()};pop.onclick=e=>{if(e.target.closest('[data-today]')){snap('Set '+p.n);c[k]=new Date().toISOString().slice(0,10);closePop();done()}if(e.target.closest('[data-clear]')){snap('Clear '+p.n);c[k]='';closePop();done()}};return}
 if(p.t==='url'||p.t==='relation'||p.t==='title'){openPop(anchor,`<h5>${esc(p.n)}</h5><input type="${p.t==='url'?'url':'text'}" data-t value="${esc(c[k]||'')}" placeholder="${p.t==='url'?'Paste a link…':'Type…'}">${c[k]&&p.t==='url'?`<a class="mi" href="${esc(c[k])}" target="_blank" rel="noopener">${ICON.open}<span>Open link</span></a>`:''}${c[k]?mi('Clear','data-clear',ICON.trash):''}`,{w:320,focus:'[data-t]'});
  const inp=pop.querySelector('[data-t]');inp.onkeydown=e=>{if(e.key==='Enter'){snap('Set '+p.n);c[k]=inp.value.trim();closePop();done()}};inp.onblur=()=>{if(pop.classList.contains('on')&&inp.value.trim()!==(c[k]||'')){snap('Set '+p.n);c[k]=inp.value.trim();done()}};
  pop.onclick=e=>{if(e.target.closest('[data-clear]')){snap('Clear '+p.n);c[k]='';closePop();done()}};return}}
function wireOptionSearch(k,onCreate){const q=pop.querySelector('[data-q]');q.oninput=()=>{const s=q.value.toLowerCase();$$('.mi[data-v]',pop).forEach(m=>m.style.display=m.textContent.toLowerCase().includes(s)?'':'none');let cr=pop.querySelector('[data-create]');if(s&&!$$('.mi[data-v]',pop).some(m=>m.textContent.trim().toLowerCase()===s)){if(!cr){cr=document.createElement('div');cr.className='mi';cr.setAttribute('data-create','');pop.appendChild(cr)}cr.innerHTML=`${ICON.plus}<span>Create <b>${esc(q.value)}</b></span>`}else cr&&cr.remove()};
 q.onkeydown=e=>{if(e.key==='Enter'){const vis=$$('.mi[data-v]',pop).filter(m=>m.style.display!=='none');if(vis.length===1){vis[0].click();return}const cr=pop.querySelector('[data-create]');if(cr)cr.click()}};
 pop.addEventListener('click',e=>{if(e.target.closest('[data-create]')){const n=q.value.trim();if(!n)return;if(P[k].t==='people'){if(!S.people.includes(n))S.people.push(n)}else if(!opts(k).some(o=>o.n===n))S.opts[k]=[...opts(k),{n,c:'default'}];closePop();onCreate(n)}})}

/* ── export / import / reset ── */
$('#bExport').onclick=e=>{openPop(e.currentTarget,`<h5>Export</h5>${mi('JSON (full backup)','data-json',ICON.download)}${mi('CSV (Notion-style)','data-csv',ICON.download)}${mi('Markdown list','data-md',ICON.download)}`,{alignRight:true});
 pop.onclick=ev=>{const t=ev.target.closest('.mi');if(!t)return;closePop();if(t.hasAttribute('data-json'))dl('video-pipeline.json',JSON.stringify(S,null,2),'application/json');
  else if(t.hasAttribute('data-csv')){const cols=PROPS;const row=c=>cols.map(p=>'"'+textOf(c,p.k).replace(/"/g,'""')+'"').join(',');dl('video-pipeline.csv',cols.map(p=>p.n).join(',')+'\n'+visibleCards().map(row).join('\n'),'text/csv')}
  else{const v=V();const md=groupsFor(v.groupBy).map(g=>{const cs=visibleCards().filter(c=>inGroup(c,v.groupBy,g));return cs.length?`## ${g.n} (${cs.length})\n`+cs.map(c=>`- **${c.title}**${c.type?.length?' · '+c.type.join(', '):''}${c.frameio?' · '+c.frameio:''}`).join('\n'):''}).filter(Boolean).join('\n\n');dl('video-pipeline.md','# Video Pipeline\n\n'+md,'text/markdown')}}};
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Downloaded '+name)}
$('#bImport').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.cards))throw 0;snap('Import');S.cards=d.cards;if(d.opts)S.opts=d.opts;if(d.people)S.people=d.people;if(d.view)S.view=Object.assign(clone(DEFAULT_VIEW),d.view);save();render();toast('Imported '+S.cards.length+' items',true)}catch(err){toast('That file is not a Video Pipeline export')}};r.readAsText(f);e.target.value=''};
$('#bReset').onclick=e=>askConfirm(e.currentTarget,'Reset everything to the Notion snapshot captured 2026-10-20? Local changes will be lost.','Reset',()=>{snap('Reset');S=fresh();save();render();toast('Board reset to Notion snapshot',true)});

/* live hand-off from Ideate while this page is open */
addEventListener('storage',e=>{if(e.key==='bm.pipeline.ping'){try{const P=JSON.parse(localStorage.getItem('bm.pipeline.v2'));if(P&&Array.isArray(P.cards)){mergeGone(P);P.cards.forEach(c=>{if(S.gone&&S.gone[c.id]&&S.gone[c.id]>=(c.editedAt||''))return;const i=S.cards.findIndex(x=>x.id===c.id);if(i<0)S.cards.push(c);else if((c.editedAt||'')>(S.cards[i].editedAt||''))S.cards[i]=c})}}catch(err){}takeInbox();render();openPending()}});
let _openedFromUrl=false;
function openPending(){let id=localStorage.getItem('bm.pipeline.open');if(!id&&!_openedFromUrl){id=new URLSearchParams(location.search).get('open');_openedFromUrl=true}if(!id)return;if(peekId===id){localStorage.removeItem('bm.pipeline.open');return}localStorage.removeItem('bm.pipeline.open');if(S.cards.some(c=>c.id===id)){const v=V();if(v.hidden.includes('Ideas'))v.hidden=v.hidden.filter(x=>x!=='Ideas');render();openPeek(id);toast('New idea from Ideate')}}
addEventListener('focus',()=>{if(takeInbox())render();openPending()});
/* ── timecode, year ── */
/* running REC timer removed (2026-10-21) */
$('#yr').textContent=new Date().getFullYear();
/* embed mode: inside the Bahlman Library (#pipeline route) — no site nav/footer, tighter top */
if(new URLSearchParams(location.search).has('embed'))document.body.classList.add('embed');
render();openPending();

/* ── photos on a card: a simple viewer (← → Esc) ── */
let PV=null,pvc=null,pvi=0;
function photoView(c,i){pvc=c;pvi=i;if(!PV){PV=document.createElement('div');PV.className='pvbox';PV.innerHTML='<button class="x" data-pv="x" title="Close (Esc)">✕</button><button class="nv p" data-pv="p">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="nv n" data-pv="n">›</button>';document.body.appendChild(PV);
  PV.onclick=e=>{const b=e.target.closest('[data-pv]');if(b){const a=b.dataset.pv;a==='x'?PV.classList.remove('on'):pvStep(a==='n'?1:-1)}else if(e.target===PV)PV.classList.remove('on')}}
 pvDraw();PV.classList.add('on')}
function pvDraw(){const L=pvc.photos||[];const x=L[pvi];if(!x)return PV.classList.remove('on');const im=PV.querySelector('img');im.src=`${LIB}_photos/thumb/${x.id}.jpg`;const hi=new Image();hi.onload=()=>{if((pvc.photos||[])[pvi]===x)im.src=hi.src};hi.src=`${LIB}_photos/web/${x.id}.jpg`;
 PV.querySelector('figcaption').innerHTML=`<div>${(x.who||[]).length?`<b>${esc(x.who.join(', '))}</b> · `:''}${esc(x.client||'')} · ${esc(String(x.shoot||'').replace(/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}\s*/,'').replace(/\s*\|\s*Bahlman$/,''))}${x.note?` · → ${esc(x.note)}`:''} <em>${pvi+1} / ${L.length}</em></div><div class="pp">${esc(x.path||x.file||x.id)} <button data-pvcopy>Copy path</button> <a href="${LIB}_photos/web/${x.id}.jpg" target="_blank" rel="noopener">Open full size ↗</a></div>`;
 PV.querySelector('[data-pvcopy]').onclick=()=>{navigator.clipboard?.writeText(x.path||x.file||'');toast('Path copied')};
 PV.querySelector('.p').disabled=pvi<=0;PV.querySelector('.n').disabled=pvi>=L.length-1}
function pvStep(d){const L=pvc.photos||[];const j=pvi+d;if(j<0||j>=L.length)return;pvi=j;pvDraw()}
document.addEventListener('keydown',e=>{if(!PV||!PV.classList.contains('on'))return;if(e.key==='Escape'){e.stopImmediatePropagation();PV.classList.remove('on')}else if(e.key==='ArrowRight')pvStep(1);else if(e.key==='ArrowLeft')pvStep(-1)},true);
