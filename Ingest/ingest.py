#!/usr/bin/env python3
"""Siftor Ingest: turns the footage folders listed in siftor.json into the Library, with no hand work.

  scan        find every video file in the footage folders; new clips get an id, changed files are redone
  sheets      12-frame contact sheet + 3-frame strip per clip (Library/_work/tools/sheets.py does the drawing)
  describe    what is in each clip, written from its contact sheet (describe.py)
  transcribe  Whisper transcripts for the clips where people talk (podcasts, interviews, ... - see siftor.json)
  faces       People/faces_run.py groups the faces it finds on the contact sheets
  build       footage.db, clips.jsonl, clips.js and the Library page (library.py)

Started by "Siftor Ingest.command". Safe to stop at any point and run again: every step skips work that is done.
Footage is only ever READ. A drive that is not plugged in is skipped; its clips stay in the Library.

usage: ingest.py [--settings siftor.json] [--only STEP[,STEP]] [--limit N]
"""
import argparse, concurrent.futures as cf, fcntl, json, os, re, shutil, sqlite3, subprocess, sys, tempfile, time

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(APP, "Library")
WORK = os.path.join(LIB, "_work", "ingest")
TOOLS = os.path.join(LIB, "_work", "tools")
SHEETS = os.path.join(APP, "Contact Sheets")
TX = os.path.join(LIB, "_work", "transcripts")
VIDEO = {".mp4", ".mov", ".m4v", ".mxf", ".mts", ".m2ts", ".avi", ".mkv", ".3gp", ".webm", ".mpg", ".mpeg"}
STEPS = ["scan", "sheets", "describe", "transcribe", "faces", "build"]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_settings(path):
    s = json.load(open(path, encoding="utf-8"))
    s.setdefault("footage_folders", [])
    for f in s["footage_folders"]:
        f["path"] = os.path.expanduser(f["path"]).rstrip("/")
        f.setdefault("name", os.path.basename(f["path"]) or "Footage")
    names = [f["name"] for f in s["footage_folders"]]
    if len(set(names)) != len(names):
        sys.exit("Two footage folders in siftor.json have the same name - give each a different \"name\".")
    return s


# ---------------------------------------------------------------- catalog
def db_open():
    os.makedirs(WORK, exist_ok=True)
    db = sqlite3.connect(os.path.join(WORK, "catalog.db"))
    db.executescript("""
    create table if not exists clips (
        id text primary key, folder text, rel text, size integer, mtime real, missing integer default 0,
        meta text, sheet_err text, descr text, desc_err text, tx text, first_seen text,
        unique (folder, rel));
    create table if not exists counter (n integer);""")
    if not db.execute("select n from counter").fetchone():
        db.execute("insert into counter values (0)")
    db.commit()
    return db


def new_id(db):
    n = db.execute("select n from counter").fetchone()[0] + 1
    db.execute("update counter set n=?", (n,))
    # the Library server accepts ids of 1-2 capital letters + 4-5 digits
    return f"C{n:05d}" if n < 100000 else f"C{chr(64 + n // 100000)}{n % 100000:05d}"


# ---------------------------------------------------------------- scan
def walk(root):
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if not x.startswith((".", "_")))   # hidden folders, _Contact Sheets etc.
        for f in sorted(files):
            if f.startswith(".") or os.path.splitext(f)[1].lower() not in VIDEO:
                continue
            p = os.path.join(d, f)
            try:
                st = os.stat(p)
            except OSError:
                continue
            if st.st_size > 0:
                yield os.path.relpath(p, root), st.st_size, st.st_mtime


