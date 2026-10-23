#!/bin/bash
# Finds the people in the footage library with face recognition (InsightFace), on this Mac. Nothing leaves the computer.
# Reads the contact sheets that already exist — the footage drives don't need to be plugged in.
# Double-click to start. Safe to close the window and double-click again: it picks up where it left off.
# When it finishes, open the People page (Library → People) and name the people at the top of the list.
APP="$HOME/Desktop/Bahlman Media App"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$APP/People" || { echo "Can't find $APP/People"; read -n1; exit 1; }
ENV="$HOME/Library/Application Support/BahlmanFaces"
VENV="$ENV/venv"; mkdir -p "$ENV"
if [ ! -x "$VENV/bin/python" ]; then
  PY=""
  for c in python3.13 python3.12 python3.11 python3.14 python3; do
    if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if (3,11)<=sys.version_info[:2]<=(3,14) else 1)' 2>/dev/null; then PY=$(command -v "$c"); break; fi
  done
  if [ -z "$PY" ]; then echo "Installing Python (one time)…"; brew install python@3.13 || { echo "Python install failed"; read -n1; exit 1; }; PY=$(command -v python3.13); fi
  echo "Setting up face recognition (one time, ~2 minutes)…"
  "$PY" -m venv "$VENV" || { echo "Could not create the Python environment"; read -n1; exit 1; }
fi
"$VENV/bin/python" -c "import insightface, onnxruntime, cv2" 2>/dev/null || {
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q insightface onnxruntime opencv-python-headless numpy || { echo "Install failed — check the internet connection and double-click again."; read -n1; exit 1; }
}
echo "Scanning faces — keep this window open. Started $(date)"
caffeinate -dimsu -w $$ &
"$VENV/bin/python" -u faces_run.py --app "$APP" "$@" 2>&1 | grep --line-buffered -v -i "warn\|tform.estimate" | tee -a faces_run.log
echo
echo "Finished $(date). Open the People page to put names to faces."
echo "(Press any key to close.)"; read -n1
