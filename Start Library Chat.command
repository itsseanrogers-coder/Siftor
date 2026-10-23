#!/bin/bash
# Starts the Library server: "Ask the Library" chat + playing clips inside the Library (no QuickTime needed).
# Runs a free, open-source AI model on this Mac (Ollama). Nothing leaves the computer; footage is only read.
# Keep this window open while you use the chat. Close it to stop the chat and free up memory.
APP="$HOME/Desktop/Bahlman Media App"
T="$APP/Library/_work/tools"
PY="$APP/venv/bin/python"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$T" || exit 1
if ! command -v ollama >/dev/null; then echo "Installing Ollama (one time)..."; brew install ollama || echo "Ollama install failed — the chat will be off, but the video player still works."; fi
STARTED=""
if command -v ollama >/dev/null && ! curl -s -m 2 http://127.0.0.1:11434/api/tags >/dev/null; then
  ollama serve > "$HOME/Library/Logs/bahlman_ollama.log" 2>&1 & STARTED=$!
  for i in $(seq 1 30); do curl -s -m 1 http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
fi
trap '[ -n "$STARTED" ] && kill $STARTED 2>/dev/null' EXIT
MEM=$(sysctl -n hw.memsize)
if [ "$MEM" -ge 34000000000 ]; then MODEL="qwen2.5:14b"; else MODEL="qwen2.5:7b"; fi
echo "Model: $MODEL  (downloads once, then works offline)"
command -v ollama >/dev/null && ollama pull "$MODEL" || echo "Model download failed — the chat will be off until it downloads (double-click again later). The video player still works."
echo
echo "Ask the Library is ready. Open the Library and click the gold 'Ask the Library' button (bottom right)."
echo "Keep this window open while you use it."
"$PY" -u chat_server.py "$MODEL"
