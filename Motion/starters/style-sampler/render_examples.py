#!/usr/bin/env python3
"""Renders an auto preview clip (+ poster) for every atlas style that has no example yet, with the style sampler."""
import json, os, subprocess, sys, glob, shutil, time
M = "/home/claude/motion"; OUT = M + "/out/Motion/atlas/examples"; SAMP = M + "/sampler"
os.makedirs(OUT, exist_ok=True)
PRESET = {"Hand-Drawn": "hand", "Painterly": "paint", "Print": "print", "Paper & Craft": "paper", "Illustration": "illus", "Art & Design Movements": "movement",
          "Retro Digital": "retro", "Retro UI & Neon": "retroui", "Dimensional": "dim", "Light & Imaging": "light", "Data & Information": "data",
          "Generative & Type": "gen", "Cosmic & Psychedelic": "cosmic", "Popular Explainer Looks": "explainer"}
HUASHU = {"cursor-demo": "dim", "continuous-morph": "explainer", "card-montage": "dim", "kinetic-type": "gen", "modular-grid": "movement", "data-story": "data", "mechanism": "data",
          "system-diagram": "data", "flat-world": "explainer", "editorial-collage": "print", "hand-drawn": "hand", "character": "explainer", "3d-object": "dim",
          "generative-field": "gen", "liquid-glass": "dim", "photo-led": "photo", "showreel": "light", "retro-digital": "retro", "art-styles": "paint", "talking-head": "photo"}
# a few specific looks get a better-fitting preset than their category's
SPECIFIC = {"kinetic-type": "gen", "editorial-essay-collage": "print", "manim-style-math": "data", "product-launch-reveal": "light", "tech-glow-explainer": "light",
            "isometric-pastel": "dim", "papercraft-models": "paper", "whiteboard-explainer": "hand", "flat-vector-science": "explainer", "kawaii-anime": "explainer",
            "editorial-chart": "data", "transit-map": "data", "neon-sign-at-night": "retroui", "synthwave-outrun": "retroui"}
atlas = json.load(open(M + "/out/Motion/atlas/atlas.json"))
only = set(sys.argv[1:])
env = dict(os.environ, OM_CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
for e in atlas:
    i = e["id"]
    if only and i not in only: continue
    if not only and os.path.exists(f"{OUT}/{i}.mp4"): continue
    pre = SPECIFIC.get(i) or (HUASHU.get(i[7:]) if i.startswith("huashu-") else PRESET.get(e["category"], "explainer"))
    ent = {"name": e["name"], "category": e["category"], "palette": e.get("palette") or [], "display": e.get("display") or "Inter", "body": e.get("body") or "Inter", "preset": pre}
    if i.startswith("huashu-"): ent.update(palette=["#0b0b0d", "#d79f46", "#f5f4f1", "#2f6f8f"], display="Anton" if pre in ("gen",) else "Inter", body="Inter")
    open(SAMP + "/entry.js", "w").write("window.ENTRY=" + json.dumps(ent) + ";")
    shutil.rmtree(SAMP + "/out", ignore_errors=True)
    t = time.time()
    r = subprocess.run(["node", M + "/huashu-motion/cli/om.js", "render", SAMP, "--fps", "24", "--silent"], env=env, capture_output=True, text=True)
    vids = glob.glob(SAMP + "/out/*.mp4")
    if r.returncode or not vids: print("FAIL", i, r.stdout[-400:], r.stderr[-400:], flush=True); continue
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", vids[0], "-vf", "scale=960:-2", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", f"{OUT}/{i}.mp4"], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", "3.2", "-i", vids[0], "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", f"{OUT}/{i}.jpg"], check=True)
    print(f"ok {i} ({pre}) {time.time()-t:.1f}s", flush=True)
