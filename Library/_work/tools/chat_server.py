"""Bahlman Library chat — a private assistant over the whole footage library, running on this Mac.
Started by "Start Library Chat.command". Listens on http://127.0.0.1:8766 (this computer only).
  GET  /health -> status
  POST /chat   {"messages":[{"role","content"}...], "client": "<current client page or ''>"}
               -> streamed lines of JSON: {"refs":[clip ids]} first, then {"t":"text"} chunks, then {"done":true}
Answers come from a local Ollama model, fed with what the library knows: clip descriptions, tags, clients, shoots,
dates and (as they finish) the Whisper transcripts. Nothing leaves the computer. Footage is never touched."""
import os, sys, json, re, sqlite3, time, threading, urllib.request, subprocess, shutil
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.abspath(os.path.join(HERE, "..", ".."))
TXD = os.path.join(OUT, "_work", "transcripts")
MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen2.5:7b"
OLLAMA = "http://127.0.0.1:11434"
PORT = 8766
STOP = set("""a an the and or but if of to in on at for with from by about into over under is are was were be been being do does did
have has had i me my we our you your he she it they them this that these those what which who whom whose where when why how all any
some can could would should will shall may might must just also than then there here not no yes so very more most such only own same
too s t don get got find show give tell list clip clips video videos footage shot shots any anything something one ones please want need
look looking like""".split())
LINKS = json.load(open(os.path.join(HERE, "tx_links.json"))) if os.path.exists(os.path.join(HERE, "tx_links.json")) else {}

def db():
    c = sqlite3.connect(f"file:{os.path.join(OUT, 'footage.db')}?mode=ro", uri=True, check_same_thread=False)
    c.row_factory = sqlite3.Row; return c
CL = db()
CLIENTS = [r[0] for r in CL.execute("select distinct client from clips where client is not null")]

# ---------- transcript index (rebuilt incrementally from _work/transcripts/*.json) ----------
TXDB = os.path.join(os.path.expanduser("~/Library/Caches"), "bahlman_tx_index.db")
TX = sqlite3.connect(TXDB, check_same_thread=False); TXL = threading.Lock(); _last = [0]
TX.executescript("""create table if not exists done(cid text primary key);
create virtual table if not exists seg using fts5(text, cid unindexed, start unindexed, stop unindexed);""")
def refresh_tx(force=False):
    if not force and time.time() - _last[0] < 60: return
    _last[0] = time.time()
    if not os.path.isdir(TXD): return
    with TXL:
        have = {r[0] for r in TX.execute("select cid from done")}
        new = [f[:-5] for f in os.listdir(TXD) if f.endswith(".json") and not f.startswith("_") and f[:-5] not in have]
        for cid in new:
            try: raw = json.load(open(os.path.join(TXD, cid + ".json")))
            except Exception: continue
            rows = [(s["text"].strip(), cid, s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000)
                    for s in raw.get("transcription", []) if s.get("text", "").strip()]
            if len(rows) == 1 and len(rows[0][0].split()) <= 3: rows = []        # "Thank you." on a silent clip
            TX.executemany("insert into seg(text,cid,start,stop) values(?,?,?,?)", rows)
            TX.execute("insert or ignore into done values(?)", (cid,))
        TX.commit()
def tx_count():
    with TXL: return TX.execute("select count(*) from done").fetchone()[0]

# ---------- retrieval ----------
def words(q):
    return [w for w in re.findall(r"[a-z0-9']+", q.lower()) if len(w) > 2 and w not in STOP][:12]
def fts(ws):
    return " OR ".join(f'"{w}"*' for w in ws)
def mmss(s):
    s = int(s); return f"{s//3600}:{s//60%60:02d}:{s%60:02d}" if s >= 3600 else f"{s//60}:{s%60:02d}"
def clients_in(text):
    t = text.lower(); return [c for c in CLIENTS if c.lower() in t or c.split()[0].lower() in t.split() and len(c.split()[0]) > 3]

