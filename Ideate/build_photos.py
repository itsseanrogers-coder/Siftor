#!/usr/bin/env python3
"""Writes Ideate/photos.js — every edited photo in the Library (id, client, brand, shoot, set, date, orientation,
folder, drive, file, path on the drive) so Ideate can search photos next to clips. Reads the Library's index.html (const P=[…]); never changes it."""
import json, os, sys
APP = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
s = open(os.path.join(APP, "Library", "index.html"), encoding="utf-8").read()
i = s.index("\nconst P=") + len("\nconst P=")
j = s.index("\n", i)
P = json.loads(s[i:j].rstrip().rstrip(";"))
rows = [[p["id"], p.get("client") or "", p.get("brand") or "", p.get("shoot") or "", p.get("set") or "", p.get("shoot_date") or "",
         "v" if (p.get("h") or 0) > (p.get("w") or 0) else "h", p.get("folder") or "", p.get("drive") or "", p.get("file") or "", p.get("abs") or ""] for p in P]
out = os.path.join(APP, "Ideate", "photos.js")
open(out, "w", encoding="utf-8").write("window.BM_PHOTOS=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(rows), "photos →", out)
