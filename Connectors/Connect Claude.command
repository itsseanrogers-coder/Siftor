#!/bin/bash
# Lets the Claude desktop app search the Bahlman footage archive (what's seen, what's said, who's in it).
# Read-only: Claude can look things up but never changes, moves or uploads footage.
# Double-click once, then quit and reopen Claude. To undo, double-click "Disconnect Claude.command".
APP="$HOME/Desktop/Bahlman Media App"
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
mkdir -p "$(dirname "$CFG")"
[ -f "$CFG" ] && cp "$CFG" "$CFG.before-bahlman.bak"
/usr/bin/python3 - "$CFG" "$APP/Connectors/footage_mcp.py" <<'EOF'
import json, sys, os
cfg, server = sys.argv[1], sys.argv[2]
try: d = json.load(open(cfg))
except Exception: d = {}
d.setdefault("mcpServers", {})["bahlman-footage"] = {"command": "/usr/bin/python3", "args": [server]}
json.dump(d, open(cfg, "w"), indent=2)
print("Added 'bahlman-footage' to Claude's connectors.")
EOF
echo
echo "Done. Quit Claude completely (Cmd+Q) and open it again — then ask it things like:"
echo "   \"Find drone shots of Montana in the Bahlman footage\""
echo "   \"Which clips is Pace Morby in, on stage?\""
echo "   \"Where does someone say 'creative finance'?\""
echo
echo "(Press any key to close.)"; read -n1
