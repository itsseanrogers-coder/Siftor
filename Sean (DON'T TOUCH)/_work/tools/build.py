#!/usr/bin/env python3
"""Build the combined footage library (Expansion + My Book) in ~/Desktop/Bahlman Media App:
footage.db (SQLite), footage_index.csv, clips.jsonl, index.html, _thumbs/,
and one _FOLDER OVERVIEW.jpg per Expansion folder."""
import csv, glob, html, json, os, re, sqlite3
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
import sys
SHEETS = os.path.expanduser("~/Desktop/Bahlman Media App" if sys.platform == "darwin" else "~/mnt/Bahlman Media App")   # contact sheets (Expansion at top level, My Book under "My Book/")
OUT = os.path.join(SHEETS, "Sean (DON'T TOUCH)")
# all contact sheets live in "Contact Sheets/" (Expansion under "Contact Sheets/Expansion/"); stored sheet paths are relative to that
def sheet_dir(drive): return "Contact Sheets/Expansion/" if drive == "Expansion" else "Contact Sheets/"       # page, database, thumbs, photos, work files
if sys.platform == "darwin":
    F, _B, _R = "/System/Library/Fonts/Supplemental/", "Arial Bold.ttf", "Arial.ttf"
else:  # Cowork Linux VM
    F, _B, _R = "/usr/share/fonts/truetype/liberation/", "LiberationSans-Bold.ttf", "LiberationSans-Regular.ttf"
FB, FS = ImageFont.truetype(F + _B, 28), ImageFont.truetype(F + _R, 15)

meta = {}
for p in glob.glob(os.path.join(SP, "meta", "*.json")):
    m = json.load(open(p)); meta[m["id"]] = m
desc = {}
for p in glob.glob(os.path.join(OUT, "_work", "grids", "G_*.desc.json")):
    desc.update(json.load(open(p)))
order = [l.split("\t")[0] for l in open(os.path.join(SP, "list.tsv"))]
clips = [meta[i] for i in order if i in meta]


def shoot_of(path):
    parts = path.split("/")
    for p in parts:  # first folder that starts with a date, e.g. 06.29.26 Karlton Live Book Launch
        if re.match(r"\d{2}\.\d{2}\.\d{2}", p):
            return p
    return parts[0]


CLIENTS = json.load(open(os.path.join(SP, "clients.json")))


def client_of(shoot):
    """(client, brand) for a shoot; brand defaults to the client."""
    for entry in CLIENTS:
        if re.search(entry[0], shoot, re.I):
            return entry[1], (entry[2] if len(entry) > 2 else entry[1])
    return "Other", "Other"


def date_of(shoot):
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{2})", shoot)
    return f"20{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


os.makedirs(os.path.join(OUT, "_thumbs"), exist_ok=True)
rows = []
for m in clips:
    d = desc.get(m["id"], {})
    shoot = shoot_of(m["path"])
    client, brand = client_of(shoot)
    thumb = os.path.join(OUT, "_thumbs", m["id"] + ".jpg")
    if not os.path.exists(thumb):
        Image.open(os.path.join(SP, "strips", m["id"] + ".jpg")).crop((320, 0, 640, 180)).save(thumb, quality=78)
    rows.append(dict(
        id=m["id"], file=os.path.basename(m["path"]), path=m["path"],
        abs_path="/Volumes/Expansion/" + m["path"], drive="Expansion", folder=os.path.dirname(m["path"]),
        client=client, brand=brand, shoot=shoot, shoot_date=date_of(shoot), duration=m["duration"], width=m["width"],
        height=m["height"], orientation=m["orientation"], fps=m["fps"], codec=m["codec"],
        has_audio=int(m["has_audio"]), size_gb=round(m["size_bytes"] / 1e9, 3),
        created=m.get("created"), content=d.get("content", ""), shot=d.get("shot", ""),
        setting=d.get("setting", ""), people=d.get("people", ""),
        description=d.get("desc", ""), tags=", ".join(d.get("tags", [])),
        quality=", ".join(d.get("quality", [])), sheet=m["sheet"]))

# My Book clips, converted from the 2026-10-06 catalog by mybook_import.py
mb_path = os.path.join(OUT, "_work", "mybook_rows.json")
if os.path.exists(mb_path):
    for r in json.load(open(mb_path)):
        r["client"], r["brand"] = client_of(r["shoot"])
        rows.append({k: r.get(k) for k in rows[0].keys()})

