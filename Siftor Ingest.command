#!/bin/bash
# Adds new footage to the Siftor Library: contact sheets, descriptions, transcripts, faces, then the Library page.
# Double-click to start. Safe to close the window and double-click again: it picks up where it left off.
# Footage is only read, never changed. Which folders it reads is set in siftor.json, next to this file.
APP="$(cd "$(dirname "$0")" && pwd)"
SUP="$HOME/Library/Application Support/Siftor"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$APP" || exit 1

if [ ! -f siftor.json ]; then
  cp Ingest/settings.example.json siftor.json
  echo "First run: siftor.json was created. List your footage folders in it (it opens now), save, then double-click again."
  open -e siftor.json; read -n1 -p "Press any key to close."; exit 0
fi
command -v ffmpeg >/dev/null || { echo "Installing ffmpeg (one time)..."; brew install ffmpeg || { echo "ffmpeg install failed"; read -n1; exit 1; }; }

VENV="$SUP/venv"; mkdir -p "$SUP"
if [ ! -x "$VENV/bin/python" ]; then
  echo "Setting up Siftor (one time)..."
  python3 -m venv "$VENV" || { echo "Could not create the Python environment"; read -n1; exit 1; }
fi
"$VENV/bin/python" -c "import PIL, anthropic" 2>/dev/null || "$VENV/bin/pip" install -q --upgrade pillow anthropic \
  || { echo "Install failed - check the internet connection and double-click again."; read -n1; exit 1; }

# Anthropic API key for clip descriptions: kept in this Mac's Application Support, never in the Siftor folder.
[ -z "$ANTHROPIC_API_KEY" ] && [ -f "$SUP/anthropic_api_key" ] && export ANTHROPIC_API_KEY="$(cat "$SUP/anthropic_api_key")"

echo "Siftor Ingest - keep this window open. Started $(date)"
caffeinate -dimsu -w $$ &
"$VENV/bin/python" -u Ingest/ingest.py "$@" 2>&1 | tee -a "$SUP/ingest.log"
echo
echo "Finished $(date). (Press any key to close.)"; read -n1
