# Siftor (Project X)

Private footage library and production pipeline for video editors: catalog local footage (contact sheets, descriptions, transcripts, faces), search and ideate from it, plan edits on a board, and review cuts. Media stays on the editor's own drives.

The code started as Sean's working Mac folder ("Bahlman Media App"), copied as is so it can be versioned. No footage, client data, transcripts, contact sheets or backup copies are kept in this repo; `.gitignore` keeps everything Ingest generates out of it.

| Folder | Step |
|---|---|
| `Ingest/` | Step 0: turns the footage folders in `siftor.json` into the Library (see below) |
| `Library/_work/tools/` | Catalog scripts, Library build, Library server (chat, player, transcription) |
| `Ideate/` | Step 2: find footage for a video idea |
| `Pipeline/` | Step 3: production board and storyboard |
| `Review/` | Step 4: review page |
| `People/` | Face recognition and the People page |
| `Motion/` | Style atlas, client style guides, edit checklist |
| `Connectors/` | Lets the Claude desktop app search the archive |
| `*.command` | Double-click launchers (macOS) |

## Ingest (Step 0)

Double-click **Siftor Ingest.command**. The first time, it creates `siftor.json` from `Ingest/settings.example.json`
and opens it: list the footage folders (each with a short `name`), then double-click again. After that each run:

1. **scan** finds every video file in the footage folders. New files get an id (`C00001`...), changed files are redone,
   files that disappeared drop out of the Library. A drive that isn't plugged in is skipped and keeps its clips.
2. **sheets** makes a 12-frame contact sheet per clip into `Contact Sheets/<folder name>/`.
3. **describe** writes what's in each clip from its contact sheet: Claude (needs an Anthropic API key in
   `~/Library/Application Support/Siftor/anthropic_api_key` and `"consent_send_stills": true`, because still frames
   are sent to Anthropic) or a local Ollama model (`"engine": "local"`), or `"off"`.
4. **build** writes `Library/footage.db`, `clips.jsonl`, `clips.js`, thumbnails and `Library/index.html`.
5. **transcribe** runs Whisper on the clips whose description says people talk (podcast, interview, talking-head,
   testimonial by default).
6. **faces** runs `People/faces_run.py` on the new contact sheets.

Every step skips work already done, so it can be stopped and restarted at any time, and footage is only ever read.
Options: `--only sheets,build` runs some steps, `--limit 20` tries a few clips, `--retry-failed` retries failures.
Folder names decide the Library's grouping: the first folder inside a footage folder is the client, the first folder
with a date in its name (`06.12.26 Launch`, `2026-06-12 Launch`) is the shoot. `"clients"` rules in `siftor.json`
(`["regex", "Client", "Brand"]`) override that.