def context(question, history, page_client):
    ws = words(question + " " + " ".join(m["content"] for m in history[-2:] if m["role"] == "user"))
    named = clients_in(question) or ([page_client] if page_client else [])
    where, args = "", []
    if named: where = " and c.client in (%s)" % ",".join("?" * len(named)); args = named
    parts, refs = [], []
    # library overview (always): clients with counts, hours, dates
    rows = CL.execute("select client, count(*) n, round(sum(duration)/3600,1) h, count(distinct shoot) s, min(shoot_date) a, max(shoot_date) b from clips group by client order by n desc").fetchall()
    parts.append("LIBRARY OVERVIEW (client: clips, hours, shoots, dates)\n" + "\n".join(f"- {r['client']}: {r['n']} clips, {r['h']} h, {r['s']} shoots, {r['a'] or '?'} to {r['b'] or '?'}" for r in rows))
    for c in named[:2]:   # shoots of the client being discussed
        ss = CL.execute("select shoot, min(shoot_date) d, count(*) n from clips where client=? group by shoot order by d desc limit 80", (c,)).fetchall()
        parts.append(f"SHOOTS FOR {c} (newest first)\n" + "\n".join(f"- {r['d'] or '?'} {r['shoot']} ({r['n']} clips)" for r in ss))
    seen = {}
    if ws:
        q = fts(ws)
        hits = CL.execute(f"""select c.id, c.client, c.shoot, c.shoot_date, c.file, c.duration, c.content, c.description, c.tags
            from clips_fts f join clips c on c.id=f.id where clips_fts match ? {where} order by bm25(clips_fts) limit 30""", [q] + args).fetchall()
        for r in hits: seen[r["id"]] = r
        refresh_tx()
        with TXL:
            th = TX.execute("select cid, start, stop, text from seg where seg match ? order by bm25(seg) limit 120", (q,)).fetchall()
        quotes, per = [], {}
        for cid, st, sp, text in th:
            c = CL.execute("select id, client, shoot, shoot_date, file, duration, content, description, tags from clips where id=?", (cid,)).fetchone()
            if not c or (named and c["client"] not in named): continue
            if per.get(cid, 0) >= 3 or len(quotes) >= 30: continue
            per[cid] = per.get(cid, 0) + 1; seen.setdefault(cid, c)
            with TXL:
                around = TX.execute("select text from seg where cid=? and start between ? and ? order by start", (cid, st - 20, st + 25)).fetchall()
            quotes.append(f'[{cid} @ {mmss(st)}] "{" ".join(a[0] for a in around)[:600]}"')
        if quotes: parts.append("TRANSCRIPT MATCHES (what was actually said, with clip id and time)\n" + "\n".join(quotes))
    if not seen and named:   # nothing matched the words: show a sample of that client's clips
        for r in CL.execute("select id, client, shoot, shoot_date, file, duration, content, description, tags from clips where client=? order by shoot_date desc limit 25", (named[0],)): seen[r["id"]] = r
    if seen:
        parts.append("MATCHING CLIPS\n" + "\n".join(
            f"[{r['id']}] {r['client']} · {r['shoot']} · {r['shoot_date'] or '?'} · {r['file']} · {mmss(r['duration'] or 0)} · {r['content']} — {r['description']}"
            for r in list(seen.values())[:40]))
        refs = list(seen)[:40]
    return "\n\n".join(parts), refs


