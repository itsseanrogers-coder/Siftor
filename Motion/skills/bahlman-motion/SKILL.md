---
name: bahlman-motion
description: Build Bahlman Media reels from their edit package — the edit checklist (every task with the Cuddle tools that do it), the reel's look, the client style guide and the storyboard — making graphics with HyperFrames/huashu-motion or Remotion and the edit in Premiere through Cuddle. Use for "build <card> in Premiere", "make the graphics for <card>", "draft a style guide for <client>", or anything about a Bahlman reel's edit, look or motion graphics.
---

# Bahlman motion

The Bahlman app decides the look **before** the edit. Three things hold it, all under `~/Desktop/Bahlman Media App/Motion/` and readable through the **bahlman-footage** connector:

| What | Where | Connector tools |
|---|---|---|
| **Style Atlas** — every visual style we can make, each with a prompt (86 named looks, huashu-motion's 20 motion languages, Sean's own references) | `Motion/atlas/` | `search_atlas`, `get_atlas_style` |
| **Client style guides** — palette, type, personality, motion languages, atlas looks, how each graphic looks and which engine makes it, do/don't | `Motion/styles/<client>.json` | `list_styles`, `get_style`, `save_style` |
| **Edit packages** — one per Pipeline card: the edit checklist (tasks + the Cuddle tools for each), the reel's look, and the storyboard beats with timing, footage (drive path), the graphic each beat needs, notes | `Motion/storyboards/<card>.json` | `list_storyboards`, `get_storyboard` |
| **Design & build knowledge** — huashu-motion (director, languages, rhythm, colour, type…) and Remotion's skills | `Motion/skills/` | `motion_knowledge` |

Footage itself: `search_footage`, `get_clip`, `list_people` (same connector). Premiere: the **Cuddle** tools (load the `cuddle-premiere-operator` skill before using them).

## 1. Know what you're making
- From a card: `get_storyboard("<title or card id>")` returns the reel's **edit package**: the edit checklist (`edit`), the beats, the client's style guide and the reel's **look**.
- **The look** is the atlas style Sean picked for this reel in step 03 · Style (`look`: name, about, palette, type, texture, motion, engine, the prompt already filled in for this reel, and its example video — `look.ref` links Futurepedia's example). It is the target: every graphic in the reel follows it, in the client's brand colours and fonts where the style guide has them. A beat's `graphic.atlas` can name a different look for that one graphic.
- No storyboard yet: say so and suggest Sean presses **Build from the shot list** on the card's Storyboard section — or work from the request directly, writing the beats in your reply first.

## 2. Settle the look (never skip)
1. `get_style(client)`.
2. **Approved** → follow it exactly: palette, type, motion languages, `graphics[kind].look` and `.engine`, do/don't. Its `atlas_styles` are the reference looks — read them with `get_atlas_style`.
3. **Draft** → use it, but tell Sean it's still a draft and anything you'd change.
4. **Missing** → draft one with huashu-motion's director method, from real material:
   - Read `motion_knowledge("huashu:director")` §1–§3 and the chart in `motion_knowledge("huashu:library/README")`.
   - Look at the client's real footage first (`search_footage` with `client=`, contact sheets / thumbnails under `Library/_thumbs/`) — stage screens, slides, logos, merch. The palette and type come from what you see, never invented; say which values are sampled/approximate.
   - Score the five personality sliders (−2…+2) from that evidence and write the one-sentence brief.
   - Pick 1–2 motion languages and 1–3 atlas looks (`search_atlas`) that fit the message shape × personality.
   - For every graphic kind (opener, title, lower-third, captions, stat, quote, transition, end-card) write how it looks and which engine makes it.
   - `save_style({...})` with `status: "draft"` and the same fields as `Motion/styles/owners-club.json`, then ask Sean to review it on **Step 03 · Style → Client styles**.

## 3. Make each beat's graphic
For every beat with a `graphic`: kind → `style.graphics[kind]` (look + engine); the reel's `look` (or the beat's `graphic.atlas`) is the target — its prompt, or `get_atlas_style(id, what, text, format, seconds)` for another look, fills in the details. Text comes from the beat (`graphic.text`, `graphic.detail`); captions without text come from the clip's transcript (`search_spoken` / `get_clip`). Length = the beat's `len`. Frame = the storyboard's `format` (1920×1080 or 1080×1920).

