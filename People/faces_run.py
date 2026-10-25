"""Bahlman People: face recognition for the footage library (InsightFace, runs on this Mac, nothing leaves it).

Started by "Run Faces.command".  Footage drives are NOT needed: it reads the contact sheets that already exist
(12 frames per clip, 480 px each) in  Bahlman Media App/Contact Sheets.

  scan     every clip's sheet -> faces (box, frame time, 512-number fingerprint), merged per clip   (resumable)
  cluster  groups fingerprints that belong to the same person -> "Person 12" until someone names them
  export   writes People/people.js, which the People page, the Library and Ideate read

Names, merges and corrections made on the People page are kept in People/edits.json and re-applied after every run,
so re-scanning or re-clustering never loses them.

Usage:  python faces_run.py --app "<Bahlman Media App folder>" [--only scan|cluster|export] [--limit N]
"""
import os, sys, json, time, sqlite3, argparse, re, collections
import numpy as np

HDR = 96            # contact-sheet header height (px)
COLS, ROWS = 4, 3   # 12 frames per sheet
MIN_FACE = 16       # smallest face side (px on the sheet) worth fingerprinting
SMALL = 28          # faces smaller than this are kept only if they appear in 2+ frames of the clip
MIN_SCORE = 0.62    # detector confidence
SAME_IN_CLIP = 0.45 # two faces in one clip with similarity above this are the same person
LINK = 0.50         # cross-clip similarity to link two faces (mutual nearest neighbours only)
GROUP_SIM = 0.50    # two groups merge only if their average faces are at least this similar
FIT = 0.42          # a face stays in its group only if it's this close to the group's average face
COHESION = 0.65     # groups whose faces average below this are bad-angle piles, not a person
MATCH_NAMED = 0.50  # a loose face joins an existing person if it is this close to their centre
KNOWN_MATCH = 0.42 # a reference photo names a person when their average face is at least this close
JOIN_NAMED = 0.55  # a new group joins a named person only if its average face is this close
SIMILAR = 0.40      # people whose centres are this close are offered as "same person?"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------------------------------------------------------------- storage
def db_open(path):
    db = sqlite3.connect(path)
    db.executescript("""
    create table if not exists done(clip text primary key, n int, at real);
    create table if not exists faces(id integer primary key, clip text, t real, frames int, x real, y real, w real, h real,
                                     score real, emb blob, crop text, person int);
    create index if not exists faces_clip on faces(clip);
    create table if not exists people(id integer primary key, faces int, clips int, cover int, centre blob, created real);
    """)
    if "px" not in [r[1] for r in db.execute("pragma table_info(faces)")]:
        db.execute("alter table faces add column px real"); db.commit()
    return db


def emb_load(b):
    return np.frombuffer(b, dtype=np.float16).astype(np.float32)


# ---------------------------------------------------------------- sheets
def sheet_index(app_dir, clips):
    """clips.jsonl's sheet path is relative to the drive's sheet root, which is not always Contact Sheets/<drive>.
    Map every clip to its real sheet by file name + longest matching path suffix."""
    root = os.path.join(app_dir, "Contact Sheets")
    by_name = collections.defaultdict(list)
    for d, _, fs in os.walk(root):
        for f in fs:
            if f.endswith(".jpg"):
                by_name[f].append(os.path.join(d, f))
    out = {}
    for c in clips:
        direct = os.path.join(root, c["drive"], c["sheet"])
        if os.path.exists(direct):
            out[c["id"]] = direct; continue
        cands = by_name.get(os.path.basename(c["sheet"]), [])
        if not cands: continue
        parts = c["sheet"].split("/")
        def score(p):
            pp = p.split(os.sep); n = 0
            while n < len(parts) and n < len(pp) and pp[-1 - n] == parts[-1 - n]: n += 1
            return n + (2 if (os.sep + c["drive"] + os.sep) in p else 0)
        out[c["id"]] = max(cands, key=score)
    return out


