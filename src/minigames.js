// Mini-games: festival rhythm rounds and multiple-choice quizzes.
import { $, clamp, pick, FONT } from './core.js';
import { ac, danceTrack, sfx } from './audio.js';
import { ask, say } from './ui.js';
import { P } from './player.js';

export const mg = { key: null };
// ---------------------------------------------------------------- rhythm
export function rhythm({ bpm = 118, beats = 36, density = 0.75, doubles = 0.2, flavour = 0, title = '', blink = false }) {
  return new Promise(resolve => {
    const cv = $('dance'); cv.classList.remove('hidden'); cv.width = innerWidth; cv.height = innerHeight;
    // tap/click a lane to hit it (phones have no arrow keys)
    cv.onpointerdown = e => { const lw = 84, cx0 = cv.width / 2 - lw * 1.5, l = Math.round((e.clientX - cx0) / lw); if (l >= 0 && l < 4 && mg.key) mg.key({ code: ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'][l] }); };
    // game time runs on the system clock so the round still ends if the browser keeps audio suspended
    const x = cv.getContext('2d'), a = ac(), T0 = a.currentTime + 2.2, B = danceTrack(T0, bpm, beats, flavour), P0 = performance.now() / 1000 + 2.2, clock = () => performance.now() / 1000 - P0;
    const notes = [];
    for (let b = 4; b < beats; b++) {
      if (Math.random() < density) notes.push({ t: b * B, l: Math.floor(Math.random() * 4) });
      if (b > 8 && Math.random() < doubles) notes.push({ t: (b + 0.5) * B, l: Math.floor(Math.random() * 4) });
    }
    mg.cur = { notes, clock };
    let hits = 0, combo = 0, best = 0, msg = '', msgT = 0, msgCol = '#fff'; const flash = [0, 0, 0, 0], end = beats * B + 1;
    const KM = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3 };
    const MISS = ['זה היה צעד או מעידה?', 'גלית נאנחה.', 'הקהל שורק. לטובה. כנראה.', 'רגל שמאל!'];
    mg.key = e => {
      const l = KM[e.code]; if (l === undefined) return true;
      const now = clock(), n = notes.find(n => !n.j && n.l === l && Math.abs(n.t - now) < 0.2);
      flash[l] = 1;
      if (n) { n.j = 'hit'; hits++; combo++; best = Math.max(best, combo); const d = Math.abs(n.t - now); msg = d < 0.06 ? 'מושלם!' : d < 0.12 ? 'יפה!' : 'כמעט!'; msgCol = d < 0.06 ? '#ffd166' : '#7ee787'; P.hop = 1; }
      else { combo = 0; msg = pick(MISS); msgCol = '#ff6b6b'; }
      msgT = 0.6; return true;
    };
    const COLS = ['#ff5d8f', '#4fc3f7', '#7ee787', '#ffb74d'], ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
    const arrow = (cx, cy, l, s, fill, alpha = 1) => {
      x.save(); x.translate(cx, cy); x.rotate(ROT[l]); x.globalAlpha = alpha; x.beginPath();
      x.moveTo(0, -s); x.lineTo(s, 0); x.lineTo(s * 0.4, 0); x.lineTo(s * 0.4, s); x.lineTo(-s * 0.4, s); x.lineTo(-s * 0.4, 0); x.lineTo(-s, 0); x.closePath();
      if (fill) { x.fillStyle = fill; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke(); } else { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 4; x.stroke(); }
      x.restore();
    };
    let last = performance.now();
    const frame = () => {
      const dt = (performance.now() - last) / 1000; last = performance.now();
      const now = clock(), W = cv.width, Hh = cv.height, lw = 84, cx0 = W / 2 - lw * 1.5, ty = Hh - 120, spd = 430;
      P.beat = now / B;
      x.clearRect(0, 0, W, Hh);
      x.fillStyle = 'rgba(15,10,30,.55)'; x.fillRect(cx0 - lw / 2 - 16, 0, lw * 4 + 32, Hh);
      for (let l = 0; l < 4; l++) { arrow(cx0 + l * lw, ty, l, 30, null); if (flash[l] > 0) { arrow(cx0 + l * lw, ty, l, 34, COLS[l], flash[l]); flash[l] -= dt * 4; } }
      for (const n of notes) {
        if (!n.j && now - n.t > 0.2) { n.j = 'miss'; combo = 0; msg = pick(MISS); msgCol = '#ff6b6b'; msgT = 0.5; }
        if (n.j === 'hit') continue;
        const y = ty - (n.t - now) * spd; if (y < -60 || y > Hh + 60) continue;
        const bl = blink && !n.j && Math.sin(now * 18 + n.t) > 0.3 ? 0.25 : 1;
        arrow(cx0 + n.l * lw, y, n.l, 30, COLS[n.l], n.j ? 0.3 : bl);
      }
      x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = '#fff';
      x.font = `900 26px ${FONT}`; x.fillText(title, W / 2, 44);
      x.font = `700 18px ${FONT}`; x.fillText(`${hits} / ${notes.length}  ·  קומבו ${combo}`, W / 2, 74);
      if (now < 0) { x.font = `900 90px ${FONT}`; x.fillText(Math.ceil(-now), W / 2, Hh / 2); }
      if (msgT > 0) { msgT -= dt; x.font = `900 ${34 + msgT * 26}px ${FONT}`; x.fillStyle = msgCol; x.fillText(msg, W / 2, ty - 160); }
      x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(cx0 - lw / 2, Hh - 28, lw * 4, 8);
      x.fillStyle = '#ffd166'; x.fillRect(cx0 - lw / 2, Hh - 28, lw * 4 * clamp(now / end, 0, 1), 8);
      if (now > end) { mg.key = null; cv.classList.add('hidden'); resolve({ score: hits / Math.max(1, notes.length), best }); }
      else requestAnimationFrame(frame);
    };
    frame();
  });
}
// ---------------------------------------------------------------- quiz
// questions: {q, a: [..], ok: [indices], yes, no, why: {index: text}}
export async function quiz(speaker, questions) {
  let score = 0;
  for (const Q of questions) {
    const i = await ask(speaker, Q.q, Q.a);
    if (Q.ok.includes(i)) { score++; sfx('coin'); if (Q.yes) await say(speaker, Q.yes); }
    else { sfx('fail'); await say(speaker, Q.why?.[i] || Q.no); }
  }
  return score;
}
