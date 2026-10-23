#!/usr/bin/env python3
"""Builds Motion/knowledge/knowledge.json (+ knowledge.js), Motion/styles/styles.js and Motion/fonts/fonts.css for the app pages: an index of the design knowledge in the
motion skills under Motion/skills/ — huashu-motion's motion languages, formats, techniques and guides (colour, rhythm,
type…), and Remotion's build guides — so style guides, the storyboard and AI tools can point at the exact file to read.
Run it again after adding or updating a skill. Other motion skills: drop the folder into Motion/skills/<name>/ and add
a reader below (or it is listed generically from its SKILL.md)."""
import json, os, re, glob, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SK = os.path.join(HERE, "skills")
rel = lambda p: os.path.relpath(p, HERE).replace(os.sep, "/")


def front(md):
    m = re.match(r"---\n(.*?)\n---", md, re.S)
    out = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line and not line.startswith(" "):
                k, v = line.split(":", 1); out[k.strip()] = v.strip().strip('"')
    return out


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def huashu():
    base = os.path.join(SK, "huashu-motion")
    ref = os.path.join(base, "references")
    if not os.path.isdir(ref): return None
    lib = open(os.path.join(ref, "library", "README.md"), encoding="utf-8").read()
    langs = []
    for line in lib.splitlines():
        m = re.match(r"\|\s*\[([\w-]+)\]\((languages/[\w-]+\.md)\)\s*\|(.*)", line)
        if m:
            c = cells(line)
            langs.append({"id": m.group(1), "says": c[1], "best_for": c[2], "template": c[3].strip("`"),
                          "file": rel(os.path.join(ref, "library", m.group(2)))})
    # the message-shape × personality chart
    chart = []
    rows = [l for l in lib.split("## Choosing")[1].splitlines() if l.startswith("| **")] if "## Choosing" in lib else []
    for l in rows:
        c = cells(l)
        chart.append({"shape": c[0].strip("*"), "precise": c[1], "calm_premium": c[2], "playful": c[3], "human": c[4]})
    fm = open(os.path.join(ref, "library", "formats.md"), encoding="utf-8").read()
    formats = [{"name": m.group(1).strip(), "length": m.group(2).strip(), "file": rel(os.path.join(ref, "library", "formats.md")) + "#" + m.group(1).strip().lower().replace(" ", "-").replace("/", "")}
               for m in re.finditer(r"^## (.+?) · (.+)$", fm, re.M)]
    tq = open(os.path.join(ref, "library", "techniques.md"), encoding="utf-8").read()
    techniques = [{"section": s, "file": rel(os.path.join(ref, "library", "techniques.md"))} for s in re.findall(r"^## (.+)$", tq, re.M)]
    guides = []
    for f in sorted(glob.glob(os.path.join(ref, "*.md"))):
        if os.path.basename(f) in ("about-author.md", "provenance.md"): continue
        t = open(f, encoding="utf-8").read()
        h = re.search(r"^# (.+)$", t, re.M)
        guides.append({"id": os.path.basename(f)[:-3], "title": h.group(1) if h else os.path.basename(f), "file": rel(f)})
    skill = open(os.path.join(base, "SKILL.md"), encoding="utf-8").read()
    return {"name": "huashu-motion", "role": "design", "version": front(skill).get("metadata", "") or re.search(r'version: "([^"]+)"', skill).group(1),
            "license": "MIT (bundled GSAP keeps its own licence)", "repo": "https://github.com/alchaincyf/huashu-motion",
            "skill": rel(os.path.join(base, "SKILL.md")), "languages": langs, "chart": chart, "formats": formats,
            "techniques": techniques, "guides": guides}


def remotion():
    base = os.path.join(SK, "remotion")
    if not os.path.isdir(base): return None
    skills = []
    for d in sorted(glob.glob(os.path.join(base, "*", "SKILL.md"))):
        fmd = front(open(d, encoding="utf-8").read())
        topics = sorted(os.path.basename(x)[:-3] for x in glob.glob(os.path.join(os.path.dirname(d), "*.md")) if not x.endswith("SKILL.md") and not x.endswith("REFERENCE.md"))
        skills.append({"id": fmd.get("name") or os.path.basename(os.path.dirname(d)), "about": fmd.get("description", ""), "file": rel(d), "topics": topics})
    return {"name": "remotion", "role": "build", "license": "Remotion skills (see remotion.dev — Remotion itself needs a company licence above its free tier)",
            "repo": "https://github.com/remotion-dev/skills", "skills": skills}


def others():
    out = []
    for d in sorted(glob.glob(os.path.join(SK, "*", "SKILL.md"))):
        name = os.path.basename(os.path.dirname(d))
        if name in ("huashu-motion",): continue
        fmd = front(open(d, encoding="utf-8").read())
        out.append({"id": fmd.get("name") or name, "about": fmd.get("description", ""), "file": rel(d)})
    return out


