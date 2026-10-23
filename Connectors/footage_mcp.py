#!/usr/bin/env python3
"""Bahlman footage connector for Claude (Model Context Protocol, stdio). Read-only, except save_style (Motion/styles only).

Lets Claude search the Bahlman archive the way Ideate does — what's seen (AI descriptions/tags), what's said
(Whisper transcripts) and who's in it (face recognition) — and look up a clip's details and where it lives.
It never changes, moves or uploads anything; only the text of search results goes back to Claude.

Standard library only, so the Mac's built-in python3 runs it.  Set up by "Connect Claude.command".
"""
import sys, os, json, re, glob, math, collections, time

APP = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
LIB = os.path.join(APP, "Sean (DON'T TOUCH)")
PEOPLE = os.path.join(APP, "People")
TX = os.path.join(LIB, "_work", "transcripts")
STOP = set("a an the and or of to in on at for with from by as is are be been it its this that these those i we you they he she them our your my me us about into over under up down out very really just like want need make making made video videos clip clips footage shot shots scene scenes show showing get some any few lot lots find me please".split())

_cache = {}
def clips():
    if "clips" not in _cache:
        rows = [json.loads(l) for l in open(os.path.join(LIB, "clips.jsonl"), encoding="utf-8") if l.strip()]
        _cache["clips"] = rows; _cache["byid"] = {c["id"]: c for c in rows}
    return _cache["clips"]

def tok(s): return [w for w in re.findall(r"[a-z0-9][a-z0-9\-']*", str(s or "").lower()) if w not in STOP]
def stem(w): return re.sub(r"(ings?|ed|es|s)$", "", w) if len(w) > 4 else w

def people():
    """Named people from the People page (face recognition), with the clips/photos they appear in."""
    if "people" in _cache: return _cache["people"]
    try:
        s = open(os.path.join(PEOPLE, "people.js"), encoding="utf-8").read()
        data = json.loads(s[s.index("=") + 1:s.rstrip().rindex(";")])
    except Exception:
        _cache["people"] = {}; return {}
    try: edits = json.load(open(os.path.join(PEOPLE, "edits.json"), encoding="utf-8"))
    except Exception: edits = []
    reset = max([e.get("at", "") for e in edits if e.get("op") == "reset"] or [""])
    edits = [e for e in edits if e.get("op") != "reset" and (not reset or e.get("at", "") > reset)]
    names, hidden, alias = {}, set(), {}
    def root(p):
        n = 0
        while p in alias and n < 50: p = alias[p]; n += 1
        return p
    faces = {k: list(v) for k, v in data.get("faces", {}).items()}
    for p in data.get("people", []):
        if p.get("name"): names[p["id"]] = p["name"]
    for e in edits:
        op = e.get("op")
        if op == "name": names[root(e["pid"])] = (e.get("name") or "").strip() or None
        elif op == "hide": (hidden.add if e.get("hidden", True) else hidden.discard)(root(e["pid"]))
        elif op == "merge" and e.get("from") != e.get("into"): alias[e["from"]] = e["into"]
        elif op == "move" and str(e.get("face")) in faces: faces[str(e["face"])][2] = e.get("to")
    by = collections.defaultdict(set)
    for f in faces.values():
        pid = root(f[2]) if f[2] is not None else None
        if pid is not None and names.get(pid) and pid not in hidden: by[names[pid]].add(f[0])
    _cache["people"] = {n: items for n, items in by.items()}
    return _cache["people"]

def clip_summary(c, extra=None):
    d = {"id": c["id"], "file": c.get("file"), "client": c.get("client"), "shoot": c.get("shoot"), "date": c.get("shoot_date"),
         "duration_s": round(c.get("duration") or 0, 1), "format": c.get("orientation"), "description": c.get("description"),
         "content": c.get("content"), "shot": c.get("shot")}
    who = [n for n, items in people().items() if c["id"] in items]
    if who: d["people"] = who
    if extra: d.update(extra)
    return d

