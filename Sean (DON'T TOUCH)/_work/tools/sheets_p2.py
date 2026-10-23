#!/usr/bin/env python3
"""Pace 2 drive version of sheets.py (normally run on the Mac by "Run Pace 2 Catalog.command"). Contact sheets for every clip in a list.

usage: sheets.py LIST WORKER NWORKERS [--reverse] [--soft]
Each clip -> _Contact Sheets/<relpath>.jpg (12 timecoded frames + header),
plus a 3-frame review strip in SP/strips/<id>.jpg and a metadata line in
SP/meta/<id>.json. Clips that already have meta are skipped, so workers can
be restarted or run from both ends of the list.
"""
import json, os, re, subprocess, sys, tempfile, time
from PIL import Image, ImageDraw, ImageFont

if sys.platform == "darwin":   # on the Mac (the normal way to run it)
    ROOT = "/Volumes/Pace 2/Pace Morby Media/2024"
    OUT = os.path.expanduser("~/Desktop/Bahlman Media App/Contact Sheets/Pace 2/2024")
    F = "/System/Library/Fonts/Supplemental/"; FONT_B, FONT_R = "Arial Bold.ttf", "Arial.ttf"
else:                          # inside the Cowork Linux VM
    ROOT = os.path.expanduser("~/mnt/2024")
    OUT = os.path.expanduser("~/mnt/Bahlman Media App/Contact Sheets/Pace 2/2024")
    F = "/usr/share/fonts/truetype/liberation/"; FONT_B, FONT_R = "LiberationSans-Bold.ttf", "LiberationSans-Regular.ttf"
SP = os.path.dirname(os.path.abspath(__file__))
CW, CH, COLS, ROWS, HEAD = 480, 270, 4, 3, 96
SW, SH = 320, 180
FB = ImageFont.truetype(F + FONT_B, 30)
FR = ImageFont.truetype(F + FONT_R, 20)
FT = ImageFont.truetype(F + FONT_B, 20)


def tc(s):
    s = max(0, s)
    return f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}"


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
                        "-show_streams", path], capture_output=True, text=True, timeout=120)
    j = json.loads(r.stdout or "{}")
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    a = any(s.get("codec_type") == "audio" for s in j.get("streams", []))
    fmt = j.get("format", {})
    dur = float(fmt.get("duration") or v.get("duration") or 0)
    w, h = int(v.get("width") or 0), int(v.get("height") or 0)
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    rot = int((v.get("tags") or {}).get("rotate", rot))
    if abs(rot) % 180 == 90:
        w, h = h, w
    fps = v.get("avg_frame_rate") or v.get("r_frame_rate") or "0/1"
    try:
        n, d = fps.split("/"); fps = round(float(n) / float(d), 3) if float(d) else 0
    except Exception:
        fps = 0
    return dict(duration=round(dur, 3), width=w, height=h, fps=fps,
                codec=v.get("codec_name", "?"), profile=v.get("profile"),
                pix_fmt=v.get("pix_fmt"), has_audio=a,
                orientation="vertical" if h > w else ("square" if h == w else "horizontal"),
                created=(fmt.get("tags") or {}).get("creation_time"),
                size_bytes=int(fmt.get("size") or os.path.getsize(path)))


SEQ_MAX = 1.5e8  # files up to this size are read once, straight through


def _load(p):
    try:
        return Image.open(p).convert("RGB") if os.path.getsize(p) > 0 else None
    except Exception:
        return None


def grab_seq(path, times, tmp):
    """Read the file once, decode keyframes only, keep the nearest to each target."""
    vf = f"scale={CW}:{CH}:force_original_aspect_ratio=decrease,showinfo"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-y", "-skip_frame", "nokey", "-i", path,
                        "-map", "0:v:0", "-vf", vf, "-fps_mode", "passthrough", "-q:v", "4",
                        os.path.join(tmp, "k%05d.jpg")], capture_output=True, text=True, timeout=900)
    pts = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", r.stderr)]
    if not pts:
        return [None] * len(times)
    out = []
    for t in times:
        k = min(range(len(pts)), key=lambda i: abs(pts[i] - t))
        out.append(_load(os.path.join(tmp, f"k{k + 1:05d}.jpg")))
    return out


