/* Step 03 · Edit plan — ① the edit checklist for a reel (a Pipeline card), then ② its look in the Style Atlas. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const EMBED = new URLSearchParams(location.search).has('embed') || window.parent !== window;
if (EMBED) { document.body.classList.add('embed'); document.querySelectorAll('.mtabs a').forEach(a => a.href = a.getAttribute('href').replace(/(\.html)/, '$1?embed=1')) }
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._k); t._k = setTimeout(() => t.classList.remove('on'), 2200) };
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d } catch (e) { return d } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch (e) { return false } };
const PKEY = 'bm.pipeline.v2';
const pcards = () => { const P = lsGet(PKEY, null); return [...((P && P.cards) || []), ...lsGet('bm.pipeline.inbox', [])].filter(c => c && !c.archived) };
let forId = new URLSearchParams(location.search).get('for') || (() => { try { return localStorage.getItem('bm.style.for') || '' } catch (e) { return '' } })();
const card = () => pcards().find(c => c.id === forId) || null;
let edit = null, tm = null;

function writeCard(mut) {
  const P = lsGet(PKEY, null), inbox = lsGet('bm.pipeline.inbox', []);
  const c = ((P && P.cards) || []).find(k => k.id === forId) || inbox.find(k => k.id === forId); if (!c) return false;
  mut(c); c.editedAt = new Date().toISOString();
  if (P) lsSet(PKEY, P); lsSet('bm.pipeline.inbox', inbox);
  try { localStorage.setItem('bm.pipeline.ping', String(Date.now())) } catch (e) { }
  return true;
}
const saveEdit = () => { clearTimeout(tm); tm = setTimeout(() => { if (writeCard(c => c.edit = edit)) $('#saved') && ($('#saved').textContent = 'Saved on the card ✓') }, 300) };
function go(where) {
  const c = card(); if (!c) return;
  if (where === 'look') { try { localStorage.setItem('bm.style.for', c.id) } catch (e) { } location.href = 'atlas.html?for=' + encodeURIComponent(c.id) + (EMBED ? '&embed=1' : ''); return }
  try { localStorage.removeItem('bm.style.for'); localStorage.setItem('bm.pipeline.open', c.id); localStorage.setItem('bm.pipeline.ping', String(Date.now())) } catch (e) { }
  if (window.parent !== window) parent.postMessage({ bm: 'step', step: 'pipeline', reload: true, open: c.id }, '*'); else location.href = '../Pipeline/index.html?open=' + encodeURIComponent(c.id);
}
function render() {
  const c = card(); const fb = $('#forbar');
  if (!c) {
    const recent = pcards().slice(-12).reverse();
    fb.className = 'forbar'; fb.innerHTML = `<div class="fb-t"><em>Step 03 · which reel is this for?</em><b>Pick a Pipeline card</b></div><select data-pick><option value="">Choose a card…</option>${recent.map(x => `<option value="${esc(x.id)}">${esc(x.title || 'Untitled')}</option>`).join('')}</select><span class="fb-h">Or make one in Ideate — “Next: pick the style” brings you here.</span>`;
    $('#ec').innerHTML = ''; $('#next').innerHTML = ''; return;
  }
  edit = c.edit ? JSON.parse(JSON.stringify(c.edit)) : BM_EDIT.forCard(c);
  if (!c.edit) { writeCard(k => k.edit = edit) }   // a fresh card gets the suggested checklist straight away
  fb.className = 'forbar'; fb.innerHTML = `<div class="fb-t"><em>Step 03 · ① planning the edit for</em><b>${esc(c.title || 'Untitled')}</b></div><span class="fb-h"><span id="saved">${c.edit ? 'Saved on the card ✓' : 'Suggested from the reel — saved on the card'}</span></span><button class="btn2 ghost" data-skip>Skip to the Pipeline →</button><button class="fb-x" data-clear title="Not this reel">✕</button>`;
  BM_EDIT.mount($('#ec'), edit, () => saveEdit());
  $('#next').innerHTML = `<button class="btn lux" data-look>Next: pick the look →</button>${c.look ? `<span class="hint">Current look: <b>${esc(c.look.name)}</b></span>` : ''}<button class="btn2 ghost" data-skip>Done — go to the Pipeline</button>`;
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-look]')) { clearTimeout(tm); writeCard(c => c.edit = edit); go('look'); return }
  if (t.closest('[data-skip]')) { clearTimeout(tm); writeCard(c => c.edit = edit); go('pipeline'); return }
  if (t.closest('[data-clear]')) { try { localStorage.removeItem('bm.style.for') } catch (er) { } forId = ''; render(); return }
});
document.addEventListener('change', e => { const p = e.target.closest('[data-pick]'); if (p && p.value) { forId = p.value; try { localStorage.setItem('bm.style.for', forId) } catch (er) { } render() } });
addEventListener('storage', e => { if (e.key === 'bm.style.for') { const v = e.newValue || ''; if (v && v !== forId) { forId = v; render() } } });
addEventListener('focus', () => { const v = (() => { try { return localStorage.getItem('bm.style.for') || '' } catch (er) { return '' } })(); if (v && v !== forId) { forId = v; render() } });
render();
