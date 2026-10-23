#!/usr/bin/env python3
"""Bring the 2026-10-06 My Book catalog (footage.db) into tonight's library format.

Writes <library>/_work/mybook_rows.json (one row per clip, same fields build.py emits)
and a 320x180 thumbnail per clip into <library>/_thumbs/M*.jpg.
Clips that already exist on Expansion (same file name + duration inside the same event)
are dropped so nothing shows up twice."""
import json, os, re, sqlite3
from PIL import Image

MB_ROOT = "/Volumes/My Book/31892AZ/Bahlman Media/"
LIB = os.path.expanduser("~/Desktop/Bahlman Media App")
OUT = os.path.join(LIB, "Library")
SRC_DB = MB_ROOT + "_Contact Sheets/footage.db"
THUMB_SRC = os.path.join(OUT, "_work", "mybook_thumbs_src")

# same event, named differently on each drive -> show as one event
ALIASES = {
    "10.17.25 Immersion 5": "10.17.25 Immersion 5 | Bahlman",
    "06.18.25 Karlton Dennis - Tax Alchemy Event": "06.18.25 Tax Alchemy Newport Beach Event",
}


def people_bucket(n):
    n = n or 0
    return "0" if n <= 0 else "1" if n == 1 else "2-5" if n <= 5 else "6-20" if n <= 20 else "crowd"


def content_of(category, shot, desc, tags):
    t = f"{desc} {tags}".lower()
    rules = [("drone", ("drone", "aerial")), ("podcast", ("podcast",)), ("testimonial", ("testimonial",)),
             ("interview", ("interview",)), ("event-stage", ("stage", "keynote", "speaker", "presenter", "presentation")),
             ("event-crowd", ("crowd", "audience", "applause", "cheer")), ("event-dinner", ("dinner", "banquet", "dining")),
             ("real-estate", ("kitchen", "property", "real estate", "listing", "renovat", "construction", "walkthrough")),
             ("talking-head", ("talking head", "talks to camera", "to camera")),
             ("event-networking", ("networking", "mingl", "conversation", "chatting"))]
    for name, keys in rules:
        if any(k in t for k in keys):
            return name
    return "broll" if category == "broll" else "event-networking"


def date_from_name(s):
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{2})", s or "")
    return f"20{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def fit(src, dst):
    canvas = Image.new("RGB", (320, 180), (18, 18, 18))
    im = Image.open(src).convert("RGB"); im.thumbnail((320, 180), Image.LANCZOS)
    canvas.paste(im, ((320 - im.width) // 2, (180 - im.height) // 2)); canvas.save(dst, quality=78)


def main():
    x = sqlite3.connect(os.path.join(OUT, "footage.db"))
    on_expansion = {(f.lower(), round(d), sh) for f, d, sh in x.execute("select file, duration, shoot from clips")}
    src = sqlite3.connect(SRC_DB)
    src.row_factory = sqlite3.Row
    # events without a date in their name: use the earliest recording date of their clips
    first_rec = {}
    for sh, cr in src.execute("select shoot, min(created) from clips where created is not null and created != '' group by shoot"):
        first_rec[sh] = (cr or "")[:10] or None
    rows, dropped, missing_thumb = [], 0, 0
    os.makedirs(os.path.join(OUT, "_thumbs"), exist_ok=True)
    for r in src.execute("select * from clips order by id"):
        shoot = ALIASES.get(r["shoot"], r["shoot"])
        if (r["filename"].lower(), round(r["duration"] or 0), shoot) in on_expansion:
            dropped += 1
            continue
        cid = "M" + r["id"]
        th = os.path.join(OUT, "_thumbs", cid + ".jpg")
        tsrc = os.path.join(THUMB_SRC, r["sheet"])
        if not os.path.exists(th):
            if os.path.exists(tsrc):
                fit(tsrc, th)
            else:
                missing_thumb += 1
        w, h = r["width"] or 0, r["height"] or 0
        rows.append(dict(
            id=cid, file=r["filename"], path=r["path"], abs_path=MB_ROOT + r["path"], drive="My Book",
            folder=os.path.dirname(r["path"]), shoot=shoot,
            shoot_date=r["shoot_date"] or date_from_name(shoot) or first_rec.get(r["shoot"]), duration=r["duration"] or 0, width=w, height=h,
            orientation=r["orientation"] or ("vertical" if h > w else "horizontal"), fps=r["fps"], codec=r["codec"],
            has_audio=None, size_gb=round((r["size_mb"] or 0) / 1000, 3), created=r["created"],
            content=content_of(r["category"], r["shot"], r["description"] or "", r["tags"] or ""),
            shot=r["shot"] or "", setting=r["location"] or "", people=people_bucket(r["people"]),
            description=r["description"] or "", tags=r["tags"] or "", quality=r["flags"] or "",
            sheet="My Book/" + r["sheet"]))
    json.dump(rows, open(os.path.join(OUT, "_work", "mybook_rows.json"), "w"))
    print(f"{len(rows)} clips imported, {dropped} already on Expansion, {missing_thumb} without thumbnail")


if __name__ == "__main__":
    main()