# ---------- in-Library video player ----------
# /clip/<id>          the original file, streamed with byte ranges (for codecs the browser can play natively)
# /play/<id>?t=sec    live H.264 1080p transcode from second t (for 10-bit 4:2:2, ProRes, etc.), fragmented MP4
# /probe/<id>         {"direct": true|false, "duration": s}
# Only files that are clips in footage.db and live under /Volumes or a footage folder in siftor.json are ever served.
# Footage is only read.
FF = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"; FP = shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"
_probe = {}
try: _enc = subprocess.run([FF, "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=10).stdout
except Exception: _enc = ""
VENC = ["-c:v", "h264_videotoolbox", "-b:v", "10M", "-realtime", "1"] if "h264_videotoolbox" in _enc else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21"]
def _footage_roots():
    try: fs = json.load(open(os.path.join(OUT, "..", "siftor.json"))).get("footage_folders", [])
    except Exception: fs = []
    return tuple(["/Volumes/"] + [os.path.expanduser(f["path"]).rstrip("/") + "/" for f in fs if f.get("path")])
ROOTS = _footage_roots()
def clip_path(cid):
    r = CL.execute("select abs_path, duration from clips where id=?", (cid,)).fetchone()
    if not r or not r[0] or not r[0].startswith(ROOTS) or "/../" in r[0]: return None, 0
    return r[0], r[1] or 0
def probe(cid):
    if cid in _probe: return _probe[cid]
    p, dur = clip_path(cid)
    if not p or not os.path.exists(p): return None
    try:
        o = json.loads(subprocess.run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,profile,pix_fmt",
                                       "-of", "json", p], capture_output=True, text=True, timeout=20).stdout)["streams"][0]
    except Exception: o = {}
    c, prof, pix = o.get("codec_name"), (o.get("profile") or ""), (o.get("pix_fmt") or "")
    ext = os.path.splitext(p)[1].lower()
    direct = ext in (".mp4", ".mov", ".m4v") and (
        (c == "h264" and pix in ("yuv420p", "yuvj420p") and "4:2:2" not in prof and "10" not in prof) or
        (c == "hevc" and pix in ("yuv420p", "yuvj420p", "yuv420p10le")))
    _probe[cid] = {"direct": direct, "duration": dur, "codec": c, "pix": pix}
    return _probe[cid]

SYSTEM = """You are the assistant inside the Bahlman Media footage library — a private, offline catalogue of Eric Bahlman's video
shoots (clips with descriptions, clients, shoots, dates, and transcripts of what people said). Answer using ONLY the library
information below. Be concise and practical, like a sharp assistant editor.
- Always point to clips by id in square brackets, e.g. [X1234]. When quoting a transcript, include the time: [U00123 @ 12:34].
- If the information below doesn't contain the answer, say so plainly and suggest a better search; never invent clips, quotes or facts.
- Counts and dates come from the LIBRARY OVERVIEW; only claim what it shows.
- Use short paragraphs or a short list. No preamble.
Today: {today}. The user is currently looking at: {page}.

{ctx}"""