def grab_seek(path, times, tmp, soft):
    """One small ffmpeg per timestamp: seek, decode a single frame."""
    out = []
    for i, t in enumerate(times):
        p = os.path.join(tmp, f"s{i:02d}.jpg")
        pre = [] if soft else ["-skip_frame", "nokey", "-noaccurate_seek"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", *pre, "-ss", f"{t:.3f}", "-i", path,
                        "-map", "0:v:0", "-frames:v", "1", "-vf",
                        f"scale={CW}:{CH}:force_original_aspect_ratio=decrease", "-q:v", "4", p],
                       capture_output=True, timeout=300)
        out.append(_load(p))
    return out


def grab(path, times, tmp, soft, size=0):
    if not soft and size <= SEQ_MAX:
        return grab_seq(path, times, tmp)
    return grab_seek(path, times, tmp, soft)


def fit(im, w, h):
    canvas = Image.new("RGB", (w, h), (18, 18, 18))
    if im is not None:
        im = im.copy(); im.thumbnail((w, h))
        canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return canvas


def build(cid, rel, soft):
    path = os.path.join(ROOT, rel)
    m = probe(path)
    dur = m["duration"]
    times = [dur * (i + 0.5) / (COLS * ROWS) for i in range(COLS * ROWS)] if dur > 0 else [0] * 12
    with tempfile.TemporaryDirectory() as tmp:
        frames = grab(path, times, tmp, soft, m["size_bytes"])
        if sum(f is not None for f in frames) < 6 and not soft:
            frames = grab(path, times, tmp, True)
    got = sum(f is not None for f in frames)
    if got == 0:
        raise RuntimeError("no frames decoded")

    sheet = Image.new("RGB", (CW * COLS, CH * ROWS + HEAD), (10, 10, 10))
    d = ImageDraw.Draw(sheet)
    d.text((16, 10), f"{cid}  {os.path.basename(rel)}", font=FB, fill=(255, 255, 255))
    info = (f"{tc(dur)}  ·  {m['width']}x{m['height']} {m['orientation']}  ·  {m['fps']} fps  ·  "
            f"{m['codec']}  ·  {m['size_bytes'] / 1e9:.2f} GB  ·  {'audio' if m['has_audio'] else 'no audio'}")
    d.text((16, 46), info, font=FR, fill=(200, 200, 200))
    d.text((16, 70), os.path.dirname(rel), font=FR, fill=(140, 140, 140))
    for i, (im, t) in enumerate(zip(frames, times)):
        x, y = (i % COLS) * CW, HEAD + (i // COLS) * CH
        sheet.paste(fit(im, CW, CH), (x, y))
        d.rectangle([x + 6, y + CH - 32, x + 136, y + CH - 6], fill=(0, 0, 0))
        d.text((x + 12, y + CH - 30), tc(t), font=FT, fill=(255, 220, 80))
    dst = os.path.join(OUT, rel + ".jpg")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sheet.save(dst, quality=82)

    # start / middle / end strip for the review grids
    pick = [frames[0], frames[6], frames[11]]
    idx = [0, 6, 11]
    for k, f in enumerate(pick):  # fall back to nearest decoded frame
        if f is None:
            near = sorted((abs(j - idx[k]), j) for j, g in enumerate(frames) if g is not None)
            pick[k] = frames[near[0][1]]
    strip = Image.new("RGB", (SW * 3, SH))
    for k, f in enumerate(pick):
        strip.paste(fit(f, SW, SH), (k * SW, 0))
    strip.save(os.path.join(SP, "strips_p2", cid + ".jpg"), quality=80)

    m.update(id=cid, path=rel, sheet="Pace 2/2024/" + os.path.relpath(dst, OUT), frames_ok=got)
    return m


def main():
    lst, w, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    rev, soft = "--reverse" in sys.argv, "--soft" in sys.argv
    for d in ("strips_p2", "meta_p2", "fail_p2"):
        os.makedirs(os.path.join(SP, d), exist_ok=True)
    rows = [l.rstrip("\n").split("\t") for l in open(lst) if l.strip()]
    rows = [r for i, r in enumerate(rows) if i % n == w]
    if rev:
        rows.reverse()
    done = 0
    for cid, rel in rows:
        mp = os.path.join(SP, "meta_p2", cid + ".json")
        if os.path.exists(mp):
            continue
        t0 = time.time()
        try:
            m = build(cid, rel, soft)
            m["secs"] = round(time.time() - t0, 1)
            tmpm = mp + ".part"
            json.dump(m, open(tmpm, "w")); os.replace(tmpm, mp)
            done += 1
        except Exception as e:
            open(os.path.join(SP, "fail_p2", cid + ".txt"), "w").write(f"{rel}\n{e!r}\n")
        print(f"[w{w}] {cid} {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    main()
