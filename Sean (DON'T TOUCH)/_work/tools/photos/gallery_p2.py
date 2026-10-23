#!/usr/bin/env python3
"""Web-size + thumbnail copies of every EDITED photo on the Pace 2 drive (same format as gallery.py).
Originals are only read. Output: <library>/_photos/{web,thumb}/S#####.jpg + ../pace2_photos.json"""
import json, os, re
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps
ROOT = "/Volumes/Pace 2/Pace Morby Media/2024"
OUT = os.path.expanduser("~/Desktop/Bahlman Media App/Sean (DON'T TOUCH)/_photos")
HERE = os.path.dirname(os.path.abspath(__file__))

def shoot_of(p):
    for part in p.split("/"):
        if re.match(r"\d{2}\.\d{2}\.\d{2}", part):
            return part
    return p.split("/")[2] if p.count("/") > 2 else p.split("/")[0]

def work(a):
    pid, rel = a
    web, th = os.path.join(OUT, "web", pid + ".jpg"), os.path.join(OUT, "thumb", pid + ".jpg")
    try:
        im = Image.open(os.path.join(ROOT, rel))
        taken = (im.getexif().get(306) or "")
        im.draft("RGB", (2048, 2048)); im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        if not os.path.exists(web):
            x = im.copy(); x.thumbnail((2048, 2048), Image.LANCZOS); x.save(web, quality=84, progressive=True)
        if not os.path.exists(th):
            x = im.copy(); x.thumbnail((560, 560), Image.LANCZOS); x.save(th, quality=80)
        return dict(id=pid, w=w, h=h, taken=taken)
    except Exception as e:
        return dict(id=pid, err=repr(e))

if __name__ == "__main__":
    for d in ("web", "thumb"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    paths = [l.strip() for l in open(os.path.join(HERE, "pace2_edited.txt")) if l.strip()]
    # same photo exported twice into one shoot (e.g. Edited + Export) -> keep the first
    seen, items = set(), []
    for p in paths:
        k = (shoot_of(p), os.path.basename(p).lower())
        if k in seen: continue
        seen.add(k); items.append((f"S{len(items) + 1:05d}", p))
    print(len(items), "unique edited photos", flush=True)
    res = {}
    with ProcessPoolExecutor(6) as ex:
        for n, r in enumerate(ex.map(work, items, chunksize=8)):
            res[r["id"]] = r
            if n % 500 == 0: print(n, flush=True)
    rows = []
    for pid, rel in items:
        r = res.get(pid, {})
        if not r or "err" in r: continue
        rows.append(dict(id=pid, path=rel, file=os.path.basename(rel), shoot=shoot_of(rel), folder=os.path.basename(os.path.dirname(rel)),
                         w=r["w"], h=r["h"], taken=r["taken"], drive="Pace 2", root=ROOT + "/"))
    json.dump(rows, open(os.path.join(os.path.dirname(HERE), "pace2_photos.json"), "w"))
    print("done", len(rows), "ok,", sum(1 for r in res.values() if "err" in r), "failed")