# ---------------------------------------------------------------- tools
def search_footage(query="", person=None, client=None, orientation=None, limit=20):
    rows = clips(); terms = [stem(w) for w in tok(query)]
    if person:
        hit = {n: v for n, v in people().items() if person.lower() in n.lower()}
        if not hit: return {"error": f"Nobody named like '{person}' yet. Named people: " + ", ".join(sorted(people())[:40])}
        ids = set().union(*hit.values()); rows = [c for c in rows if c["id"] in ids]
    if client: rows = [c for c in rows if client.lower() in (c.get("client") or "").lower() or client.lower() in (c.get("brand") or "").lower()]
    if orientation: rows = [c for c in rows if (c.get("orientation") or "") == orientation]
    if terms:
        df = collections.Counter()
        docs = []
        for c in rows:
            words = set(stem(w) for w in tok(" ".join([c.get("description") or "", c.get("tags") or "", c.get("content") or "", c.get("shot") or "", c.get("setting") or "", c.get("client") or "", c.get("shoot") or ""])))
            docs.append((c, words)); df.update(words & set(terms))
        N = max(1, len(rows)); scored = []
        for c, words in docs:
            hit = [t for t in terms if t in words]
            if hit: scored.append((sum(math.log(1 + N / (1 + df[t])) for t in hit) * (1 + 0.5 * (len(hit) - 1)), c))
        scored.sort(key=lambda x: -x[0]); rows = [c for _, c in scored]
    else:
        rows = sorted(rows, key=lambda c: c.get("shoot_date") or "", reverse=True)
    return {"total_matches": len(rows), "clips": [clip_summary(c) for c in rows[:max(1, min(int(limit or 20), 100))]]}

def search_spoken(query, limit=15):
    terms = [w for w in tok(query)]
    phrase = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", query.lower())).strip()
    if not terms: return {"error": "Say what to listen for."}
    clips(); out = []
    for p in glob.glob(os.path.join(TX, "*.json")):
        cid = os.path.basename(p)[:-5]; c = _cache["byid"].get(cid)
        if not c: continue
        try: segs = json.load(open(p, encoding="utf-8")).get("transcription", [])
        except Exception: continue
        best = None
        for s in segs:
            t = re.sub(r"\s+", " ", s.get("text") or "").strip(); low = t.lower()
            sc = sum(1 for w in terms if w in low) + (len(terms) if len(phrase) > 3 and phrase in low else 0)
            if sc and (not best or sc > best[0]): best = (sc, s.get("offsets", {}).get("from", 0) / 1000, t)
        if best: out.append((best[0], clip_summary(c, {"said": best[2], "at_s": round(best[1], 1)})))
    out.sort(key=lambda x: -x[0])
    return {"transcribed_clips_searched": len(glob.glob(os.path.join(TX, "*.json"))), "matches": [x for _, x in out[:max(1, min(int(limit or 15), 50))]]}

def list_people():
    ppl = people()
    return {"named_people": sorted(([n, sum(1 for i in v if not i.startswith("ph_")), sum(1 for i in v if i.startswith("ph_"))] for n, v in ppl.items()), key=lambda x: -(x[1] + x[2])),
            "note": "Each entry is [name, clips, photos]. Name more people on the People page in the Bahlman app."}

def get_clip(clip_id):
    clips(); c = _cache["byid"].get(clip_id)
    if not c: return {"error": f"No clip {clip_id}"}
    d = clip_summary(c); d.update({"drive": c.get("drive"), "folder": c.get("folder"), "tags": c.get("tags"), "setting": c.get("setting"),
             "has_audio": c.get("has_audio"), "resolution": f'{c.get("width")}x{c.get("height")}',
             "path_on_drive": f'/Volumes/{c.get("drive")}/{c.get("folder")}/{c.get("file")}'})
    sp = os.path.join(TX, clip_id + ".txt")
    if os.path.exists(sp): d["transcript_excerpt"] = open(sp, encoding="utf-8").read()[:1500]
    return d