def fonts():
    """fonts/fonts.css + the family list, from the bundled OFL fonts (file names like AlfaSlabOne-400.woff, Inter-var.woff)."""
    css, fams = [], {}
    for f in sorted(glob.glob(os.path.join(HERE, "fonts", "*.woff"))):
        b = os.path.basename(f)[:-5]
        m = re.match(r"(.+?)-(\d+|var)(i?)$", b)
        if not m: continue
        fam = re.sub(r"(?<=[a-z])(?=[A-Z0-9])", " ", m.group(1)).replace("EBGaramond", "EB Garamond").replace("IMFell English", "IM Fell English")
        w = "100 900" if m.group(2) == "var" else m.group(2)
        css.append(f'@font-face{{font-family:"{fam}";src:url("{os.path.basename(f)}") format("woff");font-weight:{w};font-style:{"italic" if m.group(3) else "normal"};font-display:swap}}')
        fams.setdefault(fam, []).append(os.path.basename(f))
    open(os.path.join(HERE, "fonts", "fonts.css"), "w").write("\n".join(css) + "\n")
    return sorted(fams)


def styles():
    """styles/styles.js — every style guide in one file, for pages opened straight from disk."""
    out = []
    for f in sorted(glob.glob(os.path.join(HERE, "styles", "*.json"))):
        try: out.append(json.load(open(f, encoding="utf-8")))
        except Exception as e: print("skipped", f, e)
    open(os.path.join(HERE, "styles", "styles.js"), "w", encoding="utf-8").write("window.BM_MOTION_STYLES=" + json.dumps(out, ensure_ascii=False) + ";\n")
    return out