def scan(db, settings):
    new = changed = gone = 0
    for f in settings["footage_folders"]:
        if not os.path.isdir(f["path"]):
            log(f"  {f['name']}: not plugged in ({f['path']}) - skipped, its clips stay in the Library")
            continue
        known = {r[0]: r[1:] for r in db.execute("select rel, id, size, mtime from clips where folder=?", (f["name"],))}
        seen = set()
        for rel, size, mtime in walk(f["path"]):
            seen.add(rel)
            k = known.get(rel)
            if k is None:
                db.execute("insert into clips (id, folder, rel, size, mtime, first_seen) values (?,?,?,?,?,?)",
                           (new_id(db), f["name"], rel, size, mtime, time.strftime("%Y-%m-%d")))
                new += 1
            elif (k[1], round(k[2], 3)) != (size, round(mtime, 3)) or db.execute("select missing from clips where id=?", (k[0],)).fetchone()[0]:
                if (k[1], round(k[2], 3)) != (size, round(mtime, 3)):   # the file itself changed: redo everything for it
                    db.execute("update clips set size=?, mtime=?, meta=null, sheet_err=null, descr=null, desc_err=null, tx=null where id=?",
                               (size, mtime, k[0]))
                    changed += 1
                    for old in [os.path.join(LIB, "_thumbs", k[0] + ".jpg")] + [os.path.join(TX, k[0] + e) for e in (".json", ".srt", ".txt")]:
                        if os.path.exists(old):
                            os.remove(old)
                db.execute("update clips set missing=0 where id=?", (k[0],))
        for rel, k in known.items():
            if rel not in seen:
                db.execute("update clips set missing=1 where id=?", (k[0],)); gone += 1
        db.commit()
        log(f"  {f['name']}: {len(seen)} clips")
    log(f"scan: {new} new, {changed} changed, {gone} no longer on the drive")


# ---------------------------------------------------------------- contact sheets
def _sheet_job(cid, root, out, rel):
    sys.path.insert(0, TOOLS)
    import sheets
    sheets.ROOT, sheets.OUT, sheets.SP = root, out, WORK
    m = sheets.build(cid, rel, False)
    m["sheet"] = rel + ".jpg"   # relative to Contact Sheets/<footage folder name>/
    return m


def make_sheets(db, settings, limit):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is not installed. Run the Siftor installer, or: brew install ffmpeg")
    for d in ("strips", "tmp"):
        os.makedirs(os.path.join(WORK, d), exist_ok=True)
    roots = {f["name"]: f["path"] for f in settings["footage_folders"] if os.path.isdir(f["path"])}
    todo = [r for r in db.execute("select id, folder, rel from clips where meta is null and sheet_err is null and missing=0 order by id")
            if r[1] in roots][:limit or None]
    if not todo:
        log("sheets: nothing new"); return
    n = settings.get("workers") or max(2, min(8, (os.cpu_count() or 4) - 2))
    log(f"sheets: {len(todo)} clips, {n} at a time")
    t0, done = time.time(), 0
    with cf.ProcessPoolExecutor(n) as ex:
        futs = {ex.submit(_sheet_job, cid, roots[fo], os.path.join(SHEETS, fo), rel): cid for cid, fo, rel in todo}
        for fu in cf.as_completed(futs):
            cid = futs[fu]
            try:
                db.execute("update clips set meta=? where id=?", (json.dumps(fu.result()), cid))
            except Exception as e:
                db.execute("update clips set sheet_err=? where id=?", (repr(e)[:500], cid))
            db.commit(); done += 1
            if done % 25 == 0 or done == len(todo):
                log(f"  {done}/{len(todo)} sheets  ({(time.time() - t0) / done:.1f} s per clip)")


