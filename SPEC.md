# Kidmaker — Voice/Text → Game Platform (spec)

A kid says or types a prompt; the platform generates a **complete, playable game**.
Every generated game is DYNAMIC — its shape depends on the prompt, not a fixed template.

## The 6 rules (apply to every generated game)
1. **Sides are optional & scalable.** Some games are team-vs-team ("Sonic+Shadow vs
   Gorilla+Spiderman"); some have no sides ("rock-paper-scissors", "tic-tac-toe" = 2
   players; "chess" = 2 sides of pieces). The side/character picker appears ONLY when
   the genre needs it.
2. **Levels/rounds.** Every game has progression — stages (platformer), rounds (RPS,
   tic-tac-toe), or increasing difficulty (racer).
3. **Animations fit the genre.** Brawler = punch/stomp juice; racer = speed lines;
   board = piece slide. Each engine ships its own feel.
4. **Language pick.** Each game lets the kid choose language (he/en/…); all UI text and
   generated names use it.
5. **Responsive/mobile-first.** Touch controls, fits any phone, no horizontal scroll.
6. **GPT image for characters.** When a genre needs characters/pieces, they are
   generated with GPT-image from the prompt (with a safe fallback set).

## Flow
```
prompt (voice via Web Speech API, or text)
  → POST /api/plan  → GPT returns a GAME SPEC (JSON, schema below)
  → for each item in spec.generate[]: POST /api/character → GPT-image → sprite
  → engine registry picks spec.genre → engine renders + runs the game
```

## GAME SPEC (what GPT returns)
```json
{
  "title": "סוניק ושאדו נגד הגורילה",
  "genre": "brawler",              // brawler | racer | board | tictactoe | rps | collector
  "language": "he",
  "needsSides": true,              // show team-vs-team picker?
  "needsCharacters": true,         // generate character sprites?
  "sides": [
    {"label":"הקבוצה שלי","members":["סוניק","שאדו"]},
    {"label":"היריבים","members":["גורילה","ספיידרמן"]}
  ],
  "levels": 3,                     // stages/rounds; 0 = single endless
  "goal": "לחסל את כל היריבים",
  "actions": ["move","jump","hit"],
  "generate": [                    // items needing a GPT-image sprite
    {"key":"sonic","desc":"Sonic the Hedgehog game sprite"},
    {"key":"shadow","desc":"Shadow the Hedgehog, black red stripes, sprite"}
  ],
  "theme": "grass"
}
```
- Engines READ the spec; missing/false fields simply disable that module
  (e.g. `needsCharacters:false` → no sprites, no picker).

## Engine registry (each is a self-contained module with the same interface)
`init(spec, assets, mount)` · `start()` · `destroy()` · responsive · own controls.
- `brawler`  — team vs team, scrolling stages, stomp+punch (DONE, adapt to spec)
- `tictactoe`— 2 players/rounds, tap a cell (simple, proves scalability)
- `rps`      — rounds, pick, no characters/sides
- `racer`    — lanes, accelerate/dodge, finish line   (later)
- `board`    — chess-like grid, drag pieces            (later)

## Build order
1. Spec + shell: prompt screen (voice+text), language pick, `/api/plan` call, registry.
2. Two engines that look TOTALLY different — `brawler` + `tictactoe` — to prove dynamism.
3. Wire GPT-image character generation through the backend.
4. Add engines: rps, racer, board.

## Backend (thin; holds the OpenAI key server-side — never in the client)
- `POST /api/plan`      {prompt,language} → GAME SPEC json (GPT chat, JSON mode)
- `POST /api/character` {desc} → {img: dataURL} (GPT-image, with moderation fallback)
Runs as a small service; the front-end is static and mobile-first.
