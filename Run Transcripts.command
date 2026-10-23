#!/bin/bash
# Transcribes the Library's speech clips with Whisper large-v3 (most accurate model), on this Mac's GPU.
# Double-click to start. Safe to stop (close the window) and double-click again: it picks up where it left off.
# Footage on the drives is only read, never changed. Plug in all four drives for the fastest run.
APP="$HOME/Desktop/Bahlman Media App"
T="$APP/Sean (DON'T TOUCH)/_work/tools"
PY="$APP/venv/bin/python"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$T" || exit 1
"$PY" tx_export.py   # make sure everything finished so far is in the Transcripts folder
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; read -n1; exit 1; }
WC=$(command -v whisper-cli || command -v whisper-cpp)
if [ -z "$WC" ]; then echo "Installing Whisper (whisper.cpp) with Homebrew..."; brew install whisper-cpp || { echo "Install failed"; read -n1; exit 1; }
  WC=$(command -v whisper-cli || command -v whisper-cpp); fi
MD="$HOME/Library/Application Support/BahlmanWhisper"; mkdir -p "$MD"; M="$MD/ggml-large-v3.bin"
if [ ! -s "$M" ] || [ $(stat -f%z "$M") -lt 3000000000 ]; then
  echo "Downloading the Whisper large-v3 model (3.1 GB, one time)..."
  curl -L -C - --retry 5 -o "$M" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin" || { echo "Download failed - double-click again to resume."; read -n1; exit 1; }
fi
for d in "Expansion" "My Book" "Pace 1" "Pace 2"; do [ -d "/Volumes/$d" ] && echo "  drive found: $d" || echo "  drive NOT plugged in: $d (its clips are skipped this run)"; done
N=$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || sysctl -n hw.ncpu)
echo "Transcribing with $WC — keep this window open. Started $(date)"
caffeinate -dimsu -w $$ &
"$PY" -u tx_run.py "$WC" "$M" "$N" 2>&1 | tee -a ../transcripts/_run.log
"$PY" tx_export.py
echo "Stopped $(date). Double-click again to continue if anything is left."
