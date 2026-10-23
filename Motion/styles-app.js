/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Styles — motion style guides per client.
   Files: Motion/styles/<id>.json (written by the Library server, or by Claude through the footage connector).
   This page edits them; changes save to the Library server (127.0.0.1:8766) and, if it isn't running, stay in
   this browser until it is. Design knowledge comes from Motion/knowledge (built from Motion/skills by build.py).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const API = 'http://127.0.0.1:8766';
const K = window.BM_MOTION_KNOWLEDGE || { personality: [], graphics: [], huashu: { languages: [], chart: [], formats: [] }, remotion: { skills: [] }, fonts: [] };
const LS = 'bm.motion.styles';
if (new URLSearchParams(location.search).has('embed') || window.parent !== window) { document.body.classList.add('embed'); document.querySelectorAll('.mtabs a, a[href="atlas.html"], a[href="index.html"]').forEach(a => a.href = a.getAttribute('href').replace(/(\.html)/, '$1?embed=1')) }
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._k); t._k = setTimeout(() => t.classList.remove('on'), 2000) };

/* ── data: files + anything saved in this browser that the server hasn't written yet ── */
let local = {}; try { local = JSON.parse(localStorage.getItem(LS) || '{}') } catch (e) { }
const files = Object.fromEntries((window.BM_MOTION_STYLES || []).map(s => [s.id, s]));
const stamp = s => s && (s.editedAt || s.saved || s.updated || '');
const S = {}; for (const id of new Set([...Object.keys(files), ...Object.keys(local)])) S[id] = stamp(local[id]) > stamp(files[id]) ? local[id] : files[id];
let cur = new URLSearchParams(location.hash.slice(1)).get('s') || Object.keys(S)[0] || '';
let dirty = false, timer = null, serverOk = null;

const BLANK = (client) => ({
  id: client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), client, status: 'draft', updated: new Date().toISOString().slice(0, 10), author: 'Sean',
  sentence: '', personality: Object.fromEntries(K.personality.map(p => [p.id, 0])),
  palette: { primary: '#d79f46', accent: '#ffffff', ink: '#ffffff', dark: '#0b0b0d', extra: [], notes: '' },
  type: { display: 'Inter', body: 'Inter', captions: 'Anton', notes: '' }, logo: '', motifs: [],
  motion: { languages: [], why: '', format: '', tempo: '', easing: '', transitions: '', on_screen: '' },
  graphics: Object.fromEntries(K.graphics.filter(g => g.id !== 'custom').map(g => [g.id, { engine: g.engine, look: '', knowledge: [] }])),
  do: [], dont: [], formats: ['16:9', '9:16'], evidence: [], knowledge: []
});

/* ── knowledge references: "huashu:languages/kinetic-type#Section", "remotion:remotion-captions" → files under Motion/skills ── */
function refFile(ref) {
  const [src, rest] = String(ref).split(/:(.*)/s); const [p] = (rest || '').split('#');
  if (src === 'huashu') {
    const lib = /^(languages\/|techniques$|formats$|README$|product-fit$)/.test(p) ? 'library/' : '';
    return `skills/huashu-motion/references/${lib}${p.replace(/^library\//, 'library/')}.md`;
  }
  if (src === 'remotion') return p.includes('/') ? `skills/remotion/${p}.md` : `skills/remotion/${p}/SKILL.md`;
  return '';
}
const refLabel = r => { const [src, rest] = String(r).split(/:(.*)/s); return `${src === 'huashu' ? 'huashu' : src === 'remotion' ? 'Remotion' : src} · ${rest.replace(/^library\//, '').replace(/#/, ' › ')}` };
const refChip = r => `<a class="ref" href="${esc(refFile(r))}" target="_blank" title="Open this part of the skill">${esc(refLabel(r))}</a>`;
const ATL = Object.fromEntries([...(window.BM_ATLAS || []), ...(window.BM_ATLAS_CUSTOM || [])].map(a => [a.id, a]));
const LANG = Object.fromEntries((K.huashu?.languages || []).map(l => [l.id, l]));

