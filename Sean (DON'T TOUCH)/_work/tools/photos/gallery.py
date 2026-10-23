#!/usr/bin/env python3
"""Web-size + thumbnail copies of every EDITED photo, for the library's photo galleries.
Originals are only read. Output: _Contact Sheets/_photos/{web,thumb}/<id>.jpg + _work/photos.json"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps
ROOT = "/Volumes/Expansion"
OUT = os.path.join(ROOT, "_Contact Sheets", "Sean (DON'T TOUCH)", "_photos")
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.dirname(HERE)
CLIENTS = json.load(open(os.path.join(SP, "clients.json")))
EDITED = re.compile(r"/(Final Edits|Edited|Export)", re.I)

def shoot_of(p):
    for part in p.split("/"):
        if re.match(r"\d{2}\.\d{2}\.\d{2}", part):
            return part
    return p.split("/")[0]

def owner(shoot):
    for e in CLIENTS:
        if re.search(e[0], shoot, re.I):
            return e[1], (e[2] if len(e) > 2 else e[1])
    return "Other", "Other"

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
    paths = sorted(l.strip().lstrip("./") for l in open(os.path.join(HERE, "all_photos.txt")))
    paths = [p for p in paths if EDITED.search("/" + p) and p.lower().endswith((".jpg", ".jpeg")) and "Animated GIF" not in p]
    items = [(f"P{i + 1:05d}", p) for i, p in enumerate(paths)]
    print(len(items), "edited photos", flush=True)
    res = {}
    with ProcessPoolExecutor(6) as ex:
        for n, r in enumerate(ex.map(work, items, chunksize=8)):
            res[r["id"]] = r
            if n % 250 == 0: print(n, flush=True)
    rows = []
    for pid, rel in items:
        r = res.get(pid, {})
        if "err" in r or not r: continue
        shoot = shoot_of(rel); client, brand = owner(shoot)
        rows.append(dict(id=pid, path=rel, file=os.path.basename(rel), client=client, brand=brand, shoot=shoot,
                         folder=os.path.basename(os.path.dirname(rel)), w=r["w"], h=r["h"], taken=r["taken"]))
    json.dump(rows, open(os.path.join(SP, "photos.json"), "w"))
    print("done", len(rows), "ok,", sum(1 for r in res.values() if "err" in r), "failed")
