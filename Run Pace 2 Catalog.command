#!/bin/bash
# Catalogs the Pace 2 drive (contact sheets, review strips, edited-photo copies) for the Bahlman Library.
# Double-click to start. Safe to stop (close the window) and double-click again: it picks up where it left off.
# Footage on the drive is only read, never changed.
APP="$HOME/Desktop/Bahlman Media App"
T="$APP/Library/_work/tools"
PY="$APP/venv/bin/python"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$T" || exit 1
if [ ! -d "/Volumes/Pace 2/Pace Morby Media/2024" ]; then echo "Pace 2 drive is not plugged in."; read -n1 -p "Press any key to close."; exit 1; fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; read -n1; exit 1; }
N=$(( $(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || sysctl -n hw.ncpu) ))
[ "$N" -lt 4 ] && N=4
mkdir -p logs_p2
echo "Pace 2 catalog — $N workers. Keep this window open and the drive plugged in."
echo "Started $(date)"
caffeinate -dimsu -w $$ &
for ((w=0; w<N; w++)); do "$PY" sheets_p2.py list_p2.tsv $w $N > "logs_p2/w$w.log" 2>&1 & done
TOTAL=$(wc -l < list_p2.tsv | tr -d ' ')
while pgrep -f "sheets_p2.py list_p2.tsv" >/dev/null; do
  DONE=$(ls meta_p2 | wc -l | tr -d ' '); FAIL=$(ls fail_p2 2>/dev/null | wc -l | tr -d ' ')
  printf "\rContact sheets: %s / %s clips  (%s failed)   " "$DONE" "$TOTAL" "$FAIL"; sleep 15
done
echo; echo "Contact sheets finished $(date)"
echo "Edited photos..."
"$PY" photos/gallery_p2.py 2>&1 | tee logs_p2/photos.log | tail -3
echo "ALL DONE $(date)" | tee logs_p2/DONE.txt
echo "You can close this window and tell Claude it's finished."