# ---------------------------------------------------------------- descriptions
def describe_all(db, settings, limit):
    import describe
    cfg = settings.get("describe", {})
    engine = cfg.get("engine", "local")
    if engine == "off":
        log("describe: turned off in siftor.json"); return
    if engine == "claude" and not cfg.get("consent_send_stills"):
        log("describe: skipped. Claude describes clips from their contact sheets, so still frames go to Anthropic's API.")
        log('          To allow it, set "consent_send_stills": true under "describe" in siftor.json.')
        return
    todo = db.execute("select id, folder, rel, meta from clips where meta is not null and descr is null and desc_err is null "
                      "and missing=0 order by id").fetchall()[:limit or None]
    if not todo:
        log("describe: nothing new"); return
    try:
        fn = describe.engine(cfg)
    except describe.SetupError as e:
        log(f"describe: {e}"); return
    log(f"describe: {len(todo)} clips with {describe.label(cfg)}")
    # Claude answers several clips at once; the local model does one at a time (Ollama queues the rest, and
    # queued requests would hit their timeout), so send it one clip at a time.
    at_once = 4 if engine == "claude" else 1
    t0, done = time.time(), 0
    with cf.ThreadPoolExecutor(at_once) as ex:
        futs = {ex.submit(fn, os.path.join(SHEETS, fo, json.loads(m)["sheet"]), fo, rel): cid for cid, fo, rel, m in todo}
        for fu in cf.as_completed(futs):
            cid = futs[fu]
            try:
                db.execute("update clips set descr=? where id=?", (json.dumps(fu.result()), cid))
            except describe.Stop as e:          # bad key, no credit: no point trying the rest
                log(f"describe stopped: {e}"); ex.shutdown(cancel_futures=True); db.commit(); return
            except Exception as e:
                db.execute("update clips set desc_err=? where id=?", (repr(e)[:500], cid))
            db.commit(); done += 1
            if done % 25 == 0 or done == len(todo):
                log(f"  {done}/{len(todo)} described  ({(time.time() - t0) / done:.1f} s per clip)")


# ---------------------------------------------------------------- transcripts
def first_existing(*paths):
    return next((p for p in map(os.path.expanduser, paths) if os.path.exists(p)), None)


# where the installer puts Whisper's model; the second path is where the older Bahlman tools kept it
WHISPER_MODEL = first_existing("~/Library/Application Support/Siftor/ggml-large-v3.bin",
                               "~/Library/Application Support/BahlmanWhisper/ggml-large-v3.bin")


def transcribe_all(db, settings, limit):
    cfg = settings.get("transcribe", {})
    if not cfg.get("enabled", True):
        log("transcribe: turned off in siftor.json"); return
    wc = shutil.which("whisper-cli") or shutil.which("whisper-cpp")
    if not wc or not WHISPER_MODEL:
        log("transcribe: skipped - Whisper is not set up yet (the Siftor installer does this)"); return
    want = set(cfg.get("content") or [])
    roots = {f["name"]: f["path"] for f in settings["footage_folders"] if os.path.isdir(f["path"])}
    todo = []
    for cid, fo, rel, m, d in db.execute("select id, folder, rel, meta, descr from clips where meta is not null and tx is null "
                                         "and missing=0 order by id"):
        m = json.loads(m)
        if fo not in roots or not m.get("has_audio") or m.get("duration", 0) < 3:
            continue
        if want and d is None and settings.get("describe", {}).get("engine") != "off":
            continue                     # wait for the description to know whether people talk in it
        if want and d is not None and json.loads(d).get("content") not in want:
            continue
        todo.append((cid, os.path.join(roots[fo], rel), m["duration"]))
    todo = todo[:limit or None]
    if not todo:
        log("transcribe: nothing new"); return
    os.makedirs(TX, exist_ok=True)
    log(f"transcribe: {len(todo)} clips, {sum(t[2] for t in todo) / 3600:.1f} h of audio")
    lang = cfg.get("language") or "auto"
    for k, (cid, path, dur) in enumerate(todo, 1):
        with tempfile.TemporaryDirectory() as tmp:
            wav, base = os.path.join(tmp, "a.wav"), os.path.join(tmp, cid)
            r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", path, "-vn", "-map", "0:a:0?", "-ac", "1",
                                "-ar", "16000", "-c:a", "pcm_s16le", wav], capture_output=True, text=True, timeout=1800 + dur)
            if r.returncode != 0 or not os.path.exists(wav) or os.path.getsize(wav) < 32000:
                db.execute("update clips set tx='noaudio' where id=?", (cid,)); db.commit(); continue
            r = subprocess.run([wc, "-m", WHISPER_MODEL, "-f", wav, "-l", lang, "-np", "-ojf", "-osrt", "-otxt", "-of", base],
                               capture_output=True, text=True, timeout=900 + 2 * dur)
            if r.returncode != 0 or not os.path.exists(base + ".json"):
                db.execute("update clips set tx=? where id=?", ("failed: " + r.stderr[-300:], cid)); db.commit(); continue
            for e in (".srt", ".txt", ".json"):     # json last: it marks the clip done for the Library server
                if os.path.exists(base + e):
                    shutil.move(base + e, os.path.join(TX, cid + e))
        db.execute("update clips set tx='done' where id=?", (cid,)); db.commit()
        log(f"  {k}/{len(todo)} transcribed")


