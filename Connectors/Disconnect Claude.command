#!/bin/bash
# Removes the Bahlman footage connector from the Claude desktop app.
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
/usr/bin/python3 - "$CFG" <<'EOF'
import json, sys
cfg = sys.argv[1]
try: d = json.load(open(cfg))
except Exception: d = {}
if d.get("mcpServers", {}).pop("bahlman-footage", None) is not None:
    json.dump(d, open(cfg, "w"), indent=2); print("Removed. Quit and reopen Claude.")
else: print("It wasn't connected.")
EOF
echo "(Press any key to close.)"; read -n1
