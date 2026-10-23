"""Asks, in the Terminal window, which AI should describe clips, and saves the answer in siftor.json.
Run by "Siftor Ingest.command" on the first run, or any time with:  Siftor Ingest.command --setup

  1  On this Mac (default): a free local model in Ollama. Nothing leaves the computer; descriptions are simpler.
  2  Claude: better descriptions. Each clip's contact sheet (12 still frames, never the video) goes to Anthropic.
     Needs an Anthropic API key from console.anthropic.com, billed per clip to that account.
  3  Off: no descriptions (search uses file and folder names only).
"""
import getpass, json, os, sys

SUP = os.path.expanduser("~/Library/Application Support/Siftor")
KEY = os.path.join(SUP, "anthropic_api_key")


def main(settings_path):
    s = json.load(open(settings_path, encoding="utf-8"))
    d = s.setdefault("describe", {})
    print("\nWhich AI should describe your clips?\n")
    print("  1  On this Mac (free, private - nothing leaves the computer)")
    print("  2  Claude (better descriptions - still frames are sent to Anthropic, about 2 cents a clip on your API key)")
    print("  3  Off\n")
    pick = input("Type 1, 2 or 3 and press Return [1]: ").strip() or "1"
    if pick == "2":
        print("\nPaste your Anthropic API key (from console.anthropic.com > API Keys). It is saved only on this Mac.")
        key = getpass.getpass("API key (hidden): ").strip()
        if not key.startswith("sk-ant-"):
            print("That doesn't look like an Anthropic API key - keeping the local model. Run --setup again to retry.")
            pick = "1"
        else:
            os.makedirs(SUP, exist_ok=True)
            fd = os.open(KEY, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            os.write(fd, key.encode()); os.close(fd)
            d.update(engine="claude", consent_send_stills=True)
            d.setdefault("model", "claude-opus-5-5")
            print("Saved. Clips will be described by Claude.")
    if pick == "3":
        d.update(engine="off"); print("Descriptions are off.")
    elif pick != "2":
        d.update(engine="local", consent_send_stills=False)
        print("Clips will be described on this Mac (the model downloads on the first run, about 6 GB).")
    json.dump(s, open(settings_path, "w", encoding="utf-8"), indent=2)


if __name__ == "__main__":
    main(sys.argv[1])
