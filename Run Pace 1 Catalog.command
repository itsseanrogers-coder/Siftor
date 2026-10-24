#!/bin/bash
# Catalogs the Pace 1 drive (2021-2023) (contact sheets, review strips, edited-photo copies) for the Bahlman Library.
# Double-click to start. Safe to stop (close the window) and double-click again: it picks up where it left off.
# Footage on the drive is only read, never changed.
APP="$HOME/Desktop/Bahlman Media App"
T="$APP/Library/_work/tools"
PY="$APP/venv/bin/python"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$T" || exit 1
if [ ! -d "/Volumes/Pace 1/Pace Morby Media 2021-2023" ]; then echo "Pace 1 drive (2021-2023) is not plugged in."; read -n1 -p "Press any key to close."; exit 1; fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; read -n1; exit 1; }
N=$(( $(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || sysctl -n hw.ncpu) ))
[ "$N" -lt 4 ] && N=4
mkdir -p logs_p1
echo "Pace 1 catalog — $N workers. Keep this window open and the drive plugged in."
echo "Started $(date)"
caffeinate -dimsu -w $$ &
for ((w=0; w<N; w++)); do "$PY" sheets_p1.py list_p1.tsv $w $N > "logs_p1/w$w.log" 2>&1 & done
TOTAL=$(wc -l < list_p1.tsv | tr -d ' ')
while pgrep -f "sheets_p1.py list_p1.tsv" >/dev/null; do
  DONE=$(ls meta_p1 | wc -l | tr -d ' '); FAIL=$(ls fail_p1 2>/dev/null | wc -l | tr -d ' ')
  printf "\rContact sheets: %s / %s clips  (%s failed)   " "$DONE" "$TOTAL" "$FAIL"; sleep 15
done
echo; echo "Contact sheets finished $(date)"
echo "Edited photos..."
"$PY" photos/gallery_p1.py 2>&1 | tee logs_p1/photos.log | tail -3
echo "ALL DONE $(date)" | tee logs_p1/DONE.txt
echo "You can close this window and tell Claude it's finished."
