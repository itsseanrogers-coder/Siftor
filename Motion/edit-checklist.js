/* ═══════════════════════════════════════════════════════════════════════════
   Bahlman Media · Edit checklist — what the edit should include, decided before anyone opens Premiere.
   Every item maps to the Cuddle tools (Premiere through MCP) that carry it out, so the AI knows how, not just what.
   Shared by Motion/checklist.html (step 03) and the Pipeline card. Stored on the card as card.edit:
     { preset, items: { <id>: { on: bool, <option>: value } }, notes, updated }
   and sent to the AI tools in the edit package (Motion/storyboards/<card>.json → "edit").
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const T = 'premiere_', C = 'cuddle_';
  // sec, id, label, tools, default on, hint, options {key: [label, [choices], default]}
  const ITEMS = [
    // ── Project & setup
    ['setup', 'project', 'Project & bins set up for this reel', [C + 'status', C + 'skills_list', C + 'skill_get', T + 'launch', T + 'project_get', T + 'project_create', T + 'project_open', T + 'bin_create', T + 'project_items_list'], true, 'A bin per reel: Footage, Photos, Graphics, Music.', { where: ['Project', ['New project for this reel', 'Add to the open project'], 'Add to the open project'] }],
    ['setup', 'import', 'Import the shot list (clips + photos)', [T + 'project_items_import', T + 'project_items_search', T + 'item_get'], true, 'From the storyboard beats, by their drive paths. Drives must be mounted.'],
    ['setup', 'organize', 'Organise & label clips in bins', [T + 'items_move', T + 'item_update', T + 'item_get'], true, 'Footage by beat, graphics and music in their own bins; clips named by beat.'],
    ['setup', 'selection', 'Start from what I select in Premiere', [T + 'sequences_list', T + 'sequence_open', T + 'sequence_selection_get', T + 'sequence_set_playhead'], false, 'For revisions: the AI works on the clips you highlight.'],
    ['setup', 'sequence', 'Create the sequence', [T + 'sequence_create', T + 'sequence_inspect'], true, 'Never edits an existing sequence; conforms to the footage.', { format: ['Frame', ['16:9', '9:16', '1:1', '4:5'], '16:9'] }],
    ['setup', 'versions', 'Keep a copy before big changes', [T + 'sequence_clone'], true, 'Clones the sequence before cutting silences, reframing, etc.'],
    ['setup', 'save', 'Save the project when done', [T + 'project_save', T + 'project_close'], false, 'Off = the AI asks before saving.'],
    ['setup', 'cleanup', 'Clean up after revisions', [T + 'sequence_delete', T + 'markers_remove', T + 'sequence_remove_video_filter', T + 'sequence_remove_audio_filter'], false, 'Removes old test sequences, done markers and unused effects — asks first.'],
    // ── Story & cutting
    ['cut', 'transcribe', 'Transcribe every clip', [T + 'transcript_ensure', T + 'transcript_status'], true, 'Needed for silences, fillers, captions and finding soundbites.'],
    ['cut', 'soundbites', 'Pick the soundbites by what is said', [T + 'transcript_search', T + 'transcript_get_segments'], true, 'Uses the storyboard notes and Ideate prompt to choose lines.'],
    ['cut', 'assemble', 'Assemble the rough cut from the storyboard', [T + 'sequence_assemble_ranges'], true, 'Beat order and lengths from the storyboard.'],
    ['cut', 'silences', 'Cut silences & dead air', [C + 'media_speech_edges', T + 'transcript_get_words', T + 'sequence_assemble_ranges'], true, 'Cuts land in real pauses, never clipping words.', { tight: ['Tightness', ['Tight (jump-cut)', 'Natural', 'Loose'], 'Natural'] }],
    ['cut', 'fillers', 'Remove filler words & stumbles', [T + 'transcript_get_words', C + 'media_speech_edges'], true, '“um”, “uh”, “you know”, false starts.', { level: ['How much', ['Only ums & uhs', 'Fillers + repeated words', 'Aggressive (false starts too)'], 'Fillers + repeated words'] }],
    ['cut', 'retakes', 'Keep only the best take of repeated lines', [T + 'transcript_search', T + 'transcript_get_segments'], false, 'When the speaker says the same thing twice, keep the cleaner one.'],
    ['cut', 'breaths', 'Remove loud breaths', [C + 'media_analyze', C + 'media_speech_edges'], false, 'Uses breath detection; keeps natural ones.'],
    ['cut', 'seams', 'Check every cut for flash frames & jumps', [T + 'sequence_seam', C + 'media_seam'], true, 'Catches sliver frames and bad cut points.'],
    // ── Multicam
    ['multicam', 'multicam', 'Build multicam selects', [T + 'sequence_assemble_multicam_selects'], false, 'When the shoot has synced angles.'],
    ['multicam', 'angles', 'Switch angles on speaker changes & emphasis', [T + 'sequence_set_multicam_angle', T + 'sequence_set_multicam_angles_batch'], false, '', { rhythm: ['Switching', ['On every speaker change', 'Every 4–8 s', 'Only for emphasis'], 'On every speaker change'] }],
    // ── Pacing & music
    ['pace', 'music', 'Music bed', [T + 'project_items_import', C + 'media_analyze', T + 'sequence_assemble_ranges'], true, 'Analysed for tempo and sections so cuts and graphics land on beats.', { source: ['Music', ['I’ll add the track', 'Pick from my music folder', 'No music'], 'I’ll add the track'] }],
    ['pace', 'beatcuts', 'Cut on the beat', [C + 'media_analyze', T + 'sequence_update_items'], true, 'Snaps cuts to the music’s beats; hook in the first 3 s.', { pace: ['Pacing', ['Punchy (1–2 s)', 'Energetic (2–3 s)', 'Natural (3–5 s)', 'Slow (5 s+)'], 'Energetic (2–3 s)'] }],
    ['pace', 'length', 'Hit the target length', [T + 'sequence_inspect', T + 'sequence_update_items', T + 'sequence_remove_items'], true, 'From the reel title / storyboard (e.g. 30 s).'],
    ['pace', 'nest', 'Nest sections (intro / body / outro)', [T + 'sequence_nest_items'], false, 'Keeps the timeline tidy for revisions.'],
    // ── Framing & motion
    ['frame', 'reframe', 'Reframe for vertical (keep faces in frame)', [T + 'sequence_set_motion', T + 'sequence_set_video_param_automation', C + 'media_frames'], false, 'Uses face positions from People to centre the subject in 9:16.'],
    ['frame', 'punchins', 'Punch-in zooms on emphasis', [T + 'sequence_set_motion', T + 'sequence_set_video_param_automation'], true, 'Cuts between wide and ~115% on key words to hide jump cuts.', { amount: ['Zoom', ['Subtle 108%', 'Medium 115%', 'Strong 125%'], 'Medium 115%'] }],
    ['frame', 'kenburns', 'Slow push-ins on photos', [T + 'sequence_set_video_param_automation'], true, ''],
    ['frame', 'stabilize', 'Stabilise shaky shots', [T + 'video_filters_list', T + 'sequence_append_video_filter'], false, 'Warp Stabilizer on handheld clips.'],
    ['frame', 'cutout', 'Text behind the subject / cut-outs', [C + 'media_mask_seed', C + 'media_mask_track', T + 'sequence_apply_matte'], false, 'Masks a person and puts the title behind them.'],
    // ── Colour & look
    ['colour', 'lut', 'Apply the camera LUT (log footage)', [T + 'item_set_input_lut'], false, 'For S-Log / C-Log / V-Log clips.', { lut: ['LUT', ['Match by camera', 'I’ll choose'], 'Match by camera'] }],
    ['colour', 'grade', 'Colour grade / match clips', [T + 'sequence_append_video_filter', T + 'sequence_set_video_component_params', T + 'sequence_set_video_component_params_batch', T + 'sequence_video_inspect'], true, 'Lumetri: balance, then the look’s mood.', { look: ['Look', ['Match the style guide', 'Natural / clean', 'Warm', 'Cool', 'Punchy contrast'], 'Match the style guide'] }],
    ['colour', 'adjust', 'Global adjustment layer', [T + 'sequence_add_adjustment_layer'], false, 'One layer for the overall look, easy to tweak later.'],
    ['colour', 'effects', 'Style effects (grain, vignette, glow…)', [T + 'video_filters_list', T + 'sequence_append_video_filters', T + 'sequence_set_video_param_automation'], false, 'Only what the picked look calls for.'],
    // ── Text & graphics
    ['gfx', 'captions', 'Captions', [T + 'transcript_get_words', T + 'text_place', T + 'text_style', T + 'text_align', C + 'text_fonts'], true, 'Styled from the look & style guide (font, colour, stroke).', { kind: ['Captions', ['Burned-in, few words at a time', 'Burned-in, full lines', 'Subtitle file only (.srt)'], 'Burned-in, few words at a time'], pos: ['Position', ['Lower third of frame', 'Middle', 'Top'], 'Lower third of frame'] }],
    ['gfx', 'lowerthirds', 'Lower thirds for speakers', [T + 'text_place', T + 'project_items_import', T + 'sequence_assemble_ranges'], true, 'Names from People; rendered in the look, or Premiere titles.'],
    ['gfx', 'motiongfx', 'Motion graphics from the storyboard', [T + 'project_items_import', T + 'sequence_assemble_ranges'], true, 'Rendered overlays (Remotion / HyperFrames) placed on V2 at each beat.'],
    ['gfx', 'mogrt', 'Premiere templates (.mogrt) for titles', [T + 'sequence_insert_mogrt'], false, 'If you have house templates in Premiere.'],
    ['gfx', 'transitions', 'Transitions', [T + 'transitions_list', T + 'sequence_add_transition', T + 'sequence_remove_transition'], true, '', { kind: ['Style', ['Hard cuts only', 'From the look (wipes, whips…)', 'Cross dissolves'], 'From the look (wipes, whips…)'] }],
    ['gfx', 'endcard', 'End card / call to action', [T + 'text_place', T + 'project_items_import'], true, ''],
    // ── Audio
    ['audio', 'loudness', 'Loudness to target', [C + 'media_analyze', T + 'sequence_set_audio_gain', T + 'sequence_audio_inspect'], true, 'Measured, then gained to target.', { lufs: ['Target', ['−14 LUFS (social / YouTube)', '−16 LUFS (podcast)', '−23 LUFS (broadcast)'], '−14 LUFS (social / YouTube)'] }],
    ['audio', 'voice', 'Voice clean-up (EQ, compression, de-noise)', [T + 'audio_filters_list', T + 'sequence_append_audio_filter', T + 'sequence_append_audio_filters', T + 'sequence_set_audio_component_params', T + 'sequence_set_audio_component_params_batch'], true, ''],
    ['audio', 'channels', 'Fix one-sided / mono mics', [T + 'sequence_set_audio_channel_gain', T + 'sequence_audio_inspect'], true, 'Lav on one channel → both ears.'],
    ['audio', 'ducking', 'Duck music under speech', [T + 'sequence_set_volume_automation', C + 'media_speech_edges'], true, '', { amount: ['Duck by', ['−8 dB', '−12 dB', '−18 dB'], '−12 dB'] }],
    ['audio', 'sfx', 'Sound effects on graphics & transitions', [T + 'project_items_import', T + 'sequence_assemble_ranges'], false, 'Whooshes and hits where the look’s motion lands.'],
    ['audio', 'automation', 'Fade music in / out', [T + 'sequence_set_audio_param_automation', T + 'sequence_set_volume_automation'], true, ''],
    // ── Review & delivery
    ['deliver', 'markers', 'Markers with the storyboard notes', [T + 'markers_add', T + 'markers_list', T + 'markers_update'], true, 'So the editor sees every note on the timeline.'],
    ['deliver', 'qa', 'Look at the result before handing over', [T + 'sequence_frames', T + 'frame_export', T + 'sequence_seam'], true, 'Frames at every beat, checked for text cut-offs and bad cuts.'],
    ['deliver', 'listen', 'Audio check render', [T + 'sequence_export', C + 'media_analyze'], true, 'Exports the audio and measures it.'],
    ['deliver', 'thumbs', 'Thumbnail frame options', [T + 'frame_export'], false, '3–5 stills from the strongest moments.'],
    ['deliver', 'export', 'Export', [T + 'sequence_export'], false, 'Off = stop at a finished timeline for the editor.', { how: ['How', ['Export now', 'Queue in Media Encoder'], 'Queue in Media Encoder'], formats: ['Versions', ['This frame only', '16:9 + 9:16', '16:9 + 9:16 + 1:1'], 'This frame only'] }],
    ['deliver', 'review', 'Upload to Review (step 05) for the client', [T + 'sequence_export'], false, 'After export, add it to the card’s review.'],
  ];
  const SECS = [['setup', 'Project & setup'], ['cut', 'Story & cutting'], ['multicam', 'Multicam'], ['pace', 'Pacing & music'], ['frame', 'Framing & motion'], ['colour', 'Colour & look'], ['gfx', 'Text & graphics'], ['audio', 'Audio'], ['deliver', 'Review & delivery']];
  const BY = {}; ITEMS.forEach(i => BY[i[1]] = i);

  // presets: which items are on, plus option overrides
  const PRESETS = {
    'Social reel (9:16)': { on: ['reframe', 'punchins', 'beatcuts', 'sfx'], off: ['retakes', 'multicam', 'angles', 'nest'], set: { sequence: { format: '9:16' }, silences: { tight: 'Tight (jump-cut)' }, beatcuts: { pace: 'Punchy (1–2 s)' }, captions: { kind: 'Burned-in, few words at a time', pos: 'Middle' } } },
    'Event recap / hype': { on: ['beatcuts', 'music', 'transitions', 'sfx', 'kenburns'], off: ['retakes'], set: { beatcuts: { pace: 'Energetic (2–3 s)' }, silences: { tight: 'Natural' }, captions: { kind: 'Burned-in, few words at a time' } } },
    'YouTube (16:9)': { on: ['retakes', 'nest', 'thumbs'], off: ['reframe', 'sfx'], set: { sequence: { format: '16:9' }, silences: { tight: 'Natural' }, beatcuts: { pace: 'Natural (3–5 s)' }, captions: { kind: 'Subtitle file only (.srt)' }, loudness: { lufs: '−14 LUFS (social / YouTube)' } } },
    'Podcast clip': { on: ['multicam', 'angles', 'retakes', 'breaths'], off: ['music', 'beatcuts', 'ducking', 'kenburns', 'transitions'], set: { silences: { tight: 'Tight (jump-cut)' }, captions: { kind: 'Burned-in, full lines' }, loudness: { lufs: '−16 LUFS (podcast)' } } },
    'Talking head / VSL': { on: ['retakes', 'punchins', 'breaths'], off: ['beatcuts', 'kenburns', 'multicam'], set: { silences: { tight: 'Tight (jump-cut)' }, fillers: { level: 'Aggressive (false starts too)' } } },
  };

  function defaults() { const items = {}; ITEMS.forEach(([, id, , , on, , opts]) => { items[id] = { on: !!on }; Object.entries(opts || {}).forEach(([k, v]) => items[id][k] = v[2]) }); return { preset: '', items, notes: '' } }
  function applyPreset(edit, name) {
    const p = PRESETS[name]; if (!p) return edit; const d = defaults();
    edit.items = d.items; (p.on || []).forEach(id => edit.items[id] && (edit.items[id].on = true)); (p.off || []).forEach(id => edit.items[id] && (edit.items[id].on = false));
    Object.entries(p.set || {}).forEach(([id, o]) => Object.assign(edit.items[id] || {}, o)); edit.preset = name; return edit;
  }
  function guessPreset(card) {
    const t = ((card && card.title) || '') + ' ' + ((card && card.type) || []).join(' ') + ' ' + ((card && card.body) || '').slice(0, 200);
    if (/podcast/i.test(t)) return 'Podcast clip'; if (/vsl|talking head|testimonial/i.test(t)) return 'Talking head / VSL';
    if (/youtube/i.test(t)) return 'YouTube (16:9)'; if (/9:16|vertical|reel|short|tiktok/i.test(t)) return 'Social reel (9:16)'; return 'Event recap / hype';
  }
  function forCard(card) { // a checklist for a card, defaulted from what the card already says
    const e = applyPreset(defaults(), guessPreset(card));
    const fmt = (card && card.storyboard && card.storyboard.format) || (card && card.look && card.look.format); if (fmt) e.items.sequence.format = fmt;
    if (card && !(card.clips || []).length) e.items.import.on = !!(card.photos || []).length;
    return e;
  }
  // the version the AI reads: only what's on, with the Cuddle tools that do it
  function exportOf(edit) {
    if (!edit) return null; const out = { preset: edit.preset || '', notes: edit.notes || '', include: [], skip: [] };
    SECS.forEach(([sec, secName]) => ITEMS.filter(i => i[0] === sec).forEach(([, id, label, tools, , hint, opts]) => {
      const v = edit.items[id] || { on: false };
      if (!v.on) { out.skip.push(label); return }
      const o = {}; Object.keys(opts || {}).forEach(k => o[opts[k][0]] = v[k]);
      out.include.push(Object.assign({ id, section: secName, task: label, cuddle_tools: tools }, Object.keys(o).length ? { options: o } : {}, hint ? { note: hint } : {}));
    }));
    out.updated = edit.updated || ''; return out;
  }

  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  // ── the simple view: the choices people actually make, grouped; setup & checks folded away ──
  const GROUPS = [
    ['Cutting', ['silences', 'fillers', 'retakes', 'breaths', 'angles']],
    ['Pacing & music', ['music', 'beatcuts', 'length']],
    ['Look of the edit', ['punchins', 'reframe', 'kenburns', 'transitions', 'grade', 'lut', 'stabilize', 'cutout', 'effects']],
    ['Text & graphics', ['captions', 'lowerthirds', 'motiongfx', 'endcard']],
    ['Audio', ['loudness', 'voice', 'ducking', 'sfx']],
    ['Delivery', ['export', 'thumbs', 'review']],
  ];
  const SHOWN = new Set(GROUPS.flatMap(g => g[1]).concat(['sequence']));
  const ADV = ITEMS.filter(i => !SHOWN.has(i[1])).map(i => i[1]);
  const SHORT = { 'Tight (jump-cut)': 'Tight', 'Fillers + repeated words': 'Fillers + repeats', 'Aggressive (false starts too)': 'Aggressive', 'Only ums & uhs': 'Ums & uhs',
    'On every speaker change': 'Each speaker', 'Every 4–8 s': 'Every 4–8 s', 'Only for emphasis': 'Emphasis only', 'I’ll add the track': 'I’ll add it', 'Pick from my music folder': 'From my folder',
    'Punchy (1–2 s)': 'Punchy', 'Energetic (2–3 s)': 'Energetic', 'Natural (3–5 s)': 'Natural', 'Slow (5 s+)': 'Slow', 'Subtle 108%': 'Subtle', 'Medium 115%': 'Medium', 'Strong 125%': 'Strong',
    'Hard cuts only': 'Hard cuts', 'From the look (wipes, whips…)': 'From the look', 'Cross dissolves': 'Dissolves', 'Match the style guide': 'Style guide', 'Natural / clean': 'Clean', 'Punchy contrast': 'Contrast',
    'Match by camera': 'By camera', 'I’ll choose': 'I’ll choose', 'Burned-in, few words at a time': 'Few words', 'Burned-in, full lines': 'Full lines', 'Subtitle file only (.srt)': '.srt only',
    'Lower third of frame': 'Low', 'Middle': 'Middle', 'Top': 'Top', '−14 LUFS (social / YouTube)': '−14 social', '−16 LUFS (podcast)': '−16 podcast', '−23 LUFS (broadcast)': '−23 broadcast',
    'Export now': 'Now', 'Queue in Media Encoder': 'Media Encoder', 'This frame only': 'This frame', '16:9 + 9:16': '+ 9:16', '16:9 + 9:16 + 1:1': '+ 9:16 + 1:1',
    'New project for this reel': 'New project', 'Add to the open project': 'Open project' };
  const short = c => SHORT[c] || c;
  function mount(el, edit, onChange, opt = {}) {
    let adv = false;
    const row = id => { const it = BY[id]; if (!it) return ''; const [, , label, tools, , hint, opts] = it; const v = edit.items[id] || {};
      return `<div class="ec-row${v.on ? ' on' : ''}">
        <div class="ec-main"><div class="ec-lab">${esc(label)}</div>${hint ? `<div class="ec-hint">${esc(hint)}</div>` : ''}
          ${v.on && opts ? Object.entries(opts).map(([k, [lab, ch]]) => `<div class="ec-chips" title="${esc(lab)}">${ch.map(c => `<button class="ec-chip${c === v[k] ? ' on' : ''}" data-eco="${id}" data-k="${k}" data-v="${esc(c)}" title="${esc(c)}">${esc(short(c))}</button>`).join('')}</div>`).join('') : ''}</div>
        <button class="ec-sw" role="switch" aria-checked="${!!v.on}" aria-label="${esc(label)}" data-eci="${id}" title="Cuddle: ${esc(tools.join(', '))}"><i></i></button></div>` };
    const draw = () => {
      const fmt = (edit.items.sequence || {}).format || '16:9';
      const advOn = ADV.filter(id => (edit.items[id] || {}).on).length;
      el.innerHTML = `<div class="ec${opt.compact ? ' compact' : ''}">
        <div class="ec-head">
          <div class="ec-q"><span>Type of edit</span><div class="ec-seg">${Object.keys(PRESETS).map(n => `<button class="${(edit.preset || '').replace(/ \(edited\)$/, '') === n ? 'on' : ''}" data-ecp="${esc(n)}">${esc(n.replace(/ \((9:16|16:9)\)$/, ''))}</button>`).join('')}</div></div>
          <div class="ec-q"><span>Frame</span><div class="ec-seg">${['16:9', '9:16', '1:1', '4:5'].map(f => `<button class="${fmt === f ? 'on' : ''}" data-ecf="${f}">${f}</button>`).join('')}</div></div>
        </div>
        <div class="ec-list">${GROUPS.map(([name, ids]) => `<section class="ec-grp"><h5>${esc(name)}</h5>${ids.map(row).join('')}</section>`).join('')}
          <section class="ec-grp adv${adv ? ' open' : ''}"><button class="ec-advh" data-ecadv><span>Setup & checks</span><em>${advOn} of ${ADV.length} on · ${adv ? 'hide' : 'show'}</em></button>${adv ? ADV.map(row).join('') : ''}</section>
          <section class="ec-grp"><h5>Notes for the edit</h5><textarea data-ecn rows="3" placeholder="Anything specific — e.g. open on the crowd chant, keep Jerry's line about his first deal…">${esc(edit.notes || '')}</textarea></section>
        </div></div>`;
    };
    const changed = () => { edit.updated = new Date().toISOString(); onChange && onChange(edit) };
    const edited = () => { if (edit.preset && !/ \(edited\)$/.test(edit.preset)) edit.preset += ' (edited)' };
    el.onclick = e => { const t = e.target;
      const p = t.closest('[data-ecp]'); if (p) { const f = (edit.items.sequence || {}).format; applyPreset(edit, p.dataset.ecp); if (f && !PRESETS[p.dataset.ecp].set?.sequence) edit.items.sequence.format = f; changed(); draw(); return }
      const f = t.closest('[data-ecf]'); if (f) { edit.items.sequence.format = f.dataset.ecf; if (f.dataset.ecf !== '16:9' && edit.items.reframe) edit.items.reframe.on = true; changed(); draw(); return }
      const s = t.closest('[data-eci]'); if (s) { const id = s.dataset.eci; (edit.items[id] = edit.items[id] || {}).on = !edit.items[id].on; edited(); changed(); draw(); return }
      const c = t.closest('[data-eco]'); if (c) { edit.items[c.dataset.eco][c.dataset.k] = c.dataset.v; edited(); changed(); draw(); return }
      if (t.closest('[data-ecadv]')) { adv = !adv; draw() } };
    el.oninput = e => { if (e.target.dataset.ecn != null) { edit.notes = e.target.value; changed() } };
    el.onchange = null;
    draw(); return { redraw: draw };
  }
  window.BM_EDIT = { ITEMS, SECS, PRESETS, defaults, applyPreset, forCard, exportOf, mount, count: e => e ? Object.values(e.items || {}).filter(v => v.on).length : 0, total: ITEMS.length };
})();