# Pace 2 drive (2024 Pace Morby footage): sheets_p2.py -> meta_p2/, strips_p2/, list_p2.tsv; descriptions in _work/grids_p2/
P2_ROOT = "/Volumes/Pace 2/Pace Morby Media/2024/"
MONTH = re.compile(r"^\d{2} - [A-Z][a-z]+$")


def shoot_p2(path):
    """Dated folder if there is one, else the first named folder under PACE/ (skipping month folders)."""
    parts = path.split("/")
    for p in parts:
        if re.match(r"\d{2}\.\d{2}\.\d{2}", p):
            return p
    for p in parts[1:-1]:
        if not MONTH.match(p):
            return p.strip(" -")
    return parts[0]


def date_p2(shoot):
    """Everything on this drive is from 2024; a few folders are typed as .23 (e.g. 01.14.23) — date them 2024."""
    d = date_of(shoot)
    return ("2024" + d[4:]) if d else None


# Gator Training Course: one "Gator Training Course" card inside Pace Morby; inside it, sections (0.0, 1.0, 2.0, 3.0,
# Newbie Nest, Snappy Start) and one shoot per lesson with all its camera angles, dated from the file names (03.01.24 …).
GATOR = "- 2024 Gator Training Course"


def _gator_parts(path):
    parts = path.split("/")
    if len(parts) < 4 or parts[1] != GATOR:
        return None
    sec = parts[2].replace("Gator Training Course - ", "").strip()
    lesson = None
    for p in parts[3:-1]:
        m = re.match(r"^Video (\d+)(?:\s*-\s*(.+))?$", p.strip())
        if m:
            lesson = f"Video {int(m.group(1)):02d}" + (f" – {m.group(2).strip()}" if m.group(2) else "")
            break
        if p.lower() == "broll":
            lesson = "B-roll"; break
        if p.lower().startswith("photo"):
            lesson = "Photos"; break
        m = re.match(r"^\d{2}\.\d{2}\.\d{2}\s+Gator\s+[\d.]+\s+(.+)$", p)
        if m:
            lesson = m.group(1).strip(); break
    return sec, lesson or "Other"


GATOR_DATES = {}
for _p in ([l.split("\t")[1].strip() for l in open(os.path.join(SP, "list_p2.tsv"))] if os.path.exists(os.path.join(SP, "list_p2.tsv")) else []):
    g = _gator_parts(_p)
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{2})", os.path.basename(_p))
    if g and m and m.group(2) != "":
        d = f"2024-{m.group(1)}-{m.group(2)}"
        GATOR_DATES.setdefault(g, d); GATOR_DATES.setdefault((g[0], None), d)
        GATOR_DATES[(g[0], None)] = min(GATOR_DATES[(g[0], None)], d)


def gator_p2(path):
    """(brand, event, date) for a Gator Training Course file, else None."""
    g = _gator_parts(path)
    if not g:
        return None
    sec, lesson = g
    return "Pace Morby", f"Gator {sec} · {lesson}", GATOR_DATES.get(g) or GATOR_DATES.get((sec, None)), f"Gator {sec}"


GROUP = {}  # clip/photo id -> (group card name, section) for the Library page


def client_p2(shoot):
    c, b = client_of(shoot)
    return ("Pace Morby", "Pace Morby") if c == "Other" else (c, b)


p2_meta = {}
for p in glob.glob(os.path.join(SP, "meta_p2", "*.json")):
    m = json.load(open(p)); p2_meta[m["id"]] = m
p2_desc = {}
for p in glob.glob(os.path.join(OUT, "_work", "grids_p2", "G_*.desc.json")):
    p2_desc.update(json.load(open(p)))
