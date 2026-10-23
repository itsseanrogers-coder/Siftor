#!/bin/bash
# Serves the Bahlman Media App folder and opens the Video Pipeline page.
# Keep this window open while you use the board. Close it to stop.
cd "$HOME/Desktop/Bahlman Media App" || exit 1
echo "Pipeline running: http://localhost:8770/Pipeline/index.html"
echo "Keep this window open."
(sleep 1; open "http://localhost:8770/Pipeline/index.html") &
python3 -m http.server 8770