# ---------------------------------------------------------------- motion: style atlas, client style guides, storyboards
MOTION = os.path.join(APP, "Motion")
def _jload(p, default=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return default
def _atlas():
    a = _jload(os.path.join(MOTION, "atlas", "atlas.json"), []) or []
    for f in sorted(glob.glob(os.path.join(MOTION, "atlas", "custom", "*.json"))):
        e = _jload(f); 
        if e: e.setdefault("category", "Your references"); a.append(e)
    return a
def _styles():
    return [s for s in (_jload(f) for f in sorted(glob.glob(os.path.join(MOTION, "styles", "*.json")))) if s]
def _find_style(client):
    c = (client or "").lower().strip(); ss = _styles()
    return next((s for s in ss if s.get("id") == c), None) or next((s for s in ss if c and c in (s.get("client") or "").lower()), None)

def search_atlas(query="", category=None, limit=12):
    a = _atlas(); words = [w for w in tok(query)]
    if category: a = [x for x in a if category.lower() in (x.get("category") or "").lower()]
    def score(x):
        t = " ".join(str(x.get(k) or "") for k in ("name", "category", "about", "best_for", "motion", "texture", "says")).lower()
        return sum(1 for w in words if w in t)
    if words: a = sorted([x for x in a if score(x)], key=lambda x: -score(x))
    return {"total": len(a), "categories": sorted({x.get("category") for x in _atlas()}), "styles": [
        {k: x.get(k) for k in ("id", "name", "category", "about", "best_for", "engine", "example")} for x in a[:max(1, min(int(limit or 12), 60))]]}

def get_atlas_style(style_id, what="", text="", format="16:9", seconds=4):
    x = next((e for e in _atlas() if e.get("id") == style_id or (e.get("name") or "").lower() == str(style_id).lower()), None)
    if not x: return {"error": f"No atlas style '{style_id}'. Use search_atlas to find one."}
    p = str(x.get("prompt") or "").replace("{what}", what or "{what}").replace("{text}", text or "{text}").replace("{format}", format).replace("{seconds}", str(seconds))
    d = dict(x); d["prompt_filled"] = p
    if x.get("knowledge"): d["knowledge_text"] = motion_knowledge(x["knowledge"]).get("text", "")[:8000]
    return d

def list_styles():
    return {"styles": [{"id": s.get("id"), "client": s.get("client"), "status": s.get("status"), "sentence": s.get("sentence"), "atlas": s.get("atlas", []),
                        "languages": (s.get("motion") or {}).get("languages", [])} for s in _styles()],
            "note": "Client style guides (Motion/styles). 'approved' ones are confirmed by Sean; treat 'draft' as a proposal."}

def get_style(client):
    s = _find_style(client)
    if not s: return {"error": f"No style guide for '{client}' yet.", "existing": [x.get("client") for x in _styles()],
                      "next": "Draft one with save_style, following the bahlman-motion skill (huashu-motion director method), and ask Sean to review it on the Styles page."}
    a = {e["id"]: e for e in _atlas()}
    s = dict(s); s["atlas_styles"] = [{k: a[i].get(k) for k in ("id", "name", "about", "engine", "prompt")} for i in s.get("atlas", []) if i in a]
    return s

def save_style(style):
    """Writes a client style guide to Motion/styles/<id>.json (+ styles.js). Only touches Motion/styles."""
    if isinstance(style, str):
        try: style = json.loads(style)
        except Exception: return {"error": "style must be a JSON object"}
    if not isinstance(style, dict) or not style.get("client"): return {"error": "style needs at least a 'client'"}
    sid = re.sub(r"[^a-z0-9-]+", "-", str(style.get("id") or style["client"]).lower()).strip("-")[:80]
    style["id"] = sid; style.setdefault("status", "draft"); style["saved"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    d = os.path.join(MOTION, "styles"); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, sid + ".json"); json.dump(style, open(p + ".tmp", "w", encoding="utf-8"), ensure_ascii=False, indent=1); os.replace(p + ".tmp", p)
    open(os.path.join(d, "styles.js"), "w", encoding="utf-8").write("window.BM_MOTION_STYLES=" + json.dumps(_styles(), ensure_ascii=False) + ";\n")
    return {"ok": True, "file": f"Motion/styles/{sid}.json", "review": "Sean reviews and approves it on the Styles page (step 03 · Style → Client styles)."}

def list_storyboards():
    out = []
    for f in sorted(glob.glob(os.path.join(MOTION, "storyboards", "*.json")), key=os.path.getmtime, reverse=True):
        s = _jload(f) or {}
        out.append({"id": s.get("id"), "title": s.get("title"), "client": s.get("client"), "style": s.get("style"), "beats": len(s.get("beats") or []), "seconds": s.get("total_seconds"), "look": (s.get("look") or {}).get("name"), "checklist_tasks": len((s.get("edit") or {}).get("include") or []), "updated": s.get("updated")})
    return {"storyboards": out}

def get_storyboard(card_or_title):
    q = (card_or_title or "").lower()
    for f in glob.glob(os.path.join(MOTION, "storyboards", "*.json")):
        s = _jload(f) or {}
        if s.get("id", "").lower() == q or q in (s.get("title") or "").lower():
            st = _find_style(s.get("style") or "") if s.get("style") else None
            s["style_guide"] = st or None
            if not st: s["warning"] = "No style guide picked for this storyboard — ask Sean which look to use, or use get_style on the client."
            return s
    return {"error": f"No storyboard matching '{card_or_title}'.", "available": list_storyboards()["storyboards"][:15]}

def motion_knowledge(path):
    """Reads a design/build guide from the motion skills (Motion/skills/...) — e.g. a style guide's knowledge refs."""
    p = str(path or "")
    m = re.match(r"(huashu|remotion):(.+)", p)
    if m:
        src, rest = m.group(1), m.group(2).split("#")[0]
        if src == "huashu":
            lib = "library/" if re.match(r"(languages/|techniques$|formats$|README$|product-fit$)", rest) else ""
            p = f"skills/huashu-motion/references/{lib}{rest}.md"
        else: p = f"skills/remotion/{rest}.md" if "/" in rest else f"skills/remotion/{rest}/SKILL.md"
    full = os.path.realpath(os.path.join(MOTION, p.split("#")[0]))
    if not full.startswith(os.path.realpath(MOTION) + os.sep) or not os.path.isfile(full): return {"error": f"Not found: {p}"}
    return {"file": "Motion/" + os.path.relpath(full, os.path.realpath(MOTION)), "text": open(full, encoding="utf-8").read()[:30000]}

TOOLS = [
 {"name": "search_footage", "description": "Search the Bahlman Media footage archive by what's SEEN in the clips (AI descriptions and tags). Optionally only clips where a named person appears (face recognition), or from one client, or one orientation. Read-only.",
  "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "description": "What you're looking for, e.g. 'drone sunset over lake' or 'speaker on stage with crowd'"},
   "person": {"type": "string", "description": "Only clips this named person is in"}, "client": {"type": "string"}, "orientation": {"type": "string", "enum": ["horizontal", "vertical"]},
   "limit": {"type": "integer", "default": 20}}}},
 {"name": "search_spoken", "description": "Search what's SAID in the footage (Whisper transcripts). Returns the matching line and the second it's said at. Only transcribed clips are searchable.",
  "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "default": 15}}, "required": ["query"]}},
 {"name": "list_people", "description": "List the people named in the face-recognition library, with how many clips and photos each appears in.", "inputSchema": {"type": "object", "properties": {}}},
 {"name": "get_clip", "description": "Full details of one clip by id (e.g. X0339): description, client, shoot, where the file lives on the drive, transcript excerpt.",
  "inputSchema": {"type": "object", "properties": {"clip_id": {"type": "string"}}, "required": ["clip_id"]}},
 {"name": "search_atlas", "description": "Search the Style Atlas — every visual style the Bahlman motion tools can make (106+: explainer looks, print, paper, retro, data, huashu-motion languages, Sean's own references). Returns ids to use with get_atlas_style.",
  "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}, "category": {"type": "string"}, "limit": {"type": "integer", "default": 12}}}},
 {"name": "get_atlas_style", "description": "Full details of one atlas style: look, palette, type, texture, motion, which engine builds it (hyperframes/huashu-motion or remotion), and its prompt filled in with what/text/format/seconds.",
  "inputSchema": {"type": "object", "properties": {"style_id": {"type": "string"}, "what": {"type": "string"}, "text": {"type": "string"}, "format": {"type": "string", "enum": ["16:9", "9:16"]}, "seconds": {"type": "number"}}, "required": ["style_id"]}},
 {"name": "list_styles", "description": "List client motion style guides (palette, type, motion languages, atlas looks, per-graphic rules) decided before editing.", "inputSchema": {"type": "object", "properties": {}}},
 {"name": "get_style", "description": "The full motion style guide for a client — read it before making any graphic for that client.", "inputSchema": {"type": "object", "properties": {"client": {"type": "string"}}, "required": ["client"]}},
 {"name": "save_style", "description": "Create or update a client motion style guide (writes Motion/styles/<id>.json only). Use the bahlman-motion skill's format; leave status 'draft' for Sean to approve.", "inputSchema": {"type": "object", "properties": {"style": {"type": "object"}}, "required": ["style"]}},
 {"name": "list_storyboards", "description": "List the edit packages saved from Pipeline cards (checklist, look, storyboard beats, style).", "inputSchema": {"type": "object", "properties": {}}},
 {"name": "get_storyboard", "description": "A reel's edit package by card id or title: the edit checklist (tasks to do in Premiere, each with its options and the Cuddle tools that do it, plus what to skip and Sean's notes), the reel's look (atlas style + filled prompt + example), the client's style guide, and the storyboard beats (timing, footage with drive path, the graphic each needs, notes).", "inputSchema": {"type": "object", "properties": {"card_or_title": {"type": "string"}}, "required": ["card_or_title"]}},
 {"name": "motion_knowledge", "description": "Read a design or build guide from the motion skills, e.g. 'huashu:languages/kinetic-type', 'huashu:rhythm', 'remotion:remotion-captions', or a path under Motion/.", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}},
]
FN = {"search_footage": search_footage, "search_spoken": search_spoken, "list_people": list_people, "get_clip": get_clip,
      "search_atlas": search_atlas, "get_atlas_style": get_atlas_style, "list_styles": list_styles, "get_style": get_style, "save_style": save_style,
      "list_storyboards": list_storyboards, "get_storyboard": get_storyboard, "motion_knowledge": motion_knowledge}

def send(o): sys.stdout.write(json.dumps(o) + "\n"); sys.stdout.flush()

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try: m = json.loads(line)
        except Exception: continue
        mid, method = m.get("id"), m.get("method")
        if method == "initialize":
            send({"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": (m.get("params") or {}).get("protocolVersion", "2024-11-05"),
                  "capabilities": {"tools": {}}, "serverInfo": {"name": "bahlman-footage", "version": "1.1"}}})
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            p = m.get("params") or {}; fn = FN.get(p.get("name"))
            try:
                res = fn(**(p.get("arguments") or {})) if fn else {"error": "unknown tool"}
                send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": json.dumps(res, ensure_ascii=False, indent=1)}], "isError": "error" in res}})
            except Exception as e:
                send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}})
        elif method == "ping":
            send({"jsonrpc": "2.0", "id": mid, "result": {}})
        elif mid is not None:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "method not found"}})

if __name__ == "__main__":
    main()
