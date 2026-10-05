// UI: Hebrew HUD — dialogs, cards, toasts, Facebook feed, objectives, timer, GTA-style radar and full map.
import { $, clamp, sleep, FONT } from './core.js';
import { ROADS, BUILDINGS, AREAS, BOUNDS, PLACES, ROUNDABOUTS, RAILS } from './world.js';
import { sfx } from './audio.js';
import { FEM } from './fem.js';

export const UI = { busy: false, dState: null, cardResolve: null, stats: { savtaAsked: 0, mapOpened: 0 } };
// the hero's name — all text is written with "יוסי" and personalised on the way to the screen
export const PLAYER = { name: 'יוסי', gender: 'm' };
// female hero: swap in the feminine version of the line (fem.js), then personalise the name
const FEM_KEYS = Object.keys(FEM).filter(k => k.length > 10).sort((a, b) => b.length - a.length);
function feminine(s) {   // exact line first, then any known line embedded in a longer string ("💥 " + line, template text…)
  if (FEM[s]) return FEM[s];
  for (const k of FEM_KEYS) if (s.includes(k)) s = s.split(k).join(FEM[k]);
  return s;
}
export const T = s => typeof s !== 'string' ? s : (PLAYER.gender === 'f' ? feminine(s).replace(/ה-נ-כ-ד /g, 'ה-נ-כ-ד-ה ') : s).replace(/יוסי/g, PLAYER.name).replace(/י-ו-ס-י/g, [...PLAYER.name].join('-'));

// ---------------------------------------------------------------- toasts / achievements / the Facebook group
export function toast(html, cls = '', ms = 4600) {
  const d = document.createElement('div'); d.className = 'toast ' + cls; d.innerHTML = T(html); $('toasts').prepend(d);
  while ($('toasts').children.length > 5) $('toasts').lastChild.remove();
  setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 600);
}
const ACH = {};
export const achievements = ACH;
export function achieve(id, name, desc) {
  if (ACH[id]) return; ACH[id] = { name, desc };
  toast(`<span class="ach-ico">🏆</span><b>${name}</b><br><small>${desc}</small>`, 'ach', 6000); sfx('ach');   // toast applies T()
}
const WA_COLORS = ['#25d366', '#34b7f1', '#ff6b6b', '#ffd166', '#b388ff', '#ff9f5a', '#7ee787'];
const waColor = n => WA_COLORS[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % WA_COLORS.length];
// the regulars who comment on everything (shown under some posts)
const WA_COMMENTS = [['סבתא רבקה', 'אכלת?'], ['בוריס', 'לא.'], ['מנהל הקבוצה', 'לא חשוב. אבל נשאר.'], ['אלון מהבניין ממול', 'מי זה יוסי?'], ['ראש העיר', 'יש עציץ? 🌸'], ['חנה מהקומה השלישית', 'ראיתי מהמרפסת. מאשרת.'], ['אורנה', 'זה כסוף?'], ['נועה', 'עדיין ב-85.'], ['עדי אלדר', 'בזמני לא היו תגובות. היו מכתבים.'], ['ציפי', 'תיקח מספר מאמי']];
let waTimer = 0;
export function wa(sender, text) {
  const feed = $('wa'); feed.classList.add('show');
  const d = document.createElement('div'); d.className = 'wa-msg';
  sender = T(sender); text = T(text);
  const h = [...text].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7), likes = 1 + h % 40, comments = h % 7;   // "engagement", deterministic per post
  const emo = ['👍', '👍❤️', '👍😆', '👍❤️😮', '😆', '👍😢'][h % 6], cmt = comments && h % 10 < 4 ? WA_COMMENTS[h % WA_COMMENTS.length] : null;
  const av = (n, c) => `<div class="wa-av" style="background:${c}">${[...n][0]}</div>`;
  if (sender === 'מערכת') d.innerHTML = `<div class="wa-sys">${text}</div>`;
  else d.innerHTML = `<div class="wa-top">${av(sender, waColor(sender))}<div><div class="wa-from">${sender}</div><div class="wa-meta">עכשיו · 🌐</div></div><div class="wa-dots">···</div></div><div>${text}</div>
    <div class="wa-react"><span>${emo} ${likes}</span><span>${comments === 1 ? 'תגובה אחת' : comments ? comments + ' תגובות' : ''}</span></div>
    <div class="wa-act"><span>👍 לייק</span><span>💬 תגובה</span><span>↪ שיתוף</span></div>
    ${cmt ? `<div class="wa-cmt">${av(T(cmt[0]), waColor(cmt[0]))}<div class="bub"><b>${T(cmt[0])}</b>${T(cmt[1])}</div></div>` : ''}`;
  $('wa-list').append(d);
  while ($('wa-list').children.length > (innerHeight < 850 ? 2 : 3)) $('wa-list').firstChild.remove();   // posts are tall; keep them clear of the keys bar
  sfx('wa'); clearTimeout(waTimer); waTimer = setTimeout(() => feed.classList.remove('show'), 9000);
}

