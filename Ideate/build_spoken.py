"""Builds Ideate/spoken.js — every transcribed line in the library, for Ideate's "Spoken" search.
Reads the Whisper transcripts in  Sean (DON'T TOUCH)/_work/transcripts/<clip id>.json  (written by Run Transcripts.command).
Run any time more transcripts are done:  python3 build_spoken.py   (Run Transcripts.command also runs it at the end)."""
import os, json, glob, re
HERE = os.path.dirname(os.path.abspath(__file__))
TX = os.path.join(HERE, "..", "Sean (DON'T TOUCH)", "_work", "transcripts")
out = {}
for p in sorted(glob.glob(os.path.join(TX, "*.json"))):
    cid = os.path.basename(p)[:-5]
    try: d = json.load(open(p, encoding="utf-8"))
    except Exception: continue
    segs = []
    for s in d.get("transcription", []):
        t = re.sub(r"\s+", " ", (s.get("text") or "")).strip()
        if not t or re.fullmatch(r"[\W_]*|(\[.*\])|(thank you\.?)", t, re.I): continue   # skip blanks, [music], whisper's "Thank you." filler
        o = s.get("offsets", {})
        segs.append([round(o.get("from", 0) / 1000, 2), round(o.get("to", 0) / 1000, 2), t])
    if segs: out[cid] = segs
js = "window.BM_SPOKEN=" + json.dumps(out, separators=(",", ":")) + ";\n"
tmp = os.path.join(HERE, "spoken.js.tmp"); open(tmp, "w", encoding="utf-8").write(js); os.replace(tmp, os.path.join(HERE, "spoken.js"))
print(f"spoken.js: {len(out)} clips with speech, {sum(len(v) for v in out.values())} lines, {len(js)/1e6:.1f} MB")
