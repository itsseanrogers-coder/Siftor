"""Builds the transcript job list from footage.db (run any time; safe to re-run).
tx_list.tsv  : id <tab> abs_path <tab> duration <tab> drive <tab> priority   (one line per clip to transcribe)
tx_links.json: {angle_id: primary_id} — other camera angles of the same take share the primary's transcript.
Only clips likely to contain speech are listed; b-roll, drone, product, sports, travel and test shots are skipped."""
import sqlite3, os, re, json, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.abspath(os.path.join(HERE, "..", ".."))
db = sqlite3.connect(os.path.join(OUT, "footage.db"))
# Sean 2026-10-13: large-v3 on podcasts, interviews, talking heads (+ testimonials) only.
# Full list (stage talks, events, networking...) was saved as tx_list_full.tsv; add those types back here to include them.
PRIO = {"podcast": 1, "interview": 1, "talking-head": 1, "testimonial": 1}
CAM = re.compile(r"(?i)^(cam(era)?\b.*|[a-d][\s_-]?cam\b.*|angle\b.*|card\s*\d+.*|.*\bcam\s*\d+.*|.*\bcard\s*\d+.*)$")
rows = db.execute("select id, abs_path, duration, drive, folder, content, has_audio, created from clips").fetchall()
cand = [r for r in rows if r[5] in PRIO and r[6] != 0 and (r[2] or 0) >= 3]
def ts(c):
    try: return datetime.datetime.fromisoformat(c.replace("Z", "+00:00")).timestamp()
    except Exception: return None
groups = collections.defaultdict(list)
for r in cand:
    key = "/".join(p for p in r[4].split("/") if not CAM.match(p))
    groups[key].append(r)
links = {}   # angle_id -> [primary_id, offset]  (angle time t  ==  primary time t + offset)
for key, rs in groups.items():
    rs = [r for r in rs if ts(r[7])]
    rs.sort(key=lambda r: -r[2])                     # longest first becomes the primary
    prim = []
    for r in rs:
        s0, e0 = ts(r[7]), ts(r[7]) + r[2]
        for p in prim:
            s1, e1 = ts(p[7]), ts(p[7]) + p[2]
            ov = min(e0, e1) - max(s0, s1)
            if ov >= 0.6 * r[2] and ov > 20:          # recorded at the same time -> another angle of that take
                links[r[0]] = [p[0], round(s0 - s1, 2)]; break
        else:
            prim.append(r)
jobs = [r for r in cand if r[0] not in links]
jobs.sort(key=lambda r: (PRIO[r[5]], -r[2]))       # most valuable (and longest) first
with open(os.path.join(HERE, "tx_list.tsv"), "w") as f:
    for r in jobs: f.write(f"{r[0]}\t{r[1]}\t{r[2]:.1f}\t{r[3]}\t{PRIO[r[5]]}\n")
json.dump(links, open(os.path.join(HERE, "tx_links.json"), "w"))
h = lambda rs: sum(r[2] for r in rs) / 3600
print(f"candidates {len(cand)} ({h(cand):.0f} h); angles merged {len(links)}; to transcribe {len(jobs)} ({h(jobs):.0f} h)")
for d in sorted({r[3] for r in jobs}):
    js = [r for r in jobs if r[3] == d]; print(f"  {d}: {len(js)} clips, {h(js):.0f} h")
for p in (1, 2, 3):
    js = [r for r in jobs if PRIO[r[5]] == p]; print(f"  priority {p}: {len(js)} clips, {h(js):.0f} h")