/* ── huashu-motion's chart: message shape × personality → suggested motion languages ── */
function suggest(p) {
  const v = k => +(p[k] || 0);
  const cols = { precise: -v('precise_playful') + (-v('technical_human')) / 2, playful: (v('precise_playful') + v('calm_energetic')) / 2, calm_premium: (-v('premium_accessible') - v('calm_energetic')) / 2, human: v('technical_human') };
  const col = Object.entries(cols).sort((a, b) => b[1] - a[1])[0][0];
  const rows = (K.huashu?.chart || []).filter(r => ['Claim', 'Story', 'Evidence'].includes(r.shape));
  const ids = new Set(); rows.forEach(r => (r[col] || '').split('·').forEach(x => { const m = x.trim().match(/^[\w-]+/); if (m && LANG[m[0]]) ids.add(m[0]) }));
  return { col: { precise: 'precise / technical', playful: 'playful / energetic', calm_premium: 'calm / premium', human: 'human / warm' }[col], ids: [...ids] };
}

/* ── render ── */
function renderKn() {
  const h = K.huashu || {}, r = K.remotion || {};
  $('#kn').innerHTML = `<div class="kn"><b>${(h.languages || []).length}</b><span>motion languages</span></div><div class="kn"><b>${(h.formats || []).length}</b><span>formats</span></div><div class="kn"><b>${(h.guides || []).length + (r.skills || []).length}</b><span>design & build guides</span></div><div class="kn"><b>${Object.keys(S).length}</b><span>style guides</span></div>`;
}
function renderList() {
  $('#list').innerHTML = `<div class="sl-hd"><span>Clients</span><button class="btn2" id="new">＋ New</button></div>` +
    Object.values(S).sort((a, b) => a.client.localeCompare(b.client)).map(s => `<button class="sl${s.id === cur ? ' on' : ''}" data-s="${esc(s.id)}"><span class="dots">${['primary', 'accent', 'ink', 'dark'].map(k => `<i style="background:${esc(s.palette?.[k] || '#000')}"></i>`).join('')}</span><span class="nm">${esc(s.client)}</span><em class="stt ${s.status}">${s.status === 'approved' ? 'Approved' : 'Draft'}</em></button>`).join('') +
    `<div class="sl-ask"><b>Let Claude draft one</b><p>In Claude (with the Bahlman connector on), ask:</p><code id="askTxt">Draft a motion style guide for &lt;client&gt; with the bahlman-motion skill.</code><button class="btn2 ghost" id="copyAsk">Copy</button></div>`;
}
const lines = a => (a || []).join('\n');
const unlines = t => t.split('\n').map(x => x.trim()).filter(Boolean);
function slider(p, s) {
  const v = +(s.personality?.[p.id] || 0);
  return `<div class="sld"><span class="l${v < 0 ? ' on' : ''}">${esc(p.left)}</span><input type="range" min="-2" max="2" step="1" value="${v}" data-pers="${p.id}"><span class="r${v > 0 ? ' on' : ''}">${esc(p.right)}</span><em title="${esc(p.moves)}">${esc(p.moves)}</em></div>`;
}
function fontSel(key, s) { return `<select data-type="${key}">${(K.fonts || []).map(f => `<option${f === s.type[key] ? ' selected' : ''}>${esc(f)}</option>`).join('')}${(K.fonts || []).includes(s.type[key]) ? '' : `<option selected>${esc(s.type[key])}</option>`}</select>` }
function preview(s) {
  const ev = (s.evidence || []).map(e => e.split(' — ')[0].trim()).find(e => /\.(jpe?g|png|webp)$/i.test(e));
  const P = s.palette || {}, T = s.type || {};
  return `<div class="pv" style="--p:${esc(P.primary)};--a:${esc(P.accent)};--i:${esc(P.ink)};--d:${esc(P.dark)};--fd:'${esc(T.display)}';--fb:'${esc(T.body)}';--fc:'${esc(T.captions)}'">
    ${ev ? `<img class="pvbg" src="../${esc(ev)}" alt="">` : '<div class="pvbg ph"></div>'}
    <div class="pvt"><div class="k">${esc((s.client || '').toUpperCase())}</div><div class="t">${esc(s.client || 'Title')}</div><div class="u"></div></div>
    <div class="pvl"><div class="n">Jerry Norton</div><div class="r">Speaker</div></div>
    <div class="pvc"><span>THIS IS</span> <span class="on">THE</span> <span>MOMENT</span></div>
    <div class="pvn">Mock-up from the style guide — not a render</div></div>`;
}
function renderMain() {
  const s = S[cur]; if (!s) { $('#main').innerHTML = '<div class="empty">No style guides yet — add one, or ask Claude to draft one.</div>'; return }
  const sg = suggest(s.personality || {});
  const gk = Object.keys(s.graphics || {});
  $('#main').innerHTML = `
  <div class="st-top"><div><input class="cl" data-f="client" value="${esc(s.client)}"><div class="meta">${esc(s.author || '')}${s.updated ? ' · ' + esc(s.updated) : ''} · <span id="save">${saveLabel()}</span></div></div>
    <div class="st-act"><div class="seg" id="status"><button data-v="draft" class="${s.status !== 'approved' ? 'on' : ''}">Draft</button><button data-v="approved" class="${s.status === 'approved' ? 'on' : ''}">✓ Approved</button></div><button class="btn2 ghost" id="exp">Export</button><button class="btn2 ghost danger" id="del">Delete</button></div></div>
  <div class="st-grid">
    <div class="col">
      ${preview(s)}
      <div class="card"><h4>The brief <em>— one sentence every choice follows</em></h4><textarea data-f="sentence" rows="2" placeholder="e.g. Playful, energetic, accessible, human — a members' rally.">${esc(s.sentence)}</textarea></div>
      <div class="card"><h4>Personality <em>— huashu-motion director, scored −2…+2 from evidence</em></h4>${K.personality.map(p => slider(p, s)).join('')}</div>
      <div class="card"><h4>Palette</h4><div class="pal">${['primary', 'accent', 'ink', 'dark'].map(k => `<label><input type="color" data-pal="${k}" value="${esc(s.palette?.[k] || '#000000')}"><span>${k}</span><code>${esc(s.palette?.[k] || '')}</code></label>`).join('')}</div><textarea data-pal="notes" rows="2" placeholder="Where these colours come from">${esc(s.palette?.notes)}</textarea></div>
      <div class="card"><h4>Type</h4><div class="typ">${['display', 'body', 'captions'].map(k => `<label><span>${k}</span>${fontSel(k, s)}<b style="font-family:'${esc(s.type?.[k])}'">${k === 'captions' ? 'THIS IS THE MOMENT' : k === 'display' ? esc(s.client) : 'Jerry Norton · Speaker'}</b></label>`).join('')}</div><textarea data-type="notes" rows="2" placeholder="Notes on type">${esc(s.type?.notes)}</textarea></div>
    </div>
    <div class="col">
      <div class="card"><h4>How it moves <em>— motion languages from the huashu-motion library</em></h4>
        <div class="langs">${(s.motion?.languages || []).map(id => `<span class="lang on" title="${esc(LANG[id]?.best_for || '')}"><b>${esc(id)}</b><i>${esc(LANG[id]?.says || '')}</i><button data-unlang="${esc(id)}" title="Remove">✕</button></span>`).join('') || '<span class="hint">None picked yet.</span>'}</div>
        <div class="sug"><span>Suggested for event recaps by a <b>${esc(sg.col)}</b> brand:</span>${sg.ids.filter(id => !(s.motion?.languages || []).includes(id)).map(id => `<button class="lang" data-lang="${esc(id)}" title="${esc(LANG[id].best_for)}">＋ ${esc(id)} <i>${esc(LANG[id].says)}</i></button>`).join('')}<select id="anyLang"><option value="">Any language…</option>${(K.huashu?.languages || []).map(l => `<option value="${esc(l.id)}">${esc(l.id)} — ${esc(l.says)}</option>`).join('')}</select></div>
        ${['why', 'format', 'tempo', 'easing', 'transitions', 'on_screen'].map(k => `<label class="fld"><span>${{ why: 'Why', format: 'Format', tempo: 'Tempo & cutting', easing: 'Easing', transitions: 'Transitions', on_screen: 'On screen' }[k]}</span><textarea data-mo="${k}" rows="${k === 'why' ? 2 : 1}">${esc(s.motion?.[k])}</textarea></label>`).join('')}
        <label class="fld"><span>Motifs</span><textarea data-list="motifs" rows="2" placeholder="One per line">${esc(lines(s.motifs))}</textarea></label>
      </div>
      <div class="card"><h4>Atlas looks <em>— the reference styles this client's graphics follow</em></h4>${(s.atlas || []).length ? `<div class="atl">${s.atlas.map(id => { const a = ATL[id]; return a ? `<a class="atlc" href="atlas.html#c=${encodeURIComponent(a.category)}" title="${esc(a.about)}"><span class="dots">${(a.palette || []).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span><b>${esc(a.name)}</b><em>${esc(a.engine)}</em><button data-unatl="${esc(id)}" title="Remove">✕</button></a>` : '' }).join('')}</div>` : '<span class="hint">None yet — open the <a href="atlas.html">Style Atlas</a> and use “Add to a client style”.</span>'}</div>
      <div class="card"><h4>Graphics <em>— how each one looks, and which skill makes it</em></h4>
        ${gk.map(k => { const g = s.graphics[k]; const meta = K.graphics.find(x => x.id === k); return `<div class="gfx"><div class="gh"><b>${esc(meta ? meta.name : k)}</b><select data-eng="${esc(k)}">${['huashu-motion', 'remotion', 'either'].map(e => `<option${e === g.engine ? ' selected' : ''}>${e}</option>`).join('')}</select></div><textarea data-look="${esc(k)}" rows="2" placeholder="What it looks like and how it moves">${esc(g.look)}</textarea>${(g.knowledge || []).length ? `<div class="refs">${g.knowledge.map(refChip).join('')}</div>` : ''}</div>` }).join('')}
      </div>
      <div class="card two"><label class="fld"><span>Do</span><textarea data-list="do" rows="4" placeholder="One per line">${esc(lines(s.do))}</textarea></label><label class="fld"><span>Don't</span><textarea data-list="dont" rows="4" placeholder="One per line">${esc(lines(s.dont))}</textarea></label></div>
      <div class="card"><h4>Evidence & knowledge <em>— what this guide is based on</em></h4><textarea data-list="evidence" rows="3" placeholder="Files or links this guide is based on, one per line">${esc(lines(s.evidence))}</textarea>${(s.knowledge || []).length ? `<div class="refs">${s.knowledge.map(refChip).join('')}</div>` : ''}</div>
    </div>
  </div>`;
}
function render() { renderKn(); renderList(); renderMain(); location.hash = cur ? 's=' + encodeURIComponent(cur) : '' }
const saveLabel = () => dirty ? 'Saving…' : serverOk === false ? 'Saved in this browser — open the Library app to save to Motion/styles' : serverOk ? 'Saved to Motion/styles ✓' : '';

