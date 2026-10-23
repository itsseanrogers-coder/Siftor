# Motion — Step 03 · Style

The look of every reel, decided before the edit.

- **atlas.html** — the Style Atlas: 106 styles (86 named looks + huashu-motion's 20 motion languages) with a prompt each, plus your own references. Example clips in `atlas/examples/` are auto previews made by `starters/style-sampler` from each style's palette, type and motion — swap in real examples as styles get used.
- **index.html** — client style guides (`styles/<client>.json`): palette, type, personality, motion languages, atlas looks, how each graphic looks and which engine makes it.
- **storyboards/** — written by the Storyboard section on Pipeline cards (through the Library server).
- **skills/** — the design and build knowledge: `huashu-motion` (MIT), `remotion` (Remotion's agent skills), `bahlman-motion` (how Claude uses all of this).
- **starters/** — `remotion` (lower third, title card, captions, stat, end card), `huashu-event-opener`, `style-sampler`.
- **build.py** — rebuilds `knowledge/`, `atlas/atlas.js`, `styles/styles.js`, `fonts/fonts.css`. Run it after adding a skill or editing `atlas_data.py`.

Style names in the atlas follow Futurepedia's AI Style Atlas (https://www.futurepedia.io/resources/ai-style-atlas/view); the descriptions, palettes and prompts are our own.
Fonts in `fonts/` are open-licence (SIL OFL), from huashu-motion.
