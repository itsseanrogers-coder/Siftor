/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Style Atlas (step 03 · Style)
   Every look the AI tools can make — Motion/atlas/atlas.json (built by build.py) + your own references
   (Motion/atlas/custom/*.json, saved through the Library server). Pick one for a client's style guide or a reel;
   each has a prompt the AI follows, built with Remotion, HyperFrames or huashu-motion.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const API = 'http://127.0.0.1:8766';
if (new URLSearchParams(location.search).has('embed') || window.parent !== window) { document.body.classList.add('embed'); document.querySelectorAll('.mtabs a, a[href="atlas.html"], a[href="index.html"]').forEach(a => a.href = a.getAttribute('href').replace(/(\.html)/, '$1?embed=1')) }
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._k); t._k = setTimeout(() => t.classList.remove('on'), 2200) };
const LSC = 'bm.atlas.custom', LSS = 'bm.motion.styles';
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d } catch (e) { return d } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch (e) { return false } };

/* ── data ── */
let ALL = [];
function load() {
  const custom = [...(window.BM_ATLAS_CUSTOM || [])]; const pend = lsGet(LSC, {});
  for (const id in pend) { const i = custom.findIndex(x => x.id === id); i >= 0 ? custom[i] = pend[id] : custom.push(pend[id]) }
  ALL = [...(window.BM_ATLAS || []), ...custom.map(x => ({ category: 'Your references', ...x }))].filter(x => !x.deleted);
}
load();
const CAT_ORDER = ['Popular Explainer Looks', 'huashu-motion languages', 'Your references', 'Hand-Drawn', 'Painterly', 'Print', 'Paper & Craft', 'Illustration', 'Art & Design Movements', 'Retro Digital', 'Retro UI & Neon', 'Dimensional', 'Light & Imaging', 'Data & Information', 'Generative & Type', 'Cosmic & Psychedelic'];
let cat = new URLSearchParams(location.hash.slice(1)).get('c') || 'All', q = '';
const styles = () => { const l = lsGet(LSS, {}); const f = window.BM_MOTION_STYLES || []; const ids = new Set([...f.map(s => s.id), ...Object.keys(l)]); return [...ids].map(id => { const a = l[id], b = f.find(s => s.id === id); return a && (!b || (a.editedAt || '') > (b.saved || b.updated || '')) ? a : b }).filter(Boolean) };
const usedBy = id => styles().filter(s => (s.atlas || []).includes(id)).map(s => s.client);

/* ── a cover for styles without an example clip yet: built from the style's own palette and type ── */
/* their example (Futurepedia, streamed from their site) when there is one; our auto preview when offline or for the rest */
function refCover(x, big, kind) {
  const r = x.ref; const src = kind === 'clip' ? r.clip : r.explainer;
  const fb = x.example ? ` data-fb="${esc(x.example)}" data-fbp="${esc(x.poster || '')}"` : '';
  return `<div class="cvw"><video class="cv" src="${esc(src)}" poster="${esc(r.poster)}" muted loop playsinline ${big ? 'autoplay controls' : 'preload="none"'}${fb} onerror="refFail(this)"></video><span class="auto ref" title="Example from Futurepedia's AI Style Atlas — streamed from their site">Futurepedia example</span></div>`;
}
function refFail(v) { if (!v.dataset.fb || v.dataset.failed) return; v.dataset.failed = 1; v.poster = v.dataset.fbp; v.src = v.dataset.fb; const t = v.parentElement.querySelector('.auto'); if (t) { t.textContent = 'auto preview'; t.classList.remove('ref') } }
document.addEventListener('error', e => { if (e.target.tagName === 'VIDEO' && e.target.dataset.fb) refFail(e.target) }, true);
let refKind = 'explainer';
function cover(x, big) {
  if (x.ref && (!big || refKind !== 'auto')) return refCover(x, big, big ? refKind : 'explainer');
  if (x.example) return /\.(mp4|webm|mov)$/i.test(x.example) ? `<div class="cvw"><video class="cv" src="${esc(x.example)}"${x.poster ? ` poster="${esc(x.poster)}"` : ''} muted loop playsinline ${big ? 'autoplay' : 'preload="none"'}></video>${x.auto_example ? '<span class="auto" title="Made automatically from this style\'s palette, type and motion — not a finished design">auto preview</span>' : ''}</div>` : `<img class="cv" src="${esc(x.example)}" alt="" loading="lazy">`;
  const p = x.palette && x.palette.length ? x.palette : ['#101014', '#d79f46', '#f5f4f1', '#2a2a30'];
  const dark = [...p].sort((a, b) => lum(a) - lum(b))[0], light = [...p].sort((a, b) => lum(b) - lum(a))[0];
  const acc = p.find(c => c !== dark && c !== light) || p[1];
  const word = x.category === 'huashu-motion languages' ? (x.says || x.name) : x.name;
  return `<div class="cv sw" style="--bg:${dark};--fg:${light};--ac:${acc};--fd:'${esc(x.display || 'Inter')}';--fb:'${esc(x.body || 'Inter')}'">
    <div class="swp">${p.map(c => `<i style="background:${c}"></i>`).join('')}</div>
    <div class="swt">${esc(word)}</div><div class="swu"></div><div class="swk">${esc(x.texture || x.best_for || '')}</div></div>`;
}
function lum(h) { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) }

