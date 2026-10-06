"""Headless smoke test for the game. Start the server first (python tools/serve.py), then:

    python tools/smoke.py          # load, start a game, talk to a resident, report console errors
    python tools/smoke.py mall     # ...and run a bot through the old-mall escape from checkpoint 5

Needs: pip install playwright (uses the installed Edge; Chrome works too via channel='chrome').
Run one headless browser at a time — two software-GL instances starve each other.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:8765/')
MALL = 'mall' in sys.argv
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: errors.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'[pageerror] {e}'))
    pg.goto(URL, wait_until='load')
    pg.wait_for_function('window.__k', timeout=150000)
    print('loaded; roundabouts:', pg.evaluate('__k.W.ROUNDABOUTS.length'), 'npcs:', pg.evaluate('__k.npcs.length'))
    pg.click('#t-new'); pg.fill('#name-input', 'בדיקה'); pg.click('#name-go'); time.sleep(1.5)
    for _ in range(9): pg.keyboard.press('Space'); time.sleep(0.25)   # disclaimer + prologue cards
    print('stage:', pg.evaluate('__k.G.stage'), 'active:', pg.evaluate('__k.G.active'))
    pg.keyboard.down('KeyW'); time.sleep(1.5); pg.keyboard.press('Space'); time.sleep(1); pg.keyboard.up('KeyW')
    pg.keyboard.press('KeyM'); time.sleep(0.5); pg.keyboard.press('KeyM'); pg.keyboard.press('Escape'); time.sleep(0.3); pg.keyboard.press('Escape')
    pg.evaluate('(() => { const n = __k.npcs.find(n => n.id === "res0"); __k.teleport(n.h.g.position.x + 2, n.h.g.position.z + 2); })()')
    time.sleep(0.5)
    for _ in range(14): pg.keyboard.press('KeyE'); time.sleep(0.15)
    pg.keyboard.press('Digit1'); time.sleep(0.3)
    for _ in range(6): pg.keyboard.press('KeyE'); time.sleep(0.15)
    time.sleep(2)

    def close_dialogs():
        for _ in range(30):
            st = pg.evaluate('(() => ({ d: !!__k.UI.dState, c: !!__k.UI.cardResolve, ch: !!(__k.UI.dState && __k.UI.dState.choices) }))()')
            if not st['d'] and not st['c']: return
            pg.keyboard.press('Digit1' if st['ch'] else 'KeyE'); time.sleep(0.2)
    close_dialogs()

    if MALL:
        print('mall start:', pg.evaluate('''(async () => {
            const h = await import('./src/horror.js'); const core = await import('./src/core.js'); core.renderer.render = () => {};   // logic only: software GL is too slow for the mall
            __k.G.active = 'M7'; h.enterMall(); await new Promise(r => setTimeout(r, 800));
            h.horror.phase = 'escape'; h.horror.lightsOn = true; h.horror.cp = 5; __k.teleport(9030, 30, -Math.PI / 2);   // the events-hall checkpoint
            await new Promise(r => setTimeout(r, 300)); return h.roomAt(__k.P.pos.x, __k.P.pos.z); })()'''))
        WP = [[22, 38], [-11, 38]]   # west doorway, then up the escalator to the exit
        pg.keyboard.down('ShiftLeft'); pg.keyboard.down('KeyW'); t0 = time.time(); out = None; wi = 0
        while time.time() - t0 < 40:
            s = pg.evaluate('(() => { const P = __k.P; return { active: __k.horror.active, x: Math.round(P.pos.x - 9000), z: Math.round(P.pos.z), deaths: __k.horror.deaths || 0, card: !!__k.UI.cardResolve }; })()')
            if s['card']: pg.keyboard.press('Space'); wi = 0
            if not s['active']: out = s; break
            tx, tz = WP[wi]
            if abs(s['x'] - tx) < 1.5 and abs(s['z'] - tz) < 1.5 and wi < len(WP) - 1: wi += 1; tx, tz = WP[wi]
            pg.evaluate(f'(() => {{ const P = __k.P, dx = {tx} - (P.pos.x - 9000), dz = {tz} - P.pos.z; __k.cam.yaw = Math.atan2(-dx, -dz); __k.cam.manualT = 1; }})()')
            time.sleep(0.1)
        pg.keyboard.up('KeyW'); pg.keyboard.up('ShiftLeft')
        print('mall escape: %.1fs' % (time.time() - t0), out or ('FAILED: ' + json.dumps(s)))
    b.close()

print('console errors/warnings:', len(errors))
for e in errors[:40]: print('  ', e[:300])
sys.exit(1 if errors else 0)
