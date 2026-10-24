#!/bin/bash
# Starts the Library server in the background if it isn't already running (no window needed).
# Used by the "Bahlman Library" app; safe to run any number of times.
# The server plays clips inside the Library and runs Ask the Library. Footage is only read.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
T="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$T/../../.." && pwd)"
LOG="$HOME/Library/Logs/bahlman_library_server.log"
# static server for the app folder (Pipeline / Ideate / Library over http); harmless if it is already up
if ! curl -s -m 1 http://127.0.0.1:8770/ >/dev/null 2>&1; then
  (cd "$APP" && nohup python3 -m http.server 8770 --bind 127.0.0.1 >> "$HOME/Library/Logs/bahlman_static_server.log" 2>&1 &)
fi
curl -s -m 1 http://127.0.0.1:8766/health >/dev/null 2>&1 && exit 0
if command -v ollama >/dev/null && ! curl -s -m 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  nohup ollama serve >> "$HOME/Library/Logs/bahlman_ollama.log" 2>&1 &
fi
MEM=$(sysctl -n hw.memsize); MODEL="qwen2.5:7b"; [ "$MEM" -ge 34000000000 ] && MODEL="qwen2.5:14b"
cd "$T" && nohup "$APP/venv/bin/python" -u chat_server.py "$MODEL" >> "$LOG" 2>&1 &
for i in $(seq 1 40); do curl -s -m 1 http://127.0.0.1:8766/health >/dev/null 2>&1 && exit 0; sleep 0.25; done
exit 0