p2_order = [l.split("\t")[0] for l in open(os.path.join(SP, "list_p2.tsv"))] if os.path.exists(os.path.join(SP, "list_p2.tsv")) else []
for cid in p2_order:
    m = p2_meta.get(cid)
    if not m:
        continue
    d = p2_desc.get(cid, {})
    shoot = shoot_p2(m["path"])
    client, brand = client_p2(shoot)
    sdate = date_p2(shoot)
    tags = list(d.get("tags", []))
    g = gator_p2(m["path"])
    if g:
        client, (brand, shoot, sdate, sec) = "Pace Morby", g
        GROUP[cid] = ("Gator Training Course", sec)
        cam = re.search(r"CAM\s*(\d+)", os.path.basename(m["path"]), re.I)
        if cam:
            tags.append(f"cam {cam.group(1)}")
    thumb = os.path.join(OUT, "_thumbs", cid + ".jpg")
    if not os.path.exists(thumb):
        Image.open(os.path.join(SP, "strips_p2", cid + ".jpg")).crop((320, 0, 640, 180)).save(thumb, quality=78)
    rows.append(dict(
        id=cid, file=os.path.basename(m["path"]), path=m["path"],
        abs_path=P2_ROOT + m["path"], drive="Pace 2", folder="Pace 2/2024/" + os.path.dirname(m["path"]),
        client=client, brand=brand, shoot=shoot, shoot_date=sdate, duration=m["duration"], width=m["width"],
        height=m["height"], orientation=m["orientation"], fps=m["fps"], codec=m["codec"],
        has_audio=int(m["has_audio"]), size_gb=round(m["size_bytes"] / 1e9, 3),
        created=m.get("created"), content=d.get("content", ""), shot=d.get("shot", ""),
        setting=d.get("setting", ""), people=d.get("people", ""),
        description=d.get("desc", ""), tags=", ".join(tags),
        quality=", ".join(d.get("quality", [])), sheet=m["sheet"]))

# Pace 1 drive (2021-2023 Pace Morby footage): sheets_p1.py -> meta_p1/, strips_p1/, list_p1.tsv; descriptions in _work/grids_p1/
P1_ROOT = "/Volumes/Pace 1/Pace Morby Media 2021-2023/"
PERSON_P1 = {"CODY BARTON": ("Cody Barton", "Cody Barton"), "LAURA MORBY": ("Pace Morby", "Laura Morby")}  # MANIFEST U + LAURA MORBY live under Pace Morby (Sean, 2026-10-13/20)
SKIP_P1 = re.compile(r"^(\d{4}|CODY BARTON|LAURA MORBY|PACE MORBY|MANIFEST U|PACE FILES|VIDEOS?|RAW|PHOTOS?|\d{1,2}[-. ]+.*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*)$", re.I)
DATE_P1 = re.compile(r"^(\d{1,2})[.-](\d{1,2})[.-](\d{2})\b\s*(.*)$")


def shoot_p1(path):
    """(shoot name 'MM.DD.YY Title', date or None) — folders here use 08-05-22, 7-28-22, 12.2.23 and 09.14.22 styles."""
    parts = path.split("/")[:-1]
    for p in parts:
        m = DATE_P1.match(p.strip())
        if m:
            mm, dd, yy, rest = int(m.group(1)), int(m.group(2)), m.group(3), m.group(4).strip(" -:")
            if 1 <= mm <= 12 and 1 <= dd <= 31:
                return f"{mm:02d}.{dd:02d}.{yy} {rest or 'Shoot'}", f"20{yy}-{mm:02d}-{dd:02d}"
    for p in parts:
        if not SKIP_P1.match(p.strip()):
            name = p.strip(" -")
            if "completed" in name.lower():
                name = f"Completed Edits {parts[0]}"
            return name, None
    return f"{parts[0]} Misc", None


def client_p1(path, shoot):
    for k, v in PERSON_P1.items():
        if f"/{k}/" in "/" + path:
            return v
    return client_p2(shoot)


p1_meta = {}
for p in glob.glob(os.path.join(SP, "meta_p1", "*.json")):
    m = json.load(open(p)); p1_meta[m["id"]] = m
p1_desc = {}
for p in glob.glob(os.path.join(OUT, "_work", "grids_p1", "G_*.desc.json")):
    p1_desc.update(json.load(open(p)))
p1_order = [l.split("\t")[0] for l in open(os.path.join(SP, "list_p1.tsv"))] if os.path.exists(os.path.join(SP, "list_p1.tsv")) else []
for cid in p1_order:
    m = p1_meta.get(cid)
    if not m:
        continue
    d = p1_desc.get(cid, {})
    shoot, sdate = shoot_p1(m["path"])
    if not sdate and m.get("created"):
        sdate = m["created"][:10]
        top = m["path"].split("/")[0]
        if top.isdigit() and sdate[:4] != top:      # camera clock wrong: use the folder's year (+ month folder if any)
            mm = re.search(r"/(\d{1,2})\s*-\s*[A-Za-z]+/", m["path"])
            sdate = f"{top}-{int(mm.group(1)):02d}-01" if mm else f"{top}-01-01"
    client, brand = client_p1(m["path"], shoot)
    thumb = os.path.join(OUT, "_thumbs", cid + ".jpg")
    if not os.path.exists(thumb):
        Image.open(os.path.join(SP, "strips_p1", cid + ".jpg")).crop((320, 0, 640, 180)).save(thumb, quality=78)
    rows.append(dict(
        id=cid, file=os.path.basename(m["path"]), path=m["path"],
        abs_path=P1_ROOT + m["path"], drive="Pace 1", folder="Pace 1/2021-2023/" + os.path.dirname(m["path"]),
        client=client, brand=brand, shoot=shoot, shoot_date=sdate, duration=m["duration"], width=m["width"],
        height=m["height"], orientation=m["orientation"], fps=m["fps"], codec=m["codec"],
        has_audio=int(m["has_audio"]), size_gb=round(m["size_bytes"] / 1e9, 3),
        created=m.get("created"), content=d.get("content", ""), shot=d.get("shot", ""),
        setting=d.get("setting", ""), people=d.get("people", ""),
        description=d.get("desc", ""), tags=", ".join(d.get("tags", [])),
        quality=", ".join(d.get("quality", [])), sheet=m["sheet"]))

