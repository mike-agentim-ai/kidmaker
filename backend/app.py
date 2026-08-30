#!/usr/bin/env python3
"""
Kidmaker backend — thin FastAPI service.
Holds the OpenAI key server-side (NEVER in the client).
  POST /api/plan       {prompt, language} -> GAME SPEC json
  POST /api/character  {key, desc}        -> {key, img: dataURL png}
"""
import os, json, base64
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
app = FastAPI(title="Kidmaker API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GENRES = ["brawler", "tictactoe", "rps", "racer", "board", "collector"]

PLAN_SYS = """You are a game designer for KIDS. A child gives a short prompt (any language).
Return ONE JSON object describing a complete, kid-friendly game. Schema:
{
 "title": string (in the child's language),
 "genre": one of ["brawler","tictactoe","rps","racer","board","collector"],
 "language": ISO code you detected (e.g. "he","en"),
 "needsSides": bool,        // true only for versus games with teams (brawler, board)
 "needsCharacters": bool,   // true if the game shows characters/pieces to generate
 "sides": [ {"label": string, "members": [string,...]} ],  // [] if no sides
 "levels": int,             // stages/rounds; >=1
 "goal": string,
 "actions": [string,...],
 "generate": [ {"key": short_slug, "desc": english image prompt for a game sprite} ],
 "theme": string
}
RULES:
- Pick the genre that best fits. "X vs Y" or fighting -> brawler. "tic tac toe / איקס עיגול" -> tictactoe.
  "rock paper scissors / אבן נייר" -> rps. "race / cars / מרוץ" -> racer. "chess / שחמט" -> board.
- needsSides/needsCharacters MUST be false for rps and tictactoe unless the child clearly
  wants characters. Keep it scalable: only include modules the game truly needs.
- Every game has levels>=1.
- 'generate' lists ONLY items that need an image (characters/pieces). Empty array if none.
- Respond with JSON ONLY, no prose."""

class PlanReq(BaseModel):
    prompt: str
    language: str | None = None

@app.post("/api/plan")
def plan(req: PlanReq):
    user = f"Child prompt: {req.prompt}\nPreferred language: {req.language or 'auto-detect'}"
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"system","content":PLAN_SYS},{"role":"user","content":user}],
        response_format={"type":"json_object"}, temperature=0.4)
    spec = json.loads(r.choices[0].message.content)
    if spec.get("genre") not in GENRES:
        spec["genre"] = "brawler"
    spec.setdefault("levels", 1)
    spec.setdefault("generate", [])
    return spec

class CharReq(BaseModel):
    key: str
    desc: str

FALLBACK = {  # served if moderation blocks generation
    "img": None
}

@app.post("/api/character")
def character(req: CharReq):
    prompt = (f"{req.desc}. Cute cartoon game character sprite, full body, "
              "flat style, bold colors, plain transparent background, no text.")
    try:
        r = client.images.generate(model="gpt-image-1", prompt=prompt,
                                    size="1024x1024", n=1, background="transparent")
        b64 = r.data[0].b64_json
        return {"key": req.key, "img": f"data:image/png;base64,{b64}"}
    except Exception as e:
        # moderation or error -> signal client to use a fallback emoji/sprite
        return {"key": req.key, "img": None, "error": str(e)[:200]}

@app.get("/health")
def health():
    return {"status": "ok"}
