#!/bin/bash
# One-time update: teaches the "Bahlman Library" Dock app to start the Library server by itself,
# so clips play inside the Library (and Ask the Library works) with no extra windows.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
T="$(cd "$(dirname "$0")" && pwd)"
APPB="$HOME/Applications/Bahlman Library.app"
TMP="$(mktemp -d)"
echo "Updating Bahlman Library app..."
osacompile -o "$TMP/BL.app" "$T/app/BahlmanLibrary.applescript" || { echo "Compile failed"; read -n1; exit 1; }
if [ -d "$APPB" ]; then
  cp "$APPB/Contents/Resources/Scripts/main.scpt" "$T/app/main_before_player.scpt" 2>/dev/null
  cp "$TMP/BL.app/Contents/Resources/Scripts/main.scpt" "$APPB/Contents/Resources/Scripts/main.scpt"
  codesign --force --deep -s - "$APPB" 2>/dev/null
  echo "App updated."
else
  echo "Couldn't find $APPB"
fi
echo "Restarting the Library server with the new player..."
pkill -f "chat_server.py" 2>/dev/null; sleep 1
"$T/start_library_server.sh"
curl -s -m 2 http://127.0.0.1:8766/health && echo && echo "Library server is running in the background. You can close this window."