**HyperFrames / huashu-motion** (openers, transitions, end cards, anything bespoke):
- Work in `Motion/work/<card>/<nn>-<kind>/`. `Motion/skills/huashu-motion/bin/om new <dir>` (or `npx huashu-motion new`), then follow `Motion/skills/huashu-motion/SKILL.md` and its contract: one paused GSAP timeline, composition variables for every text and colour, deterministic.
- Client work: `data-om-signature="off"` on `<html>`.
- `om check`, then `om still <dir> --at …` and look at the frames before rendering.
- Render the overlay: `om render <dir> --transparent --format mov` (ProRes 4444 with alpha). A starter in the Bahlman house look is in `Motion/starters/huashu-event-opener/`.
- If HyperFrames is installed instead, the same HTML composition renders with it.

**Remotion** (lower thirds, titles, captions, stats, quotes — repeatable, data-driven):
- Starter project: `Motion/starters/remotion/` (compositions `lower-third`, `title-card`, `captions`, `stat`, `end-card`; brand kit in `src/shared.tsx`). Copy it to `Motion/work/remotion/` once (`npm install`), restyle the components to the style guide (colours, fonts from `Motion/fonts/`, motion), then render per beat:
  `npx remotion render src/index.ts lower-third <out>.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --props='{"name":"…","role":"…","format":"9:16","seconds":3,"brand":{…}}'`
- Read `motion_knowledge("remotion:remotion-best-practices")` and the topic files it routes to (captions, timing, text highlights, transitions) when writing new components.
- Remotion is free for individuals and small teams; a larger company needs its licence.

Put every render in `Motion/renders/<card>/<nn>-<kind>.mov` and write `Motion/renders/<card>/manifest.json`:
`{"card":…, "format":…, "beats":[{"n":1,"at":0,"len":3,"footage":"/Volumes/…","graphic":"Motion/renders/<card>/01-opener.mov"}]}`.
Show Sean a still or two of each graphic before going into Premiere.

## 4. Build the edit in Premiere (Cuddle), following the edit checklist
The edit package's `edit` is the checklist Sean set in step 03 ①: `include` is the list of tasks to do — each with its `section`, `task`, `options` (e.g. silences: Tight / Natural / Loose; captions: burned-in or .srt; loudness target) and `cuddle_tools`, the Cuddle tools that do it — and `skip` is what he does not want. `notes` are his own instructions and win over everything else. No checklist → ask, or use the defaults for the reel type and say which.

Load the cuddle-premiere-operator skill (and `cuddle_skills_list` → the audio / video-motion / frame-inspection skills a task needs) and follow its contract: inspect first, explicit ids, pass revisions, never save without asking. Then work through `include` in this order, using the tools each task names:
1. **Project & setup** — project/bins, import the beats' footage + photos + rendered overlays (drives must be mounted; list missing files and stop), organise, create the sequence in the checklist's frame, clone before big changes.
2. **Story & cutting** — transcribe, choose soundbites (storyboard notes + Ideate prompt), assemble the rough cut from the beats (`premiere_sequence_assemble_ranges`, V1, `dest: "chain"`), then silences / fillers / retakes / breaths on real pauses (`cuddle_media_speech_edges`), then check every seam.
3. **Multicam** if on.
4. **Pacing & music** — analyse the track, cut on the beat at the chosen pace, hit the target length.
5. **Framing & motion** — reframe for vertical using face positions, punch-ins at the chosen zoom, push-ins on photos, stabilise, cut-outs.
6. **Colour & look** — LUTs, grade toward the reel's look / style guide, adjustment layer, effects.
7. **Text & graphics** — captions styled from the look (font, colour, stroke via `premiere_text_style`), lower thirds (names from the beats' `who`), the rendered motion graphics on V2 at each beat's `at` (`videoTrack: 1`, `dest: <at>`, `mode: "overwrite"`), transitions, end card.
8. **Audio** — loudness to the target, voice clean-up, channel fixes, ducking music under speech, fades, SFX.
9. **Review & delivery** — markers with each beat's notes, look at frames at every beat (cuddle-frame-inspection) and an audio check render; export / Review upload only if those items are on — otherwise stop at a finished timeline.
Report what was done per section, what was skipped and why, and what's left for the editor.

## Rules
- The look comes from the style guide and the atlas, never from habit. Don't use the gold Bahlman house style on a client that has its own brand.
- Real names, logos and text only — from People, the card and the client's material. Never invent a role or a statistic; leave it blank and ask.
- Only write inside `Motion/` (and Premiere, through Cuddle). Footage drives are read-only.