cols = list(rows[0].keys())
db = os.path.join(OUT, "footage.db")
# build the database in a temp file, then copy it over footage.db (works on the Mac and in the Cowork VM,
# where files in the folder can be overwritten but not deleted)
import shutil, tempfile
db_final, db = db, os.path.join(tempfile.mkdtemp(), "footage.db")
con = sqlite3.connect(db)
con.execute(f"CREATE TABLE clips ({', '.join(c + (' PRIMARY KEY' if c == 'id' else '') for c in cols)})")
con.executemany(f"INSERT INTO clips VALUES ({','.join('?' * len(cols))})", [tuple(r.values()) for r in rows])
con.execute("CREATE VIRTUAL TABLE clips_fts USING fts5(id UNINDEXED, client, brand, shoot, file, description, tags, content, shot, setting)")
con.execute("INSERT INTO clips_fts SELECT id, client, brand, shoot, file, description, tags, content, shot, setting FROM clips")
con.commit(); con.close()
shutil.copyfile(db, db_final)

with open(os.path.join(OUT, "footage_index.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
with open(os.path.join(OUT, "clips.jsonl"), "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
# clips.js — same rows, trimmed, as a script file so Ideate (step 02) can read the archive from file:// with no server
_KEEP = ["id","file","drive","folder","client","brand","shoot","shoot_date","duration","width","height","orientation","has_audio","content","shot","setting","people","description","tags","sheet"]
with open(os.path.join(OUT, "clips.js"), "w") as f:
    f.write("/* generated by build.py - the footage archive for Ideate (step 02). Same rows as clips.jsonl, trimmed. */\nwindow.BM_CLIPS=")
    json.dump([{k: r.get(k) for k in _KEEP} for r in rows], f, separators=(",", ":")); f.write(";\n")

# folder overviews: every clip's middle frame with name + duration
import sys
byfolder = defaultdict(list)
for r in rows:
    byfolder[r["folder"]].append(r)
PREVIEW = "--preview" in sys.argv
TW, TH, LB = 320, 180, 40
for folder, rs in ([] if PREVIEW else [(f, rs) for f, rs in byfolder.items() if rs[0]["drive"] in ("Expansion", "Pace 2", "Pace 1")]):
    cols_n = min(8, max(4, int(len(rs) ** 0.5) + 1))
    nrow = -(-len(rs) // cols_n)
    img = Image.new("RGB", (TW * cols_n, 60 + nrow * (TH + LB)), (12, 12, 12))
    d = ImageDraw.Draw(img)
    d.text((14, 14), f"{folder}   ({len(rs)} clips)", font=FB, fill=(255, 255, 255))
    for k, r in enumerate(rs):
        x, y = (k % cols_n) * TW, 60 + (k // cols_n) * (TH + LB)
        img.paste(Image.open(os.path.join(OUT, "_thumbs", r["id"] + ".jpg")), (x, y))
        mm, ss = divmod(int(r["duration"]), 60)
        d.text((x + 6, y + TH + 3), r["file"][:34], font=FS, fill=(255, 220, 80))
        d.text((x + 6, y + TH + 20), f"{r['id']}  {mm}:{ss:02d}  {r['orientation']}", font=FS, fill=(180, 180, 180))
    dst = os.path.join(SHEETS, sheet_dir(rs[0]["drive"]) + folder, "_FOLDER OVERVIEW.jpg")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img.save(dst, quality=80)

# browsable page
data = [{k: r[k] for k in ("id", "file", "client", "brand", "shoot", "shoot_date", "duration", "orientation", "content",
                           "shot", "description", "tags", "quality", "sheet", "abs_path", "drive")} for r in rows]
for d in data:  # sheets live one level above the page
    d["sheet"] = "../" + sheet_dir(d["drive"]) + d["sheet"]
    if d["id"] in GROUP:
        d["grp"], d["sec"] = GROUP[d["id"]]
page = open(os.path.join(SP, "index_template.html")).read()
page = page.replace("/*DATA*/[]", json.dumps(data).replace("</", "<\\/"))
cov_dir = os.path.join(OUT, "_covers")
covers = sorted(f[:-4] for f in os.listdir(cov_dir) if f.startswith("X") and f.endswith(".jpg")) if os.path.isdir(cov_dir) else []
page = page.replace("/*COVERS*/[]", json.dumps(covers))
photos = json.load(open(os.path.join(SP, "photos.json"))) if os.path.exists(os.path.join(SP, "photos.json")) else []
mbp = os.path.join(SP, "mybook_photos.json")
if os.path.exists(mbp):
    photos += json.load(open(mbp))
p1p = os.path.join(SP, "pace1_photos.json")
if os.path.exists(p1p):
    for p in json.load(open(p1p)):
        p["shoot"], p["_date"] = shoot_p1(p["path"])
        p["_client"] = client_p1(p["path"], p["shoot"])
        photos.append(p)
p2p = os.path.join(SP, "pace2_photos.json")
if os.path.exists(p2p):
    for p in json.load(open(p2p)):
        p["shoot"] = shoot_p2(p["path"])  # same event names as the Pace 2 clips
        g = gator_p2(p["path"])
        if g:
            p["_brand"], p["shoot"], p["_date"], sec = g
            GROUP[p["id"]] = ("Gator Training Course", sec)
        photos.append(p)
SET_DROP = re.compile(r'^(-?\s*final edits?|-?\s*edited photos?|-?\s*edited|raw content|untitled export|export|photos?|pix|jpgs?|\d{4}|\d{4}-\d{2}-\d{2})$', re.I)


def set_of(p):
    """Gallery set (sub-gallery) from the folders between the event and the file, e.g. 'Day 2' or a headshot name."""
    parts = p["path"].split("/")[:-1]
    i = next((k for k, x in enumerate(parts) if x == p["shoot"] or x.strip(" -") == p["shoot"]), -1)
    ev = re.sub(r"^\d{2}\.\d{2}\.\d{2}\s*", "", p["shoot"])
    out = []
    for x in parts[i + 1:]:
        if SET_DROP.match(x.strip()):
            continue
        x = re.sub(r"^\d{2}\.\d{2}\.\d{2}\s*", "", x)
        x = re.sub(re.escape(ev), "", x, flags=re.I).strip(" -:")
        x = re.sub(r"^(-?\s*edited\s+photos?\s*-\s*)", "", x, flags=re.I)
        x = re.sub(r"\s*-?\s*(edited\s+)?photos?$", "", x, flags=re.I).strip(" -:_")
        if x and x not in out:
            out.append(x)
    return " · ".join(out) or "Highlights"


pdata = []
for p in photos:
    pc, pb = client_p2(p["shoot"]) if p.get("drive") == "Pace 2" else client_of(p["shoot"])
    if p.get("_brand"):
        pc, pb = "Pace Morby", p["_brand"]
    if p.get("_client"):
        pc, pb = p["_client"]
    pdata.append(dict(id=p["id"], file=p["file"], client=pc, brand=pb, shoot=p["shoot"], shoot_date=p.get("_date") or (date_p2(p["shoot"]) if p.get("drive") == "Pace 2" else None if p.get("drive") == "Pace 1" else date_of(p["shoot"])),
                      folder=p["folder"], set=set_of(p), w=p["w"], h=p["h"], abs=p.get("root", "/Volumes/Expansion/") + p["path"],
                      drive=p.get("drive", "Expansion")))
for d in pdata:
    if d["id"] in GROUP:
        d["grp"], d["sec"] = GROUP[d["id"]]
page = page.replace("/*PHOTOS*/[]", json.dumps(pdata).replace("</", "<\\/"))
heroes = json.load(open(os.path.join(SP, "heroes.json"))) if os.path.exists(os.path.join(SP, "heroes.json")) else {}
page = page.replace("/*HEROES*/{}", json.dumps({k: {"src": v["src"], "portrait": v["portrait"], "pos": v.get("pos")} for k, v in heroes.items()}))
open(os.path.join(OUT, "index.html"), "w").write(page)
print(f"{len(rows)} clips, {sum(1 for r in rows if r['description'])} described, {len(byfolder)} folder overviews")
