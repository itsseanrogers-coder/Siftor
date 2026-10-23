#!/usr/bin/env python3
"""Pace 2 version of grids.py. Pack finished clips' 3-frame strips into review grids of 16 (2 cols x 8 rows).

grids/G_NNN.jpg + grids/G_NNN.json (clip ids, paths, durations). Clips are
taken in list order so a grid mostly stays inside one shoot. Only clips that
are not yet in any grid are packed, so this can be re-run as sheets finish.
usage: grids.py [--final]   (--final also packs a trailing partial grid)
"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(os.path.dirname(SP), "grids_p2"); os.makedirs(G, exist_ok=True)
FL = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if sys.platform == "darwin"
                        else "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 18)
SW, SH, LAB, N = 960, 180, 26, 16

ids = [l.split("\t")[0] for l in open(os.path.join(SP, "list_p2.tsv"))]
placed = set()
GJ = [j for j in glob.glob(os.path.join(G, "G_*.json")) if not j.endswith(".desc.json")]
for j in GJ:
    placed |= {c["id"] for c in json.load(open(j))}
ready = []
for i in ids:  # only the finished stretch at the front of the list, so grids stay in shoot order while sheets run
    if i in placed: continue
    if os.path.exists(os.path.join(SP, "meta_p2", i + ".json")): ready.append(i)
    elif os.path.exists(os.path.join(SP, "fail_p2", i + ".txt")): continue
    else: break
n = len(GJ)
final = "--final" in sys.argv
while len(ready) >= N or (final and ready):
    batch, ready = ready[:N], ready[N:]
    n += 1
    img = Image.new("RGB", (SW * 2, (SH + LAB) * 8), (0, 0, 0))
    d = ImageDraw.Draw(img); info = []
    for k, cid in enumerate(batch):
        m = json.load(open(os.path.join(SP, "meta_p2", cid + ".json")))
        x, y = (k % 2) * SW, (k // 2) * (SH + LAB)
        name = os.path.basename(m["path"])
        d.text((x + 6, y + 3), f"{cid}  {name[:46]}  {m['duration']:.0f}s  {m['orientation']}",
               font=FL, fill=(255, 220, 80))
        img.paste(Image.open(os.path.join(SP, "strips_p2", cid + ".jpg")), (x, y + LAB))
        info.append(dict(id=cid, path=m["path"], duration=m["duration"],
                         orientation=m["orientation"], has_audio=m["has_audio"]))
    img.save(os.path.join(G, f"G_{n:03d}.jpg"), quality=80)
    json.dump(info, open(os.path.join(G, f"G_{n:03d}.json"), "w"), indent=0)
print(f"grids: {n}, unplaced ready clips: {len(ready)}")