class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); self.send_header("Access-Control-Allow-Private-Network", "true")
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith("/people/known"): return self.people_known()
        u = urlparse(self.path); parts = u.path.strip("/").split("/")
        if len(parts) == 2 and parts[0] in ("clip", "play", "probe") and re.fullmatch(r"[A-Z]{1,2}\d{4,5}", parts[1]):
            return self.video(parts[0], parts[1], parse_qs(u.query))
        ok = True
        try: urllib.request.urlopen(OLLAMA + "/api/tags", timeout=2)
        except Exception: ok = False
        body = json.dumps({"ok": True, "model": MODEL, "ollama": ok, "transcripts": tx_count(), "player": True}).encode()
        self.send_response(200); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    def video(self, kind, cid, q):
        if kind == "probe":
            info = probe(cid); body = json.dumps(info or {"missing": True}).encode()
            self.send_response(200 if info else 404); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body); return
        p, dur = clip_path(cid)
        if not p or not os.path.exists(p):
            self.send_response(404); self.cors(); self.end_headers(); return
        try:
            if kind == "clip":
                size = os.path.getsize(p); rng = self.headers.get("Range"); a, b = 0, size - 1
                m = re.match(r"bytes=(\d*)-(\d*)", rng or "")
                if m:
                    if m.group(1): a = int(m.group(1))
                    if m.group(2): b = min(int(m.group(2)), size - 1)
                    if not m.group(1) and m.group(2): a, b = size - int(m.group(2)), size - 1
                self.send_response(206 if m else 200); self.cors()
                self.send_header("Content-Type", "video/quicktime" if p.lower().endswith(".mov") else "video/mp4")
                self.send_header("Accept-Ranges", "bytes"); self.send_header("Content-Length", str(b - a + 1))
                if m: self.send_header("Content-Range", f"bytes {a}-{b}/{size}")
                self.end_headers()
                with open(p, "rb") as f:
                    f.seek(a); left = b - a + 1
                    while left > 0:
                        chunk = f.read(min(1 << 20, left))
                        if not chunk: break
                        self.wfile.write(chunk); left -= len(chunk)
            else:
                t = max(0.0, float((q.get("t") or ["0"])[0]))
                self.send_response(200); self.cors(); self.send_header("Content-Type", "video/mp4"); self.end_headers()
                cmd = [FF, "-v", "error", "-ss", f"{t:.2f}", "-i", p, "-map", "0:v:0", "-map", "0:a:0?",
                       "-vf", "scale=-2:'min(1080,ih)',format=yuv420p", *VENC,
                       "-c:a", "aac", "-b:a", "160k", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "pipe:1"]
                pr = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                try:
                    while True:
                        chunk = pr.stdout.read(1 << 16)
                        if not chunk: break
                        self.wfile.write(chunk)
                finally:
                    pr.kill()
        except (BrokenPipeError, ConnectionResetError): pass
    # ---- /transcribe: Review step (04) sends an uploaded cut; Whisper large-v3 (whisper.cpp) transcribes it on this Mac ----
    def transcribe(self):
        import tempfile, shutil, subprocess, re
        wc = shutil.which("whisper-cli") or shutil.which("whisper-cpp") or shutil.which("/opt/homebrew/bin/whisper-cli") or shutil.which("/opt/homebrew/bin/whisper-cpp")
        model = os.path.expanduser("~/Library/Application Support/BahlmanWhisper/ggml-large-v3.bin")
        def fail(code, msg):
            self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"error": msg}).encode())
        if not wc or not os.path.exists(model): return fail(503, "Whisper is not installed yet - double-click 'Run Transcripts.command' once to set it up.")
        from email.parser import BytesParser; from email.policy import HTTP
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        msg = BytesParser(policy=HTTP).parsebytes(b"Content-Type: " + self.headers.get("Content-Type", "").encode() + b"\r\n\r\n" + body)
        parts = {p.get_param("name", header="content-disposition"): p for p in msg.iter_parts()} if msg.is_multipart() else {}
        if "file" not in parts: return fail(400, "no file")
        fp = parts["file"]; fname = fp.get_filename() or "x.mp4"; speakers = (parts["speakers"].get_payload(decode=True).decode().strip() if "speakers" in parts else "0") == "1"
        tmp = tempfile.mkdtemp(prefix="bm_review_tx_"); src = os.path.join(tmp, "in" + os.path.splitext(fname)[1]); wav = os.path.join(tmp, "a.wav"); base = os.path.join(tmp, "out")
        try:
            with open(src, "wb") as o: o.write(fp.get_payload(decode=True))
            del body, msg, parts
            r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-map", "0:a:0?", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], capture_output=True, text=True, timeout=3600)
            if r.returncode != 0 or not os.path.exists(wav) or os.path.getsize(wav) < 32000: return fail(422, "This file has no usable audio track.")
            n = int(subprocess.run(["sysctl", "-n", "hw.perflevel0.physicalcpu"], capture_output=True, text=True).stdout.strip() or "8")
            cmd = [wc, "-m", model, "-f", wav, "-l", "en", "-t", str(n), "-np", "-oj", "-of", base] + (["-tdrz"] if speakers else [])
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
            if r.returncode != 0 or not os.path.exists(base + ".json"):
                if speakers:  # diarization needs a tinydiarize model; retry plain
                    r = subprocess.run([c for c in cmd if c != "-tdrz"], capture_output=True, text=True, timeout=7200)
                if r.returncode != 0 or not os.path.exists(base + ".json"): return fail(500, "Whisper failed: " + r.stderr[-300:])
            j = json.load(open(base + ".json"))
            segs = []
            for t in j.get("transcription", []):
                txt = (t.get("text") or "").strip(); off = t.get("offsets", {})
                if not txt: continue
                spk = None
                m = re.match(r"^\[?(SPEAKER[_ ]?\w+)\]?:?\s*(.*)$", txt)
                if m: spk, txt = m.group(1), m.group(2)
                segs.append({"start": off.get("from", 0) / 1000.0, "end": off.get("to", 0) / 1000.0, "text": txt, "speaker": spk})
            self.send_response(200); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"language": "English (US)", "model": "whisper large-v3", "segments": segs}).encode())
        except subprocess.TimeoutExpired: return fail(504, "Transcription timed out")
        except (BrokenPipeError, ConnectionResetError): pass
        finally: shutil.rmtree(tmp, ignore_errors=True)
    # ---- /people/known: "Add person from photo" on the People page -> People/known/<name>.jpg, then the face matcher runs ----
    def people_known(self):
        import base64, subprocess
        people = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "People"))
        app = os.path.dirname(people)
        def reply(code, obj):
            self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(obj).encode())
        if self.command == "GET":
            try: return reply(200, {"ok": True, "known": json.load(open(os.path.join(people, "known.json"), encoding="utf-8"))})
            except Exception: return reply(200, {"ok": True, "known": {}})
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except Exception: return reply(400, {"ok": False, "error": "bad json"})
        name = re.sub(r"[^\w .'-]+", "", (req.get("name") or "")).strip()[:80]
        data = req.get("image") or ""
        if not name or "," not in data: return reply(400, {"ok": False, "error": "need a name and a photo"})
        kd = os.path.join(people, "known"); os.makedirs(kd, exist_ok=True)
        fn = name + ".jpg"; open(os.path.join(kd, fn), "wb").write(base64.b64decode(data.split(",", 1)[1]))
        try:   # a re-upload replaces the old result
            kj = os.path.join(people, "known.json"); k = json.load(open(kj, encoding="utf-8")); k.pop(fn, None); json.dump(k, open(kj, "w", encoding="utf-8"), indent=1)
        except Exception: pass
        py = os.path.expanduser("~/Library/Application Support/BahlmanFaces/venv/bin/python")
        if not os.path.exists(py): return reply(503, {"ok": False, "error": "Face recognition isn't set up on this Mac yet - run Run Faces.command once."})
        subprocess.Popen([py, os.path.join(people, "faces_run.py"), "--app", app, "--only", "known"], stdout=open(os.path.join(people, "known_run.log"), "a"), stderr=subprocess.STDOUT, start_new_session=True)
        return reply(200, {"ok": True, "file": fn})
    # ---- /people/edits: names & corrections from the People page -> People/edits.json (+ edits.js for pages opened as files) ----
    def people_edits(self):
        people = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "People"))
        def reply(code, obj):
            self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(obj).encode())
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except Exception: return reply(400, {"ok": False, "error": "bad json"})
        os.makedirs(people, exist_ok=True)
        path = os.path.join(people, "edits.json")
        try: have = json.load(open(path, encoding="utf-8"))
        except Exception: have = []
        ids = {e.get("id") for e in have}
        for e in req.get("edits", []):
            if isinstance(e, dict) and e.get("op") in ("name", "hide", "merge", "move", "reset") and e.get("id") not in ids:
                have.append(e); ids.add(e.get("id"))
        tmp = path + ".tmp"; json.dump(have, open(tmp, "w", encoding="utf-8"), indent=0); os.replace(tmp, path)
        js = os.path.join(people, "edits.js"); open(js + ".tmp", "w", encoding="utf-8").write("window.BM_PEOPLE_EDITS=" + json.dumps(have) + ";\n"); os.replace(js + ".tmp", js)
        return reply(200, {"ok": True, "edits": have})
    # ---- /motion/save: style guides and storyboards from the app -> Motion/styles/<id>.json, Motion/storyboards/<card>.json
    #      (+ styles.js / storyboards.js for pages opened as files). AI tools read them through the footage connector. ----
    def motion_save(self):
        motion = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "Motion"))
        def reply(code, obj):
            self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps(obj).encode())
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except Exception: return reply(400, {"ok": False, "error": "bad json"})
        kind, data = req.get("kind"), req.get("data")
        folder = {"style": "styles", "storyboard": "storyboards", "atlas": os.path.join("atlas", "custom")}.get(kind)
        if not folder or not isinstance(data, dict): return reply(400, {"ok": False, "error": "need kind style|storyboard|atlas and data"})
        sid = re.sub(r"[^a-z0-9-]+", "-", str(data.get("id") or "").lower()).strip("-")[:80]
        if not sid: return reply(400, {"ok": False, "error": "missing id"})
        d = os.path.join(motion, folder); os.makedirs(d, exist_ok=True)
        path = os.path.join(d, sid + ".json")
        example = ""
        if kind == "atlas" and str(data.get("example_data") or "").startswith("data:"):   # a reference's example clip / image
            import base64
            head, b64 = data["example_data"].split(",", 1)
            ext = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}.get(head[5:].split(";")[0], "bin")
            exd = os.path.join(motion, "atlas", "examples"); os.makedirs(exd, exist_ok=True)
            open(os.path.join(exd, sid + "." + ext), "wb").write(base64.b64decode(b64)); example = "atlas/examples/" + sid + "." + ext
        data.pop("example_data", None); data.pop("example_name", None)
        if example: data["example"] = example
        if req.get("delete"):
            if os.path.exists(path): os.replace(path, path + ".deleted")
        else:
            data["id"] = sid; data["saved"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            tmp = path + ".tmp"; json.dump(data, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1); os.replace(tmp, path)
        allv = []
        for f in sorted(os.listdir(d)):
            if f.endswith(".json"):
                try: allv.append(json.load(open(os.path.join(d, f), encoding="utf-8")))
                except Exception: pass
        var = {"style": "BM_MOTION_STYLES", "storyboard": "BM_MOTION_STORYBOARDS", "atlas": "BM_ATLAS_CUSTOM"}[kind]
        js = os.path.join(motion, "atlas", "custom.js") if kind == "atlas" else os.path.join(d, folder + ".js")
        open(js + ".tmp", "w", encoding="utf-8").write("window." + var + "=" + json.dumps(allv, ensure_ascii=False) + ";\n"); os.replace(js + ".tmp", js)
        return reply(200, {"ok": True, "id": sid, "file": os.path.relpath(path, os.path.dirname(motion)), "example": example})
    def do_POST(self):
        if self.path.startswith("/people/edits"): return self.people_edits()
        if self.path.startswith("/motion/save"): return self.motion_save()
        if self.path.startswith("/people/known"): return self.people_known()
        if self.path.startswith("/transcribe"): return self.transcribe()
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        except Exception: self.send_response(400); self.end_headers(); return
        msgs = [m for m in req.get("messages", []) if m.get("role") in ("user", "assistant") and m.get("content")][-8:]
        if not msgs or msgs[-1]["role"] != "user": self.send_response(400); self.end_headers(); return
        page = req.get("client") or ""
        ctx, refs = context(msgs[-1]["content"], msgs[:-1], page)
        sysmsg = SYSTEM.format(today=time.strftime("%Y-%m-%d"), page=page or "the library home", ctx=ctx)
        self.send_response(200); self.cors(); self.send_header("Content-Type", "application/x-ndjson"); self.end_headers()
        send = lambda o: (self.wfile.write((json.dumps(o) + "\n").encode()), self.wfile.flush())
        try:
            send({"refs": refs})
            data = json.dumps({"model": MODEL, "stream": True, "messages": [{"role": "system", "content": sysmsg}] + msgs,
                               "options": {"num_ctx": 16384, "temperature": 0.2}}).encode()
            r = urllib.request.urlopen(urllib.request.Request(OLLAMA + "/api/chat", data=data, headers={"Content-Type": "application/json"}), timeout=600)
            for line in r:
                if not line.strip(): continue
                o = json.loads(line)
                if o.get("message", {}).get("content"): send({"t": o["message"]["content"]})
                if o.get("done"): break
            send({"done": True})
        except (BrokenPipeError, ConnectionResetError): pass
        except Exception as e:
            try: send({"error": f"The local model isn't answering ({e.__class__.__name__}). Is the Library Chat window still open?"})
            except Exception: pass

if __name__ == "__main__":
    refresh_tx(force=True)
    print(f"Library chat ready on http://127.0.0.1:{PORT} — model {MODEL}, {len(CLIENTS)} clients, {tx_count()} transcripts indexed.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
