"""Writes tx_map.json: where each clip's transcript goes in the readable "Transcripts" folder.
  Transcripts/<Drive>/<Client - Event>/<TXT|SRT|JSON>/<subfolders inside the event, same as the drive>/<clip name>.<ext>
Covers every clip in tx_list.tsv plus the other camera angles that share a transcript (tx_links.json)."""
import sqlite3, os, re, json
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.abspath(os.path.join(HERE, "..", ".."))
db = sqlite3.connect(os.path.join(OUT, "footage.db"))
ids = [l.split("\t")[0] for l in open(os.path.join(HERE, "tx_list.tsv")) if l.strip()]
links = json.load(open(os.path.join(HERE, "tx_links.json")))
want = set(ids) | {a for a, (p, o) in links.items() if p in set(ids)}
GRP = {}  # Gator lesson grouping lives only in the page data; folder path is good enough here
bad = re.compile(r'[/:\\*?"<>|]+')
def clean(s): return bad.sub("-", s).strip(" .-") or "Untitled"
def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())
SKIP = re.compile(r"(?i)^(\d{4}|\d{1,2}\s*-\s*[a-z]+.*|\d{1,2}-\d{2}\s+[a-z]+|bahlman media|pace|pace morby|raw|video|videos|-?pace files|31892az)$")
PREFIX = {"Pace 1": "Pace 1/2021-2023/", "Pace 2": "Pace 2/2024/"}
m = {}
for i, f, folder, drive, client, shoot, abs_path in db.execute(
        "select id, file, folder, drive, client, shoot, abs_path from clips"):
    if i not in want: continue
    rel = folder[len(PREFIX[drive]):] if drive in PREFIX and folder.startswith(PREFIX[drive]) else folder
    parts = [p for p in rel.split("/") if p]
    ns = norm(shoot or "")
    k = next((j for j, p in enumerate(parts) if ns and (norm(p) == ns or (len(ns) > 6 and ns in norm(p)))), None)
    if k is not None: sub = parts[k + 1:]
    else:   # event folder not found by name: keep the drive's own path, minus the year / month / drive-root levels
        j = 0
        while j < len(parts) - 1 and SKIP.match(parts[j]): j += 1
        sub = parts[j:]
    event = clean(shoot if shoot and norm(shoot).startswith(norm(client)) else f"{client} - {shoot}" if shoot else client)
    stem = clean(os.path.splitext(f)[0])
    m[i] = {"dir": f"{clean(drive)}/{event}", "sub": "/".join(clean(p) for p in sub), "stem": stem, "file": f, "src": abs_path}
# two clips landing on the same name -> add the clip id
seen = {}
for i, v in sorted(m.items()):
    key = (v["dir"], v["sub"], v["stem"].lower())
    if key in seen: v["stem"] += f" ({i})"
    seen[key] = i
json.dump(m, open(os.path.join(HERE, "tx_map.json"), "w"), ensure_ascii=False)
print(len(m), "clips mapped;", len({v['dir'] for v in m.values()}), "event folders")
for v in list(m.values())[:0]: print(v)