/* ── render ── */
function render() {
  const cats = {}; ALL.forEach(x => cats[x.category] = (cats[x.category] || 0) + 1);
  const order = [...CAT_ORDER.filter(c => cats[c]), ...Object.keys(cats).filter(c => !CAT_ORDER.includes(c))];
  $('#kn').innerHTML = `<div class="kn"><b>${ALL.length}</b><span>styles</span></div><div class="kn"><b>${order.length}</b><span>categories</span></div><div class="kn"><b>${ALL.filter(x => x.ref).length}</b><span>Futurepedia examples</span></div><div class="kn"><b>${styles().length}</b><span>client styles</span></div>`;
  $('#cats').innerHTML = [`<button class="${cat === 'All' ? 'on' : ''}" data-c="All">All <em>${ALL.length}</em></button>`, ...order.map(c => `<button class="${cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)} <em>${cats[c]}</em></button>`)].join('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = ALL.filter(x => (cat === 'All' || x.category === cat) && words.every(w => [x.name, x.category, x.about, x.best_for, x.motion, x.texture, x.says, x.engine].join(' ').toLowerCase().includes(w)));
  $('#grid').innerHTML = list.map(x => { const u = usedBy(x.id); return `<button class="at-card" data-id="${esc(x.id)}">
    ${cover(x)}<div class="at-in"><div class="at-n">#${String(x.n).padStart(2, '0')} · ${esc(x.category)}</div><div class="at-name">${esc(x.name)}</div><div class="at-ab">${esc(x.about)}</div>
    <div class="at-tags"><span class="eng ${esc(x.engine)}">${esc(x.engine)}</span>${u.length ? `<span class="used">✓ ${esc(u.join(', '))}</span>` : ''}</div></div></button>` }).join('') || `<div class="empty">No styles match “${esc(q)}”.</div>`;
  location.hash = cat !== 'All' ? 'c=' + encodeURIComponent(cat) : '';
}
document.addEventListener('mouseover', e => { const v = e.target.closest?.('.at-card video'); if (v) v.play().catch(() => { }) });
document.addEventListener('mouseout', e => { const v = e.target.closest?.('.at-card video'); if (v && !v.contains(e.relatedTarget)) v.pause() });

/* ── the reel the look is for: a Pipeline card. Ideate's "Send to Pipeline" sets bm.style.for and comes here first. ── */
const PKEY = 'bm.pipeline.v2';
function pcards() { const P = lsGet(PKEY, null); const inbox = lsGet('bm.pipeline.inbox', []); return [...((P && P.cards) || []), ...inbox].filter(c => c && !c.archived) }
let forId = new URLSearchParams(location.search).get('for') || (() => { try { return localStorage.getItem('bm.style.for') || '' } catch (e) { return '' } })();
const forCard = () => pcards().find(c => c.id === forId) || null;
// step 03 is ① the edit checklist, then ② the look: a reel without a checklist yet starts at ①
(() => { const c = forCard(); if (c && !c.edit && !new URLSearchParams(location.search).has('nochecklist')) location.replace('checklist.html?for=' + encodeURIComponent(c.id) + (new URLSearchParams(location.search).has('embed') || window.parent !== window ? '&embed=1' : '')) })();
function cardFormat(c) { return (c.storyboard && c.storyboard.format) || (/9:16|vertical|reel|short|tiktok/i.test((c.title || '') + ' ' + (c.type || []).join(' ') + ' ' + (c.body || '').slice(0, 300)) ? '9:16' : '16:9') }
function banner() {
  let el = $('#forbar'); if (!el) { el = document.createElement('div'); el.id = 'forbar'; $('.at-bar').before(el) }
  const c = forCard();
  if (!c) { const recent = pcards().slice(-8).reverse(); el.className = 'forbar off'; el.innerHTML = recent.length ? `<span>Picking a look for a reel?</span><select data-forpick><option value="">Choose a Pipeline card…</option>${recent.map(x => `<option value="${esc(x.id)}">${esc(x.title || 'Untitled')}</option>`).join('')}</select>` : ''; return }
  el.className = 'forbar';
  el.innerHTML = `<div class="fb-t"><em>Step 03 · ② choosing the look for</em><b>${esc(c.title || 'Untitled')}</b>${c.look ? `<span class="fb-now">Now: ${esc(c.look.name)}</span>` : ''}</div><span class="fb-h">Open a style and press <b>Use this look</b> — everything about it goes onto the card.</span><a class="btn2 ghost" href="checklist.html?for=${encodeURIComponent(c.id)}${document.body.classList.contains('embed') ? '&embed=1' : ''}">← ① Checklist (${window.BM_EDIT ? BM_EDIT.count(c.edit) : ''} on)</a><button class="btn2 ghost" data-forskip>Skip — go to the Pipeline →</button><button class="fb-x" data-forclear title="Not picking for this reel">✕</button>`;
}
function goPipeline(id) {
  try { localStorage.setItem('bm.pipeline.open', id); localStorage.setItem('bm.pipeline.ping', String(Date.now())) } catch (e) { }
  if (window.parent !== window) { parent.postMessage({ bm: 'step', step: 'pipeline', reload: true, open: id }, '*'); return }
  location.href = '../Pipeline/index.html?open=' + encodeURIComponent(id);
}
function lookOf(x, c) {
  const p = Object.assign({}, fill, { what: fill.what || (c && c.title) || 'the reel', text: fill.text || (c && c.title) || '' });
  const filled = String(x.prompt || '').replace(/\{what\}/g, p.what).replace(/\{text\}/g, p.text).replace(/\{format\}/g, p.format).replace(/\{seconds\}/g, p.seconds);
  const keep = ['id', 'name', 'category', 'about', 'palette', 'display', 'body', 'texture', 'motion', 'best_for', 'engine', 'template', 'says', 'use_when', 'avoid_when', 'signature', 'knowledge', 'example', 'poster', 'source', 'source_url'];
  const L = {}; keep.forEach(k => { if (x[k] != null && x[k] !== '' && !(Array.isArray(x[k]) && !x[k].length)) L[k] = x[k] });
  if (x.ref) L.ref = x.ref;
  L.prompt = filled; L.prompt_template = x.prompt || ''; L.format = p.format; L.seconds = +p.seconds || 4; L.picked = new Date().toISOString();
  return L;
}
function applyLook(cardId, x) {
  const P = lsGet(PKEY, null); const inbox = lsGet('bm.pipeline.inbox', []);
  const c = (P && P.cards || []).find(k => k.id === cardId) || inbox.find(k => k.id === cardId); if (!c) return toast('That card is gone from the Pipeline');
  c.look = lookOf(x, c); c.editedAt = new Date().toISOString(); c.editedBy = c.editedBy || 'Sean Rogers';
  if (c.storyboard) { c.storyboard.look = x.id; if (!c.storyboard.format) c.storyboard.format = c.look.format }
  if (P) lsSet(PKEY, P); lsSet('bm.pipeline.inbox', inbox);
  try { localStorage.removeItem('bm.style.for') } catch (e) { }
  toast(`“${x.name}” is now the look for ${c.title || 'the reel'}`); close(); forId = '';
  setTimeout(() => goPipeline(c.id), 450);
}

/* ── detail: everything about a style + its prompt, filled in ── */
const fill = { what: '', text: '', format: '16:9', seconds: 4 };
function promptOf(x) { return String(x.prompt || '').replace(/\{what\}/g, fill.what || 'an event recap reel').replace(/\{text\}/g, fill.text || '(the reel\'s titles, names and lines)').replace(/\{format\}/g, fill.format).replace(/\{seconds\}/g, fill.seconds) }
function open(id) {
  const x = ALL.find(a => a.id === id); if (!x) return; const st = styles(); const u = usedBy(x.id); const fc = forCard();
  if (fc && !fill._for) { fill.what = fc.title || ''; fill.text = (fc.title || '').split('—')[0].trim(); fill.format = cardFormat(fc); fill._for = fc.id }
  const m = $('#modal');
  m.innerHTML = `<div class="at-box"><button class="x" data-x>✕</button>
    <div class="at-l">${x.ref ? `<div class="rtab">${[['explainer', 'Their explainer'], ['clip', 'Their style clip'], ['auto', 'Our auto preview']].map(([k, n]) => `<button data-rk="${k}" class="${refKind === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}<div id="cvbig">${cover(x, true)}</div>
      ${x.palette && x.palette.length ? `<div class="at-pal">${x.palette.map(c => `<span><i style="background:${esc(c)}"></i>${esc(c)}</span>`).join('')}</div>` : ''}
      ${x.display ? `<div class="at-type"><b style="font-family:'${esc(x.display)}'">${esc(x.name)}</b><span style="font-family:'${esc(x.body)}'">${esc(x.display)} · ${esc(x.body)}</span></div>` : ''}
      <dl>${[['Texture', x.texture], ['Motion', x.motion], ['Best for', x.best_for], ['Use when', x.use_when], ['Avoid when', x.avoid_when]].filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${x.signature && x.signature.length ? `<h5>Signature moves</h5><ol>${x.signature.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <p class="src">${x.knowledge ? `Full recipe: <a href="${esc(x.knowledge)}" target="_blank">${esc(x.knowledge.split('/').pop())}</a> · ` : ''}${x.source_url ? `<a href="${esc(x.source_url)}" target="_blank" rel="noopener">${esc(x.source || 'source')}</a>` : esc(x.source || '')}</p>
    </div>
    <div class="at-r"><div class="at-n">#${String(x.n).padStart(2, '0')} · ${esc(x.category)} · <span class="eng ${esc(x.engine)}">${esc(x.engine)}</span></div><h2>${esc(x.name)}</h2><p class="ab">${esc(x.about)}</p>
      <h5>Prompt <em>— fill in the reel, then copy it into Claude</em></h5>
      <div class="pf"><input data-fill="what" placeholder="What it's for — e.g. the Owners Club Huntington Beach recap opener" value="${esc(fill.what)}"><input data-fill="text" placeholder="Text on screen — e.g. OWNERS CLUB · HUNTINGTON BEACH · SEPT 28" value="${esc(fill.text)}">
        <span class="seg">${['16:9', '9:16'].map(f => `<button data-fmt="${f}" class="${fill.format === f ? 'on' : ''}">${f}</button>`).join('')}</span><label>Seconds <input data-fill="seconds" type="number" min="1" max="60" value="${fill.seconds}"></label></div>
      <pre class="pr" id="pr">${esc(promptOf(x))}</pre>
      <div class="at-use">${fc ? `<button class="btn lux" data-use="${esc(fc.id)}">Use this look for “${esc(fc.title || 'this reel')}” →</button>` : `<select data-usefor><option value="">Use this look for a Pipeline card…</option>${pcards().slice(-12).reverse().map(c => `<option value="${esc(c.id)}">${c.look && c.look.id === x.id ? '✓ ' : ''}${esc(c.title || 'Untitled')}</option>`).join('')}</select>`}<span class="hint">The style, its palette, type, motion, prompt and example go onto the card.</span></div>
      <div class="at-act"><button class="btn2" data-copy>Copy prompt</button>
        <select data-tostyle><option value="">Add to a client style…</option>${st.map(s => `<option value="${esc(s.id)}">${(s.atlas || []).includes(x.id) ? '✓ ' : ''}${esc(s.client)}</option>`).join('')}</select>
        ${x.category === 'Your references' ? `<button class="btn2 ghost danger" data-delref>Delete reference</button>` : ''}</div>
      ${u.length ? `<p class="usedby">Used in: ${esc(u.join(', '))}</p>` : ''}
    </div></div>`;
  m.classList.add('on'); m.dataset.id = id;
}
function close() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = '' }

/* ── add an atlas style to a client's style guide (same storage as the Styles page) ── */
async function addToStyle(sid, x) {
  const s = styles().find(y => y.id === sid); if (!s) return; s.atlas = [...new Set([...(s.atlas || []), x.id])]; s.editedAt = new Date().toISOString();
  const l = lsGet(LSS, {}); l[sid] = s; lsSet(LSS, l);
  try { const r = await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'style', data: s }) }); if (!r.ok) throw 0; delete l[sid]; lsSet(LSS, l); toast(`Added to the ${s.client} style ✓`) }
  catch (e) { toast(`Added to the ${s.client} style — saved in this browser until the Library app is open`) }
  render(); open(x.id);
}

/* ── your own references ── */
function addForm() {
  const cats = [...new Set(['Your references', ...ALL.map(x => x.category)])];
  const m = $('#modal'); m.innerHTML = `<div class="at-box add"><button class="x" data-x>✕</button><div class="at-r wide"><h2>Add a reference</h2><p class="ab">A look you want to be able to ask for: drop in an example clip or screenshot, describe it and write the prompt. It joins the atlas for everyone using this app on this Mac.</p>
    <label class="fl"><span>Name</span><input id="rn" placeholder="e.g. Grant Cardone stage-recap titles"></label>
    <label class="fl"><span>Category</span><select id="rc">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
    <label class="fl"><span>Example clip or image</span><input id="rf" type="file" accept="video/mp4,video/webm,video/quicktime,image/*"></label>
    <label class="fl"><span>What it looks like</span><textarea id="ra" rows="3" placeholder="Palette, type, texture, how things move…"></textarea></label>
    <label class="fl"><span>Prompt</span><textarea id="rp" rows="5" placeholder="Instructions the AI follows. Use {what}, {text}, {format} and {seconds} where the reel's details go."></textarea></label>
    <div class="fl2"><label class="fl"><span>Best for</span><input id="rb" placeholder="event openers, speaker intros…"></label><label class="fl"><span>Built with</span><select id="re"><option value="hyperframes">hyperframes</option><option value="remotion">remotion</option></select></label></div>
    <label class="fl"><span>Palette (optional)</span><span class="pal4">${[0, 1, 2, 3].map(i => `<input type="color" data-rp="${i}" value="${['#0b0b0d', '#d79f46', '#ffffff', '#2a2a30'][i]}">`).join('')}<label class="chk"><input type="checkbox" id="rpal"> use these</label></span></label>
    <div class="at-act"><button class="btn lux" id="rsave">Save to the atlas</button><span id="rmsg" class="hint"></span></div></div></div>`;
  m.classList.add('on');
}
async function saveRef() {
  const name = $('#rn').value.trim(); if (!name) return toast('Give it a name');
  const id = 'ref-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const e = { id, name, category: $('#rc').value, about: $('#ra').value.trim(), prompt: $('#rp').value.trim() || `Make a {seconds}-second {format} motion graphic for {what} in the "${name}" style: ${$('#ra').value.trim()}\nText on screen: {text}`,
    best_for: $('#rb').value.trim(), engine: $('#re').value, palette: $('#rpal').checked ? $$('[data-rp]').map(i => i.value) : [], source: 'Your reference', added: new Date().toISOString() };
  const f = $('#rf').files[0]; let data = '';
  if (f) { if (f.size > 60e6) return toast('That file is over 60 MB — trim it first'); data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f) }) }
  $('#rmsg').textContent = 'Saving…';
  try {
    const r = await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'atlas', data: { ...e, example_data: data, example_name: f ? f.name : '' } }) });
    const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.error || r.status); e.example = j.example || '';
    window.BM_ATLAS_CUSTOM = [...(window.BM_ATLAS_CUSTOM || []).filter(x => x.id !== id), e]; toast('Added to the atlas ✓');
  } catch (err) {
    if (data && data.length < 3e6 && f.type.startsWith('image/')) e.example = data;
    const p = lsGet(LSC, {}); p[id] = e; if (!lsSet(LSC, p)) { delete e.example; p[id] = e; lsSet(LSC, p) }
    toast('Saved in this browser — open the Library app so the clip is stored with the atlas');
  }
  load(); cat = e.category; render(); close(); open(id);
}
async function delRef(id) {
  if (!confirm('Delete this reference from the atlas?')) return;
  const p = lsGet(LSC, {}); delete p[id]; lsSet(LSC, p);
  try { await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'atlas', data: { id }, delete: true }) }) } catch (e) { }
  window.BM_ATLAS_CUSTOM = (window.BM_ATLAS_CUSTOM || []).filter(x => x.id !== id); load(); close(); render(); toast('Deleted');
}
// references saved while the server was off go up as soon as it answers
(async () => { const p = lsGet(LSC, {}); for (const id in p) { try { const r = await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'atlas', data: { ...p[id], example_data: String(p[id].example || '').startsWith('data:') ? p[id].example : '', example: String(p[id].example || '').startsWith('data:') ? '' : p[id].example } }) }); if (r.ok) { delete p[id]; lsSet(LSC, p) } } catch (e) { break } } })();

/* ── events ── */
document.addEventListener('click', e => {
  const t = e.target;
  const c = t.closest('[data-c]'); if (c) { cat = c.dataset.c; render(); return }
  const card = t.closest('.at-card'); if (card) { open(card.dataset.id); return }
  if (t.id === 'add') { addForm(); return }
  if (t.id === 'rsave') { saveRef(); return }
  if (t.closest('[data-x]') || t.id === 'modal') { close(); return }
  const m = $('#modal'); const x = ALL.find(a => a.id === m.dataset.id);
  const rk = t.closest('[data-rk]'); if (rk && x) { refKind = rk.dataset.rk; $$('[data-rk]').forEach(b => b.classList.toggle('on', b === rk)); $('#cvbig').innerHTML = cover(x, true); return }
  const f = t.closest('[data-fmt]'); if (f && x) { fill.format = f.dataset.fmt; $$('[data-fmt]').forEach(b => b.classList.toggle('on', b === f)); $('#pr').textContent = promptOf(x); return }
  const us = t.closest('[data-use]'); if (us && x) { applyLook(us.dataset.use, x); return }
  if (t.closest('[data-forskip]')) { const c = forCard(); try { localStorage.removeItem('bm.style.for') } catch (e) { } if (c) goPipeline(c.id); return }
  if (t.closest('[data-forclear]')) { try { localStorage.removeItem('bm.style.for') } catch (e) { } forId = ''; fill._for = ''; banner(); return }
  if (t.closest('[data-copy]') && x) { navigator.clipboard?.writeText(promptOf(x)); toast('Prompt copied — paste it into Claude'); return }
  if (t.closest('[data-delref]') && x) { delRef(x.id); return }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { q = e.target.value; render(); return }
  const k = e.target.dataset.fill; if (k) { fill[k] = e.target.value; const x = ALL.find(a => a.id === $('#modal').dataset.id); if (x) $('#pr').textContent = promptOf(x) }
});
document.addEventListener('change', e => { const uf = e.target.closest('[data-usefor]'); if (uf && uf.value) { const x = ALL.find(a => a.id === $('#modal').dataset.id); applyLook(uf.value, x); return } const fp = e.target.closest('[data-forpick]'); if (fp && fp.value) { forId = fp.value; try { localStorage.setItem('bm.style.for', forId) } catch (er) { } fill._for = ''; banner(); return }
 const s = e.target.closest('[data-tostyle]'); if (s && s.value) { const x = ALL.find(a => a.id === $('#modal').dataset.id); addToStyle(s.value, x) } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('on')) close() });
render(); banner();
addEventListener('storage', e => { if (e.key === 'bm.style.for' || e.key === PKEY || e.key === 'bm.pipeline.ping') { const v = (() => { try { return localStorage.getItem('bm.style.for') || '' } catch (er) { return '' } })(); if (e.key === 'bm.style.for') { forId = v; fill._for = '' } banner() } });
addEventListener('focus', () => { const v = (() => { try { return localStorage.getItem('bm.style.for') || '' } catch (er) { return '' } })(); if (v && v !== forId) { forId = v; fill._for = '' } banner() });
