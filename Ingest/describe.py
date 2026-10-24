"""Writes what is in a clip from its 12-frame contact sheet, in the same fields the Library has always used:
desc, content, shot, setting, people, tags, quality. Two engines, chosen under "describe" in siftor.json:

  local   (default) a vision model in Ollama on this Mac (free, nothing leaves the computer, weaker descriptions).
  claude  Claude through Anthropic's API (best results). The contact sheet's still frames are sent; footage never is.
          Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) and "consent_send_stills": true.
"""
import base64, json, os, urllib.request

CONTENT = ["talking-head", "interview", "podcast", "testimonial", "event-stage", "event-crowd", "event-networking",
           "event-dinner", "broll", "lifestyle", "real-estate", "product", "drone", "travel", "sports",
           "graphic-overlay", "finished-edit", "test-shot", "other"]
SHOT = ["close", "medium", "wide", "aerial", "pov", "mixed"]
SETTING = ["interior", "exterior", "mixed"]
PEOPLE = ["none", "1", "2-5", "6-20", "20+"]
QUALITY = ["underexposed", "overexposed", "motion-blur", "shaky", "soft-focus", "black-frames", "obstructed"]

SCHEMA = {
    "type": "object",
    "properties": {
        "desc": {"type": "string", "description": "One sentence, 12-30 words: who/what is on screen and what happens"},
        "content": {"type": "string", "enum": CONTENT},
        "shot": {"type": "string", "enum": SHOT},
        "setting": {"type": "string", "enum": SETTING},
        "people": {"type": "string", "enum": PEOPLE},
        "tags": {"type": "array", "items": {"type": "string"}, "description": "5-10 lowercase search words, hyphenated"},
        "quality": {"type": "array", "items": {"type": "string", "enum": QUALITY}},
    },
    "required": ["desc", "content", "shot", "setting", "people", "tags", "quality"],
    "additionalProperties": False,
}

PROMPT = """This is a contact sheet of one video clip: 12 frames spread evenly through the clip, with timecodes.
The header shows the file name, length, format and folder. A video editor will search their footage archive
with what you write, so describe what can actually be seen; never guess names of people you cannot read on screen.

File: {rel}
Footage folder: {folder}

content: the kind of footage. talking-head = one person speaking to camera; interview = a person answering
someone off or on camera; podcast = seated conversation with microphones; testimonial = a customer praising
something; event-* = at an event (stage, crowd, networking, dinner); broll = cutaway footage of things or places;
finished-edit = an already edited video with titles/graphics; test-shot = camera tests, black or junk.
quality: only problems you can see. Flat, low-contrast log footage (S-Log, V-Log) is normal, NOT a defect."""


class SetupError(Exception):
    """The engine can't run on this Mac yet (missing key, model, program)."""


class Stop(Exception):
    """Every later clip would fail the same way (bad key, no credit), so stop the step."""


def label(cfg):
    return f"Claude ({cfg.get('model', 'claude-opus-5-5')})" if cfg.get("engine", "local") == "claude" else \
        f"the local model {cfg.get('local_model', 'qwen2.5vl:7b')}"


def _clean(d):
    d["tags"] = [t.strip().lower().replace(" ", "-") for t in d.get("tags", []) if t.strip()][:12]
    d["quality"] = [q for q in d.get("quality", []) if q in QUALITY]
    return d


def engine(cfg):
    return _claude(cfg) if cfg.get("engine", "local") == "claude" else _local(cfg)


# ---------------------------------------------------------------- Claude
def _claude(cfg):
    try:
        import anthropic
    except ImportError:
        raise SetupError("the anthropic package is missing (the Siftor installer adds it: pip install anthropic)")
    client = anthropic.Anthropic(max_retries=4)
    model = cfg.get("model", "claude-opus-5-5")

    def run(sheet, folder, rel):
        img = base64.standard_b64encode(open(sheet, "rb").read()).decode()
        try:
            r = client.beta.messages.create(
                model=model,
                max_tokens=4000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",                       # if one model declines, another finishes the clip
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img}},
                    {"type": "text", "text": PROMPT.format(rel=rel, folder=folder)},
                ]}],
            )
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as e:
            raise Stop(f"Anthropic refused the API key ({e.message}). Check ANTHROPIC_API_KEY.")
        except anthropic.BadRequestError as e:
            if "credit" in str(e.message).lower():
                raise Stop(f"the Anthropic account is out of credit ({e.message})")
            raise
        if r.stop_reason == "refusal":
            raise RuntimeError("declined: " + str(getattr(r.stop_details, "category", "")))
        if r.stop_reason == "max_tokens":
            raise RuntimeError("answer was cut off")
        text = next(b.text for b in r.content if b.type == "text")
        return _clean(json.loads(text))

    return run


# ---------------------------------------------------------------- local (Ollama)
OLLAMA = "http://127.0.0.1:11434"


def _local(cfg):
    model = cfg.get("local_model", "qwen2.5vl:7b")
    try:
        tags = json.load(urllib.request.urlopen(OLLAMA + "/api/tags", timeout=3))
    except Exception:
        raise SetupError("Ollama is not running (start it, or run the Siftor installer)")
    if not any(m.get("name", "").startswith(model) for m in tags.get("models", [])):
        raise SetupError(f"the local model {model} is not downloaded yet (ollama pull {model})")

    def run(sheet, folder, rel):
        body = {"model": model, "stream": False, "format": SCHEMA, "options": {"temperature": 0},
                "messages": [{"role": "user", "content": PROMPT.format(rel=rel, folder=folder),
                              "images": [base64.b64encode(open(sheet, "rb").read()).decode()]}]}
        req = urllib.request.Request(OLLAMA + "/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
        out = json.load(urllib.request.urlopen(req, timeout=600))
        d = _clean(json.loads(out["message"]["content"]))
        for k, allowed in (("content", CONTENT), ("shot", SHOT), ("setting", SETTING), ("people", PEOPLE)):
            if d.get(k) not in allowed:
                d[k] = "other" if k == "content" else allowed[-1]
        return d

    return run
