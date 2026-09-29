// Touch controls for phones/tablets: virtual joystick + action buttons (they emit the same key events as the keyboard).
export const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || location.search.includes('touch');
export const touch = { x: 0, y: 0, active: false, run: false };

const key = (code, key, type) => dispatchEvent(new KeyboardEvent(type, { code, key }));
if (TOUCH) {
  document.body.classList.add('touch');
  const ui = document.createElement('div'); ui.id = 'touch-ui';
  ui.innerHTML = `<div id="joy"><div id="knob"></div></div>
    <div id="tbtns">
      <button data-k="KeyE" data-c="e" class="big">✋<small>פעולה</small></button>
      <button data-k="Space" data-c=" " class="big">⤴<small>קפיצה</small></button>
      <button data-k="KeyQ" data-c="q">🛴</button><button data-k="KeyF" data-c="f">🔦</button>
      <button data-k="KeyM" data-c="m">🗺️</button><button data-k="Escape" data-c="Escape">⏸</button>
    </div>`;
  document.body.append(ui);
  // joystick: analog; pushing it near the rim runs
  const joy = ui.querySelector('#joy'), knob = ui.querySelector('#knob'), R = 55;
  let id = null, cx = 0, cy = 0;
  const move = e => {
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.x = dx / R; touch.y = -dy / R; touch.run = d > R * 0.92;
  };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; try { joy.setPointerCapture(id); } catch {} const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; touch.active = true; move(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; touch.active = false; touch.x = touch.y = 0; touch.run = false; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  // buttons → key events (dialogs, cards, map and pause all listen to keydown already)
  for (const b of ui.querySelectorAll('#tbtns button')) {
    b.addEventListener('pointerdown', e => { e.preventDefault(); key(b.dataset.k, b.dataset.c, 'keydown'); b.classList.add('down'); });
    const up = () => { key(b.dataset.k, b.dataset.c, 'keyup'); b.classList.remove('down'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  const orient = () => document.body.classList.toggle('portrait', innerHeight > innerWidth);
  addEventListener('resize', orient); orient();
}