// ---------------------------------------------------------------- dialogue
const SPEAKER_COL = { 'יוסי': '#8ecae6', 'סבתא רבקה': '#ff8fab', 'ראש העיר': '#ffd166', 'מיצי': '#ffb703', 'כיכרון': '#ff4d6d', 'מספר': '#cdb4db' };
function openDialog(name, text, choices, resolve) {
  $('dialog').classList.add('show'); $('dname').style.color = SPEAKER_COL[name] || '#ffd166'; name = T(name); text = T(text); choices = choices && choices.map(T); $('dname').textContent = name;
  $('dtext').textContent = ''; $('dchoices').innerHTML = ''; $('dhint').style.display = choices ? 'none' : '';
  UI.dState = { full: text, i: 0, choices, resolve, shown: false };
  if (name === 'סבתא רבקה' && text.includes('אכלת?')) UI.stats.savtaAsked++;
}
export const say = (name, text) => new Promise(r => openDialog(name, text, null, r));
export const ask = (name, text, choices) => new Promise(r => openDialog(name, text, choices, r));
export async function lines(list) { for (const [n, t] of list) await say(n, t); }
export function closeDialog(v) { const r = UI.dState.resolve; UI.dState = null; $('dialog').classList.remove('show'); r(v); }
export function advance() {
  const d = UI.dState; if (!d) return;
  if (d.i < d.full.length) { d.i = d.full.length; return; }
  if (!d.choices) closeDialog();
}
export function tickDialog(dt) {
  const d = UI.dState; if (!d) return;
  if (d.i < d.full.length) { const b = Math.floor(d.i); d.i = Math.min(d.full.length, d.i + dt * 70); if (Math.floor(d.i / 3) > Math.floor(b / 3)) sfx('blip'); }
  $('dtext').textContent = d.full.slice(0, Math.floor(d.i));
  if (d.choices && !d.shown && d.i >= d.full.length) {
    d.shown = true;
    d.choices.forEach((c, i) => { const b = document.createElement('button'); b.innerHTML = `<kbd>${i + 1}</kbd> ${c}`; b.onclick = () => closeDialog(i); $('dchoices').append(b); });
  }
}
$('dialog').addEventListener('click', e => { if (!e.target.closest('button')) advance(); });

// ---------------------------------------------------------------- full-screen cards
export function card(html, { dark = true, big = false } = {}) {
  return new Promise(r => {
    const c = $('card'); c.className = 'show' + (dark ? ' dark' : '') + (big ? ' big' : '');
    $('card-text').innerHTML = T(html); $('card-text').style.animation = 'none'; void $('card-text').offsetWidth; $('card-text').style.animation = '';
    UI.cardResolve = () => { UI.cardResolve = null; r(); };
  });
}
export function hideCard() { $('card').className = ''; }
export async function cards(list, opts) { for (const h of list) await card(h, opts); hideCard(); }
$('card').addEventListener('click', () => UI.cardResolve && UI.cardResolve());
export const fade = on => $('fade').classList.toggle('on', on);

