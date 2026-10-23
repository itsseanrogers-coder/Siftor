#!/usr/bin/env python3
"""_FOLDER OVERVIEW.jpg for every Pace 1 folder (same layout as build.py). Resumable: skips folders already done
unless --redo. Stops after ~160 s so it fits one Cowork VM command; run again to continue."""
import json, os, sys, time
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
SP = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(os.path.dirname(SP)); SHEETS = os.path.join(os.path.dirname(OUT), "Contact Sheets")
F, B, R = (("/System/Library/Fonts/Supplemental/", "Arial Bold.ttf", "Arial.ttf") if sys.platform == "darwin"
           else ("/usr/share/fonts/truetype/liberation/", "LiberationSans-Bold.ttf", "LiberationSans-Regular.ttf"))
FB, FS = ImageFont.truetype(F + B, 28), ImageFont.truetype(F + R, 15)
by = defaultdict(list)
for l in open(os.path.join(OUT, "clips.jsonl")):
    r = json.loads(l)
    if r["drive"] == "Pace 1": by[r["folder"]].append(r)
TW, TH, LB = 320, 180, 40; t0 = time.time(); made = 0; left = 0
for folder, rs in by.items():
    dst = os.path.join(SHEETS, folder, "_FOLDER OVERVIEW.jpg")
    if os.path.exists(dst) and "--redo" not in sys.argv: continue
    if time.time() - t0 > 160: left += 1; continue
    cols = min(8, max(4, int(len(rs) ** 0.5) + 1)); nrow = -(-len(rs) // cols)
    img = Image.new("RGB", (TW * cols, 60 + nrow * (TH + LB)), (12, 12, 12)); d = ImageDraw.Draw(img)
    d.text((14, 14), f"{folder[len('Pace 1/2021-2023/'):]}   ({len(rs)} clips)", font=FB, fill=(255, 255, 255))
    for k, r in enumerate(rs):
        x, y = (k % cols) * TW, 60 + (k // cols) * (TH + LB)
        img.paste(Image.open(os.path.join(OUT, "_thumbs", r["id"] + ".jpg")), (x, y))
        mm, ss = divmod(int(r["duration"]), 60)
        d.text((x + 6, y + TH + 3), r["file"][:34], font=FS, fill=(255, 220, 80))
        d.text((x + 6, y + TH + 20), f"{r['id']}  {mm}:{ss:02d}  {r['orientation']}", font=FS, fill=(180, 180, 180))
    os.makedirs(os.path.dirname(dst), exist_ok=True); img.save(dst, quality=80); made += 1
print(f"made {made}, still to do {left}, folders {len(by)}")
