"""Copies finished transcripts into the readable folder (Bahlman Media App/Transcripts), organised like the drives:
  Transcripts/<Drive>/<Client - Event>/<TXT|SRT|JSON>/<same subfolders as on the drive>/<clip name>.txt|.srt|.json
Other camera angles of the same take get their own copy, with times shifted to match that camera.
Usage: tx_export.py            -> export everything finished (skips ones already exported)
       tx_export.py ID [ID..]  -> export just those clips (tx_run.py calls this after each clip)"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.abspath(os.path.join(HERE, "..", "transcripts"))
DEST = os.path.abspath(os.path.join(HERE, "..", "..", "..", "Transcripts"))
MAP = json.load(open(os.path.join(HERE, "tx_map.json")))
LINKS = json.load(open(os.path.join(HERE, "tx_links.json")))
ANGLES = {}
for a, (p, off) in LINKS.items(): ANGLES.setdefault(p, []).append((a, off))

def segments(raw):
    segs = []
    for s in raw.get("transcription", []):
        text = s["text"].strip()
        if not text: continue
        words, cur = [], None
        for t in s.get("tokens", []):
            tx = t["text"]
            if tx.startswith("[_") or tx.startswith("<|"): continue
            if cur is None or tx.startswith(" "):
                cur = {"w": tx.strip(), "start": t["offsets"]["from"] / 1000, "end": t["offsets"]["to"] / 1000}; words.append(cur)
            else:
                cur["w"] += tx; cur["end"] = t["offsets"]["to"] / 1000
        segs.append({"start": s["offsets"]["from"] / 1000, "end": s["offsets"]["to"] / 1000, "text": text,
                     "words": [w for w in words if w["w"]]})
    return segs

def shift(segs, off):   # times on another camera: that camera started `off` seconds after the primary
    out = []
    for s in segs:
        if s["end"] - off <= 0: continue
        out.append({"start": max(0, round(s["start"] - off, 3)), "end": round(s["end"] - off, 3), "text": s["text"],
                    "words": [{"w": w["w"], "start": max(0, round(w["start"] - off, 3)), "end": round(w["end"] - off, 3)} for w in s["words"] if w["end"] - off > 0]})
    return out

def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write(cid, segs, primary=None):
    v = MAP.get(cid)
    if not v: return False
    for kind, ext in (("TXT", ".txt"), ("SRT", ".srt"), ("JSON", ".json")):
        d = os.path.join(DEST, v["dir"], kind, v["sub"]); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, v["stem"] + ext)
        if ext == ".txt":
            body = "\n".join(s["text"] for s in segs) + "\n"
        elif ext == ".srt":
            body = "".join(f"{n}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n" for n, s in enumerate(segs, 1))
        else:
            body = json.dumps({"clip_id": cid, "file": v["file"], "source": v["src"], "model": "whisper large-v3",
                               "shared_from_angle": primary, "segments": segs}, ensure_ascii=False, indent=1)
        open(p, "w").write(body)
    return True

def export(cid, force=False):
    rawp = os.path.join(RAW, cid + ".json")
    if not os.path.exists(rawp) or cid not in MAP: return 0
    v = MAP[cid]
    if not force and os.path.exists(os.path.join(DEST, v["dir"], "JSON", v["sub"], v["stem"] + ".json")): return 0
    segs = segments(json.load(open(rawp)))
    n = int(write(cid, segs))
    for a, off in ANGLES.get(cid, []):
        n += int(write(a, shift(segs, off), primary=cid))
    return n

if __name__ == "__main__":
    ids = sys.argv[1:] or [f[:-5] for f in os.listdir(RAW) if f.endswith(".json") and not f.startswith("_")]
    n = sum(export(i, force=bool(sys.argv[1:])) for i in ids)
    print(f"exported {n} clip transcripts to {DEST}")