// ---------------------------------------------------------------- objectives / timer / widgets
export function setObjective(title, items = []) {
  $('obj').classList.toggle('hidden', !title);
  $('obj-title').textContent = T(title) || '';
  $('obj-list').innerHTML = items.map(([done, t]) => `<div class="q ${done ? 'done' : ''}">${done ? '☑' : '☐'} ${T(t)}</div>`).join('');
}
let timerEnd = 0, timerCb = null, timerLabel = '';
export function startTimer(sec, label, onEnd) { timerEnd = performance.now() + sec * 1000; timerCb = onEnd; timerLabel = label; $('timer').classList.remove('hidden'); }
export function stopTimer() { timerCb = null; $('timer').classList.add('hidden'); }
export const timeLeft = () => timerCb ? Math.max(0, (timerEnd - performance.now()) / 1000) : Infinity;
export function tickTimer() {
  if (!timerCb) return;
  const t = timeLeft(); $('timer').innerHTML = `<small>${timerLabel}</small>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('urgent', t < 20);
  if (t <= 0) { const cb = timerCb; stopTimer(); cb(); }
}
export function setCounter(n) { $('rb-count').textContent = n; }
export function setLocation(street, place) {
  $('loc-street').textContent = street || ''; $('loc-place').textContent = place || '';
}
export function prompt(html) { $('prompt').classList.toggle('hidden', !html); if (html) $('prompt').innerHTML = html; }
let paT = 0;
export function pa(text, slow = true) {
  const el = $('pa'); el.classList.add('show'); el.classList.toggle('slow', slow); el.textContent = '📢 ' + T(text);
  clearTimeout(paT); paT = setTimeout(() => el.classList.remove('show'), 6500); sfx(slow ? 'pa' : 'jingle');
}
export function showHUD(on) { for (const id of ['hud-top', 'radar-wrap', 'waze', 'help']) $(id).classList.toggle('hidden', !on); }

// =====================================================================
// radar (GTA-style minimap) — pre-rendered city, rotated with the camera
// =====================================================================
const MARGIN = 350, RS = 0.6;
const RX0 = BOUNDS.x0 - MARGIN, RZ0 = BOUNDS.z0 - MARGIN, RW = Math.round((BOUNDS.x1 - BOUNDS.x0 + MARGIN * 2) * RS), RH = Math.round((BOUNDS.z1 - BOUNDS.z0 + MARGIN * 2) * RS);
export const radarCanvas = document.createElement('canvas'); radarCanvas.width = RW; radarCanvas.height = RH;
{
  const x = radarCanvas.getContext('2d'), X = v => (v - RX0) * RS, Z = v => (v - RZ0) * RS;
  x.fillStyle = '#2b3a2a'; x.fillRect(0, 0, RW, RH);
  const AC = { residential: '#3a4638', park: '#3f6b35', forest: '#35592f', grass: '#3f6436', pitch: '#3f7a3a', retail: '#4a4550', industrial: '#44464c', parking: '#3a3c40', scrub: '#394e33', orchard: '#3d5a33', farm: '#4a4a36' };
  for (const a of AREAS) { const c = AC[a.cls]; if (!c) continue; x.fillStyle = c; x.beginPath(); a.pts.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.closePath(); x.fill(); }
  x.fillStyle = '#56606a'; for (const b of BUILDINGS) { x.beginPath(); b.pts.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.closePath(); x.fill(); }
  x.lineCap = x.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of [...ROADS].sort((a, b) => b.cls - a.cls)) {
    if (r.cls === 6) continue;
    x.strokeStyle = pass ? (r.cls === 0 ? '#f0c24b' : r.cls <= 2 ? '#f4f1e8' : '#c9ccd1') : '#1b1f24';
    x.lineWidth = Math.max(1.5, r.w * RS * (r.cls <= 2 ? 1.3 : 1.1)) + (pass ? 0 : 2.2);
    x.beginPath(); r.pts.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.stroke();
  }
  x.strokeStyle = '#9b8a74'; x.setLineDash([4, 3]); x.lineWidth = 2;
  for (const r of RAILS) { x.beginPath(); r.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.stroke(); }
  x.setLineDash([]);
}
const rc = $('radar').getContext('2d'), RAD = $('radar').width;
export const blips = [];   // {x, z, icon, color, label, id}
export function setBlip(id, x, z, icon, color = '#fff', label = '') {
  let b = blips.find(b => b.id === id); if (!b) blips.push(b = { id }); Object.assign(b, { x, z, icon, color, label });
}
export const removeBlip = id => { const i = blips.findIndex(b => b.id === id); if (i >= 0) blips.splice(i, 1); };
export function drawRadar(px, pz, playerYaw, camYaw, targets, zoom = 1, t = 0) {
  const W = RAD, c = W / 2, sc = RS * 0.55 / zoom * 1.4;     // radar pixels per radar-canvas pixel
  rc.save(); rc.clearRect(0, 0, W, W);
  rc.beginPath(); rc.roundRect(0, 0, W, W, 18); rc.clip();
  rc.fillStyle = '#1e2a1f'; rc.fillRect(0, 0, W, W);
  rc.translate(c, c + W * 0.12); rc.rotate(camYaw);
  rc.scale(sc / RS, sc / RS); rc.translate(-(px - RX0) * RS, -(pz - RZ0) * RS);
  rc.drawImage(radarCanvas, 0, 0);
  rc.restore();
  // world → radar screen
  const cos = Math.cos(camYaw), sin = Math.sin(camYaw), k = sc, cy = c + W * 0.12;
  const toR = (x, z) => { const dx = (x - px) * k, dz = (z - pz) * k; return [c + dx * cos - dz * sin, cy + dx * sin + dz * cos]; };
  const inside = ([x, y]) => x > 10 && x < W - 10 && y > 10 && y < W - 10;
  const clampEdge = ([x, y]) => { const dx = x - c, dy = y - cy, m = Math.max(Math.abs(dx) / (W / 2 - 12), dy < 0 ? -dy / (cy - 12) : dy / (W - cy - 12)); return m > 1 ? [c + dx / m, cy + dy / m] : [x, y]; };
  rc.font = `16px ${FONT}`; rc.textAlign = 'center'; rc.textBaseline = 'middle';
  for (const b of blips) {
    let p = toR(b.x, b.z); const ins = inside(p); p = clampEdge(p);
    rc.globalAlpha = ins ? 1 : 0.7; rc.fillStyle = 'rgba(0,0,0,.55)'; rc.beginPath(); rc.arc(p[0], p[1], 11, 0, 7); rc.fill();
    rc.fillStyle = b.color; rc.fillText(b.icon, p[0], p[1] + 1); rc.globalAlpha = 1;
  }
  for (const tg of targets) {
    let p = toR(tg.x, tg.z); const ins = inside(p); p = clampEdge(p);
    const pulse = 7 + Math.sin(t * 6) * 2;
    rc.fillStyle = '#ffd166'; rc.strokeStyle = '#1b1b1b'; rc.lineWidth = 2;
    if (ins) { rc.beginPath(); rc.arc(p[0], p[1], pulse, 0, 7); rc.fill(); rc.stroke(); }
    else { const a = Math.atan2(p[1] - cy, p[0] - c); rc.save(); rc.translate(p[0], p[1]); rc.rotate(a); rc.beginPath(); rc.moveTo(10, 0); rc.lineTo(-7, -8); rc.lineTo(-7, 8); rc.closePath(); rc.fill(); rc.stroke(); rc.restore(); }
  }
  // north marker
  { const [nx, ny] = clampEdge(toR(px, pz - 5000)); rc.fillStyle = '#e63946'; rc.beginPath(); rc.arc(nx, ny, 10, 0, 7); rc.fill(); rc.fillStyle = '#fff'; rc.font = `700 13px ${FONT}`; rc.fillText('צ', nx, ny + 1); }
  // player arrow
  rc.save(); rc.translate(c, cy); rc.rotate(Math.PI - playerYaw + camYaw);
  rc.fillStyle = '#fff'; rc.strokeStyle = '#111'; rc.lineWidth = 2; rc.beginPath(); rc.moveTo(0, -11); rc.lineTo(8, 9); rc.lineTo(0, 5); rc.lineTo(-8, 9); rc.closePath(); rc.fill(); rc.stroke();
  rc.restore();
  rc.strokeStyle = 'rgba(255,255,255,.8)'; rc.lineWidth = 3; rc.beginPath(); rc.roundRect(1.5, 1.5, W - 3, W - 3, 18); rc.stroke();
}

export function radarNoSignal() {
  const W = RAD; rc.save(); rc.clearRect(0, 0, W, W); rc.beginPath(); rc.roundRect(0, 0, W, W, 18); rc.clip();
  rc.fillStyle = '#0d0d10'; rc.fillRect(0, 0, W, W); rc.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 400; i++) rc.fillRect(Math.random() * W, Math.random() * W, 2, 2);
  rc.fillStyle = '#e8dcc8'; rc.textAlign = 'center'; rc.direction = 'rtl'; rc.font = `900 22px ${FONT}`; rc.fillText('📵 אין קליטה', W / 2, W / 2 - 14);
  rc.font = `600 13px ${FONT}`; rc.fillText('גם לוויין לא נכנס לקניון הישן', W / 2, W / 2 + 14); rc.restore();
}
// ---------------------------------------------------------------- full map (M)
export function drawBigMap(px, pz, yaw, targets) {
  const cv = $('bigmap-canvas'), W = cv.width = innerWidth, Hh = cv.height = innerHeight, x = cv.getContext('2d');
  x.fillStyle = '#131a14'; x.fillRect(0, 0, W, Hh);
  const s = Math.min((W - 80) / RW, (Hh - 120) / RH), ox = (W - RW * s) / 2, oz = (Hh - RH * s) / 2 + 20;
  x.drawImage(radarCanvas, ox, oz, RW * s, RH * s);
  const T = (wx, wz) => [ox + (wx - RX0) * RS * s, oz + (wz - RZ0) * RS * s];
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  for (const p of PLACES) { const [a, b] = T(p.x, p.z); x.font = `${p.hood ? 600 : 800} ${p.hood ? 12 : 15}px ${FONT}`; x.fillStyle = p.hood ? 'rgba(255,255,255,.55)' : 'rgba(255,230,160,.8)'; x.fillText(p.name, a, b); }
  for (const bl of blips) { const [a, b] = T(bl.x, bl.z); x.fillStyle = 'rgba(0,0,0,.6)'; x.beginPath(); x.arc(a, b, 14, 0, 7); x.fill(); x.font = `18px ${FONT}`; x.fillStyle = bl.color; x.fillText(bl.icon, a, b + 1); if (bl.label) { x.font = `700 13px ${FONT}`; x.fillStyle = '#fff'; x.fillText(bl.label, a, b + 24); } }
  for (const tg of targets) { const [a, b] = T(tg.x, tg.z); x.fillStyle = '#ffd166'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, 9, 0, 7); x.fill(); x.stroke(); }
  const [a, b] = T(px, pz); x.save(); x.translate(a, b); x.rotate(Math.PI - yaw); x.fillStyle = '#fff'; x.strokeStyle = '#e63946'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -14); x.lineTo(10, 11); x.lineTo(0, 6); x.lineTo(-10, 11); x.closePath(); x.fill(); x.stroke(); x.restore();
  x.font = `900 30px ${FONT}`; x.fillStyle = '#ffd166'; x.fillText('מפת כרמיאל', W / 2, 32);
  x.font = `600 14px ${FONT}`; x.fillStyle = '#ccc'; x.fillText(`${ROUNDABOUTS.length} כיכרות אמיתיות על המפה · M לסגירה · Waze: תל אביב שעה ו-45`, W / 2, Hh - 20);
}
