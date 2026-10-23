"""Transcribes the Library's speech clips with Whisper large-v3 (whisper.cpp, runs on the Mac's GPU).
Started by "Run Transcripts.command". Resumable: clips that already have a transcript are skipped.
Footage is only READ: ffmpeg copies each clip's audio to a temporary 16 kHz WAV in ~/Library/Caches, Whisper reads that.
Output per clip in _work/transcripts/:  <id>.json (segments + word timings), <id>.srt, <id>.txt
One reader thread per drive (all four drives read in parallel), one Whisper process at a time."""
import os, sys, json, time, queue, threading, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import tx_export
HERE = os.path.dirname(os.path.abspath(__file__))
TX = os.path.abspath(os.path.join(HERE, "..", "transcripts")); os.makedirs(TX, exist_ok=True)
FAIL = os.path.join(TX, "_fail"); os.makedirs(FAIL, exist_ok=True)
TMP = os.path.expanduser("~/Library/Caches/bahlman_tx"); os.makedirs(TMP, exist_ok=True)
import fcntl
_lock = open(os.path.join(TMP, ".lock"), "w")
try: fcntl.flock(_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    print("Transcripts are already running in another window — this one will close.", flush=True); sys.exit(0)
WHISPER, MODEL = sys.argv[1], sys.argv[2]
THREADS = int(sys.argv[3]) if len(sys.argv) > 3 else 8
jobs = [l.rstrip("\n").split("\t") for l in open(os.path.join(HERE, "tx_list.tsv")) if l.strip()]
def done(i): return any(os.path.exists(os.path.join(TX, i + e)) for e in (".json", ".noaudio"))   # failed clips are retried on the next run
todo = [j for j in jobs if not done(j[0])]
total_s = sum(float(j[2]) for j in jobs); left_s = sum(float(j[2]) for j in todo)
print(f"{len(jobs)} clips ({total_s/3600:.0f} h of audio); {len(todo)} left ({left_s/3600:.0f} h)", flush=True)
Q = queue.Queue(maxsize=8); lock = threading.Lock(); missing = []
def fail(i, msg):
    open(os.path.join(FAIL, i + ".txt"), "w").write(msg[:1500] + ("\n...\n" + msg[-500:] if len(msg) > 2000 else ""))
def reader(drive_jobs):
    for j in drive_jobs:
        try: read_one(*j)
        except Exception as e: fail(j[0], 'reader: %r' % e)
def read_one(i, path, dur, drive, prio):
    if True:
        if not os.path.exists(path):
            with lock: missing.append(i)
            return
        wav = os.path.join(TMP, i + ".wav")
        try: r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", path, "-vn", "-map", "0:a:0?", "-ac", "1",
                            "-ar", "16000", "-c:a", "pcm_s16le", wav], capture_output=True, text=True, timeout=1800 + float(dur))
        except subprocess.TimeoutExpired:
            fail(i, "ffmpeg timed out"); return
        if r.returncode != 0 or not os.path.exists(wav) or os.path.getsize(wav) < 32000:
            if os.path.exists(wav): os.remove(wav)
            if r.returncode == 0 or "does not contain any stream" in r.stderr: open(os.path.join(TX, i + ".noaudio"), "w").write("")
            else: fail(i, "ffmpeg: " + r.stderr)
            return
        Q.put((i, wav, float(dur)))
by_drive = {}
for j in todo: by_drive.setdefault(j[3], []).append(j)
ts = [threading.Thread(target=reader, args=(js,), daemon=True) for js in by_drive.values()]
for t in ts: t.start()
def finished(): return all(not t.is_alive() for t in ts) and Q.empty()
JFLAG = ["-ojf"]
t0 = time.time(); audio_done = 0.0; n = 0
while not finished():
    try: i, wav, dur = Q.get(timeout=5)
    except queue.Empty: continue
    base = os.path.join(TMP, i)
    for attempt in range(2):
        cmd = [WHISPER, "-m", MODEL, "-f", wav, "-l", "en", "-t", str(THREADS), "-np", *JFLAG, "-osrt", "-otxt", "-of", base]
        try: r = subprocess.run(cmd, capture_output=True, text=True, timeout=900 + 2 * dur)
        except subprocess.TimeoutExpired: r = subprocess.CompletedProcess(cmd, 1, "", "whisper timed out")
        if r.returncode != 0 and JFLAG == ["-ojf"] and ("ojf" in r.stderr or "unknown" in r.stderr.lower()):
            JFLAG = ["-oj"]; continue
        break
    if r.returncode == 0 and os.path.exists(base + ".json"):
        for e in (".srt", ".txt"):
            if os.path.exists(base + e): shutil.move(base + e, os.path.join(TX, i + e))
        shutil.move(base + ".json", os.path.join(TX, i + ".json"))   # json last = marks the clip done
        try: tx_export.export(i, force=True)          # readable copy in Bahlman Media App/Transcripts
        except Exception as e: print("export failed", i, repr(e), flush=True)
    else:
        fail(i, "whisper: " + r.stderr)
    try: os.remove(wav)
    except FileNotFoundError: pass
    n += 1; audio_done += dur; el = time.time() - t0; speed = audio_done / el if el else 0
    left_s -= dur; eta = left_s / speed / 3600 if speed else 0
    msg = f"{time.strftime('%H:%M')}  {n} done  {audio_done/3600:.1f} h of audio in {el/3600:.1f} h  ({speed:.1f}x real time)  ~{eta:.0f} h left"
    print(msg, flush=True)
    json.dump({"done_this_run": n, "audio_hours": round(audio_done/3600, 2), "speed_x": round(speed, 1), "eta_hours": round(eta, 1),
               "missing_files": len(missing), "updated": time.strftime("%Y-%m-%d %H:%M")}, open(os.path.join(TX, "_progress.json"), "w"))
print(f"FINISHED. {n} transcribed this run; {len(missing)} clips skipped because their drive/file was not found.", flush=True)
