#!/usr/bin/env python3
"""Turn _work/health.jsonl into health.html (File Health page of the library)."""
import json, os, re
from collections import defaultdict

LIB = os.path.expanduser("~/Desktop/Bahlman Media App/Library")
SRC = os.path.join(LIB, "_work", "health.jsonl")
DRIVE = "/Volumes/My Book/31892AZ/"

rows = []
for l in open(SRC):
    try: rows.append(json.loads(l))
    except Exception: pass

def area(p):
    return "Recovered (~Damaged~) folder" if "/(~Damaged~)/" in p else "Bahlman Media"

def shoot(p):
    rel = p.replace(DRIVE, "")
    for part in rel.split("/"):
        if re.match(r"\d{2}\.\d{2}\.\d{2}", part): return part
    parts = rel.split("/")
    return "/".join(parts[1:4]) if len(parts) > 3 else rel

summary = defaultdict(lambda: defaultdict(int))
bad = []
for r in rows:
    summary[area(r["path"])][r["status"]] += 1
    summary[area(r["path"])]["total"] += 1
    if r["status"] != "ok":
        bad.append(dict(p=r["path"], rel=r["path"].replace(DRIVE, ""), f=os.path.basename(r["path"]), k=r["kind"],
                        s=r["status"], i=r.get("issues", []), sz=r.get("size"), a=area(r["path"]), sh=shoot(r["path"]),
                        v=r.get("video"), d=r.get("duration")))
data = dict(summary={a: dict(v) for a, v in summary.items()}, bad=bad, scanned=len(rows))

page = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>File Health · Bahlman Library</title><link rel="icon" type="image/png" href="_brand/favicon.png">
<style>
@font-face{font-family:"BM Display";src:local("Rafaella-Bold"),local("Rafaella Bold");font-weight:700}
@font-face{font-family:"BM Shadow";src:local("Rafaella-BoldShadow"),local("Rafaella Bold Shadow")}
:root{--bg:#08080a;--panel:#141418;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--fg:#f4f4f6;--fg2:#b6b6c0;--mut:#76767f;--acc:#d79f46;
--red:#ff6b5e;--amber:#f2b33d;--violet:#a98bff;--green:#5fd39a;--sans:-apple-system,"SF Pro Text",Inter,system-ui,sans-serif;--display:"BM Display",Georgia,serif;--shadow:"BM Shadow","BM Display",Georgia,serif}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--fg);font:14px/1.45 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:16px;padding:14px 28px;background:rgba(8,8,10,.75);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
.bar img{height:24px}.bar .crumb{color:var(--mut)}.bar .crumb b{color:var(--fg)}
.bar input{margin-left:auto;width:min(420px,50vw);height:38px;border-radius:12px;border:1px solid var(--line2);background:rgba(255,255,255,.04);color:var(--fg);padding:0 14px;font:inherit;outline:none}
main{max-width:1500px;margin:0 auto;padding:0 28px 80px}
.hero{padding:50px 0 26px}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--acc);font-weight:650}
h1{font-family:var(--shadow);font-weight:400;color:var(--acc);font-size:clamp(44px,6vw,84px);line-height:1;margin:12px 0 10px}
.sub{color:var(--fg2);max-width:70ch}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin:30px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px 22px;position:relative;overflow:hidden;cursor:pointer;transition:.2s}
.card:hover{border-color:var(--line2)}.card.on{border-color:var(--acc)}
.card b{display:block;font-size:34px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.card span{color:var(--fg2);font-size:13px}.card i{position:absolute;right:16px;top:18px;width:10px;height:10px;border-radius:50%}
.areas{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:30px}
.area{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px 22px}
.area h3{font-size:15px;margin-bottom:12px}.meter{display:flex;height:12px;border-radius:999px;overflow:hidden;background:#222}
.meter div{height:100%}.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12.5px;color:var(--fg2)}
.legend em{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;font-style:normal}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.chip{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);color:var(--fg2);font-size:13px}.chip.on{background:var(--fg);color:#0a0a0c;border-color:var(--fg)}
.group{margin-top:26px}.group h2{font-family:var(--display);font-weight:700;font-size:24px;display:flex;align-items:baseline;gap:12px}
.group h2 small{font-family:var(--sans);font-size:13px;color:var(--mut);font-weight:500}
.list{margin-top:10px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.row{display:grid;grid-template-columns:110px minmax(0,1.3fr) minmax(0,1.6fr) 90px 150px;gap:14px;align-items:center;padding:11px 16px;border-top:1px solid var(--line);background:rgba(255,255,255,.015)}
.row:first-child{border-top:0}.row:hover{background:rgba(255,255,255,.04)}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:999px}
.b-corrupt{background:rgba(255,107,94,.14);color:var(--red)}.b-damaged{background:rgba(242,179,61,.14);color:var(--amber)}.b-unreadable{background:rgba(169,139,255,.16);color:var(--violet)}
.fn{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fp{font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.why{color:var(--fg2);font-size:13px}.kind{color:var(--mut);font-size:12.5px;text-transform:capitalize}
.acts{display:flex;gap:6px;justify-content:flex-end}.acts a,.acts button{font-size:12px;padding:6px 10px;border-radius:9px;border:1px solid var(--line2);color:var(--fg2)}.acts a:hover,.acts button:hover{color:var(--fg);border-color:rgba(255,255,255,.3)}
.more{padding:12px 16px;color:var(--acc);font-size:13px;cursor:pointer;border-top:1px solid var(--line)}
.empty{padding:70px;text-align:center;color:var(--mut)}
.note{margin-top:40px;color:var(--mut);font-size:12.5px;line-height:1.6;max-width:90ch}
@media(max-width:900px){.areas{grid-template-columns:1fr}.row{grid-template-columns:1fr;gap:4px}.acts{justify-content:flex-start}}
</style></head><body>
<header class="bar"><a href="index.html"><img src="_brand/bm.png" alt="BM"></a><span class="crumb"><a href="index.html">Library</a> / <b>File Health</b></span><input id="q" placeholder="Search file or event…"></header>
<main>
<section class="hero"><div class="eyebrow">My Book drive</div><h1>File Health</h1>
<p class="sub">Every photo, RAW and video on the drive was opened and checked — headers, blank or cut-off endings, and for videos a test decode at the middle and end. Nothing on the drive was changed.</p></section>
<div class="cards" id="cards"></div>
<div class="areas" id="areas"></div>
<div class="filters" id="kinds"></div>
<div id="out"></div>
<p class="note"><b>Corrupt</b> — the file is empty or its data is missing; it can't be opened. <b>Damaged</b> — it opens but part of it is broken (a cut-off photo, or video that breaks up). <b>Unreadable</b> — the drive itself reported an error reading it, which can point to a failing area of the disk. A copy on another drive or card may still be good.</p>
</main>
<script>
const H=/*HEALTH*/{};
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('en-US'),gb=b=>b==null?'':b>=1e9?(b/1e9).toFixed(1)+' GB':(b/1e6).toFixed(b>=1e7?0:1)+' MB';
const bm=(a,p)=>'bmlib://'+a+'/'+btoa(unescape(encodeURIComponent(p))).replace(/\+/g,'-').replace(/\//g,'_');
const COL={corrupt:'var(--red)',damaged:'var(--amber)',unreadable:'var(--violet)',ok:'var(--green)'};
let st='',kd='',limit={};
function cards(){const t={ok:0,corrupt:0,damaged:0,unreadable:0};Object.values(H.summary).forEach(a=>Object.keys(t).forEach(k=>t[k]+=a[k]||0));
 const items=[['','Problem files',H.bad.length,'var(--acc)'],['corrupt','Corrupt',t.corrupt,COL.corrupt],['damaged','Damaged',t.damaged,COL.damaged],['unreadable','Unreadable',t.unreadable,COL.unreadable],['ok','Healthy',t.ok,COL.ok]];
 $('#cards').innerHTML=items.map(([k,l,n,c])=>`<div class="card ${st===k&&k!=='ok'?'on':''}" data-s="${k}"><i style="background:${c}"></i><b>${num(n)}</b><span>${l}</span></div>`).join('');
 $('#areas').innerHTML=Object.entries(H.summary).map(([a,s])=>{const T=s.total||1;return `<div class="area"><h3>${esc(a)} · ${num(s.total)} files checked</h3><div class="meter">${['ok','damaged','corrupt','unreadable'].map(k=>`<div style="width:${100*(s[k]||0)/T}%;background:${COL[k]}"></div>`).join('')}</div>
 <div class="legend">${['ok','damaged','corrupt','unreadable'].map(k=>`<span><em style="background:${COL[k]}"></em>${k==='ok'?'Healthy':k[0].toUpperCase()+k.slice(1)} ${num(s[k]||0)}</span>`).join('')}</div></div>`}).join('');
 const ks=[...new Set(H.bad.map(b=>b.k))];$('#kinds').innerHTML=[['','All types'],...ks.map(k=>[k,k==='raw'?'RAW photos':k==='folder'?'Folders':k[0].toUpperCase()+k.slice(1)+'s'])].map(([k,l])=>`<button class="chip ${kd===k?'on':''}" data-k="${k}">${l} ${k?num(H.bad.filter(b=>b.k===k).length):''}</button>`).join('')}
function render(){cards();const w=$('#q').value.toLowerCase().split(/\s+/).filter(Boolean);
 const L=H.bad.filter(b=>(!st||b.s===st)&&(!kd||b.k===kd)&&w.every(x=>(b.rel+' '+b.sh).toLowerCase().includes(x)));
 if(st==='ok'||!L.length){$('#out').innerHTML=`<div class="empty">${st==='ok'?'Healthy files aren’t listed — only problems are.':'No problem files match.'}</div>`;return}
 const g={};L.forEach(b=>{const k=b.a+'||'+b.sh;(g[k]=g[k]||[]).push(b)});
 $('#out').innerHTML=Object.entries(g).sort((a,b)=>b[1].length-a[1].length).map(([k,bs])=>{const[a,sh]=k.split('||');const n=limit[k]||25;
  return `<section class="group"><h2>${esc(sh)} <small>${esc(a)} · ${num(bs.length)} file${bs.length>1?'s':''}</small></h2><div class="list">${bs.slice(0,n).map(b=>`<div class="row">
  <span><span class="badge b-${b.s}">${b.s}</span></span><div><div class="fn">${esc(b.f)}</div><div class="fp" title="${esc(b.p)}">${esc(b.rel)}</div></div>
  <div class="why">${esc((b.i||[]).join(' · '))}</div><div class="kind">${b.k==='raw'?'RAW':b.k}${b.sz!=null?'<br>'+gb(b.sz):''}</div>
  <div class="acts">${b.k!=='folder'?`<a href="${bm('reveal',b.p)}">Reveal</a>`:''}<button data-copy="${esc(b.p)}">Copy path</button></div></div>`).join('')}
  ${bs.length>n?`<div class="more" data-g="${esc(k)}">Show ${num(Math.min(100,bs.length-n))} more of ${num(bs.length-n)}</div>`:''}</div></section>`}).join('')}
document.body.addEventListener('click',e=>{const c=e.target.closest('.card');if(c){st=st===c.dataset.s?'':c.dataset.s;render();return}
 const k=e.target.closest('.chip');if(k){kd=k.dataset.k;render();return}
 const m=e.target.closest('.more');if(m){limit[m.dataset.g]=(limit[m.dataset.g]||25)+100;render();return}
 const cp=e.target.closest('[data-copy]');if(cp){navigator.clipboard.writeText(cp.dataset.copy);cp.textContent='Copied';setTimeout(()=>cp.textContent='Copy path',1200)}});
let t;$('#q').oninput=()=>{clearTimeout(t);t=setTimeout(render,150)};render();
</script></body></html>"""
open(os.path.join(LIB, "health.html"), "w").write(page.replace("/*HEALTH*/{}", json.dumps(data).replace("</", "<\\/")))
print(f"{len(rows)} scanned, {len(bad)} problem files")
