/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Pipeline — Storyboard (on each card, under Footage)
   Beats in order: the footage, the graphic it needs and notes — plus the client's style guide (Motion/styles),
   so the look is decided before the edit. Saved on the card, and to Motion/storyboards/<card>.json through the
   Library server so AI tools (Claude + the bahlman-motion skill + Cuddle in Premiere) can build from it.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const STY = () => (window.BM_MOTION_STYLES || []).concat(Object.values(lsStyles()).filter(s => !(window.BM_MOTION_STYLES || []).some(x => x.id === s.id)));
  const lsStyles = () => { try { return JSON.parse(localStorage.getItem('bm.motion.styles') || '{}') } catch (e) { return {} } };
  const styleOf = id => { const l = lsStyles()[id]; const f = (window.BM_MOTION_STYLES || []).find(s => s.id === id); return l && (!f || (l.editedAt || '') > (f.saved || f.updated || '')) ? l : f };
  const K = window.BM_MOTION_KNOWLEDGE || { graphics: [] };
  const GFX = (K.graphics && K.graphics.length ? K.graphics : [{ id: 'opener', name: 'Opener' }, { id: 'title', name: 'Title card' }, { id: 'lower-third', name: 'Lower third' }, { id: 'captions', name: 'Captions' }, { id: 'stat', name: 'Stat' }, { id: 'quote', name: 'Pull quote' }, { id: 'transition', name: 'Transition' }, { id: 'end-card', name: 'End card' }, { id: 'custom', name: 'Custom' }]);
  const ATL = id => [...(window.BM_ATLAS || []), ...(window.BM_ATLAS_CUSTOM || [])].find(a => a.id === id);
  const gname = id => (GFX.find(g => g.id === id) || {}).name || id;
  const API = 'http://127.0.0.1:8766';
  let saved = {}; // card id → 'ok' | 'local'
  const fmt = s => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` };
  const uidb = () => 'b' + Math.random().toString(36).slice(2, 8);
  const clientOf = c => { const cs = [...(c.clips || []), ...(c.photos || [])].map(x => x.client).filter(Boolean); const n = {}; cs.forEach(x => n[x] = (n[x] || 0) + 1); return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || '' };
  const guessStyle = c => { const cl = clientOf(c).toLowerCase(); const all = STY(); return (all.find(s => s.client.toLowerCase() === cl) || all.find(s => cl && s.client.toLowerCase().includes(cl.split(' ')[0])) || {}).id || '' };

  /* ── build beats from the shot list: one per clip/photo; an opener first, a lower third the first time a person shows up, an end card last ── */
  function build(c) {
    const items = [...(c.clips || []).map(x => ({ kind: 'clip', ...x })), ...(c.photos || []).map(x => ({ kind: 'photo', ...x }))];
    const seen = new Set(); const beats = [];
    const sc = {}; items.forEach(x => { if (x.shoot) sc[x.shoot] = (sc[x.shoot] || 0) + 1 });
    const mainShoot = String(Object.entries(sc).sort((a, b) => b[1] - a[1])[0]?.[0] || '').replace(/^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}\s*/, '').replace(/\s*\|\s*Bahlman$/, '');
    const target = /(\d+)\s*(s|sec|second)/i.test(c.title || '') ? +RegExp.$1 : 0;
    items.forEach((x, i) => {
      const len = x.kind === 'photo' ? 2 : Math.min(4, Math.max(1.5, (x.duration || 3) * 0.5));
      const who = i === 0 ? null : (x.who || []).find(n => !seen.has(n)); if (who) seen.add(who);
      let g = { kind: '', text: '', detail: '' };
      if (i === 0) g = { kind: 'opener', text: (c.title || '').split('—')[0].trim(), detail: mainShoot };
      else if (who) g = { kind: 'lower-third', text: who, detail: '' };
      beats.push({ id: uidb(), len: +len.toFixed(1), src: { kind: x.kind, id: x.id }, gfx: g, notes: x.note || '' });
    });
    beats.push({ id: uidb(), len: 3, src: null, gfx: { kind: 'end-card', text: clientOf(c), detail: '' }, notes: '' });
    if (target) { // fit the target length: shrink everything, or stretch clips up to what they actually have
      const tot = beats.reduce((a, b) => a + b.len, 0), k = target / tot;
      beats.forEach((b, i) => { const src = i < items.length ? items[i] : null; const max = src && src.kind === 'clip' && src.duration ? src.duration : (src ? 4 : 3.5);
        b.len = Math.max(0.8, Math.min(max, +(b.len * k).toFixed(1))) }) }
    return { style: guessStyle(c), format: c.look && c.look.format ? c.look.format : /9:16|vertical|reel|short|tiktok/i.test((c.title || '') + ' ' + (c.type || []).join(' ')) ? '9:16' : '16:9', beats, target };
  }

  const srcOf = (c, s) => !s ? null : s.kind === 'photo' ? (c.photos || []).find(x => x.id === s.id) : (c.clips || []).find(x => x.id === s.id);
  const thumbOf = (s) => !s ? '' : s.kind === 'photo' ? `${LIB}_photos/thumb/${s.id}.jpg` : `${LIB}_thumbs/${s.id}.jpg`;

  /* ── the look picked in step 03 · Style: everything about it, carried onto the card ── */
  function lookHtml(c) {
    const L = c.look;
    if (!L) return `<div class="sec lk" data-lk><h4 data-sec><i>▼</i>Look <span class="sbh">not picked yet</span></h4><div class="secb"><div class="sb0"><p>Pick the visual style for this reel in step 03 · Style — its palette, type, motion, prompt and example come onto this card, and the AI tools follow it.</p><button class="b ok" data-lkpick>Pick a style →</button></div></div></div>`;
    const vid = L.ref ? L.ref.explainer : (/\.(mp4|webm)$/i.test(L.example || '') ? '../Motion/' + L.example : '');
    const pos = L.ref ? L.ref.poster : (L.poster ? '../Motion/' + L.poster : '');
    const fb = L.example ? ` data-fb="../Motion/${esc(L.example)}"` : '';
    const row = (k, v) => v ? `<div class="lkr"><span>${k}</span><div>${esc(Array.isArray(v) ? v.join(' · ') : v)}</div></div>` : '';
    return `<div class="sec lk" data-lk><h4 data-sec><i>▼</i>Look <span class="sbh">${esc(L.name)} · ${esc(L.category || '')}</span></h4><div class="secb">
      <div class="lkg"><div class="lkv">${vid ? `<video src="${esc(vid)}" poster="${esc(pos)}" muted loop playsinline autoplay${fb} onerror="if(this.dataset.fb&&!this.dataset.failed){this.dataset.failed=1;this.src=this.dataset.fb}"></video>` : pos ? `<img src="${esc(pos)}" alt="">` : ''}${L.ref ? '<em>Futurepedia example</em>' : ''}</div>
        <div class="lki"><b>${esc(L.name)}</b><p>${esc(L.about || '')}</p>
          ${(L.palette || []).length ? `<div class="lkp">${L.palette.map(x => `<span title="${esc(x)}"><i style="background:${esc(x)}"></i>${esc(x)}</span>`).join('')}</div>` : ''}
          ${row('Type', [L.display, L.body].filter(Boolean))}${row('Texture', L.texture)}${row('Motion', L.motion)}${row('Best for', L.best_for)}${row('Built with', L.engine)}${row('Format', L.format ? `${L.format} · ${L.seconds || 4}s per graphic` : '')}
        </div></div>
      <div class="lkpr"><div class="lkph"><span>Prompt for the AI tools</span><button class="b" data-lkcopy>Copy</button></div><pre>${esc(L.prompt || '')}</pre></div>
      <div class="sbft"><button class="b" data-lkpick>Change look →</button><button class="b" data-lkrm>Remove look</button><span class="sp"></span>${L.source_url ? `<a class="sblink" href="${esc(L.source_url)}" target="_blank" rel="noopener">${esc(L.source || 'source')} ↗</a>` : ''}</div>
    </div></div>`;
  }
  /* ── the edit checklist (what goes in the edit — every item a Cuddle task), from step 03 ① ── */
  const DRAFTS = new Map(), SENT = new Map();
  function editHtml(c) {
    if (!window.BM_EDIT) return '';
    const n = BM_EDIT.count(c.edit);
    return `<div class="sec ed${c.edit ? '' : ' closed'}" data-ed><h4 data-sec><i>▼</i>Edit checklist <span class="sbh">${c.edit ? `${n} of ${BM_EDIT.total} on${c.edit.preset ? ' · ' + esc(c.edit.preset) : ''}` : 'not set — suggested below'}</span></h4><div class="secb"><div data-edmount></div></div></div>`;
  }
  function html(c) { return editHtml(c) + lookHtml(c) + sbHtml(c) }
  function sbHtml(c) {
    const sb = c.storyboard; const has = !!(sb && sb.beats && sb.beats.length);
    const all = STY(); const st = has && sb.style ? styleOf(sb.style) : null;
    const tot = has ? sb.beats.reduce((a, b) => a + (+b.len || 0), 0) : 0;
    let t = 0;
    return `<div class="sec sb" data-sb><h4 data-sec><i>▼</i>Storyboard <span class="sbh">${has ? `${sb.beats.length} beats · ${fmt(tot)}${sb.target ? ` of ${fmt(sb.target)}` : ''}${st ? ` · ${esc(st.client)} style` : ''}` : 'plan the edit and its graphics before anyone opens Premiere'}</span></h4><div class="secb">
      ${!has ? `<div class="sb0"><p>Turn the footage into beats — what plays when, which graphic it needs and how it should look (from the client's style guide), so the AI tools in Premiere know what to make.</p><button class="b ok" data-sbbuild>${(c.clips || []).length || (c.photos || []).length ? 'Build from the shot list' : 'Start an empty storyboard'}</button></div>` : `
      <div class="sbbar">
        <label>Style <select data-sbstyle><option value="">— pick a style guide —</option>${all.map(s => `<option value="${esc(s.id)}"${s.id === sb.style ? ' selected' : ''}>${esc(s.client)}${s.status === 'approved' ? '' : ' (draft)'}</option>`).join('')}</select></label>
        <a class="sblink" href="../Motion/index.html${sb.style ? '#s=' + encodeURIComponent(sb.style) : ''}" target="_blank" data-sbopen>${st ? 'Open style guide ↗' : 'Styles ↗'}</a>
        <span class="seg" data-sbfmt>${['16:9', '9:16'].map(f => `<button data-v="${f}" class="${sb.format === f ? 'on' : ''}">${f}</button>`).join('')}</span>
        <span class="sbsave">${saved[c.id] === 'ok' ? 'Saved for AI tools ✓' : saved[c.id] === 'local' ? 'Saved on the card — open the Library app so AI tools can read it' : ''}</span>
      </div>
      ${st ? `<div class="sbsty" style="--p:${esc(st.palette?.primary)};--a:${esc(st.palette?.accent)}"><i></i><i></i><span>${esc(st.sentence || '')}</span><em>${(st.motion?.languages || []).map(esc).join(' · ')}</em></div>` : `<div class="sbsty none">No style guide picked — the AI tools won't know the look. Pick one above, or make one on the Styles page.</div>`}
      <div class="sbl">${sb.beats.map((b, i) => { const s0 = t; t += +b.len || 0; const src = srcOf(c, b.src); const look = st && b.gfx.kind && st.graphics?.[b.gfx.kind];
        return `<div class="sbb" data-bi="${i}">
          <div class="sbn"><b>${i + 1}</b><span>${fmt(s0)}–${fmt(t)}</span></div>
          <div class="sbt">${b.src ? `<img src="${thumbOf(b.src)}" alt="" loading="lazy">` : '<div class="sbnone">no footage</div>'}</div>
          <div class="sbf"><div class="sbsrc">${src ? `${b.src.kind === 'photo' ? 'Photo' : 'Clip'} ${esc(b.src.id)} · ${esc(src.description || (src.who || []).join(', ') || src.file || '')}` : b.src ? esc(b.src.id) : 'Graphic only'}</div>
            <div class="sbg"><select data-bk>${['', ...GFX.map(g => g.id)].map(k => `<option value="${k}"${k === (b.gfx.kind || '') ? ' selected' : ''}>${k ? esc(gname(k)) : 'No graphic'}</option>`).join('')}</select>
              ${b.gfx.kind ? `<input data-bt value="${esc(b.gfx.text)}" placeholder="${b.gfx.kind === 'lower-third' ? 'Name' : b.gfx.kind === 'captions' ? 'Words (blank = from the transcript)' : b.gfx.kind === 'stat' ? 'Number' : 'Text'}"><input data-bd value="${esc(b.gfx.detail)}" placeholder="${b.gfx.kind === 'lower-third' ? 'Role' : b.gfx.kind === 'stat' ? 'Label' : 'Second line'}">` : ''}</div>
            ${b.gfx.kind && ((st && (st.atlas || []).length) || c.look) ? (() => { const opts = [...new Set([...(c.look ? [c.look.id] : []), ...((st && st.atlas) || [])])]; const dflt = c.look ? c.look.name : (ATL(opts[0])?.name || 'style default'); return `<div class="sbatl"><span>Look</span><select data-ba><option value="">${esc(dflt)} (${c.look ? "this reel's look" : 'style default'})</option>${opts.map(id => `<option value="${esc(id)}"${b.gfx.atlas === id ? ' selected' : ''}>${esc((c.look && c.look.id === id ? c.look.name : ATL(id)?.name) || id)}</option>`).join('')}</select></div>` })() : ''}
            ${look ? `<div class="sblook" title="From the ${esc(st.client)} style guide — ${esc(look.engine)}"><b>${esc(look.engine)}</b> ${esc(look.look)}</div>` : ''}
            <input class="sbnote" data-bn value="${esc(b.notes)}" placeholder="Notes for the edit (timing, music hit, what to show)…"></div>
          <div class="sbx"><input data-bl type="number" min="0.3" step="0.1" value="${+b.len}" title="Length (seconds)"><span>s</span><div><button data-bu title="Move up">▲</button><button data-bdn title="Move down">▼</button><button data-brm title="Remove">✕</button></div></div>
        </div>` }).join('')}</div>
      <div class="sbft"><button class="b" data-sbadd>＋ Add a graphic-only beat</button><button class="b" data-sbre title="Rebuild the beats from the shot list (replaces these)">↻ Rebuild from shot list</button><span class="sp"></span><button class="b ok" data-sbcopy title="Copy a request to paste into Claude">Copy request for Claude</button></div>`}
    </div></div>`;
  }

  /* ── the file AI tools read: the storyboard plus everything they need about the footage and the style ── */
  function exportOf(c) {
    const sb = c.storyboard || { beats: [], format: (c.look && c.look.format) || '16:9', style: '' }; let t = 0;
    return { id: c.id, title: c.title, card: c.id, client: clientOf(c), style: sb.style || '', format: sb.format, target_seconds: sb.target || null, prompt: (c.body || '').split('\n').slice(1, 2).join('').trim(),
      beats: sb.beats.map((b, i) => { const s = srcOf(c, b.src); const at = t; t += +b.len || 0;
        return { n: i + 1, at: +at.toFixed(2), len: +b.len, footage: b.src ? { kind: b.src.kind, id: b.src.id, path: s ? (s.path || (s.drive && s.folder ? `/Volumes/${s.drive}/${s.folder}/${s.file}` : s.file || '')) : '', description: s?.description || '', who: s?.who || [], clip_seconds: s?.duration || null } : null,
          graphic: b.gfx.kind ? { kind: b.gfx.kind, text: b.gfx.text, detail: b.gfx.detail, atlas: b.gfx.atlas || (c.look && c.look.id) || ((sb.style && (styleOf(sb.style) || {}).atlas) || [])[0] || '' } : null, notes: b.notes } }),
      look: c.look || null,
      edit: window.BM_EDIT && c.edit ? BM_EDIT.exportOf(c.edit) : null,
      total_seconds: +t.toFixed(2), updated: new Date().toISOString() };
  }
  let tm = null;
  function persist(c) {
    c.editedAt = new Date().toISOString(); save();
    clearTimeout(tm); tm = setTimeout(async () => {
      try { const r = await fetch(API + '/motion/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'storyboard', data: exportOf(c) }) }); if (!r.ok) throw 0; saved[c.id] = 'ok' } catch (e) { saved[c.id] = 'local' }
      const el = document.querySelector('#peek .sbsave'); if (el) el.textContent = saved[c.id] === 'ok' ? 'Saved for AI tools ✓' : 'Saved on the card — open the Library app so AI tools can read it';
    }, 600);
  }
  const redraw = () => { renderPeek(); render() };

  function wire(el, c) {
    const em = el.querySelector('[data-edmount]');
    if (em && window.BM_EDIT) { if (!c.edit && !DRAFTS.has(c.id)) DRAFTS.set(c.id, BM_EDIT.forCard(c)); const ed = c.edit || DRAFTS.get(c.id);
      BM_EDIT.mount(em, ed, e => { c.edit = e; DRAFTS.delete(c.id); persist(c); const h = el.querySelector('[data-ed] .sbh'); if (h) h.textContent = `${BM_EDIT.count(e)} of ${BM_EDIT.total} on${e.preset ? ' · ' + e.preset : ''}` }, { compact: true }) }
    const lk = el.querySelector('[data-lk]');
    if (lk) lk.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-lkpick]')) { try { localStorage.setItem('bm.style.for', c.id) } catch (er) { } if (window.parent !== window) parent.postMessage({ bm: 'step', step: 'style', reload: true }, '*'); else location.href = '../Motion/atlas.html?for=' + encodeURIComponent(c.id); return }
      if (t.closest('[data-lkcopy]')) { navigator.clipboard?.writeText(c.look?.prompt || ''); toast('Prompt copied — paste it into Claude'); return }
      if (t.closest('[data-lkrm]')) { if (!confirm('Remove the look from this card?')) return; snap('Remove look'); delete c.look; persist(c); redraw(); return }
    });
    // a look picked in the Style step is written straight onto the card — pass it on to the AI tools once
    if (c.look && c._lookSent !== c.look.picked) { c._lookSent = c.look.picked; persist(c) }
    // same for a checklist set in step 03 ①
    const es = c.edit && (c.edit.updated || 'x'); if (es && SENT.get(c.id) !== es) { SENT.set(c.id, es); persist(c) }
    const box = el.querySelector('[data-sb]'); if (!box) return;
    box.addEventListener('click', e => {
      const t = e.target; const sb = c.storyboard; const row = t.closest('[data-bi]'); const i = row ? +row.dataset.bi : -1;
      if (t.closest('[data-sbbuild]') || t.closest('[data-sbre]')) { if (t.closest('[data-sbre]') && !confirm('Rebuild the beats from the shot list? This replaces the current beats.')) return; snap('Storyboard'); c.storyboard = Object.assign(build(c), sb && sb.style ? { style: sb.style } : {}); persist(c); redraw(); return }
      if (t.closest('[data-sbfmt] button')) { sb.format = t.closest('button').dataset.v; persist(c); redraw(); return }
      if (t.closest('[data-sbadd]')) { sb.beats.push({ id: uidb(), len: 2, src: null, gfx: { kind: 'title', text: '', detail: '' }, notes: '' }); persist(c); redraw(); return }
      if (t.closest('[data-bu]') && i > 0) { [sb.beats[i - 1], sb.beats[i]] = [sb.beats[i], sb.beats[i - 1]]; persist(c); redraw(); return }
      if (t.closest('[data-bdn]') && i < sb.beats.length - 1) { [sb.beats[i + 1], sb.beats[i]] = [sb.beats[i], sb.beats[i + 1]]; persist(c); redraw(); return }
      if (t.closest('[data-brm]')) { snap('Remove beat'); sb.beats.splice(i, 1); persist(c); redraw(); return }
      if (t.closest('[data-sbcopy]')) { const st = sb.style ? styleOf(sb.style) : null; navigator.clipboard?.writeText(`Use the bahlman-motion skill to build "${c.title}" in Premiere from its edit package (Motion/storyboards/${c.id}.json): follow the edit checklist with the Cuddle tools it names, make every graphic in the reel's look${st ? ` and the ${st.client} style guide (Motion/styles/${st.id}.json)` : ''}, render them as transparent overlays into Motion/renders/${c.id}/, and assemble the sequence from the storyboard's footage. Show me stills before exporting anything.`); toast('Copied — paste it into Claude'); return }
      if (t.closest('[data-sbopen]') && window.parent !== window) { /* inside the Library: open in a new window is fine */ }
    });
    box.addEventListener('change', e => {
      const t = e.target; const sb = c.storyboard; const row = t.closest('[data-bi]'); const b = row ? sb.beats[+row.dataset.bi] : null;
      if (t.matches('[data-sbstyle]')) { sb.style = t.value; persist(c); redraw(); return }
      if (b && t.matches('[data-bk]')) { b.gfx.kind = t.value; if (t.value === 'lower-third' && !b.gfx.text) { const s = srcOf(c, b.src); b.gfx.text = (s?.who || [])[0] || '' } persist(c); redraw(); return }
      if (b && t.matches('[data-ba]')) { b.gfx.atlas = t.value; persist(c); return }
      if (b && t.matches('[data-bl]')) { b.len = Math.max(0.3, +t.value || 1); persist(c); redraw(); return }
    });
    box.addEventListener('input', e => {
      const t = e.target; const sb = c.storyboard; const row = t.closest('[data-bi]'); const b = row ? sb.beats[+row.dataset.bi] : null; if (!b) return;
      if (t.matches('[data-bt]')) b.gfx.text = t.value; else if (t.matches('[data-bd]')) b.gfx.detail = t.value; else if (t.matches('[data-bn]')) b.notes = t.value; else return;
      persist(c);
    });
  }
  window.SB = { html, wire, build, exportOf };
})();