# ---------------------------------------------------------------- faces
FACES_PY = first_existing("~/Library/Application Support/Siftor/faces-venv/bin/python",
                          "~/Library/Application Support/BahlmanFaces/venv/bin/python")


def faces(settings, limit):
    if not settings.get("faces", {}).get("enabled", True):
        log("faces: turned off in siftor.json"); return
    if not FACES_PY:
        log("faces: skipped - face recognition is not set up yet (the Siftor installer does this)"); return
    cmd = [FACES_PY, "-u", os.path.join(APP, "People", "faces_run.py"), "--app", APP] + (["--limit", str(limit)] if limit else [])
    log("faces: scanning contact sheets")
    subprocess.run(cmd, cwd=os.path.join(APP, "People"))


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--settings", default=os.path.join(APP, "siftor.json"))
    ap.add_argument("--only", help="comma-separated steps: " + ",".join(STEPS))
    ap.add_argument("--limit", type=int, default=0, help="at most N clips per step (for a quick test)")
    ap.add_argument("--retry-failed", action="store_true", help="try again on clips whose sheet, description or transcript failed")
    a = ap.parse_args()
    if not os.path.exists(a.settings):
        sys.exit(f"No settings file at {a.settings}. Copy Ingest/settings.example.json there and list your footage folders.")
    settings = load_settings(a.settings)
    steps = a.only.split(",") if a.only else STEPS
    bad = [s for s in steps if s not in STEPS]
    if bad:
        sys.exit(f"Unknown step {bad[0]}. Steps: {', '.join(STEPS)}")

    os.makedirs(WORK, exist_ok=True)
    lock = open(os.path.join(WORK, ".lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log("Ingest is already running in another window."); return
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    db = db_open()
    if a.retry_failed:
        db.execute("update clips set sheet_err=null, desc_err=null")
        db.execute("update clips set tx=null where tx like 'failed%'")
        db.commit()
    log(f"Siftor Ingest - {len(settings['footage_folders'])} footage folder(s)")
    if "scan" in steps: scan(db, settings)
    if "sheets" in steps: make_sheets(db, settings, a.limit)
    if "describe" in steps: describe_all(db, settings, a.limit)
    if "build" in steps:               # build before transcribe/faces: both read the Library's clip list
        import library; library.build(db, settings)
    if "transcribe" in steps: transcribe_all(db, settings, a.limit)
    if "faces" in steps: faces(settings, a.limit)
    if "build" in steps and ("transcribe" in steps or "faces" in steps):
        import library; library.build(db, settings)
    s = db.execute("select count(*), sum(meta is not null), sum(descr is not null), sum(tx='done'), sum(sheet_err is not null), "
                   "sum(desc_err is not null), sum(tx like 'failed%') from clips where missing=0").fetchone()
    log(f"Library: {s[0]} clips, {s[1] or 0} with contact sheets, {s[2] or 0} described, {s[3] or 0} transcribed")
    if (s[4] or 0) + (s[5] or 0) + (s[6] or 0):
        log(f"Problems: {s[4] or 0} sheets, {s[5] or 0} descriptions, {s[6] or 0} transcripts failed "
            f"(run again with --retry-failed to try them again)")


if __name__ == "__main__":
    main()
