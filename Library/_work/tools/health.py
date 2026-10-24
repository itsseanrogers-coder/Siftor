#!/usr/bin/env python3
"""File Health scan of the My Book drive. Read-only: nothing on the drive is changed.

For every video / photo / RAW file it checks that the file can be read, isn't blank,
has a valid header and ending, and (videos) that a frame decodes from the middle and the end.
Results stream to <library>/_work/health.jsonl so the scan can resume; folders that can't
be opened are recorded too. usage: health.py [workers]"""
import json, os, subprocess, sys, time
from concurrent.futures import ProcessPoolExecutor

DRIVE = "/Volumes/My Book/31892AZ"
ROOTS = [os.path.join(DRIVE, "Bahlman Media"), os.path.join(DRIVE, "(~Damaged~)")]
SKIP_DIRS = {"_Contact Sheets"}
LIB = os.path.expanduser("~/Desktop/Bahlman Media App/Library")
OUT = os.path.join(LIB, "_work", "health.jsonl")
VIDEO = {".mp4", ".mov", ".mxf", ".m4v", ".mts", ".avi"}
PHOTO = {".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff", ".webp"}
RAW = {".arw", ".dng", ".raf", ".cr2", ".cr3", ".nef"}
CHUNK = 65536


def blank(b):
    return len(b) > 0 and b.count(0) == len(b)


def check(path):
    ext = os.path.splitext(path)[1].lower()
    kind = "video" if ext in VIDEO else "photo" if ext in PHOTO else "raw"
    r = dict(path=path, kind=kind, ext=ext[1:], status="ok", issues=[])
    def bad(msg, sev="corrupt"):
        r["issues"].append(msg)
        if sev == "corrupt" or r["status"] == "ok":
            r["status"] = sev
    try:
        size = os.path.getsize(path); r["size"] = size
        if size == 0:
            bad("Empty file (0 bytes)"); return r
        with open(path, "rb") as f:
            head = f.read(CHUNK)
            f.seek(max(0, size - CHUNK)); tail = f.read(CHUNK)
    except OSError as e:
        r["status"] = "unreadable"; r["issues"].append(f"Drive couldn't read this file ({e.strerror or e})"); return r
    if blank(head):
        bad("Start of file is blank — the header is missing")
    tail_blank = blank(tail)
    if kind == "photo" and not r["issues"]:
        if ext in (".jpg", ".jpeg"):
            if head[:2] != b"\xff\xd8": bad("Not a valid JPEG header")
            elif b"\xff\xd9" not in tail.rstrip(b"\x00")[-4096:] or tail_blank:
                # cameras pad JPEGs with zeros; only a real decode failure counts
                try:
                    from PIL import Image
                    Image.open(path).load()
                except Exception as e:
                    bad("Photo is cut off — the image data ends early" if "truncated" in str(e) else "Photo won't open — image data is damaged", "damaged")
        elif ext == ".png" and head[:8] != b"\x89PNG\r\n\x1a\n": bad("Not a valid PNG header")
        elif ext in (".tif", ".tiff") and head[:4] not in (b"II*\x00", b"MM\x00*"): bad("Not a valid TIFF header")
        elif ext == ".heic" and b"ftyp" not in head[:32]: bad("Not a valid HEIC header")
        elif ext == ".webp" and (head[:4] != b"RIFF" or head[8:12] != b"WEBP"): bad("Not a valid WebP header")
    if kind in ("photo",) and ext not in (".jpg", ".jpeg") and tail_blank and not r["issues"]:
        bad("End of file is blank — likely cut off / incomplete copy", "damaged")
    if kind == "raw" and not r["issues"]:
        if ext == ".raf":
            if not head.startswith(b"FUJIFILM"): bad("Not a valid Fujifilm RAW header")
        elif head[:4] not in (b"II*\x00", b"MM\x00*") and not (ext == ".cr3" and b"ftyp" in head[:32]):
            bad("Not a valid RAW header")
    if kind == "video" and r["status"] != "corrupt":
        try:
            p = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_entries",
                                "format=duration:stream=codec_type,codec_name,width,height", path],
                               capture_output=True, text=True, timeout=60)
            j = json.loads(p.stdout or "{}")
        except Exception:
            j = {}; p = None
        streams = j.get("streams") or []
        v = next((s for s in streams if s.get("codec_type") == "video"), None)
        dur = float((j.get("format") or {}).get("duration") or 0)
        r["duration"] = round(dur, 2)
        if v: r["video"] = f'{v.get("codec_name")} {v.get("width")}x{v.get("height")}'
        if not j.get("format"):
            bad("Video won't open — the container is damaged")
        elif not v:
            bad("No picture track found")
        else:
            if dur <= 0:
                bad("Video has no length information", "damaged")
            spots = [("middle", dur / 2), ("end", max(0, dur - 1.5))] if dur > 3 else [("start", 0)]
            for label, t in spots:
                try:
                    d = subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-ss", f"{t:.2f}", "-i", path, "-map", "0:v:0",
                                        "-frames:v", "1", "-f", "null", "-"], capture_output=True, text=True, timeout=120)
                    if d.returncode != 0 or "error" in d.stderr.lower() or "invalid" in d.stderr.lower():
                        bad(f"Picture breaks up / won't decode near the {label} ({int(t // 60)}:{int(t % 60):02d})", "damaged")
                except subprocess.TimeoutExpired:
                    bad(f"Decoding hangs near the {label}", "damaged")
    return r


def walk():
    files, dir_errors = [], []
    for root in ROOTS:
        def onerr(e, root=root):
            dir_errors.append(dict(path=e.filename, kind="folder", status="unreadable", issues=[f"Folder can't be opened ({e.strerror})"]))
        for d, dirs, fs in os.walk(root, onerror=onerr):
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
            for f in fs:
                if f.startswith("._") or f.startswith("."):
                    continue
                if os.path.splitext(f)[1].lower() in VIDEO | PHOTO | RAW:
                    files.append(os.path.join(d, f))
    return files, dir_errors


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    done = set()
    if os.path.exists(OUT):
        for l in open(OUT):
            try: done.add(json.loads(l)["path"])
            except Exception: pass
    t0 = time.time()
    files, dir_errors = walk()
    print(f"{len(files)} media files, {len(dir_errors)} unreadable folders, listed in {time.time() - t0:.0f}s", flush=True)
    with open(OUT, "a") as out:
        for e in dir_errors:
            if e["path"] not in done: out.write(json.dumps(e) + "\n")
        todo = [f for f in files if f not in done]
        # videos first-class but slow: interleave so progress reflects both
        with ProcessPoolExecutor(workers) as ex:
            for n, r in enumerate(ex.map(check, todo, chunksize=4)):
                out.write(json.dumps(r) + "\n")
                if n % 500 == 0:
                    out.flush(); print(f"{n}/{len(todo)}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