def atlas(k):
    """atlas/atlas.json + atlas.js — the Style Atlas: every visual style the AI tools can be asked to make, with a prompt each.
    Sources: atlas_data.py (86 styles named after Futurepedia's AI Style Atlas — our own descriptions and prompts),
    huashu-motion's motion languages (its library files), and your own references in atlas/custom/*.json."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("atlas_data", os.path.join(HERE, "atlas_data.py")); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
    slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    ex_dir = os.path.join(HERE, "atlas", "examples")
    def example(i):
        for ext in ("mp4", "webm", "gif", "jpg", "png"):
            if os.path.exists(os.path.join(ex_dir, f"{i}.{ext}")): return f"atlas/examples/{i}.{ext}"
        return ""
    def poster(i):
        return f"atlas/examples/{i}.jpg" if os.path.exists(os.path.join(ex_dir, f"{i}.jpg")) and os.path.exists(os.path.join(ex_dir, f"{i}.mp4")) else ""
    ENG = {"hyperframes": "a single HTML composition (HTML + CSS + GSAP on one paused timeline, deterministic: no clock, no unseeded random) that HyperFrames or huashu-motion can render — `om render <dir> --transparent --format mov` for an overlay",
           "remotion": "a Remotion component driven by props (text, colours, format, seconds), rendered as a transparent ProRes 4444 overlay"}
    out = []
    refs = {}
    try: refs = json.load(open(os.path.join(HERE, "atlas", "futurepedia_refs.json"), encoding="utf-8"))   # their example videos, shown from their site
    except Exception: pass
    for n, (name, cat, about, pal, disp, body, tex, mot, best, eng) in enumerate(A.STYLES, 1):
        i = slug(name)
        prompt = (f'Make a {{seconds}}-second {{format}} motion graphic for {{what}} in the "{name}" style.\n'
                  f"Look: {about}\nPalette: {', '.join(pal)} — use the client's brand colours from their style guide instead where they have them.\n"
                  f"Type: {disp} for headlines, {body} for supporting text.\nTexture: {tex}.\nMotion: {mot}.\n"
                  f"Text on screen: {{text}}\nBuild it as {ENG[eng]}. Keep every word readable on a phone and inside the safe areas for {{format}}.")
        out.append({"id": i, "n": n, "name": name, "category": cat, "about": about, "palette": pal, "display": disp, "body": body,
                    "texture": tex, "motion": mot, "best_for": best, "engine": eng, "prompt": prompt, "example": example(i), "poster": poster(i), "auto_example": True,
                    "source": "Bahlman atlas · style named after Futurepedia's AI Style Atlas", "source_url": "https://www.futurepedia.io/resources/ai-style-atlas/view",
                    "ref": refs.get(name) or None})
    h = k.get("huashu") or {}
    for lang in h.get("languages", []):
        f = os.path.join(HERE, lang["file"]); txt = open(f, encoding="utf-8").read() if os.path.exists(f) else ""
        first = re.split(r"\n## ", txt)[0]
        paras = [p.strip() for p in first.split("\n\n")[1:] if p.strip() and not p.strip().startswith("**")]
        para = re.sub(r"\s+", " ", paras[0])[:420] if paras else ""
        use = re.search(r"\*\*Use when:\*\*\s*(.+?)(\*\*Avoid when:\*\*\s*(.+?))?(\n\n|$)", txt, re.S)
        sig = re.findall(r"^\d+\.\s+(.+)$", txt.split("## Signature")[1].split("\n## ")[0], re.M)[:4] if "## Signature" in txt else []
        cam = re.search(r"## Camera[^\n]*\n(.+?)(\n## |$)", txt, re.S)
        i = "huashu-" + lang["id"]
        prompt = (f'Make a {{seconds}}-second {{format}} motion graphic for {{what}} in huashu-motion\'s "{lang["id"]}" motion language — {lang["says"].lower()}.\n'
                  f"Read and follow {lang['file']} (signature moves, camera, rhythm, easing, look) and the huashu-motion contract; start from its \"{lang['template']}\" template.\n"
                  f"Use the client's style guide for palette and type.\nText on screen: {{text}}\nBuild it as {ENG['hyperframes']}. Keep every word readable on a phone and inside the safe areas for {{format}}.")
        out.append({"id": i, "n": len(out) + 1, "name": lang["id"].replace("-", " ").title(), "category": "huashu-motion languages", "about": para or lang["says"],
                    "says": lang["says"], "use_when": re.sub(r"\s+", " ", use.group(1)).strip() if use else lang["best_for"], "avoid_when": re.sub(r"\s+", " ", use.group(3)).strip() if use and use.group(3) else "",
                    "signature": sig, "motion": re.sub(r"\s+", " ", cam.group(1)).strip()[:400] if cam else "", "palette": [], "display": "", "body": "",
                    "texture": "", "best_for": lang["best_for"], "engine": "hyperframes", "template": lang["template"], "prompt": prompt, "example": example(i), "poster": poster(i), "auto_example": True,
                    "knowledge": lang["file"], "source": "huashu-motion (MIT)", "source_url": "https://github.com/alchaincyf/huashu-motion"})
    for f in sorted(glob.glob(os.path.join(HERE, "atlas", "custom", "*.json"))):
        try: e = json.load(open(f, encoding="utf-8")); e.setdefault("category", "Your references"); e["n"] = len(out) + 1; out.append(e)
        except Exception as ex: print("skipped", f, ex)
    os.makedirs(os.path.join(HERE, "atlas"), exist_ok=True)
    json.dump(out, open(os.path.join(HERE, "atlas", "atlas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, "atlas", "atlas.js"), "w", encoding="utf-8").write("window.BM_ATLAS=" + json.dumps(out, ensure_ascii=False) + ";\n")
    return out


PERSONALITY = [  # huashu-motion director §3 — score each −2…+2 from evidence; the sentence is the brief
    {"id": "precise_playful", "left": "precise", "right": "playful", "moves": "easing (hard ease-out → springs with overshoot), shape language (grids → blobs)"},
    {"id": "calm_energetic", "left": "calm", "right": "energetic", "moves": "tempo (80–100 → 125–150 BPM), shot length, cut density"},
    {"id": "premium_accessible", "left": "premium", "right": "accessible", "moves": "negative space, type scale contrast, colour count, how much is on screen"},
    {"id": "technical_human", "left": "technical", "right": "human", "moves": "monospace / code / diagrams vs photos, faces, hand-drawn"},
    {"id": "established_new", "left": "established", "right": "new", "moves": "restraint and continuity vs bold, surprising"},
]
GRAPHICS = [  # the graphics a Bahlman reel uses; each style guide says how each one looks and which engine makes it
    {"id": "opener", "name": "Opener / title sequence", "engine": "huashu-motion"},
    {"id": "title", "name": "Title / chapter card", "engine": "remotion"},
    {"id": "lower-third", "name": "Lower third (name + role)", "engine": "remotion"},
    {"id": "captions", "name": "Captions", "engine": "remotion"},
    {"id": "stat", "name": "Stat / number callout", "engine": "remotion"},
    {"id": "quote", "name": "Pull quote", "engine": "remotion"},
    {"id": "transition", "name": "Transition / sting", "engine": "huashu-motion"},
    {"id": "end-card", "name": "End card / logo", "engine": "huashu-motion"},
    {"id": "custom", "name": "Custom (describe it)", "engine": "either"},
]

if __name__ == "__main__":
    k = {"built": datetime.datetime.now().isoformat(timespec="seconds"), "personality": PERSONALITY, "graphics": GRAPHICS,
         "huashu": huashu(), "remotion": remotion(), "skills": others(), "fonts": fonts()}
    os.makedirs(os.path.join(HERE, "knowledge"), exist_ok=True)
    json.dump(k, open(os.path.join(HERE, "knowledge", "knowledge.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, "knowledge", "knowledge.js"), "w", encoding="utf-8").write("window.BM_MOTION_KNOWLEDGE=" + json.dumps(k, ensure_ascii=False) + ";\n")
    h = k["huashu"] or {}; r = k["remotion"] or {}
    print(f"{len(h.get('languages', []))} motion languages, {len(h.get('formats', []))} formats, {len(h.get('guides', []))} guides · {len(r.get('skills', []))} Remotion skills · {len(k['skills'])} other skills · {len(k['fonts'])} fonts · {len(styles())} style guides · {len(atlas(k))} atlas styles")
