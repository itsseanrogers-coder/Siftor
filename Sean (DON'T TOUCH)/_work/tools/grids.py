#!/usr/bin/env python3
"""Pack finished clips' 3-frame strips into review grids of 16 (2 cols x 8 rows).

grids/G_NNN.jpg + grids/G_NNN.json (clip ids, paths, durations). Clips are
taken in list order so a grid mostly stays inside one shoot. Only clips that
are not yet in any grid are packed, so this can be re-run as sheets finish.
usage: grids.py [--final]   (--final also packs a trailing partial grid)
"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
G = "/Volumes/Expansion/_Contact Sheets/Sean (DON'T TOUCH)/_work/grids"; os.makedirs(G, exist_ok=True)
F = "/System/Library/Fonts/Supplemental/"
FL = ImageFont.truetype(F + "Arial Bold.ttf", 18)
SW, SH, LAB, N = 960, 180, 26, 16

ids = [l.split("\t")[0] for l in open(os.path.join(SP, "list.tsv"))]
placed = set()
GJ = [j for j in glob.glob(os.path.join(G, "G_*.json")) if not j.endswith(".desc.json")]
for j in GJ:
    placed |= {c["id"] for c in json.load(open(j))}
ready = [i for i in ids if i not in placed and os.path.exists(os.path.join(SP, "meta", i + ".json"))]
n = len(GJ)
final = "--final" in sys.argv
while len(ready) >= N or (final and ready):
    batch, ready = ready[:N], ready[N:]
    n += 1
    img = Image.new("RGB", (SW * 2, (SH + LAB) * 8), (0, 0, 0))
    d = ImageDraw.Draw(img); info = []
    for k, cid in enumerate(batch):
        m = json.load(open(os.path.join(SP, "meta", cid + ".json")))
        x, y = (k % 2) * SW, (k // 2) * (SH + LAB)
        name = os.path.basename(m["path"])
        d.text((x + 6, y + 3), f"{cid}  {name[:46]}  {m['duration']:.0f}s  {m['orientation']}",
               font=FL, fill=(255, 220, 80))
        img.paste(Image.open(os.path.join(SP, "strips", cid + ".jpg")), (x, y + LAB))
        info.append(dict(id=cid, path=m["path"], duration=m["duration"],
                         orientation=m["orientation"], has_audio=m["has_audio"]))
    img.save(os.path.join(G, f"G_{n:03d}.jpg"), quality=80)
    json.dump(info, open(os.path.join(G, f"G_{n:03d}.json"), "w"), indent=0)
print(f"grids: {n}, unplaced ready clips: {len(ready)}")