/* ── edits ── */
function touch() { const s = S[cur]; s.editedAt = new Date().toISOString(); s.updated = s.editedAt.slice(0, 10); dirty = true; local[cur] = s; try { localStorage.setItem(LS, JSON.stringify(local)) } catch (e) { } const el = $('#save'); if (el) el.textContent = saveLabel(); clearTimeout(timer); timer = setTimeout(push, 700) }
async function push(id = cur, del = false) {
  try {
    const r = await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'style', data: S[id] || { id }, delete: del }) });
    if (!r.ok) throw new Error('HTTP ' + r.status); serverOk = true; if (!del) { delete local[id]; try { localStorage.setItem(LS, JSON.stringify(local)) } catch (e) { } }
  } catch (e) { serverOk = false }
  dirty = false; const el = $('#save'); if (el) el.textContent = saveLabel();
}
// anything saved only in this browser goes to the server as soon as it answers
(async () => { for (const id of Object.keys(local)) await push(id); if (Object.keys(local).length === 0) { try { await fetch(API + '/health'); serverOk = true } catch (e) { serverOk = false } } const el = $('#save'); if (el) el.textContent = saveLabel() })();

document.addEventListener('input', e => {
  const t = e.target, s = S[cur]; if (!s || !t.closest('#main')) return;
  if (t.dataset.f) s[t.dataset.f] = t.value;
  else if (t.dataset.pers) { s.personality[t.dataset.pers] = +t.value; touch(); renderMain(); return }
  else if (t.dataset.pal) { s.palette[t.dataset.pal] = t.value; if (t.type === 'color') { const c = t.parentElement.querySelector('code'); if (c) c.textContent = t.value; $('.pv')?.style.setProperty({ primary: '--p', accent: '--a', ink: '--i', dark: '--d' }[t.dataset.pal], t.value) } }
  else if (t.dataset.type) { s.type[t.dataset.type] = t.value }
  else if (t.dataset.mo) s.motion[t.dataset.mo] = t.value;
  else if (t.dataset.list) s[t.dataset.list] = unlines(t.value);
  else if (t.dataset.look) s.graphics[t.dataset.look].look = t.value;
  else return;
  touch(); if (t.dataset.f === 'client') renderList();
});
document.addEventListener('change', e => {
  const t = e.target, s = S[cur]; if (!s) return;
  if (t.dataset.type && t.tagName === 'SELECT') { s.type[t.dataset.type] = t.value; touch(); renderMain() }
  else if (t.dataset.eng) { s.graphics[t.dataset.eng].engine = t.value; touch() }
  else if (t.id === 'anyLang' && t.value) { s.motion.languages = [...new Set([...(s.motion.languages || []), t.value])]; touch(); renderMain() }
});
document.addEventListener('click', e => {
  const t = e.target, s = S[cur];
  const b = t.closest('[data-s]'); if (b) { cur = b.dataset.s; render(); return }
  if (t.id === 'new') { const c = prompt('Client name'); if (!c) return; const n = BLANK(c.trim()); if (S[n.id]) { cur = n.id; render(); return } S[n.id] = n; cur = n.id; render(); touch(); return }
  if (t.id === 'copyAsk') { navigator.clipboard?.writeText($('#askTxt').textContent); toast('Copied — paste it into Claude'); return }
  if (!s) return;
  const st = t.closest('#status button'); if (st) { s.status = st.dataset.v; touch(); renderMain(); renderList(); toast(s.status === 'approved' ? 'Approved — AI tools will use this look' : 'Back to draft'); return }
  const l = t.closest('[data-lang]'); if (l) { s.motion.languages = [...new Set([...(s.motion.languages || []), l.dataset.lang])]; touch(); renderMain(); return }
  const ua = t.closest('[data-unatl]'); if (ua) { e.preventDefault(); s.atlas = (s.atlas || []).filter(x => x !== ua.dataset.unatl); touch(); renderMain(); return }
  const u = t.closest('[data-unlang]'); if (u) { s.motion.languages = s.motion.languages.filter(x => x !== u.dataset.unlang); touch(); renderMain(); return }
  if (t.id === 'exp') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' })); a.download = s.id + '.json'; a.click(); return }
  if (t.id === 'del') { if (!confirm(`Delete the style guide for ${s.client}?`)) return; const id = cur; delete S[id]; delete local[id]; try { localStorage.setItem(LS, JSON.stringify(local)) } catch (e) { } push(id, true); cur = Object.keys(S)[0] || ''; render(); toast('Deleted'); return }
});
render();
