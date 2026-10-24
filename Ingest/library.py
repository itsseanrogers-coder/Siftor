"""Builds the Library from Ingest's catalog, in the files every other part of Siftor already reads:

  Library/footage.db        SQLite: table clips + full-text index clips_fts (Library server, Claude connector)
  Library/clips.jsonl       one clip per line (People / face recognition)
  Library/footage_index.csv the same rows for a spreadsheet
  Library/clips.js          trimmed rows for Ideate
  Library/_thumbs/<id>.jpg  middle frame of each clip
  Library/index.html        the Library page (Library/_work/tools/index_template.html + the rows)

Clients, brands and shoots come from the folder names: the first folder inside a footage folder is the client,
the first folder with a date in its name is the shoot. Rules under "clients" in siftor.json can override that:
[["regex on the clip's folder path", "Client", "optional Brand"], ...] - first match wins.
"""
import csv, datetime, json, os, re, shutil, sqlite3, subprocess, sys, tempfile

from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(APP, "Library")
WORK = os.path.join(LIB, "_work", "ingest")
TEMPLATE = os.path.join(LIB, "_work", "tools", "index_template.html")

DATED = [  # folder-name dates: 06.29.26 Launch, 2026-06-29 Launch, 20260629 Launch
    (re.compile(r"(?<!\d)(\d{2})[.\-_](\d{2})[.\-_](\d{2})(?!\d)"), lambda m: (2000 + int(m[3]), int(m[1]), int(m[2]))),
    (re.compile(r"(?<!\d)(20\d{2})[.\-_](\d{2})[.\-_](\d{2})(?!\d)"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    (re.compile(r"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
]


def folder_date(name):
    for rx, f in DATED:
        m = rx.search(name)
        if m:
            try:
                return datetime.date(*f(m)).isoformat()
            except ValueError:
                pass
    return None


def place(folder_name, rel, rules):
    """(client, brand, shoot, shoot_date) for a clip at <footage folder>/<rel>."""
    parts = rel.split("/")[:-1]
    path = "/".join(parts)
    shoot = next((p for p in parts if folder_date(p)), None) or (parts[-1] if parts else folder_name)
    client = parts[0] if parts and parts[0] != shoot else folder_name
    brand = client
    for rule in rules:
        if re.search(rule[0], path, re.I):
            client = rule[1]; brand = rule[2] if len(rule) > 2 else rule[1]
            break
    return client, brand, shoot, folder_date(shoot)


def build(db, settings):
    roots = {f["name"]: f["path"] for f in settings["footage_folders"]}
    rules = settings.get("clients") or []
    os.makedirs(os.path.join(LIB, "_thumbs"), exist_ok=True)
    rows = []
    for cid, fo, rel, meta, descr in db.execute(
            "select id, folder, rel, meta, descr from clips where meta is not null and missing=0 order by id"):
        if fo not in roots:      # footage folder taken out of siftor.json
            continue
        m, d = json.loads(meta), json.loads(descr) if descr else {}
        client, brand, shoot, sdate = place(fo, rel, rules)
        if not sdate and m.get("created"):
            sdate = m["created"][:10]
        thumb = os.path.join(LIB, "_thumbs", cid + ".jpg")
        strip = os.path.join(WORK, "strips", cid + ".jpg")
        if not os.path.exists(thumb) and os.path.exists(strip):
            Image.open(strip).crop((320, 0, 640, 180)).save(thumb, quality=78)
        rows.append(dict(
            id=cid, file=os.path.basename(rel), path=rel, abs_path=os.path.join(roots.get(fo, ""), rel), drive=fo,
            folder=os.path.dirname(rel), client=client, brand=brand, shoot=shoot, shoot_date=sdate,
            duration=m["duration"], width=m["width"], height=m["height"], orientation=m["orientation"], fps=m["fps"],
            codec=m["codec"], has_audio=int(m["has_audio"]), size_gb=round(m["size_bytes"] / 1e9, 3),
            created=m.get("created"), content=d.get("content", ""), shot=d.get("shot", ""), setting=d.get("setting", ""),
            people=d.get("people", ""), description=d.get("desc", ""), tags=", ".join(d.get("tags", [])),
            quality=", ".join(d.get("quality", [])), sheet=m["sheet"]))
    if not rows:
        print("build: no clips with contact sheets yet", flush=True); return

    cols = list(rows[0].keys())
    tmp = os.path.join(tempfile.mkdtemp(), "footage.db")   # build aside, then swap in, so the server never reads half a db
    con = sqlite3.connect(tmp)
    con.execute(f"CREATE TABLE clips ({', '.join(c + (' PRIMARY KEY' if c == 'id' else '') for c in cols)})")
    con.executemany(f"INSERT INTO clips VALUES ({','.join('?' * len(cols))})", [tuple(r.values()) for r in rows])
    con.execute("CREATE VIRTUAL TABLE clips_fts USING fts5(id UNINDEXED, client, brand, shoot, file, description, tags, content, shot, setting)")
    con.execute("INSERT INTO clips_fts SELECT id, client, brand, shoot, file, description, tags, content, shot, setting FROM clips")
    con.commit(); con.close()
    shutil.copyfile(tmp, os.path.join(LIB, "footage.db"))

    with open(os.path.join(LIB, "footage_index.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    with open(os.path.join(LIB, "clips.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    keep = ["id", "file", "drive", "folder", "client", "brand", "shoot", "shoot_date", "duration", "width", "height",
            "orientation", "has_audio", "content", "shot", "setting", "people", "description", "tags", "sheet"]
    with open(os.path.join(LIB, "clips.js"), "w") as f:
        f.write("/* generated by Ingest/library.py - the footage archive for Ideate. */\nwindow.BM_CLIPS=")
        json.dump([{k: r.get(k) for k in keep} for r in rows], f, separators=(",", ":")); f.write(";\n")

    data = [{k: r[k] for k in ("id", "file", "client", "brand", "shoot", "shoot_date", "duration", "orientation", "content",
                               "shot", "description", "tags", "quality", "sheet", "abs_path", "drive")} for r in rows]
    for d in data:   # contact sheets live next to the Library folder
        d["sheet"] = "../Contact Sheets/" + d["drive"] + "/" + d["sheet"]
    page = open(TEMPLATE, encoding="utf-8").read()
    page = page.replace("/*DATA*/[]", json.dumps(data).replace("</", "<\\/"))
    page = page.replace("/*COVERS*/[]", "[]").replace("/*PHOTOS*/[]", "[]").replace("/*HEROES*/{}", "{}")
    open(os.path.join(LIB, "index.html"), "w", encoding="utf-8").write(page)

    spoken = os.path.join(APP, "Ideate", "build_spoken.py")   # Ideate's "Spoken" search, from the transcripts
    if os.path.exists(spoken):
        subprocess.run([sys.executable, spoken], capture_output=True)
    print(f"build: Library has {len(rows)} clips, {sum(1 for r in rows if r['description'])} described", flush=True)
