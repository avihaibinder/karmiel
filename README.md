# כרמיאל: הדרך החוצה

A comic open-world adventure set in a real-map Karmiel: 180-ish roundabouts, one grandmother, one kleptomaniac cat, and a hero who thinks he can leave for Tel Aviv. Hebrew UI, keyboard or touch.

All characters, names, institutions and events in the game are fictional; any resemblance to real people or events is coincidental.

## Run

```
python tools\serve.py      # or double-click play.bat
```

Opens http://127.0.0.1:8765/. A server is required (plain ES modules do not load from `file://`); three.js is fetched from a CDN on first load.

## Controls

WASD / arrows move · Shift run · Space jump · E talk / act · Q scooter · F flashlight / car remote · M map · Esc pause. Phones get a joystick and buttons.

## Code map (`src/`)

| file | what |
|---|---|
| `core.js` | renderer, scene, shared helpers (materials, merged geometry, Hebrew text textures) |
| `world.js` | terrain (SRTM), buildings, roads, roundabouts, vegetation, collisions, ground height |
| `landmarks.js` | hand-made props at real OpenStreetMap spots (station, city hall, mall, BIG, amphi…) |
| `pizza.js` | the pedestrian mall and its pizzerias |
| `characters.js`, `npc.js` | blocky people/animals/vehicles; NPC movement, barks, stealth cones |
| `player.js` | movement, the e-scooter, follow camera |
| `traffic.js` | cars driving the real road graph (and running you over) |
| `missions.js` | story: prologue, acts, side missions, finale, endings, save/continue |
| `horror.js` | the abandoned Kikar HaIr mall level |
| `banter.js`, `collect_text.js` | NPC dialogue, group posts, treasures text |
| `ui.js` | dialogs, cards, toasts, the "כרמיאלים מדברים" Facebook group feed, radar, map |
| `fem.js` | generated map: masculine line → feminine line for a female hero (lines not in it play masculine) |
| `data.js` | generated from OpenStreetMap + SRTM by `tools/build_data.py`. Do not edit. |

Text is written with "יוסי" and personalised at display time (`T()` in `ui.js`). Inside Hebrew strings use `״` / `׳`, not ASCII quotes.

## Testing

`tools/smoke.py` drives the game in a headless Edge (Python Playwright): loads it, starts a game, talks to a resident, and reports console errors; `python tools/smoke.py mall` also runs a bot through the mall escape. Start the server first. Notes: run one headless browser at a time; `node --check` does not catch syntax errors in these modules, use `node -e "import('./src/x.js').catch(e => console.log(e.message))"`.

`window.__k` exposes the game state (`G`, `P`, `M`, `UI`, `W`, `LM`, `npcs`, `horror`, `teleport`, `cam`) for debugging and the tests.

## Data

`tools/build_data.py` (with `osm.py`, `elev.py`) rebuilds `src/data.js` from the raw OSM/SRTM dumps in `tools/`. Map data © OpenStreetMap contributors (ODbL).