def load_photos(lib):
    """The Library's edited photos (id, client, shoot, …) — build.py embeds them in index.html as `const P=[…]`."""
    try:
        s = open(os.path.join(lib, "index.html"), encoding="utf-8").read()
        i = s.index("\nconst P=") + len("\nconst P=")
        return json.JSONDecoder().raw_decode(s, i)[0]
    except Exception as e:
        log("couldn't read the photo list from the Library:", e); return []


PHOTO = "ph_"       # photo items are stored as ph_<photo id> so they never collide with clip ids


def read_img(path):
    import cv2
    data = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR)


# ---------------------------------------------------------------- scan
def make_app():
    from insightface.app import FaceAnalysis
    import onnxruntime as ort
    avail = ort.get_available_providers()
    prov = [p for p in ("CoreMLExecutionProvider", "CPUExecutionProvider") if p in avail]
    app = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"], providers=prov)
    app.prepare(ctx_id=0, det_size=(1920, 832), det_thresh=0.5)
    log("face model ready —", ", ".join(prov))
    return app


def scan(app_dir, out_dir, db, limit=None):
    import cv2
    lib = os.path.join(app_dir, "Library")
    clips = [json.loads(l) for l in open(os.path.join(lib, "clips.jsonl"), encoding="utf-8")]
    done = {r[0] for r in db.execute("select clip from done")}
    todo = [c for c in clips if c["id"] not in done]
    log(f"{len(clips)} clips, {len(done)} already scanned, {len(todo)} to go")
    if not todo: return
    log("finding contact sheets…")
    sheets = sheet_index(app_dir, todo)
    crops = os.path.join(out_dir, "_faces"); os.makedirs(crops, exist_ok=True)
    app = make_app()
    t0 = time.time(); n = 0; nf = 0
    for c in todo[:limit] if limit else todo:
        p = sheets.get(c["id"])
        img = read_img(p) if p else None
        rows = []
        if img is not None and img.shape[0] > HDR + 100:
            body = img[HDR:]
            th, tw = body.shape[0] / ROWS, body.shape[1] / COLS
            dur = float(c.get("duration") or 0)
            found = []
            for f in app.get(body):
                x1, y1, x2, y2 = [float(v) for v in f.bbox]
                if f.det_score < MIN_SCORE or min(x2 - x1, y2 - y1) < MIN_FACE: continue
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                tile = int(min(ROWS - 1, cy // th)) * COLS + int(min(COLS - 1, cx // tw))
                tx, ty = (tile % COLS) * tw, (tile // COLS) * th
                found.append(dict(e=f.normed_embedding.astype(np.float32), s=float(f.det_score), tile=tile,
                                  t=dur * (tile + 0.5) / (COLS * ROWS),
                                  box=((x1 - tx) / tw, (y1 - ty) / th, (x2 - x1) / tw, (y2 - y1) / th),
                                  abs=(x1, y1, x2, y2), size=min(x2 - x1, y2 - y1)))
            # merge the same person across the 12 frames of this clip
            tracks = []
            for f in sorted(found, key=lambda f: -f["s"] * f["size"]):
                best, bs = None, SAME_IN_CLIP
                for tr in tracks:
                    if f["tile"] in tr["tiles"]: continue          # two faces in one frame are two people
                    s = float(tr["e"] @ f["e"])
                    if s > bs: best, bs = tr, s
                if best is None:
                    tracks.append(dict(e=f["e"].copy(), sum=f["e"].copy(), tiles={f["tile"]}, top=f))
                else:
                    best["sum"] += f["e"]; best["tiles"].add(f["tile"]); best["e"] = best["sum"] / np.linalg.norm(best["sum"])
            tracks = [tr for tr in tracks if tr["top"]["size"] >= SMALL or len(tr["tiles"]) >= 2]
            for k, tr in enumerate(tracks):
                f = tr["top"]; x1, y1, x2, y2 = f["abs"]
                m = 0.35 * max(x2 - x1, y2 - y1)
                X1, Y1 = int(max(0, x1 - m)), int(max(0, y1 - m)); X2, Y2 = int(min(body.shape[1], x2 + m)), int(min(body.shape[0], y2 + m))
                side = max(X2 - X1, Y2 - Y1)
                crop = cv2.resize(body[Y1:Y1 + side, X1:X1 + side], (128, 128), interpolation=cv2.INTER_AREA)
                name = f"{c['id']}_{k}.jpg"
                cv2.imwrite(os.path.join(crops, name), crop, [cv2.IMWRITE_JPEG_QUALITY, 82])
                rows.append((c["id"], round(f["t"], 2), len(tr["tiles"]), *[round(v, 4) for v in f["box"]], round(f["s"], 3),
                             tr["e"].astype(np.float16).tobytes(), name, None))
        db.executemany("insert into faces(clip,t,frames,x,y,w,h,score,emb,crop,person) values(?,?,?,?,?,?,?,?,?,?,?)", rows)
        db.execute("insert or replace into done values(?,?,?)", (c["id"], len(rows), time.time()))
        n += 1; nf += len(rows)
        if n % 50 == 0:
            db.commit()
            el = time.time() - t0; rate = n / el
            log(f"{n}/{len(todo)} clips · {nf} people-in-clip found · {rate:.1f} clips/s · ~{(len(todo) - n) / rate / 60:.0f} min left")
    db.commit()
    log(f"scan finished: {n} clips, {nf} faces")


def scan_photos(app_dir, out_dir, db, limit=None, app=None):
    import cv2
    lib = os.path.join(app_dir, "Library")
    photos = load_photos(lib)
    done = {r[0] for r in db.execute("select clip from done where clip like 'ph_%'")}
    todo = [p for p in photos if PHOTO + p["id"] not in done]
    log(f"{len(photos)} edited photos, {len(photos) - len(todo)} already scanned, {len(todo)} to go")
    if not todo: return
    crops = os.path.join(out_dir, "_faces"); os.makedirs(crops, exist_ok=True)
    app = app or make_app()
    keep = app.det_model.input_size; app.det_model.input_size = (1024, 1024)
    t0 = time.time(); n = nf = 0
    for p in (todo[:limit] if limit else todo):
        key = PHOTO + p["id"]; rows = []
        img = read_img(os.path.join(lib, "_photos", "web", p["id"] + ".jpg"))
        if img is not None:
            H, W = img.shape[:2]
            for k, f in enumerate(sorted(app.get(img), key=lambda f: -f.det_score)):
                x1, y1, x2, y2 = [float(v) for v in f.bbox]
                size = min(x2 - x1, y2 - y1)
                if f.det_score < MIN_SCORE or size < 24: continue
                m = 0.35 * max(x2 - x1, y2 - y1)
                X1, Y1 = int(max(0, x1 - m)), int(max(0, y1 - m)); side = int(max(x2 - x1, y2 - y1) + 2 * m)
                crop = cv2.resize(img[Y1:Y1 + side, X1:X1 + side], (128, 128), interpolation=cv2.INTER_AREA)
                name = f"{key}_{len(rows)}.jpg"
                cv2.imwrite(os.path.join(crops, name), crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
                rows.append((key, 0, 1, round(x1 / W, 4), round(y1 / H, 4), round((x2 - x1) / W, 4), round((y2 - y1) / H, 4),
                             round(float(f.det_score), 3), f.normed_embedding.astype(np.float16).tobytes(), name, None, round(size, 1)))
        db.executemany("insert into faces(clip,t,frames,x,y,w,h,score,emb,crop,person,px) values(?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        db.execute("insert or replace into done values(?,?,?)", (key, len(rows), time.time()))
        n += 1; nf += len(rows)
        if n % 50 == 0:
            db.commit(); rate = n / (time.time() - t0)
            log(f"{n}/{len(todo)} photos · {nf} faces · {rate:.1f} photos/s · ~{(len(todo) - n) / rate / 60:.0f} min left")
    app.det_model.input_size = keep
    db.commit()
    log(f"photo scan finished: {n} photos, {nf} faces")


# ---------------------------------------------------------------- edits made on the People page
def load_edits(out_dir):
    p = os.path.join(out_dir, "edits.json")
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return []


# ---------------------------------------------------------------- "add person from photo"
def save_edits(out_dir, edits):
    p = os.path.join(out_dir, "edits.json"); tmp = p + ".tmp"
    json.dump(edits, open(tmp, "w", encoding="utf-8"), indent=0); os.replace(tmp, p)
    js = os.path.join(out_dir, "edits.js"); open(js + ".tmp", "w", encoding="utf-8").write("window.BM_PEOPLE_EDITS=" + json.dumps(edits) + ";\n"); os.replace(js + ".tmp", js)


def known(out_dir, db, app=None):
    """People/known/<Full Name>.jpg  →  find that face among the people already found and name them.
    Results go to People/known.json (shown on the People page) and the names to edits.json like any other name."""
    import cv2
    kd = os.path.join(out_dir, "known"); os.makedirs(kd, exist_ok=True)
    kj = os.path.join(out_dir, "known.json")
    try: done = json.load(open(kj, encoding="utf-8"))
    except Exception: done = {}
    files = [f for f in sorted(os.listdir(kd)) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")) and f not in done]
    if not files: return
    ppl = db.execute("select id, centre, clips from people").fetchall()
    if not ppl: log("no people yet — run the scan first"); return
    P = np.array([r[0] for r in ppl]); C = np.stack([emb_load(r[1]) for r in ppl]); C /= np.linalg.norm(C, axis=1, keepdims=True)
    app = app or make_app(); keep = app.det_model.input_size; app.det_model.input_size = (640, 640)
    edits = load_edits(out_dir); now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    for f in files:
        name = re.sub(r"[_]+", " ", os.path.splitext(f)[0]).strip()
        img = read_img(os.path.join(kd, f)); res = {"name": name, "at": now}
        faces = app.get(img) if img is not None else []
        if not faces: res.update(ok=False, why="No face found in that photo — try a clearer, front-facing one.")
        else:
            fc = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
            sims = C @ fc.normed_embedding.astype(np.float32); order = np.argsort(-sims)[:3]
            best = int(order[0]); sim = float(sims[best])
            res.update(candidates=[[int(P[k]), round(float(sims[k]), 3)] for k in order])
            if sim >= KNOWN_MATCH:
                pid = int(P[best]); res.update(ok=True, pid=pid, sim=round(sim, 3))
                edits.append({"id": "known-" + uid_(), "at": now, "op": "name", "pid": pid, "name": name, "source": "photo"})
            else: res.update(ok=False, why=f"No confident match yet (closest {sim:.2f}). They may not be in the footage, or need a clearer photo.")
        done[f] = res; log(f"known face {name}: " + (f"matched person {res['pid']} ({res['sim']})" if res.get("ok") else res["why"]))
    app.det_model.input_size = keep
    save_edits(out_dir, edits); json.dump(done, open(kj, "w", encoding="utf-8"), indent=1)
    open(os.path.join(out_dir, "known.js"), "w", encoding="utf-8").write("window.BM_KNOWN=" + json.dumps(done) + ";\n")


def uid_():
    import random, string
    return "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(10))


# ---------------------------------------------------------------- cluster
class DSU:
    def __init__(s, n): s.p = list(range(n))
    def f(s, a):
        while s.p[a] != a: s.p[a] = s.p[s.p[a]]; a = s.p[a]
        return a
    def u(s, a, b): s.p[s.f(a)] = s.f(b)


def cluster(db, out_dir, knn=None):
    rows = db.execute("select id, clip, emb, person, coalesce(px, w*480), frames from faces where emb is not null").fetchall()
    if not rows: log("no faces yet"); return
    ids = np.array([r[0] for r in rows]); clip = [r[1] for r in rows]; old = {r[0]: r[3] for r in rows}
    E = np.stack([emb_load(r[2]) for r in rows]); E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-9
    N = len(E); K = min(12, N - 1)
    if K < 1: log('not enough faces to cluster'); return
    log(f"clustering {N} faces…")
    if knn is not None and len(knn[0]) == N: nn, ns = knn
    else:
        nn = np.zeros((N, K), dtype=np.int64); ns = np.zeros((N, K), dtype=np.float32)
        for i in range(0, N, 2048):
            S = E[i:i + 2048] @ E.T
            for j in range(S.shape[0]): S[j, i + j] = -1
            idx = np.argpartition(-S, K, axis=1)[:, :K]
            nn[i:i + 2048] = idx; ns[i:i + 2048] = np.take_along_axis(S, idx, axis=1)
    # Merge by strongest links first, but only when the two GROUPS (not just two faces) look alike.
    # Plain single-link chaining glues different people together through blurry/side-on faces.
    qual = np.array([r[4] for r in rows], dtype=np.float32)            # face size on the sheet (px)
    frames = np.array([r[5] for r in rows], dtype=np.float32)
    good = (qual >= SMALL) | (frames >= 3)                              # tiny one-off faces never seed links
    # people already NAMED on the People page are locked: their faces keep their person, and new groups
    # only join them when they clearly match. Nobody has to re-check a name after a re-scan.
    fd = {str(int(i)): [clip[k], 0, old[int(i)]] for k, i in enumerate(ids)}
    names, _hidden, _alias = apply_edits(None, fd, load_edits(out_dir))
    named = {p for p, nm in names.items() if nm}
    fixed = {k: fd[str(int(i))][2] for k, i in enumerate(ids) if fd[str(int(i))][2] in named}
    for k in fixed: good[k] = False
    ncent = {}
    for p in named:
        m = [k for k, q in fixed.items() if q == p]
        if m: v = E[m].mean(0); ncent[p] = v / np.linalg.norm(v)
    if named: log(f"{len(named)} named people locked ({len(fixed)} faces)")
    edges = []; nnset = [set(r.tolist()) for r in nn]
    for i in range(N):
        if not good[i]: continue
        for j, sv in zip(nn[i], ns[i]):
            if sv >= LINK and good[j] and i < j and i in nnset[j]: edges.append((float(sv), i, int(j)))
    edges.sort(reverse=True)
    d = DSU(N); csum = E.copy(); cnt = np.ones(N)
    for sv, i, j in edges:
        a, b = d.f(i), d.f(j)
        if a == b: continue
        ca = csum[a] / np.linalg.norm(csum[a]); cb = csum[b] / np.linalg.norm(csum[b])
        if float(ca @ cb) < GROUP_SIM: continue
        d.p[a] = b; csum[b] += csum[a]; cnt[b] += cnt[a]
    groups = collections.defaultdict(list)
    for i in range(N):
        if i not in fixed: groups[d.f(i)].append(i)
    # clean each group: drop faces that don't fit it, then drop groups that don't hold together
    # (piles of side profiles / backs of heads look alike to the model but aren't one person)
    clean = []; once = 0
    for g in groups.values():
        if len(g) >= 2:
            for _ in range(2):
                c = E[g].mean(0); c /= np.linalg.norm(c)
                g = [i for i in g if float(E[i] @ c) >= FIT]
                if len(g) < 2: break
            if len(g) >= 2:
                c = E[g].mean(0); c /= np.linalg.norm(c)
                if float((E[g] @ c).mean()) < COHESION: continue
        if len(g) >= 2 and len({clip[i] for i in g}) >= 2:
            clean.append(g); continue
        # seen in one clip only: a clear face is still kept, so the People page can show who was found
        # (it lists them under "Seen once"); tiny one-off faces are dropped
        g = [i for i in g if good[i]]
        if g: clean.append(g); once += 1
    groups = clean
    if once: log(f"{once} faces seen in one clip only (shown under Seen once)")
    # keep person ids stable across runs: reuse the old id that most of a group's faces had
    used = set(named) & set(ncent); assign = {int(ids[k]): p for k, p in fixed.items()}
    prev_max = db.execute("select coalesce(max(id),0) from people").fetchone()[0]
    nxt = max([prev_max] + [p for p in named if isinstance(p, int) and p < 900000]) + 1
    NP = list(ncent); NC = np.stack([ncent[p] for p in NP]) if NP else None
    for g in sorted(groups, key=len, reverse=True):
        if NC is not None:
            c = E[g].mean(0); c /= np.linalg.norm(c); sims = NC @ c; b = int(sims.argmax())
            if sims[b] >= JOIN_NAMED:
                for i in g: assign[int(ids[i])] = NP[b]
                continue
        votes = collections.Counter(old[ids[i]] for i in g if old[ids[i]] is not None and old[ids[i]] not in named)
        pid = next((p for p, _ in votes.most_common() if p not in used), None)
        if pid is None: pid = nxt; nxt += 1
        used.add(pid)
        for i in g: assign[int(ids[i])] = pid
    # faces that didn't make a group but are close to a group's centre join it
    members = collections.defaultdict(list)
    for k, i in enumerate(ids):
        p = assign.get(int(i))
        if p is not None: members[p].append(k)
    cent = {}
    for pid in used:
        v = E[members[pid]].mean(0); cent[pid] = v / np.linalg.norm(v)
    if cent:
        P = np.array(list(cent.keys())); C = np.stack([cent[p] for p in P])
        loose = [k for k, i in enumerate(ids) if int(i) not in assign and k not in fixed]
        for s in range(0, len(loose), 4096):
            ch = loose[s:s + 4096]; S = E[ch] @ C.T; b = S.argmax(1)
            for k, bi, sv in zip(ch, b, S[np.arange(len(ch)), b]):
                if sv >= MATCH_NAMED: assign[int(ids[k])] = int(P[bi])
    db.execute("update faces set person=null")
    db.executemany("update faces set person=? where id=?", [(p, f) for f, p in assign.items()])
    db.execute("delete from people")
    members = collections.defaultdict(list)
    for k, i in enumerate(ids):
        p = assign.get(int(i))
        if p is not None: members[p].append(k)
    for pid in used:
        m = members[pid]
        v = E[m].mean(0); v /= np.linalg.norm(v)
        cover = int(db.execute("select id from faces where person=? order by coalesce(px, w*480)*score*min(frames,3) desc limit 1", (pid,)).fetchone()[0])
        db.execute("insert into people values(?,?,?,?,?,?)", (pid, len(m), len({clip[k] for k in m}), cover, v.astype(np.float16).tobytes(), time.time()))
    db.commit()
    log(f"{len(used)} people found; {len(assign)} of {N} faces belong to someone")


# ---------------------------------------------------------------- export (people.js)
def apply_edits(people, faces, edits):
    """people: pid -> dict; faces: fid -> [clip,t,pid,...]. Edits replay in order."""
    names = {}; hidden = set(); alias = {}
    last_reset = max([e.get("at", "") for e in edits if e.get("op") == "reset"] or [""])
    edits = [e for e in edits if e.get("op") != "reset" and (not last_reset or e.get("at", "") > last_reset)]
    def root(p):
        while p in alias: p = alias[p]
        return p
    for e in edits:
        op = e.get("op")
        if op == "name": names[root(e["pid"])] = e.get("name") or None
        elif op == "hide": (hidden.add if e.get("hidden", True) else hidden.discard)(root(e["pid"]))
        elif op == "merge" and e["from"] != e["into"]: alias[e["from"]] = e["into"]
        elif op == "move" and str(e["face"]) in faces: faces[str(e["face"])][2] = e.get("to")
    for f in faces.values():
        if f[2] is not None and f[2] in alias: f[2] = root(f[2])
    return names, hidden, alias


def export(app_dir, out_dir, db):
    lib = os.path.join(app_dir, "Library")
    clips = {c["id"]: c for c in (json.loads(l) for l in open(os.path.join(lib, "clips.jsonl"), encoding="utf-8"))}
    photos = {PHOTO + p["id"]: p for p in load_photos(lib)}
    meta = dict(clips); meta.update(photos)
    ppl = {r[0]: dict(id=r[0], cover=r[3], centre=emb_load(r[4])) for r in db.execute("select * from people")}
    faces = {str(r[0]): [r[1], r[2], r[3], r[4], r[5]] for r in
             db.execute("select id, clip, t, person, frames, crop from faces where person is not null").fetchall()}
    crop_of = {str(r[0]): r[1] for r in db.execute("select id, crop from faces where person is not null")}
    edits = load_edits(out_dir)
    names, hidden, alias = apply_edits(ppl, faces, edits)
    by = collections.defaultdict(list)
    for fid, f in faces.items():
        if f[2] is not None: by[f[2]].append(fid)
    out = []
    for pid, fl in by.items():
        if pid in alias: continue
        cl = {faces[f][0] for f in fl}
        hint = collections.Counter(meta[c]["client"] for c in cl if c in meta).most_common(3)
        shoots = collections.Counter(meta[c]["shoot"] for c in cl if c in meta).most_common(3)
        cover = str(ppl[pid]["cover"]) if pid in ppl and str(ppl[pid]["cover"]) in faces and faces[str(ppl[pid]["cover"])][2] == pid else \
            max(fl, key=lambda f: faces[f][3])
        out.append(dict(id=pid, name=names.get(pid), hidden=pid in hidden, clips=sum(1 for c in cl if not c.startswith(PHOTO)),
                        photos=sum(1 for c in cl if c.startswith(PHOTO)), faces=len(fl), cover=cover,
                        hint=[[h, n] for h, n in hint], shoots=[[s, n] for s, n in shoots]))
    # "same person?" suggestions between unmerged people
    live = [p for p in out if p["id"] in ppl]
    if len(live) > 1:
        C = np.stack([ppl[p["id"]]["centre"] for p in live]); C /= np.linalg.norm(C, axis=1, keepdims=True)
        S = C @ C.T
        for i, p in enumerate(live):
            S[i, i] = -1; j = np.argsort(-S[i])[:3]
            p["similar"] = [live[k]["id"] for k in j if S[i, k] >= SIMILAR]
    out.sort(key=lambda p: -(p["clips"] + p["photos"]))
    used_ph = {v[0] for v in faces.values() if v[2] is not None and v[0].startswith(PHOTO)}
    data = dict(v=1, generated=time.strftime("%Y-%m-%d %H:%M"), scanned=db.execute("select count(*) from done").fetchone()[0],
                found=db.execute("select count(*) from faces").fetchone()[0],
                people=out, faces={f: [v[0], v[1], v[2], v[3], crop_of[f]] for f, v in faces.items() if v[2] is not None},
                photos={k: [photos[k]["id"], photos[k].get("client"), photos[k].get("shoot"), photos[k].get("shoot_date"),
                            photos[k].get("w"), photos[k].get("h"), photos[k].get("set")] for k in used_ph if k in photos},
                edits=len(edits))
    js = "window.BM_PEOPLE=" + json.dumps(data, separators=(",", ":")) + ";\n"
    tmp = os.path.join(out_dir, "people.js.tmp"); open(tmp, "w", encoding="utf-8").write(js); os.replace(tmp, os.path.join(out_dir, "people.js"))
    named = sum(1 for p in out if p["name"])
    log(f"people.js written: {len(out)} people ({named} named), {len(data['faces'])} faces, {len(js) / 1e6:.1f} MB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", required=True); ap.add_argument("--only", choices=["scan", "photos", "cluster", "export", "known"]); ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    out = os.path.join(a.app, "People"); os.makedirs(out, exist_ok=True)
    db = db_open(os.path.join(out, "faces.db"))
    if a.only in (None, "scan"): scan(a.app, out, db, a.limit)
    if a.only in (None, "scan", "photos"): scan_photos(a.app, out, db, a.limit)
    if a.only in (None, "cluster"): cluster(db, out)
    if a.only in (None, "known"): known(out, db)
    if a.only in (None, "cluster", "export", "known"): export(a.app, out, db)
    log("done.")
