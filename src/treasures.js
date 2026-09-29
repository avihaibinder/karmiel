// Mitzi's hidden treasures (30 collectibles) + a "secret" per neighbourhood, shown GTA-style on first visit.
import { THREE, scene, $, label } from './core.js';
import { POI, PLACES, CHETS, ROUNDABOUTS, free, groundAt, placeAt } from './world.js';
import { LM } from './landmarks.js';
import { P } from './player.js';
import { TREASURES, MILESTONES, MITZI_END, HOODS } from './collect_text.js';
import { toast, wa, achieve, say, T } from './ui.js';
import { sfx } from './audio.js';

const KEY = 'karmiel-treasures';
const state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
state.got ||= []; state.hoods ||= [];
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
export const resetTreasures = () => { state.got = []; state.hoods = []; persist(); for (const t of spots) t.g.visible = true; count(); };

// ---------------------------------------------------------------- where they hide: special spots first, then one per neighbourhood
function near(p, r0 = 4, r1 = 60) {
  for (let r = r0; r < r1; r += 3) for (let a = 0; a < 6.28; a += 0.5) { const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (free(x, z)) return { x, z }; }
  return { x: p.x, z: p.z };
}
const stone = ROUNDABOUTS.find(r => r.name === 'כיכר האבן');
const special = [
  LM.platform, LM.amphi.stage, CHETS[1] && { x: CHETS[1].x, z: CHETS[1].z }, stone && { x: stone.x + stone.ir * 0.6, z: stone.z }, LM.bigLot.center,
  LM.schnitzelia.critic, LM.moti, LM.exam.seat, LM.tremp.stop, LM.makosh, POI.japanese && near(POI.japanese), LM.cityhall.ribbon, LM.photoBooth, LM.home,
].filter(Boolean);
const places = PLACES.map(p => near(p, 6, 90));
const where = [...special, ...places].slice(0, TREASURES.length);
const spots = TREASURES.map((t, i) => {
  const p = where[i % where.length], g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa500, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25 }));
  g.add(gem); const s = label(t.emoji, { bg: 'rgba(0,0,0,0)', px: 80, k: 0.011 }); s.position.y = 1; g.add(s);
  const base = groundAt(p.x, p.z) + 1.1; g.position.set(p.x, base, p.z); g.visible = !state.got.includes(i); scene.add(g);
  return { ...t, i, g, gem, base, x: p.x, z: p.z };
});

// ---------------------------------------------------------------- HUD + area banner
const counter = document.createElement('div'); counter.className = 'panel'; $('counters').append(counter);
const count = () => { counter.textContent = `💎 אוצרות מיצי: ${state.got.length}/${TREASURES.length}`; };
count();
let bannerT = 0;
function banner(name) {
  const el = $('area'); el.textContent = name; el.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => el.classList.remove('show'), 4200);
}

// ---------------------------------------------------------------- per frame
let pingT = 0, hoodT = 0;
export async function tickTreasures(dt, t, active) {
  if (!active || P.interior) return;
  let nearest = 1e9;
  for (const s of spots) {
    if (!s.g.visible) continue;
    const d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); nearest = Math.min(nearest, d);
    if (d > 120) continue;
    s.gem.rotation.y = t * 2; s.g.position.y = s.base + Math.sin(t * 3 + s.i) * 0.2;
    if (d < 2.2 && Math.abs(P.pos.y + 1 - s.base) < 2.5) collect(s);
  }
  if ((pingT -= dt) <= 0 && nearest < 30) { pingT = 0.6 + nearest / 12; sfx('beep', 1 - nearest / 30); }   // warmer → faster pings
  if ((hoodT -= dt) <= 0) {
    hoodT = 1;
    const h = placeAt(P.pos.x, P.pos.z);
    if (h && HOODS[h] && !state.hoods.includes(h)) {
      state.hoods.push(h); persist(); banner(h); setTimeout(() => toast(`🗺️ <b>${h}</b>: ${HOODS[h]}`, '', 7000), 600);
      if (state.hoods.length === Object.keys(HOODS).length) achieve('hoods', 'מכיר כל פינה', 'ביקרת בכל השכונות והיישובים שמסביב. עכשיו אתה יודע איפה כל אחד חונה.');
    }
  }
}
async function collect(s) {
  s.g.visible = false; state.got.push(s.i); persist(); count(); sfx('pickup'); sfx('meow');
  toast(`${s.emoji} <b>${s.name}</b><br>${s.text}`, 'good', 7000);
  const n = state.got.length, m = MILESTONES[n];
  if (m) setTimeout(() => wa(m[0], m[1]), 2500);
  if (n === 10) achieve('treas10', 'השותף של מיצי', 'מצאת 10 אוצרות של מיצי. היא מתחילה לחשוד בך.');
  if (n === TREASURES.length) {
    achieve('treasAll', 'כל האוצרות', 'מצאת את כל 30 האוצרות של מיצי. היא חונכת לך כיכר. או שזו מלכודת.');
    setTimeout(async () => { for (const [sp, line] of MITZI_END) await say(sp, line); }, 3500);
  }
}
