// Story & missions — "כרמיאל: הדרך החוצה". Design: story_design.md (Prologue, Acts 1–3, finale, endings).
import { THREE, scene, camera, mesh, boxG, cylG, mat, label, textTex, pick, sleep, clamp, FONT } from './core.js';
import { H, POI, ROUNDABOUTS, CHETS, groundAt, addBoxCollider, BOUNDS, free } from './world.js';
import { LM, nearestRoad } from './landmarks.js';
import { makeHuman, makeCat, makeScooter, animateHuman } from './characters.js';
import { P, cam, teleport, placeScooter, scooter, keys, pressed, knock, setPlayerGender } from './player.js';
import { npcs, npc, addNPC, placeNPC, hideNPC, bark, addCone, removeCone, sees } from './npc.js';
import { traffic, boostTraffic } from './traffic.js';
import { UI, PLAYER, T, say, ask, lines, card, cards, hideCard, toast, wa, achieve, setObjective, startTimer, stopTimer, setCounter, fade, setBlip, removeBlip, pa } from './ui.js';
import { sfx, music } from './audio.js';
import { rhythm, quiz } from './minigames.js';
import { enterMall, nearNest, takeStamp, horror } from './horror.js';
import { ELDAR, MORE_BARKS } from './banter.js';

// =====================================================================
// state
// =====================================================================
export const G = { act: 0, done: new Set(), perks: {}, rb: 180, hits: 0, active: null, stage: 'title', flags: {}, t0: 0, rbSeen: new Set() };
export const M = { targets: [], hots: new Map(), items: [], hooks: new Set() };
class Fail extends Error { constructor(msg) { super(msg); this.fail = true; } }
let token = { failed: false };
const waiters = [];
export function tickWaiters() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.tok.failed) { waiters.splice(i, 1); w.rej(new Fail(w.tok.reason)); }
    else if (w.cond()) { waiters.splice(i, 1); w.res(); }
  }
}
const until = cond => new Promise((res, rej) => waiters.push({ cond, res, rej, tok: token }));
const failMission = reason => { token.failed = true; token.reason = reason; };
const near = (p, r = 4) => () => Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r;
async function goTo(p, r = 4) { M.targets = [p]; await until(near(p, r)); M.targets = []; }
function save() { try { localStorage.setItem('karmiel-save', JSON.stringify({ name: PLAYER.name, gender: PLAYER.gender, done: [...G.done], perks: G.perks, rb: G.rb, hits: G.hits, flags: G.flags })); } catch {} }
export function loadSave() { try { return JSON.parse(localStorage.getItem('karmiel-save')); } catch { return null; } }
export function openRoundabout(name, mayorWa) { G.rb++; setCounter(G.rb); toast(`✂️ ראש העיר חנך כיכר חדשה: <b>${name}</b>. כיכרות: ${G.rb}.`, 'good', 5500); sfx('ribbon'); if (mayorWa) setTimeout(() => wa('ראש העיר', mayorWa), 2500); }
// interactables (press E) and pickups (walk into)
export function hot(id, o) { M.hots.set(id, o); }
export const unhot = id => M.hots.delete(id);
export function item({ x, z, y = 1.2, emoji, name, onPick }) {
  const g = new THREE.Group(), s = label(emoji, { bg: 'rgba(0,0,0,0)', px: 90, k: 0.013 }); s.position.y = 0.4; g.add(s);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd166 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.5; g.add(ring);
  const base = groundAt(x, z) + y; g.position.set(x, base, z); scene.add(g);
  const it = { g, x, z, base, name, onPick, alive: true }; M.items.push(it); return it;
}
export function tickItems(t) {
  for (const it of M.items) {
    if (!it.alive) continue;
    it.g.position.y = it.base + Math.sin(t * 3) * 0.15; it.g.rotation.y = t * 1.5;
    if (Math.hypot(it.x - P.pos.x, it.z - P.pos.z) < 1.6 && Math.abs(it.base - (P.pos.y + 1)) < 1.8) { it.alive = false; scene.remove(it.g); sfx('pickup'); it.onPick?.(); }
  }
  M.items = M.items.filter(i => i.alive);
}
const clearItems = () => { for (const it of M.items) scene.remove(it.g); M.items = []; };
async function runMission(id, fn, onFail) {
  if (G.active) { toast('🚧 אתה באמצע משימה. בכרמיאל עושים דבר אחד בכל פעם. (חוץ מסבתא. היא עושה הכול.)', 'bad'); return; }
  G.active = id; UI.busy = false;
  for (;;) {
    token = { failed: false };
    try { await fn(); break; }
    catch (e) {
      if (!e.fail) throw e;
      stopTimer(); P.frozen = true; sfx('fail'); M.targets = [];
      await card(`<div class="fail">😵</div>${e.message}<br><small>לחץ כדי לנסות שוב</small>`); hideCard(); P.frozen = false;
      await onFail?.();
    }
  }
  G.active = null; G.done.add(id); stopTimer(); M.targets = []; setObjective(null); save(); refreshBlips(); music('roam');
}

// =====================================================================
// cast
// =====================================================================
const home = LM.home;
const CAST = {
  savta: ['סבתא רבקה', { shirt: 0x8e4585, dress: 0x8e4585, pants: 0x8e4585, hair: 0xbbbbbb, scarf: 0x4a6fa5, skin: 0xe9c4a0 }],
  itzik: ['איציק · אבטחה', { shirt: 0xffffff, pants: 0x1c1c1c, hair: 0x222222, cap: 0x1c2a44, wand: true }],
  shlomo: ['שלמה · אגד', { shirt: 0x9ecbe8, pants: 0x2b2f3a, hair: null, mustache: 0x333333, belly: true }],
  tsipi: ['ציפי · קבלה', { shirt: 0xe76f51, pants: 0x264653, hair: 0x8b3a1a, bigHair: true, glasses: true, skin: 0xe8bf98 }],
  mayor: ['ראש העיר משה קונינסקי', { shirt: 0x2b2f3a, pants: 0x2b2f3a, hair: 0x8f8f8f, skin: 0xe8bf98, tie: 0x1f4e9c, glasses: true, scissors: true }],
  boris: ['בוריס', { shirt: 0xc2b280, pants: 0x555555, hair: 0xcccccc, cap: 0x444444, mustache: 0xcccccc }],
  copy: ['בעל המכון', { shirt: 0x6d597a, pants: 0x333333, hair: 0x222222, glasses: true }],
  dudu: ['דודו · השניצליה', { shirt: 0xf6a01a, pants: 0x333333, hair: 0x2a1a10, apron: 0xffffff, chef: true }],
  critic: ['ליאור המבקר', { shirt: 0x111111, pants: 0x111111, hair: 0x2a1a10, shades: true, beard: 0x2a1a10 }],
  galit: ['גלית · כוריאוגרפית', { shirt: 0xff4d8d, pants: 0x6a1b9a, hair: 0x1a1a1a, ponytail: true, skin: 0xd9a47a }],
  aviv: ['אביב אלוש', { shirt: 0x1a1a1a, pants: 0x3a4f7a, hair: 0x1a120c, beard: 0x2a1c12, shades: true, skin: 0xd6a17a }],
  shimshon: ["פרופ' שמשון", { shirt: 0xf5f5f5, coat: 0xf5f5f5, pants: 0x555555, hair: 0xdddddd, bigHair: true, glasses: true, beard: 0xdddddd }],
  rachel: ['רחל המשגיחה', { shirt: 0x4a4e69, pants: 0x22223b, hair: 0x6b3e26, glasses: true, ponytail: true }],
  orna: ['אורנה', { shirt: 0xf28482, pants: 0xf6f1e6, hair: 0xd4a373, shades: true, phone: true }],
  noa: ['נועה · חיילת', { shirt: 0x5b6b3a, pants: 0x5b6b3a, hair: 0x5a3a1a, ponytail: true, duffel: true }],
  moti: ['מוטי · פלאפל', { shirt: 0xffffff, pants: 0x333333, hair: 0x222222, mustache: 0x222222, belly: true, apron: 0xf4a261, skin: 0xd9a47a }],
  baker: ['נהג המאפייה', { shirt: 0xffffff, pants: 0x444444, hair: 0x333333, cap: 0xffffff }],
  eldar: ['עדי אלדר · ראש העיר לשעבר', { shirt: 0x5f6673, pants: 0x3a3a3a, hair: null, sideHair: 0xdddddd, glasses: true, belly: true, wand: true, tie: 0x8b1e2d, skin: 0xe8bf98 }],
};
const HID = { x: 0, z: -99999 };
for (const [id, [name, look]] of Object.entries(CAST)) addNPC({ id, name, x: HID.x, z: HID.z, look });
for (const id of Object.keys(CAST)) hideNPC(id);
const show = (id, p, rot) => placeNPC(id, p.x, p.z, rot);
// permanent residents of the world (they stay where they live)
show('itzik', LM.gate, LM.stationFace + Math.PI);
show('shlomo', { x: LM.bus.x + 3, z: LM.bus.z + 2 });
show('moti', LM.moti, LM.motiRot);
show('boris', LM.cityhall.boris);
show('tsipi', LM.cityhall.tsipi);
show('mayor', LM.cityhall.mayor); npc('mayor').pose = 'point';
show('copy', LM.copyShop);
show('dudu', LM.schnitzelia.dudu);
show('galit', LM.amphi.galit);
show('shimshon', LM.exam.shimshon);
show('orna', LM.orna);
show('noa', LM.tremp.noa);
// Boris's קלנועית
const kalno = new THREE.Group(); mesh(boxG(1, 0.4, 1.8), 0xd62828, 0, 0.45, 0, kalno); mesh(boxG(0.8, 0.6, 0.2), 0x222222, 0, 1, 0.8, kalno); for (const [a, b] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.6], [0.45, 0.6]]) mesh(cylG(0.25, 0.25, 0.15, 10).rotateZ(Math.PI / 2), 0x111111, a, 0.25, b, kalno);
kalno.visible = false; scene.add(kalno);

// default barks when nothing mission-related is going on
const BARKS = {
  itzik: ['אני פה 9 שנים. אתה הדבר הכי מעניין שקרה.', 'טופס 17-כ. בלי טופס – אין רכבת. בלי רכבת – אין תל אביב. פשוט.', 'אני לא ממציא. אני מאלתר ביטחונית.'],
  shlomo: ['קו 1 מגיע לכל מקום. הוא עושה את כל הכיכרות וחוזר לפה.', 'אני פה 22 שנה. יש לי מערכת יחסים עם כיכר האבן.', 'למה שמישהו ירצה לצאת? יש 180 כיכרות. עוד לא סיימתי לראות את כולן.'],
  moti: ['פלאפל? מ-1992 באותו מחיר. בערך. לא באמת.', 'בפנים? אני לא נכנס. אף אחד לא נכנס.', 'יוסי! הפלאפל של 2019! אגדה!'],
  boris: ['מט בשלושה מהלכים. לא, לא איתך. אני מדבר עם עצמי. אני מנצח.', 'בתל אביב קפה 48 שקל. אני לא הייתי. אבל אני יודע.', 'כרמיאל זה 20 דקות מהכל. מהים, מהכנרת, מחיפה. מתל אביב לא. אבל מי צריך.'],
  tsipi: ['יש תור, מאמי. גם לראש העיר יש תור. הוא מספר 12.', 'בוקר טוב, תיקח מספר מאמי.'],
  mayor: ['יוסי! באת לחנוך איתי כיכר?', 'עיר זה לא בניינים וכיכרות. טוב, גם כיכרות. בעיקר כיכרות.', 'יש לי כיכר ביום שלישי. תבוא. יש עציץ.'],
  copy: ['צילום? 50 אגורות. צבעוני? 50 אגורות.', 'אתה עוזב? חינם, רק שתצא כבר מהתור הזה.'],
  dudu: ['בשניצליה יש בגט שיכול להחזיק משפחה.', 'תמיד תבקש חריף.'],
  galit: ['הצעדים יודעים אותך.', 'על הבמה כולם בני 11. חוץ מבוריס. בוריס תמיד בן 70.'],
  shimshon: ['הפלאפל ההוא... אני עדיין חושב עליו.', '7 שנים ושעה. אבל נספור רק את השעה.'],
  orna: ['ראית רכב כסוף? עם שריטה? בערך מ-2016?', 'אני ואורנה... כלומר אני, בקבוצת תמיכה של חונים בביג.'],
  noa: ['אני מחכה לטרמפ מיום שלישי. מאיזה שלישי? אני כבר לא יודעת מה זה ימים.', 'יש פה ספסל, שקית במבה, ועורב אחד שאני קוראת לו רונן.'],
};
const NAG = {
  itzik: 'אתה מדבר איתי כל כך הרבה, שאני צריך למלא עליך טופס. טופס 17-ל: "חשד לחברות".', shlomo: 'זה הביקור השישי שלך. עוד אחד ואני מוסיף אותך למסלול של קו 1.',
  moti: 'כבר דיברנו 6 פעמים. בפעם השביעית אני גובה כמו על מנה.', boris: 'אתה מדבר איתי יותר מהנכד שלי. אני כותב עליך בפייסבוק. דברים טובים. אבל בטון מאשים.',
  tsipi: 'מאמי, דיברת איתי יותר מהמספר שלך. אתה עכשיו מספר 401. התקדמת אחורה.', mayor: 'יוסי, אתה פה כל הזמן. אתה בטוח שאתה רוצה לעזוב? כי זה נראה כמו מישהו שרוצה כיכר.',
  copy: 'צילמתי אותך 12 פעמים בראש. בצבע. זה 6 שקל. אני לא אשכח.', dudu: 'עוד פעם אתה? אני נותן לך בגט רק כדי שתפסיק לבוא. זה לא עובד. אני יודע.',
  galit: 'אתה חוזר אליי כל הזמן. זה כוריאוגרפיה. זה נקרא "הלוך-חזור". אני רושמת עליו זכויות.', shimshon: 'שישה ביקורים. זה יותר ממה שבאת לשיעורים שלי. ב-4 שנים.',
  orna: 'אתה שוב פה? גם אתה איבדת רכב? ברוך הבא לקבוצת התמיכה. יש עוגה. לא זוכרים איפה.', noa: 'דיברנו כל כך הרבה שרונן העורב מקנא. הוא לא אומר. אבל הוא עורב. הם מראים.',
};
const NOA_ACT = ['אני מחכה לטרמפ מיום שלישי. זה בסדר. יש פה ספסל.', 'אני מחכה לטרמפ מיום שלישי. זה בסדר. יש פה ספסל.', 'מיום שלישי שעבר. או זה שלפניו. רונן העורב אומר שלפניו. הוא עורב, אבל הוא סופר.', 'מאיזה שלישי? אני כבר לא יודעת מה זה ימים. אני מודדת זמן בכיכרות שראש העיר חנך.', 'הקמתי פה ועד טרמפיאדה. אני יושבת הראש. רונן סגן. יש לנו כבר קבוצת פייסבוק. רק דברים חשובים.'];
const talkCount = {};
function barker(id, l) { return async () => { const k = talkCount[id] = (talkCount[id] || 0) + 1, name = CAST[id][0].split(' · ')[0]; if (k === 6 && NAG[id]) return say(name, NAG[id]); if (id === 'noa' && k % 3 === 1) return say(name, NOA_ACT[G.act] || NOA_ACT[4]); return say(name, l[k % l.length]); }; }
for (const [id, l] of Object.entries(BARKS)) npc(id).talk = barker(id, l);
const N = id => CAST[id][0].split(' · ')[0];
for (const [k, v] of Object.entries(MORE_BARKS)) BARKS[k]?.push(...v);   // in place: the talk closures hold these arrays

// עדי אלדר — the previous mayor (1998–2018), on a bench by כיכר האבן, keeping a friendly-petty eye on his successor
{
  const rb = ROUNDABOUTS.find(r => r.name === 'כיכר האבן') || { x: LM.cityhall.boris.x + 30, z: LM.cityhall.boris.z, r: 10 };
  let spot = null;
  for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = rb.x + Math.cos(a) * (rb.r + 11), z = rb.z + Math.sin(a) * (rb.r + 11); if (free(x, z)) spot = { x, z, a }; }
  spot ||= { x: rb.x + rb.r + 11, z: rb.z, a: 0 };
  const face = Math.atan2(rb.x - spot.x, rb.z - spot.z);
  const b = new THREE.Group(); mesh(boxG(2.4, 0.15, 0.7), 0x8a5a3b, 0, 0.55, 0, b); mesh(boxG(2.4, 0.6, 0.1), 0x8a5a3b, 0, 0.95, -0.3, b);
  b.position.set(spot.x - Math.sin(face) * 1.2, H(spot.x, spot.z), spot.z - Math.cos(face) * 1.2); b.rotation.y = face; scene.add(b); addBoxCollider(b.position.x, b.position.z, 2.4, 0.7, face);
  show('eldar', spot, face);
  let k = 0;
  npc('eldar').talk = async () => {
    const E = 'עדי אלדר';
    if (!G.flags.metEldar) {
      for (const [s, t] of ELDAR.intro) await say(s, t);
      const c = await ask(E, '...', ELDAR.choices.map(o => o.opt));
      for (const [s, t] of ELDAR.choices[c].reply) await say(s, t);
      G.flags.metEldar = true; save();
      achieve('eldar', 'שני ראשי ערים', 'שמעת את עדי אלדר על קונינסקי. קונינסקי כבר יודע. בפייסבוק.');
      ELDAR.wa.forEach(([s, t], i) => setTimeout(() => wa(s, t), 3000 + i * 3500));
      return;
    }
    k++; await say(E, k === 6 && ELDAR.nag ? ELDAR.nag : ELDAR.barks[k % ELDAR.barks.length]);
  };
}

// =====================================================================
// radar blips & markers
// =====================================================================
const GIVERS = { M4: ['dudu', '🥖'], M5: ['galit', '💃'], M6: ['shimshon', '🎓'], S1: ['orna', '🅿️'], S2: ['noa', '🪖'], S3: ['boris', '🛴'] };
export function refreshBlips() {
  const lm = [['station', LM.gate, '🚆', '#8ecae6', 'תחנת הרכבת'], ['kikar', LM.kikar.entrance, '🏚️', '#b388ff', 'הקניון הישן'], ['cityhall', LM.cityhall.door, '🏛️', '#ffd166', 'העירייה'],
    ['lev', LM.lev, '🛍️', '#ff8fab', 'הקניון החדש'], ['schn', LM.schnitzelia.door, '🥖', '#f6a01a', 'השניצליה'], ['amphi', LM.amphi.front, '🎭', '#b388ff', 'אמפי פארק הגליל'],
    ['braude', LM.exam.entrance, '🎓', '#4fc3f7', 'אורט בראודה'], ['big', LM.bigLot.center, '🅱️', '#ff6b6b', 'ביג כרמיאל'], ['home', LM.home, '🏠', '#7ee787', 'הבית של יוסי'], ['makosh', LM.makosh, '⛰️', '#7ee787', 'גבעת מכוש'], ['hatim', CHETS[3] || LM.home, '🏢', '#f4a261', 'החתים'], ['eldar', npc('eldar').h.g.position, '👴', '#cdb4db', 'עדי אלדר']];
  for (const [id, p, ic, c, l] of lm) setBlip(id, p.x, p.z, ic, c, l);
  for (const [m, [who]] of Object.entries(GIVERS)) {
    const avail = G.act >= 2 && !G.done.has(m) && !G.active, p = npc(who).h.g.position;
    if (avail) setBlip('give-' + m, p.x, p.z, m[0] === 'M' ? '❗' : '❔', m[0] === 'M' ? '#ffd166' : '#4fc3f7', ''); else removeBlip('give-' + m);
  }
}
npc('dudu').news = () => G.act >= 2 && !G.done.has('M4') && !G.active;
npc('galit').news = () => G.act >= 2 && !G.done.has('M5') && !G.active;
npc('shimshon').news = () => G.act >= 2 && !G.done.has('M6') && !G.active;
npc('orna').news = () => G.act >= 2 && !G.done.has('S1') && !G.active;
npc('noa').news = () => G.act >= 2 && !G.done.has('S2') && !G.active;
npc('boris').news = () => (G.act >= 2 && !G.done.has('S3') && !G.active) || (G.active === 'M3' && !G.flags.sig) || (G.active === 'M4' && !G.flags.sauce);
npc('mayor').news = () => (G.act === 4 && !G.active && !G.done.has('END')) || (G.active === 'M3' && G.flags.docs);
// the mayor after the credits (the finale must not restart when you talk to him again)
const MAYOR_AFTER = ['יוסי! חזרת! כלומר, נשארת! כלומר, לא משנה! יש לי כיכר ביום שלישי. תבוא. יש שני עציצים.', 'אחרי כל מה שעברנו – אני רוצה שתדע: הכיכר על שמך עדיין שם. היא מתגעגעת. כיכרות לא יודעות להתגעגע. היא לומדת.', 'הסיבוב הכי יפה בעיר? הסיבוב שבו אתה מחליט להישאר. ...ציפי, תרשמי את זה. זה לשלט.', 'ראיתי את הסוף שלך. לא משנה איזה. הייתי בכל אחד מהם. אני ראש עיר. אני בכל מקום. בעיקר בכיכרות.'];
npc('moti').news = () => G.act === 3 && !G.active && G.flags.chaseDone;
npc('itzik').news = () => G.active === 'M2';
npc('tsipi').news = () => G.active === 'M3' && !G.flags.docs;
npc('copy').news = () => G.active === 'M3' && !G.flags.copy;

// =====================================================================
// PROLOGUE + M1 "ההודעה"
// =====================================================================
export function setName(n, g = 'm') { PLAYER.name = n; PLAYER.gender = g; LM.setGraffiti?.(n, g); setPlayerGender(g); }
export async function newGame() {
  G.stage = 'play'; G.act = 1; G.t0 = performance.now(); setCounter(G.rb);
  teleport(home.x, home.z, home.face);
  await cards([
    '<h2>הבהרה</h2><div style="font-size:21px;line-height:1.6">כל הדמויות, השמות, המוסדות והאירועים במשחק הם בדיוניים לחלוטין.<br>אין כל קשר בינם לבין אנשים חיים או מתים, גופים או אירועים אמיתיים,<br>וכל דמיון למציאות הוא מקרי בלבד.</div>',
    'כרמיאל. עיר בגליל. 50 אלף תושבים.<br>180 כיכרות. אחת לכל 277 איש.<br><b>אף אחד לא נשאר בלי כיכר.</b>',
    'יוסי. 29. נולד פה. גדל פה.<br>למד פה (כמעט). אוכל פה (הרבה, בגלל סבתא).',
    'יום אחד יוסי ראה סרטון באינסטגרם.<br>אנשים בתל אביב שותים קפה על אופניים. ליד הים. בחולצות פשתן.',
    'יוסי לא יודע מה זה פשתן.<br>אבל הוא יודע מה הוא רוצה.',
    '<h2>הוא רוצה החוצה.</h2>',
    'הוא פותח את קבוצת הפייסבוק של השכונה.<br>האצבע מעל כפתור השליחה.',
    'הוא לא יודע שהעיר כבר מחכה לו.',
  ]);
  await M1();
}
async function M1() {
  await runMission('M1', async () => {
    setObjective('ההודעה', [[false, 'לארוז 3 דברים'], [false, 'לצאת לתחנת הרכבת']]);
    const burst = [['יוסי', 'חברים, רציתי לעדכן. אני עובר לתל אביב. היה כיף. ביי 🙂'], ['אורנה', 'מה????'], ['בוריס', 'יוסי, אתה שיכור? עוד שעה אני בא עם עגבניות.'], ['חנה מהקומה השלישית', 'איזה יוסי? של רבקה?'], ['סבתא רבקה', 'יוסי תתקשר לסבתא'], ['סבתא רבקה', 'יוסי תתקשר לסבתא'], ['מנהל הקבוצה', 'הקבוצה מיועדת לדברים חשובים בלבד!!! (זה חשוב, ממשיכים)']];
    burst.forEach(([s, t], i) => setTimeout(() => wa(s, t), 800 + i * 1400));
    setTimeout(() => toast('⌨️ WASD כדי ללכת. Shift כדי לרוץ. בכרמיאל אף אחד לא רץ, אבל נו.', '', 6000), 1500);
    setTimeout(() => toast('⌨️ רווח כדי לקפוץ. מעל אדניות, מעל שלוליות, מעל רגשות.', '', 6000), 8000);
    let got = 0; const upd = () => setObjective('ההודעה', [[got >= 3, `לארוז 3 דברים (${got}/3)`], [false, 'לצאת לתחנת הרכבת']]);
    const I = LM.items1;
    const its = [
      item({ ...I.charger, emoji: '🔌', name: 'מטען', onPick: () => { got++; upd(); toast('נאסף: מטען. 12% סוללה. כמו המורל.', 'good'); } }),
      item({ ...I.id, emoji: '🪪', name: 'ת"ז', onPick: () => { got++; upd(); toast('נאספה: תעודת זהות. בתמונה אתה בן 16 ועם ג\'ל.', 'good'); } }),
      item({ ...I.shirt, emoji: '👕', name: 'חולצה', onPick: () => { got++; upd(); toast('נאספה: חולצת פסטיבל 2008. עדיין מריחה מהורה.', 'good'); } }),
    ];
    M.targets = its.map(i => i.g.position);
    const ti = setInterval(() => { M.targets = its.filter(i => i.alive).map(i => i.g.position); }, 300);
    await until(() => got >= 3); clearInterval(ti); M.targets = [];
    // Savta blocks the sidewalk
    const sp = { x: P.pos.x + Math.sin(P.yaw) * 4, z: P.pos.z + Math.cos(P.yaw) * 4 };
    show('savta', sp, P.yaw + Math.PI); await sleep(400);
    await say(N('savta'), 'יוסי. אכלת?');
    await say('יוסי', 'סבתא, אני עובר לתל אביב.');
    await say(N('savta'), 'שמעתי. בפייסבוק. כמו זרה. כמו מישהי מהמכולת.');
    const c = await ask('יוסי', '...', ['"סבתא, זה רק שעה ו-45."', '"סבתא, יש שם הזדמנויות."', '"אכלתי."']);
    await say(N('savta'), ['שעה ו-45 זה מה שלקח לסבא שלך להתחתן איתי. ותראה מה יצא.', 'גם פה יש הזדמנויות. יש לבת של אסתר הזדמנות. היא רווקה. ורופאת שיניים. כמעט.', 'שקרן. יש לך פנים של אחד שלא אכל מאז 2019.'][c]);
    await lines([[N('savta'), 'טוב. לך. אני לא אעצור אותך. אני רק אעמוד פה. עם העגלה. באמצע.'], ['יוסי', 'סבתא, את חוסמת את כל המדרכה.'], [N('savta'), 'קח שניצל לדרך. בתל אביב שניצל עולה 48 שקל. שמעתי מבוריס.']]);
    toast('🍱 קיבלת: קופסת שניצל של סבתא. חפץ שאי אפשר להשתמש בו ואי אפשר לזרוק.', 'good', 6000);
    achieve('msg', 'ההודעה נשלחה', 'הודעת בקבוצה שאתה עוזב. 47 תגובות. 12 מסבתא.');
    hideNPC('savta');
    setTimeout(() => toast('⌨️ E כדי לדבר. בכרמיאל זה אומר 40 דקות לפחות. M – מפה.', '', 6000), 1000);
  });
  await M2();
}

// =====================================================================
// M2 "הרכבת לא מחכה"
// =====================================================================
async function M2() {
  await runMission('M2', async () => {
    setObjective('הרכבת לא מחכה', [[false, 'להגיע לתחנת הרכבת כרמיאל'], [false, 'לעלות על הרכבת לתל אביב']]);
    toast('🚆 Waze: תל אביב – שעה ו-45. תחנת הרכבת – צפונה, ליד כביש 85.');
    await goTo(LM.gate, 5);
    startTimer(120, 'הרכבת יוצאת בעוד', () => toast('🚆 הרכבת יצאה. הבאה בעוד שעה. או בעוד שנה. תלוי בעבודות.', 'bad', 6000));
    const it = npc('itzik'); it.talking = true; it.h.g.rotation.y = Math.atan2(P.pos.x - it.h.g.position.x, P.pos.z - it.h.g.position.z);
    await lines([[N('itzik'), 'עצור! בדיקה ביטחונית. תפתח ת\'תיק.'], ['יוסי', 'אחי, הרכבת יוצאת עוד שתי דקות.'], [N('itzik'), 'אז שתי דקות אני בודק. מה זה? קופסה חשודה!'], ['יוסי', 'זה שניצל של סבתא שלי.'], [N('itzik'), '(פותח, לוקח ביס) ...חשוד מאוד. אני מחרים חצי.']]);
    const c = await ask(N('itzik'), 'לאן אתה נוסע?', ['"לתל אביב."', '"לחיפה. בערך."', '"למה זה משנה לך?"']);
    await say(N('itzik'), ['לתל אביב?! יש לך טופס 17-כ? אישור יציאה מהעיר?', 'בערך לחיפה זה תל אביב. ראיתי את הפייסבוק. יש לך טופס 17-כ?', 'כי אני פה 9 שנים ואתה הדבר הכי מעניין שקרה. טופס 17-כ, בבקשה.'][c]);
    await lines([['יוסי', 'אין דבר כזה טופס 17-כ.'], [N('itzik'), 'יש. המצאתי אותו לפני דקה. אבל הוא רשמי. ראש העיר צריך לחתום.'], ['יוסי', 'אתה ממציא טפסים?'], [N('itzik'), 'אני לא ממציא. אני מאלתר ביטחונית.']]);
    it.talking = false;
    const how = await ask('יוסי', '(הרכבת יוצאת. מה עושים?)', ['להתווכח עם איציק', 'ללכת לשלמה, אולי יש אוטובוס', 'להתגנב לרציף 🕵️']);
    if (how === 0) {
      const O = ['"זה לא חוקי."', '"אני אתקשר לעורך דין."', '"איציק, בחייאת."'], RE = ['לא חוקי? יש לו מספר. מספר זה חוק. זה טופס 17-כ. אם אתה מתווכח – זה 17-כ1. ערעור.', 'עורך דין? הוא בקבוצה. הוא כתב "יוסי תחשוב על זה". זה טופס 17-כ2. עכשיו גם הוא צריך לחתום.', '"בחייאת" זה לא נימוק ביטחוני. זה 17-כ3. אני כבר לא זוכר מה ההבדל, אבל הוא רשמי.'];
      for (let r = 0; r < 3; r++) { const a = await ask('יוסי', r ? '(עוד ניסיון)' : '(מתווכח)', O); await say(N('itzik'), RE[a]); }
      await say(N('itzik'), '(מראה דף מקומט) 17-כ3 מבטל את 17-כ1 ו-2. אז חזרנו לטופס 17-כ. עירייה. יאללה.');
    } else if (how === 1) {
      setObjective('הרכבת לא מחכה', [[true, 'להגיע לתחנה'], [false, 'לדבר עם שלמה בתחנה המרכזית']]);
      await goTo(npc('shlomo').h.g.position, 4);
      await lines([[N('shlomo'), 'לאן, חמוד? עלה, קו 1, אני יוצא עכשיו.'], ['יוסי', 'הוא מגיע לתל אביב?'], [N('shlomo'), 'קו 1 מגיע לכל מקום. הוא עושה את כל הכיכרות בעיר וחוזר לפה.'], ['יוסי', 'אז הוא לא יוצא מהעיר.'], [N('shlomo'), 'למה שמישהו ירצה לצאת? יש 180 כיכרות. אני עוד לא סיימתי לראות את כולן.']]);
      const b = await ask('יוסי', '...', ['"טוב, תודה, לא."', '"עזוב, תן לי נסיעה אחת."']);
      if (b === 0) await say(N('shlomo'), 'מתי שתרצה. אני פה. תמיד פה. כבר 22 שנה. בוא נגיד שיש לי מערכת יחסים עם כיכר האבן.');
      else { fade(true); await sleep(900); await card('🚌 ...<br>40 שניות. 11 כיכרות. 3 פעמים כיכר האבן.'); hideCard(); fade(false); await say(N('shlomo'), '(מוריד אותך באותה נקודה בדיוק) הגענו! 4.50 בבקשה.'); }
    } else if (how === 2) {
      setObjective('הרכבת לא מחכה', [[true, 'להגיע לתחנה'], [false, 'להתגנב לרציף בלי שאיציק יראה']]);
      toast('🕵️ אל תיכנס לחרוט האדום של איציק. הרציף מאחורי הבניין.', '', 6000);
      const cone = addCone(it, 13, 0.6); it.pose = 'point'; const base = it.h.g.rotation.y;   // a posed NPC is not turned toward the player, so the sweep owns his rotation
      let caught = false; const sweep = setInterval(() => { it.h.g.rotation.y = base + Math.sin(performance.now() / 900) * 1.3; }, 30);
      try { await until(() => { if (sees(it, P.pos)) { caught = true; return true; } return near(LM.platform, 6)(); }); }
      finally { clearInterval(sweep); removeCone(it); it.pose = null; }
      if (caught) { sfx('fail'); await say(N('itzik'), 'תפסתי אותך! אתה יודע כמה זמן לא קרה פה כלום? אני מתקשר לאמא שלי לספר לה.'); }
      else { toast('🚪 הדלתות נסגרו. הנהג נופף לך. הוא בקבוצת הפייסבוק.', 'bad', 6000); achieve('almost', 'כמעט', 'התגנבת לרכבת. הדלתות היו מהירות יותר.'); wa('איציק', 'עדכון מהתחנה: יוסי ניסה להתגנב. עצרתי אותו בגבורה. (הדלתות עצרו, אבל אני הייתי שם)'); }
    }
    stopTimer();
    await say(N('itzik'), 'תביא טופס 17-כ חתום מהעירייה ואני אעביר אותך עם כבוד. ועם שניצל. בעיקר השניצל.');
    await say(N('itzik'), 'ועוד משהו. קח קורקינט מהאבדות. נמצא בקו 1 ב-2011. לא בדקתי אותו ביטחונית. גם לא אבדוק.');
    placeScooter(P.pos.x + Math.sin(P.yaw + 1.2) * 2.5, P.pos.z + Math.cos(P.yaw + 1.2) * 2.5, P.yaw);
    toast('🛴 נפתח: קורקינט חשמלי. <b>Q</b> כדי לעלות/לרדת. הכיכרות הן לא רמפות. הן כן. אבל לא.', 'good', 8000);
    refreshBlips();
  });
  toast('📋 משימה חדשה: טופס 17-כ. זמן הגעה לתל אביב (Waze): שעה ו-45.', '', 6000);
  await M3();
}

// =====================================================================
// M3 "טופס 17-כ"
// =====================================================================
async function M3() {
  G.flags.docs = false; G.flags.copy = false; G.flags.photo = false; G.flags.sig = false;
  await runMission('M3', async () => {
    const obj = () => setObjective('טופס 17-כ', [[G.flags.docs, 'לקחת מספר אצל ציפי בעירייה'], [G.flags.copy, 'צילום ת"ז – מכון צילום במדרחוב'], [G.flags.photo, 'תמונת פספורט – תא הצילום בקניון החדש'], [G.flags.sig, 'חתימת שכן – בוריס, על הספסל'], [false, 'לחזור לעירייה']]);
    obj(); await goTo(npc('tsipi').h.g.position, 4);
    await say(N('tsipi'), 'בוקר טוב, תיקח מספר מאמי.');
    toast('🎟️ המספר שלך: 400. על הלוח: 3. בהצלחה.', '', 6000);
    await lines([[N('tsipi'), 'אה, אתה יוסי! של הפייסבוק! טופס 17-כ? בטח. יש לנו אותו כבר... 40 דקות.'], [N('tsipi'), 'אני צריכה צילום תעודת זהות, תמונת פספורט, וחתימה של שכן שמאשר שאתה באמת רוצה ללכת.']]);
    const c = await ask('יוסי', '...', ['"למה צריך חתימה של שכן?"', '"אפשר לעשות את זה אונליין?"', '"זה נשמע כמו טופס שהמציאו הבוקר."']);
    await say(N('tsipi'), ['כי אם שכן מסכים שתלך – כנראה שאתה באמת מעצבן. זה נוהל.', 'בטח! יש אתר. הוא עולה בימי שני בין 9 ל-9:05.', 'כל הטפסים הומצאו מתישהו בבוקר, מאמי. תביא מסמכים.'][c]);
    G.flags.docs = true; obj();
    npc('copy').talk = async () => { if (G.flags.copy) return say(N('copy'), 'עוד צילום? 50 אגורות. אתה עדיין פה?'); await say(N('copy'), 'צילום? 50 אגורות. צבעוני? 50 אגורות. אתה עוזב? חינם, רק שתצא כבר מהתור הזה.'); G.flags.copy = true; toast('📄 נאסף: צילום ת"ז. יצאת בו כמו חשוד בסדרה של כאן 11.', 'good'); obj(); };
    hot('booth', { ...LM.photoBooth, r: 3, label: 'להצטלם בתא הצילום', cond: () => !G.flags.photo, onE: async () => { if (G.flags.photo) return; P.frozen = true; fade(true); sfx('blip'); await sleep(250); fade(false); await sleep(250); fade(true); await sleep(250); fade(false); P.frozen = false; G.flags.photo = true; toast('📸 תא הצילום צילם 4 תמונות. ב-3 מהן סבתא שלך מופיעה ברקע. אתה לא יודע איך.', 'good', 6000); obj(); } });
    npc('boris').talk = async () => {
      if (G.flags.sig) return say(N('boris'), 'חתמתי. עכשיו לך. בשקט. יש לי מרפסת.');
      await say(N('boris'), 'אתה רוצה שאני חותם שאתה הולך? שב. משחק שחמט אחד. אם אתה מנצח – אני חותם.');
      const b = await ask('יוסי', '...', ['"בסדר, בוא."', '"אין לי זמן לשחמט."']);
      await say(N('boris'), ['(4 מהלכים) מט. אתה משחק כמו שאתה חונה. אבל אני חותם. כי אני רוצה שקט במרפסת.', 'לאף אחד אין זמן. בגלל זה כולם בתל אביב והם עצבניים. אני חותם. תחזור לשחק.'][b]);
      await say(N('boris'), 'דרך אגב, בתל אביב קפה 48 שקל. אני לא הייתי. אבל אני יודע.');
      G.flags.sig = true; toast('✍️ נאספה: חתימת שכן. בוריס חתם בכתב יד של רופא.', 'good'); obj();
    };
    const tick = setInterval(() => { M.targets = [!G.flags.copy && npc('copy').h.g.position, !G.flags.photo && LM.photoBooth, !G.flags.sig && npc('boris').h.g.position].filter(Boolean); }, 300);
    await until(() => G.flags.copy && G.flags.photo && G.flags.sig); clearInterval(tick); unhot('booth');
    obj(); await goTo(npc('mayor').h.g.position, 5);
    LM.numberBoard.children[0].material[4] = new THREE.MeshStandardMaterial({ map: textTex(['תור: 400'], 512, 256, { bg: '#111', fg: '#ff4d4d' }) });
    toast('🔢 הלוח קפץ מ-3 ל-400 ברגע שחזרת. "כי כולם בפייסבוק ורצו לראות".', '', 5000);
    await card('לשכת ראש העיר.<br>על הקיר: מפה עם 180 סיכות.<br>על השולחן: מספריים בגודל של נער.'); hideCard();
    const m = N('mayor');
    await lines([['ראש העיר', 'יוסי! איזה כיף! באת לחנוך איתי כיכר? יש לי אחת חדשה ליד המכללה. שמתי בה עציץ.'], ['יוסי', 'אני באתי לחתום על טופס 17-כ. אני עובר לתל אביב.'], ['ראש העיר', '(שומט את המספריים) ...תל אביב? אבל... אבל יש לנו אמפי. יש לנו פסטיבל. יש לנו כיכר האירוסים!']]);
    const d = await ask('יוסי', '...', ['"גם בתל אביב יש כיכרות."', '"אני צריך שינוי."', '"זה לא אישי."']);
    await say('ראש העיר', ['כיכר רבין זה לא כיכר! אין בה אפילו סיבוב! אי אפשר להסתובב בה ולהתחרט!', 'שינוי? פתחנו 4 כיכרות החודש! זה שינוי! כל יום אתה נכנס מכיוון אחר לבית!', 'הכול אישי, יוסי. אני ראש עיר. כל תושב שעוזב זה כמו כיכר שסוגרים. וכיכרות לא סוגרים.'][d]);
    await lines([['ראש העיר', 'טוב. דמוקרטיה. אני חותם. איפה החותמת... ציפי? איפה החותמת העירונית?'], [N('tsipi'), '(מבחוץ) היא הייתה על השולחן לפני שהחתולה נכנסה!']]);
    mitziRun(npc('mayor').h.g.position, 22);
    await card('מבעד לחלון: חתולה ג\'ינג\'ית בורחת עם משהו מוזהב בפה.<br>היא מסתכלת עליך. <b>היא לא מתנצלת.</b>'); hideCard();
    await lines([['ראש העיר', 'מיצי. שוב. היא לוקחת כל דבר שנוצץ. פעם לקחה לי חצי מהמספריים.'], ['ראש העיר', 'אתה יודע מה? עד שנמצא את החותמת – תעשה לי שלושה דברים למען העיר. בתור פרידה.'], ['ראש העיר', 'תאכיל את העיר – בשניצליה. תרקוד את העיר – בפסטיבל. ותסיים את מה שהתחלת – בבראודה.'], ['יוסי', 'זה נשמע כמו תוכנית להשאיר אותי פה.'], ['ראש העיר', '(מחייך) זה נשמע כמו פרידה מכובדת. קח קורקינט עירוני. ירוק, שקט, ונוסע מצוין בכיכרות.']]);
    await say('ראש העיר', '...קורקינט מהאבדות? מ-2011? אני משדרג לך אותו לעירוני. אותו קורקינט, אבל עם מדבקה של העירייה.');
    toast('🛴 הקורקינט שודרג: עכשיו יש עליו מדבקה. זה כל השדרוג.', 'good', 6000);
    openRoundabout('כיכר הטופס');
    setTimeout(() => wa('ציפי', 'מי שרואה חתולה ג\'ינג\'ית עם חותמת – לא לגעת, להתקשר לעירייה. (לא תענו, אבל תתקשרו)'), 2500);
    achieve('form', 'טופס 17-כ', 'מילאת טופס שהומצא לפני שעה. כל הכבוד, אזרח.');
  });
  npc('copy').talk = barker('copy', BARKS.copy);   // back to his regular lines (the mission override stuck forever)
  G.act = 2; save(); actTwoIntro();
}
function actTwoIntro() {
  refreshBlips(); setupGivers();
  setObjective('שלושת התנאים', [[G.done.has('M4'), 'תאכיל את העיר – השניצליה 🥖'], [G.done.has('M5'), 'תרקוד את העיר – אמפי פארק הגליל 💃'], [G.done.has('M6'), 'תסיים את מה שהתחלת – אורט בראודה 🎓']]);
  toast('❗ משימות חדשות על המפה. ❔ = משימות צד (לא חובה, אבל שוות הטבה בגמר).', '', 7000);
}
const BUS_DEST = () => [['העירייה', LM.cityhall.door], ['השניצליה', LM.schnitzelia.door], ['אמפי פארק הגליל', LM.amphi.front], ['אורט בראודה', LM.exam.entrance], ['ביג', LM.bigLot.center], ['גבעת מכוש', LM.makosh], ['הבית', LM.home]];
async function busRide() {
  const D = BUS_DEST(), c = await ask(N('shlomo'), 'לאן, חמוד? קו 1 מגיע לכל מקום. בסוף. אחרי כל הכיכרות. 4.50.', [...D.map(d => d[0]), 'עזוב, אני ברגל']);
  if (c === D.length) return say(N('shlomo'), 'ברגל? בכרמיאל? אתה תגיע אחרי הקו.');
  fade(true); await sleep(700);
  await card(`🚌 ...<br>${7 + Math.floor(Math.random() * 20)} כיכרות. 3 פעמים כיכר האבן. שלמה סיפר לך על הגרוש שלו. פעמיים.`); hideCard();
  if (Math.random() < 1 / 6) { fade(false); return say(N('shlomo'), '(עוצר בדיוק איפה שעלית) הגענו! ...לא לשם. לפה. קו 1 מגיע לכל מקום, לא אמרתי שבסדר מסוים.'); }
  const t = D[c][1]; teleport(t.x + 3, t.z + 3); if (P.onScooter) { const { dismount } = await import('./player.js'); dismount(); } fade(false);
  toast('🚌 הגענו! תרד מהדלת האחורית. הקדמית שמורה לכיכרות.', 'good');
}
function setupGivers() {
  npc('shlomo').talk = () => G.active ? say(N('shlomo'), pick(BARKS.shlomo)) : busRide();
  npc('dudu').talk = () => G.done.has('M4') ? say(N('dudu'), 'יוסי! תבוא כל יום! עד שאתה עוזב!') : M4();
  npc('galit').talk = () => G.done.has('M5') ? say(N('galit'), 'אני כוריאוגרפית. כל התנועות שלי מניפולטיביות.') : M5();
  npc('shimshon').talk = () => G.done.has('M6') ? say(N('shimshon'), 'אתה מהנדס. אל תבנה כיכרות בתל אביב. הם לא מוכנים.') : M6();
  npc('orna').talk = () => G.done.has('S1') ? say(N('orna'), 'מצאתי אותו פעמיים השבוע! שיא אישי!') : S1();
  npc('noa').talk = () => G.done.has('S2') ? say(N('noa'), 'אני פה. אני תמיד פה. זה כבר עניין של זהות.') : S2();
  npc('boris').talk = async () => {
    if (G.active === 'M4' && !G.flags.sauce) return borisSauce();
    if (G.active) return say(N('boris'), pick(BARKS.boris));
    if (!G.done.has('S3')) return S3();
    return say(N('boris'), 'יוסי בסדר. כתבתי. אל תבקש יותר.');
  };
  npc('mayor').talk = async () => {
    if (G.done.has('END')) return say('ראש העיר', pick(MAYOR_AFTER));
    if (G.act === 4 && !G.active) return M8();
    if (G.flags.metEldar && Math.random() < 0.45) return say('ראש העיר', pick(ELDAR.onMayor));
    await say('ראש העיר', G.done.has('M4') && G.done.has('M5') && G.done.has('M6') ? 'החותמת! מיצי! מישהו ראה את מיצי?!' : pick(['עוד לא סיימת את שלושת התנאים? מצוין. כלומר, חבל. כלומר, מצוין.', 'תאכיל, תרקוד, תסיים. ואז נדבר. או שתישאר ולא נצטרך לדבר.']));
  };
  npc('moti').talk = () => G.act === 3 && !G.active && G.flags.chaseDone ? M7() : say(N('moti'), G.act === 3 ? 'מיצי? ראיתי אותה ליד התחנה המרכזית. רוץ! אני אחכה. אני תמיד מחכה.' : pick(BARKS.moti));
}
function checkActThree() {
  if (G.act === 2 && G.done.has('M4') && G.done.has('M5') && G.done.has('M6')) {
    G.act = 3; save();
    setTimeout(async () => {
      wa('שלמה הנהג', 'ראיתי חתולה ג\'ינג\'ית בתחנה המרכזית עם משהו מוזהב בפה. היא עלתה לקו 1 וירדה. לא שילמה.'); await sleep(2500);
      wa('ציפי', 'זאת היא!!! זו החותמת!!! יוסי רוץ!!!'); await sleep(2500);
      wa('מנהל הקבוצה', 'אפשר לא לכתוב "רוץ" בקבוצה? יש פה אנשים עם לחץ דם.');
      setObjective('הקומה הנשכחת', [[false, 'לתפוס את מיצי בתחנה המרכזית']]); M.targets = [LM.bus]; refreshBlips();
      setTimeout(() => wa('ציפי', 'יוסי איפה אתה?? היא ליד קו 1!!! היא עוד לא שילמה!!!'), 25000);
      mitziChase();
    }, 2500);
  } else if (G.act === 2) actTwoIntro();
}

// =====================================================================
// M4 "הביקורת" — HaSchnitzelia
// =====================================================================
let bakeryTruck = null;
function spawnBakery() {
  if (bakeryTruck) return bakeryTruck;
  const s = LM.schnitzelia.door, rb = ROUNDABOUTS.filter(r => r.ir > 2).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
  const g = new THREE.Group(); mesh(boxG(5.5, 2.8, 2.3), 0xffffff, 0, 1.8, 0, g); mesh(boxG(1.8, 1.8, 2.2), 0xf6a01a, 3.4, 1.3, 0, g);
  const sgn = label('🥖 מאפיית הגליל', { px: 28 }); sgn.position.y = 3.8; g.add(sgn);
  for (const [a, b] of [[-1.8, 1.1], [-1.8, -1.1], [2.8, 1.1], [2.8, -1.1]]) mesh(cylG(0.45, 0.45, 0.3, 10).rotateX(Math.PI / 2), 0x111111, a, 0.45, b, g);
  scene.add(g); bakeryTruck = { g, rb, a: 0, laps: 0 }; tickBakery(0); return bakeryTruck;
}
export function tickBakery(dt) {
  if (!bakeryTruck || !bakeryTruck.g.visible) return;
  const b = bakeryTruck, r = b.rb.r; b.a += dt * 11 / r; const x = b.rb.x + Math.cos(b.a) * r, z = b.rb.z + Math.sin(b.a) * r;
  b.g.position.set(x, H(x, z) + 0.4, z); b.g.rotation.y = -b.a - Math.PI;
}
let m4obj = null;
async function borisSauce() {
  await say(N('boris'), 'רוטב? יש לי פלפל חריף במרפסת. חידה: מה יש לכרמיאל ואין לתל אביב?');
  const c = await ask('יוסי', '...', ['"חניה."', '"ים."', '"אני."']);
  await say(N('boris'), ['נכון. והרבה. קח פלפל. אל תשפשף עיניים. אני אומר מניסיון של 1987.', 'לא נכון. גם אין לנו ים. אבל 20 דקות לים. בערך. ביום בלי פקקים. ב-1994. קח פלפל.', '(דמעה קטנה) ...זה לא התשובה. אבל קח פלפל. וגם מפית.'][c]);
  G.flags.sauce = true; toast('🌶️ נאסף: פלפל חריף של בוריס.', 'good'); m4obj?.();
}
async function M4() {
  await runMission('M4', async () => {
    G.flags.pickles = G.flags.bread = G.flags.sauce = false;
    const obj = () => setObjective('הביקורת', [[G.flags.pickles, 'חמוצים – סבתא במדרחוב'], [G.flags.bread, 'בגטים – משאית המאפייה בכיכר'], [G.flags.sauce, 'רוטב חריף – בוריס'], [false, 'לחזור לדודו']]);
    if (G.flags.m4intro) await say(N('dudu'), 'עוד פעם! המבקר נתן לנו הזדמנות שנייה. הוא אכל בינתיים פלאפל אצל מוטי.');
    else {
    G.flags.m4intro = true;
    await say(N('dudu'), 'יוסי! אחי! אלוהים שלח אותך. או הפייסבוק. אחד מהשניים.');
    await say(N('dudu'), 'עוד 4 דקות מגיע מבקר אוכל מתל אביב. ואין לי חמוצים, אין בגטים, ואין את הרוטב החריף.');
    const c = await ask('יוסי', '...', ['"למה שיהיה אכפת לי ממבקר מתל אביב?"', '"אני על זה."', '"אני עוזב את העיר, אני לא עובד פה."']);
    await say(N('dudu'), ['כי אם הוא יכתוב שהשניצל שלנו טוב, כל תל אביב תבוא לפה. ואז לא תצטרך לעבור לשם. חשבת על זה?', 'זה הבחור. כמו בצבא. רק עם שניצל. כמו בצבא.', 'כולם עובדים פה כשיש מבקר. גם השוטר. תסתכל, הוא מקלף תפוחי אדמה.'][c]);
    }
    if (!P.onScooter) setTimeout(() => toast('🛴 טיפ: 4 דקות, 3 מקומות. ברגל זה אפשרי. גם לעבור לתל אביב ברגל זה אפשרי.'), 3000);
    obj(); toast('⏱️ 4:00 עד שהמבקר מגיע. חמוצים. בגטים. רוטב. זוז.', 'bad', 6000); music('tense');
    startTimer(240, 'המבקר מגיע בעוד', () => failMission('המבקר הזמין סושי. ביום רביעי. בכרמיאל. אלוהים ירחם על כולנו.'));
    show('savta', LM.savtaMidrachov);
    npc('savta').talk = async () => {
      if (G.flags.pickles) return say(N('savta'), 'לך, לך. תגיד לדודו שהחמוצים של סבתא. שיכתוב על הקיר.');
      await lines([[N('savta'), 'אכלת?'], ['יוסי', 'סבתא, אני צריך חמוצים. דחוף.'], [N('savta'), 'יש לי. תמיד יש לי. אבל רק אם תבטיח לבוא לארוחת שישי.']]);
      const s = await ask('יוסי', '...', ['"אני מבטיח."', '"סבתא, אין זמן!"']);
      await say(N('savta'), ['הקלטתי. יש לי אפליקציה. הנכד של אסתר התקין.', 'לסבתא תמיד אין זמן. בגלל זה היא לוקחת את החמוצים חזרה. ...טוב, קח. אבל בעצב.'][s]);
      G.flags.pickles = true; toast('🥒 נאספו: חמוצים של סבתא.', 'good'); obj();
    };
    const truck = spawnBakery(); truck.g.visible = true;
    hot('bakery', { get x() { return truck.g.position.x; }, get z() { return truck.g.position.z; }, r: 7, label: 'לדבר עם נהג המאפייה', cond: () => !G.flags.bread, onE: async () => {
      await say(N('baker'), 'אני לא יוצא מהכיכר עד שמישהו נותן לי להיכנס לנתיב! אני פה 11 סיבובים!');
      const b = await ask('יוסי', '...', ['"אני אעצור את התנועה, תצא."', '"תזרוק לי את הבגטים מהחלון."']);
      await say(N('baker'), ['(יוצא) גיבור! קח בגטים. חמים. כמו הלב של העיר. וכמו המנוע, שעוד רגע נשרף.', '(זורק 6 בגטים בסיבוב) תפסת 4. שניים נחתו בכיכר. עכשיו הם נוי עירוני.'][b]);
      G.flags.bread = true; toast('🥖 נאספו: בגטים. חמים.', 'good'); obj();
    } });
    const tick = setInterval(() => { M.targets = [!G.flags.pickles && npc('savta').h.g.position, !G.flags.bread && truck.g.position, !G.flags.sauce && npc('boris').h.g.position].filter(Boolean); }, 300);
    try { await until(() => G.flags.pickles && G.flags.bread && G.flags.sauce); } finally { clearInterval(tick); }
    obj(); await goTo(npc('dudu').h.g.position, 4); stopTimer();
    await say(N('dudu'), 'הכול פה! עכשיו – בגט הזהב. אתה מרכיב. אני מתפלל.');
    const score = await quiz(N('dudu'), [
      { q: 'בגט הזהב (1/4): איזה לחם?', a: ['בגט טרי', 'פיתה', 'לחם שחור של בוריס'], ok: [0], yes: 'בגט. כמו שאלוהים התכוון.', no: 'פיתה זה לפלאפל. אתה כבר עשית את הטעות הזאת ב-2019.', why: { 2: 'בוריס עדיין מחפש אותו.' } },
      { q: 'בגט הזהב (2/4): איזה שניצל?', a: ['עוף, פריך, זהוב', 'טופו', 'שניצל של סבתא מהקופסה'], ok: [0], yes: 'זהוב. כמו שקיעה על גבעת מכוש.', no: 'טופו?! המבקר מתל אביב דווקא ישמח. אבל לא.', why: { 2: 'יפה שאתה נאמן, אבל הוא מלפני שלושה פרקים.' } },
      { q: 'בגט הזהב (3/4): מה מורחים?', a: ['חומוס + עמבה + טחינה', 'אבוקדו על מחמצת', 'כלום'], ok: [0], yes: 'השילוש הקדוש.', no: 'כלום?! זה לא בגט, זה מקל.', why: { 1: 'עוד לא עברת לתל אביב ואתה כבר ככה?' } },
      { q: 'בגט הזהב (4/4): תוספות?', a: ['חמוצים, צ\'יפס בפנים, פלפל של בוריס', 'נבטים', '"מה שהשף ממליץ"'], ok: [0], yes: 'צ\'יפס בפנים. אתה אמן.', no: 'השף ממליץ שתחליט לבד.', why: { 1: 'המבקר מתל אביב אמר "וואו, נבטים". ואז כולם בשניצליה הסתכלו עליך.' } },
    ]);
    if (score < 2) failMission('המבקר ביקש בגט בלי כלום. זה לא בגט, זה מקל. נסה שוב.');
    await until(() => true);
    show('critic', LM.schnitzelia.critic);
    await say(N('critic'), 'אז זה השניצל בבגט המפורסם של הצפון. בוא נראה.');
    await say(N('critic'), score === 4 ? '(ביס) ...אני צריך לשבת. אני כבר יושב. אני צריך לשבת עוד יותר.' : score === 3 ? '(ביס) טוב. ממש טוב. יש פה משהו. אולי זה הפלפל. אולי זה האנשים שבוהים בי.' : '(ביס) ...זה בגט. זה בהחלט בגט. אני אכתוב "בגט". בלי שם תואר.');
    await lines([[N('critic'), 'אצלנו בתל אביב דבר כזה היה עולה 89 שקל. ואתה היית מקבל חצי. עם עלה.'], ['יוסי', '89?! בוריס אמר 48.'], [N('critic'), '48 זה רק הצ\'ייסר של הטחינה.'], [N('dudu'), 'יוסי, בזכותך! תבוא כל יום! עד סוף החיים! ...אה, אתה עוזב. אז תבוא כל יום עד שאתה עוזב.']]);
    toast('✅ תנאי 1/3: תאכיל את העיר. בוצע.', 'good'); openRoundabout('כיכר יוסי-תחשוב-על-זה', 'חנכתי כיכר. היא לא קשורה ליוסי. השם קשור ליוסי. הכיכר עצמה ניטרלית.');
    setTimeout(() => wa('דודו', 'תודה ליוסי! שניצל חינם לכל מי ששכנע אותו להישאר!!! (רק למי ששכנע)'), 2000);
    achieve('chef', 'שף בגט', 'הרשמת מבקר מתל אביב. הוא עדיין יושב שם.');
  }, async () => { G.flags.pickles = G.flags.bread = G.flags.sauce = false; hideNPC('critic'); teleport(LM.schnitzelia.dudu.x + 2, LM.schnitzelia.dudu.z + 2); });
  unhot('bakery'); hideNPC('savta'); if (bakeryTruck) bakeryTruck.g.visible = true;
  { let i = 0; npc('critic').talk = () => say(N('critic'), G.act >= 4 ? 'שמעתי שאתה עוזב לתל אביב. לא. תקשיב לי. אני משם. תישאר. תזמין בגט. זה הכול.' : (L => L[i++ % L.length])(['אני כותב את הביקורת. זה פרק 3. הפרק נקרא "בגט". הפרק הבא נקרא "עוד בגט".', 'ביטלתי את הדירה בתל אביב. אני לא עוזב. אתם חושבים שזה בגלל הבגט. זה בגלל הבגט.', ...(MORE_BARKS.critic || [])])); }
  checkActThree();
}

// =====================================================================
// M5 "רגל שמאל" — Karmiel Dance Festival
// =====================================================================
const seniors = [];
async function danceRound(n) {
  const A = LM.amphi;
  P.dancing = true; P.frozen = true; P.pos.set(A.stage.x, A.y, A.stage.z); P.yaw = A.dir;
  cam.fixed = { pos: new THREE.Vector3(A.cam.x, A.y + 7, A.cam.z), look: new THREE.Vector3(A.stage.x, A.y + 2.2, A.stage.z) };
  npc('galit').dance = true;
  const cfg = [{ bpm: 108, beats: 32, density: 0.6, doubles: 0, flavour: 0, title: 'סיבוב 1: הורה אמפי' }, { bpm: 122, beats: 36, density: 0.75, doubles: 0.15, flavour: 1, title: 'סיבוב 2: זומבה של גמלאים' }, { bpm: 136, beats: 40, density: 0.8, doubles: 0.3, flavour: 2, title: 'סיבוב 3: ההורה של 2026 – רמיקס', blink: true }][n];
  music(null); const r = await rhythm(cfg); music('roam');
  P.dancing = false; P.frozen = false; cam.fixed = null; npc('galit').dance = false;
  return r.score;
}
async function M5() {
  await runMission('M5', async () => {
    setObjective('רגל שמאל', [[false, 'לרקוד 3 סיבובים בפסטיבל']]);
    await say(N('galit'), 'אתה! עם החולצה של 2008! אתה יודע לרקוד?');
    await lines([['יוסי', 'רקדתי בפסטיבל כשהייתי בן 11. חטפתי מכה מתוף.'], [N('galit'), 'מושלם. יש לך ניסיון בפציעות. הרקדנית שלי נקעה רגל. אתה נכנס. עוד 5 דקות.']]);
    const c = await ask('יוסי', '...', ['"אני לא יודע את הצעדים."', '"אם אני רוקד, ראש העיר חותם לי. אני בפנים."', '"אני כבר לא בן 11."']);
    await say(N('galit'), ['אף אחד לא יודע את הצעדים. זה פסטיבל מחול מאז 88\'. הצעדים יודעים אותך.', 'מעולה. ואם תרקוד טוב – אולי תישאר. אני אומרת את זה בתור גלית, לא בתור מזימה עירונית.', 'גם אני לא. אבל על הבמה כולם בני 11. חוץ מבוריס. בוריס תמיד בן 70.'][c]);
    toast('⬅️⬇️⬆️➡️ חיצים (או WASD) כדי לרקוד. בקצב. בכרמיאל לא סולחים על פספוס של פעמה.', '', 7000);
    show('savta', LM.amphi.seat, LM.amphi.dir + Math.PI); const sg = label(T('יוסי אל תעזוב (ותאכל)'), { bg: '#fff', fg: '#b3261e', px: 34 }); sg.position.y = 3.2; npc('savta').h.g.add(sg); npc('savta').pose = 'arms-up';
    const FAILS = ['רגל שמאל. הרגל השמאלית. יוסי, יש לך שתיים. תבחר אחת.', 'הקהל מחא כפיים. מנימוס. זה הכי גרוע.', 'בוריס מחא כפיים. בוריס לא מוחא כפיים. זה רחמים. רחמים רוסיים. הכי כבדים.', 'גלית שקלה להחליף אותך בבובה מהקניון הישן. הבובה הסכימה. היא זזה רק כשלא מסתכלים.'];
    const SIGNS = ['יוסי אל תעזוב (ותאכל)', 'יוסי רגל שמאל!!! השנייה!!!', 'יוסי אתה מדהים (עדיין לא אכלת)']; let tries = 0, sgn = sg;
    const rounds = [
      ['סיבוב 1: הורה אמפי.<br>4,000 איש. אחד מהם סבתא שלך. עם שלט.', 'השלט של סבתא: "יוסי אל תעזוב (ותאכל)".'],
      ['סיבוב 2: זומבה של גמלאים.<br>בוריס בשורה הראשונה. הוא לא מחייך. הוא אף פעם לא מחייך. <b>הוא מאושר.</b>'],
      ['סיבוב 3: ההורה של 2026 – רמיקס.<br>גלית הוסיפה דרופ. אף אחד לא ביקש דרופ.'],
    ];
    for (let n = 0; n < 3; n++) {
      if (n === 1) { show('boris', { x: LM.amphi.stage.x + 3, z: LM.amphi.stage.z - 1 }); npc('boris').dance = true; }
      await cards(rounds[n]);
      npc('savta').h.g.remove(sgn); sgn = label(T(SIGNS[n]), { bg: '#fff', fg: '#b3261e', px: 34 }); sgn.position.y = 3.2; npc('savta').h.g.add(sgn);
      if (n === 1) setTimeout(() => bark(npc('boris'), 'אני לא מחייך. זה הפנים שלי כשאני מאושר. תתרגל.'), 6000);
      for (;;) { const s = await danceRound(n); if (s >= 0.55) { sfx('win'); toast(`💃 ${Math.round(s * 100)}%! הקהל משתגע.`, 'good'); break; } sfx('fail'); await card(`${Math.round(s * 100)}%... ${FAILS[Math.min(tries++, FAILS.length - 1)]}<br><small>שוב מהסיבוב הזה</small>`); hideCard(); }
      if (n === 0) await avivCameo();
    }
    npc('boris').dance = false; show('boris', LM.cityhall.boris);
    await lines([[N('galit'), 'יוסי. זה היה... בסדר גמור. בשביל מישהו שעוזב. בשביל מישהו שנשאר – זה היה מושלם.'], ['יוסי', 'זה משפט מניפולטיבי.'], [N('galit'), 'אני כוריאוגרפית. כל התנועות שלי מניפולטיביות.']]);
    toast('✅ תנאי 2/3: תרקוד את העיר. בוצע.', 'good'); openRoundabout('כיכר באמת-יוסי?', 'כיכר נוספת. יוסי, אם אתה קורא – יש בה עציץ. שני עציצים. אני מוכן להגיע לשלושה.');
    setTimeout(() => wa('חנה מהקומה השלישית', 'ראיתי את יוסי רוקד. בכיתי. גם בגלל הפלפל של בוריס שהיה על הידיים שלי.'), 2000);
    achieve('hora', 'מלך ההורה', 'סיימת את שלושת סיבובי הפסטיבל. הרגל השמאלית סלחה לך.');
    npc('savta').h.g.remove(sgn); npc('savta').pose = null; hideNPC('savta');
  });
  checkActThree();
}
async function avivCameo() {
  show('aviv', LM.amphi.backstage); P.pos.set(LM.amphi.backstage.x + 2, groundAt(LM.amphi.backstage.x + 2, LM.amphi.backstage.z), LM.amphi.backstage.z);
  await card('מאחורי הקלעים...'); hideCard();
  await lines([['אביב אלוש', 'היי, אתה יוסי? כל הפייסבוק מדבר עליך. גם אני בקבוצה. אל תשאל איך.'], ['יוסי', 'אביב אלוש?! אתה גדלת פה, נכון? ועזבת. אז אפשר לעזוב!'], ['אביב אלוש', 'אפשר ללכת לכל מקום. אבל תבדוק שאתה הולך למשהו, ולא רק בורח ממשהו.']]);
  const c = await ask('יוסי', '...', ['"וואו. זה עמוק."', '"אפשר סלפי?"', '"אתה חוזר לפה לפעמים?"']);
  await say('אביב אלוש', ['כן, אני יודע. תרגלתי את זה מול המראה. עכשיו לך תרקוד, הקהל מחכה.', 'בטח. (קליק) ...סבתא שלך נכנסה לתמונה. איך היא הגיעה לפה? זה מאחורי הקלעים.', 'תמיד כיף לחזור הביתה. הכיכרות מזכירות לי מאיפה באתי. ואיך לא לצאת מהן.'][c]);
  if (c === 1) { fade(true); sfx('blip'); await sleep(150); fade(false); }
  achieve('aviv', 'סלפי עם אביב', 'הצטלמת עם אביב אלוש. סבתא בפריים. תמיד.');
  hideNPC('aviv');
}

// =====================================================================
// M6 "המבחן" — ORT Braude (stealth + quiz)
// =====================================================================
async function M6() {
  const E = LM.exam; let rachel;
  await runMission('M6', async () => {
    setObjective('המבחן', [[false, 'להתגנב למקום 47 בלי שרחל תראה'], [false, 'לעבור את המבחן (4 מתוך 6)']]);
    if (G.flags.m6intro) await say(N('shimshon'), 'שוב אתה? רחל כבר קוראת לך "הבחור עם הג\'ל". תיכנס בשקט. יותר בשקט.');
    else { G.flags.m6intro = true;
    await lines([[N('shimshon'), 'יוסי. 7 שנים. 7 שנים אני שומר לך את הטופס. אתה יודע למה?'], ['יוסי', 'כי אתה... אוהב אותי?'], [N('shimshon'), 'כי אף אחד לא עזב לי מבחן בשביל פלאפל. אף אחד! היה לי סטודנט שעזב בשביל לידה. זה מובן.']]);
    const c = await ask('יוסי', '...', ['"הפלאפל היה ממש טוב."', '"אני מצטער, פרופסור."', '"למה אני בכלל צריך תואר בתל אביב?"']);
    await say(N('shimshon'), ['(רועד) אני יודע שהוא היה טוב. הלכתי לבדוק. הוא היה מצוין. זה מה שהכי כואב.', 'אל תצטער. תסיים. יש לך שעה. בעצם, 7 שנים ושעה. אבל נספור רק את השעה.', 'בתל אביב? אתה צריך תואר כדי לקבל דירה עם חלון. בלי תואר – חלון לקיר.'][c]);
    await say(N('shimshon'), 'המשגיחה רחל לא יודעת שאתה חוזר. היא לא מאמינה בהזדמנות שנייה. תיכנס בשקט.');
    }
    toast('🕵️ אל תיכנס לחרוט האדום. שב במקום 47 (מסומן בצהוב).', '', 6000);
    toast('📝 המקום שלך: 47. עדיין יש עליו פתק "יוסי – חזר מהפלאפל?"', '', 6000);
    rachel = show('rachel', { x: E.center.x - 12, z: E.center.z - 10 }); rachel.path = LM.examPath; rachel.speed = 2.6; rachel.pathWait = 1.2; addCone(rachel, 11, 0.62);
    const RB = ['שקט באולם! גם את, מחשבון.', 'מי אכל פה במבה? אני מריחה במבה.', 'אני רואה הכול. חוץ ממה שמאחוריי. תלמידים, אל תנצלו את זה.'];
    const bk = setInterval(() => bark(rachel, pick(RB)), 5000);
    M.targets = [E.seat];
    let seen = false;
    try { await until(() => { if (sees(rachel, P.pos)) { seen = true; return true; } return near(E.seat, 1.3)(); }); } finally { clearInterval(bk); }
    if (seen) { sfx('fail'); failMission('סליחה, אתה נבחן? תעודה. ...זו תעודת זהות עם ג\'ל. אתה נראה עייף יותר.'); await until(() => false); }
    M.targets = []; P.frozen = true; P.pos.set(E.seat.x, groundAt(E.seat.x, E.seat.z), E.seat.z);
    let score = 0;
    for (;;) {
      score = await quiz(N('shimshon'), [
        { q: 'שאלה 1: מכונית נכנסת לכיכר ב-50 קמ"ש. כמה פעמים היא תסתובב לפני שמישהו ייתן לה לצאת?', a: ['1', '3', '∞', '"תלוי אם זה נהג של המאפייה"'], ok: [2], yes: 'נכון. הנדסת תנועה בגליל היא ענף של הפילוסופיה.', no: 'לא. אינסוף. זה תמיד אינסוף.' },
        { q: 'שאלה 2: גשר בנוי ל-10 טון. מגיעה סבתא עם עגלת שוק וקופסאות אוכל. האם הגשר מחזיק?', a: ['כן', 'לא', 'הגשר מחזיק, הנכדים לא'], ok: [2], yes: 'חישוב מדויק. קיבלת נקודה וגם כופתאות.', no: 'לא לקחת בחשבון את הקציצות.' },
        { q: 'שאלה 3: קורקינט חשמלי נוסע 25 קמ"ש במורד גבעת מכוש. מה המהירות בזמן הפגיעה בשיח?', a: ['25', '0', '"כמה זה עולה לי בביטוח?"'], ok: [1], yes: 'נכון. השיח ניצח. השיחים תמיד מנצחים.', no: 'השיח לא מסכים איתך.' },
        { q: 'שאלה 4: מהו הכוח השקול הפועל על אדם שמנסה לעזוב את כרמיאל?', a: ['כבידה', 'חיכוך', 'קבוצת פייסבוק', 'סבתא × תאוצה'], ok: [2], yes: 'נכון. 214 חברים. 3 פעילים. אינסוף כוח.', no: 'לא. זה הפייסבוק. תמיד הפייסבוק.', why: { 3: 'קרוב מאוד. אבל סבתא היא לא וקטור. היא קבוע.' } },
        { q: 'שאלה 5: כמה זמן לוקח להגיע מכרמיאל לים?', a: ['20 דקות', '45 דקות', 'שעה'], ok: [0], yes: 'נכון! תמיד 20 דקות. לא משנה מאיפה. לא משנה לאיזה ים.', no: 'לא נכון. 20 דקות. תשאל כל אחד פה. הם יגידו 20 דקות. גם על פריז.' },
        { q: 'שאלה 6: חשב: שכר דירה בתל אביב חלקי משכורת התחלתית של מהנדס.', a: ['0.3', '0.5', '"שגיאה: חלוקה בדמעות"'], ok: [2], yes: 'מדויק. זה בדיוק מה שהמחשבון שלי הראה ב-2019.', no: 'תבדוק שוב. עם טישו.' },
      ]);
      if (score >= 4) break;
      await say(N('shimshon'), 'ציון: 54. בבראודה זה "כמעט מהנדס". בהורים שלך זה "איפה טעינו". עוד פעם.');
      toast('🪟 סבתא בחלון. עם קופסה. היא מסמנת לך "תאכל".');
    }
    P.frozen = false;
    await lines([[N('shimshon'), 'עברת. 7 שנים ושעה. אתה מהנדס. תשמע, אני לא אדם רגשי. אבל... (מוציא מטפחת) אבק.'], [N('shimshon'), 'תגיד, הפלאפל ההוא... מאיפה הוא היה?'], ['יוסי', 'ממוטי. בקניון הישן.'], [N('shimshon'), 'הקניון הישן... פעם הייתה שם באולינג. היום רק מוטי ורוחות. תשמור על עצמך אם אתה הולך לשם.']]);
    toast('✅ תנאי 3/3: תסיים את מה שהתחלת. בוצע. יש לך תואר. אין לך חותמת.', 'good', 6000); openRoundabout('כיכר אנחנו-לא-כועסים-רק-מאוכזבים', 'הצוות אומר שאני "מגזים". הצוות יקבל כיכר משלו. בשם "כיכר הצוות-שותק".');
    setTimeout(() => wa('פרופ\' שמשון', 'יוסי מ-2019 סיים את המבחן. אני לא בוכה. זה אבק. גם בפייסבוק זה אבק.'), 2000);
    achieve('eng', 'הנדסאי בדיעבד', 'סיימת מבחן אחרי 7 שנים ושעה. הפלאפל היה שווה את זה.');
  }, async () => { if (rachel) { removeCone(rachel); rachel.path = null; hideNPC('rachel'); } P.frozen = false; teleport(E.entrance.x, E.entrance.z + 3); });
  if (rachel) { removeCone(rachel); rachel.path = null; hideNPC('rachel'); }
  checkActThree();
}

// =====================================================================
// S1 "חניה 404" — BIG
// =====================================================================
async function S1() {
  await runMission('S1', async () => {
    const L = LM.bigLot, target = L.cars.find(c => c.row === 'ג' && c.n === 3);
    target.m.material.color.set(0xc9ccd1);
    await lines([[N('orna'), 'סליחה, ראית רכב? כסוף? עם שריטה? בערך מ-2016? אני פה מ-9 בבוקר.'], ['יוסי', 'כל הרכבים פה כסופים.'], [N('orna'), 'אני יודעת! זה מה שאני אומרת לבעלי כבר 3 שעות בטלפון!']]);
    const c = await ask('יוסי', '...', ['"איפה חנית בערך?"', '"למה לא צילמת את מספר החניה?"', '"למה את לא לוקחת מונית?"']);
    await say(N('orna'), ['ליד עמוד. עם מספר. או אות. היה שם עץ. או שזה היה אדם עם כובע ירוק.', 'צילמתי! יש לי תמונה של העמוד. (מראה) ...זה הרגל שלי. צילמתי את הנעל.', 'ומי יחזיר את האוטו? הוא לבד פה. הוא רגיש. הוא מ-2016.'][c]);
    await say(N('orna'), 'קח את השלט. הוא מצפצף כשהוא קרוב. כמו בעלי כשהוא רעב.');
    toast('🔑 <b>F</b> כדי ללחוץ על השלט. ככל שהצפצוף חזק יותר – אתה קרוב יותר. או שזו משאית ברוורס.', '', 7000);
    setObjective('חניה 404', [[false, 'למצוא את הרכב של אורנה (F = שלט)']]);
    const orna = npc('orna'); orna.follow = P.pos;
    const OB = ['אולי זה הזה? לא. זה של הרופא. הוא חונה פה מאז שהביג נפתח.', 'אני זוכרת שהייתה מוזיקה ברדיו כשחניתי. אבל זה לא עוזר, נכון?', 'אם לא נמצא אותו, אני פשוט אגור פה. יש ביג. יש שירותים. יש קפה. מה עוד צריך?'];
    const bk = setInterval(() => bark(orna, pick(OB)), 9000);
    const wrong = L.cars.filter(c => c !== target && c.m.material.color.getHex() === 0xc9ccd1).slice(0, 3);
    const WR = [async () => say('גבר ישן ברכב', 'אני לא ישן. אני מחכה לאשתי. היא בפנים. מ-2022.'), async () => toast('🍉 הרכב מלא אבטיחים. אין נהג. יש פתק: "חזור בעוד שעה, תעשו מה שבא לכם".'), async () => say('אסתר', 'יוסי! הנכד של רבקה! סבתא שלך אמרה שאם אני רואה אותך – להגיד לך לאכול. תאכל.')];
    wrong.forEach((w, i) => hot('wrong' + i, { x: w.x, z: w.z, r: 3.5, label: 'לבדוק את הרכב', onE: WR[i] }));
    M.targets = [L.center];
    let found = false;
    const beep = () => { const d = Math.hypot(P.pos.x - target.x, P.pos.z - target.z), p = clamp(1 - d / 60, 0.05, 1); sfx('beep', p); toast('🔑 ' + '▮'.repeat(Math.max(1, Math.round(p * 10))) + '▯'.repeat(10 - Math.max(1, Math.round(p * 10))), '', 1200); if (d < 4) found = true; };
    const hook = () => { if (pressed.has('KeyF')) beep(); }; M.hooks.add(hook);
    try { await until(() => found); } finally { M.hooks.delete(hook); clearInterval(bk); for (let i = 0; i < 3; i++) unhot('wrong' + i); }
    orna.follow = null;
    await lines([[N('orna'), 'זה הוא! בשורה ג-3! ...שורה אחת מהכניסה. הלכתי לידו 40 פעם. לא הכרתי אותו בלי שמש.'], [N('orna'), 'יוסי, מגיע לך טרמפ. מתי שתרצה. גם לתל אביב. אני לא נוסעת לתל אביב, אבל אסיע אותך עד הכיכר.']]);
    G.perks.orna = true; toast('🎁 הטבה נפתחה: "טרמפ של אורנה" – בגמר, אורנה תקפיץ אותך מעל המחסום הראשון.', 'good', 7000);
    setTimeout(() => wa('אורנה', 'מצאתי את הרכב!!! תודה ליוסי!!! מי שרוצה, אני עכשיו בביג, הוא בשורה ג-3, תבואו להגיד שלום'), 1500);
    achieve('park', 'מצאתי חניה בביג', 'מצאת רכב כסוף בחניון של רכבים כסופים. הישג אנושי.');
  }, async () => { npc('orna').follow = null; });
  show('orna', LM.orna);
  if (G.act === 2) actTwoIntro();
}

// =====================================================================
// S2 "כומתה על 85" — Road 85
// =====================================================================
async function S2() {
  const T = LM.tremp;
  await runMission('S2', async () => {
    if (G.flags.s2intro) await say(N('noa'), 'הכומתה עדיין שם. רונן העורב שומר עליה. הוא לא עוזר. הוא רק שומר.');
    else { G.flags.s2intro = true;
    await lines([[N('noa'), 'היי. אתה נוסע לכיוון המרכז? אני מחכה לטרמפ מיום שלישי.'], ['יוסי', 'היום זה ראשון.'], [N('noa'), 'אני יודעת. יום שלישי שעבר. בהתחלה זה היה מביך. עכשיו אני פשוט גרה פה.']]);
    const c = await ask('יוסי', '...', ['"למה לא לקחת אוטובוס?"', '"לא, אני גם תקוע פה."']);
    await say(N('noa'), ['לקחתי. הוא עשה את כל הכיכרות והחזיר אותי לפה. הנהג קרא לזה "סיור מודרך".', 'ברוך הבא. יש פה ספסל, יש שקית במבה, ויש עורב אחד שאני קוראת לו רונן.'][c]);
    await card('משאית עוברת ב-90. הרוח לוקחת את הכומתה של נועה.<br>היא נוחתת בשיחים בגדר ההפרדה.'); hideCard(); sfx('whoosh');
    await say(N('noa'), 'לא לא לא! הכומתה! אם הרס"פית רואה אותי בלי כומתה – אני בשבת הזאת בבסיס. ובבאה. ובשבת של 2027.');
    const d = await ask('יוסי', '...', ['"אני אביא לך אותה."', '"את לא יכולה לקנות חדשה?"']);
    await say(N('noa'), ['באמת? אתה גיבור. או מטומטם. בכביש 85 זה אותו דבר.', 'בצבא? לקנות? אתה חושב שיש פה ביג? ...יש פה ביג. אבל לא מוכרים שם כומתות.'][d]);
    }
    boostTraffic(r => r.cls === 0 && r.pts.some(([x, z]) => Math.hypot(x - T.median.x, z - T.median.z) < 350));
    toast('⏱️ 1:30 עד שהרס"פית מתקשרת. תסתכל ימינה. ושמאלה. ושוב ימינה. זה כביש 85.', 'bad', 7000); music('tense');
    setObjective('כומתה על 85', [[false, 'להביא את הכומתה מגדר ההפרדה'], [false, 'לחזור לנועה']]);
    startTimer(90, 'הרס"פית מתקשרת בעוד', () => failMission('הרס"פית התקשרה. נועה קיבלה ריתוק. היא לא יכולה לצאת מהבסיס. היא גם לא בבסיס. זה מסובך.'));
    let got = false; item({ x: T.median.x, z: T.median.z, y: 1.2, emoji: '🪖', name: 'כומתה', onPick: () => { got = true; toast('🪖 יש כומתה! עכשיו לחזור. התנועה התגברה. כמובן.', 'good'); } });
    M.targets = [T.median];
    await until(() => got);
    setObjective('כומתה על 85', [[true, 'להביא את הכומתה'], [false, 'לחזור לנועה']]);
    await goTo(npc('noa').h.g.position, 3.5); stopTimer();
    await lines([[N('noa'), 'הבאת אותה! קח, זה רב-קו שלי. יש עליו 3.40. זה כל מה שיש לי. וגם במבה פתוחה.'], [N('noa'), 'אם אתה אי פעם נוסע – תעבור פה. אני אהיה פה. אני תמיד פה. זה כבר עניין של זהות.']]);
    toast('🎫 קיבלת: רב-קו של נועה. יתרה: 3.40 ₪. מספיק לחצי תחנה.', 'good'); G.perks.noa = true;
    setTimeout(() => wa('בוריס', 'ראיתי את יוסי חוצה את 85. פעמיים. חשבתי שזה סרט. זה לא היה סרט.'), 1500);
    achieve('penguin', 'פינגווין של 85', 'חצית את כביש 85 פעמיים ונשארת בחיים. אל תעשה את זה בבית. או בכביש.');
  }, async () => { clearItems(); teleport(T.stop.x, T.stop.z); });
  boostTraffic(null); clearItems();
  if (G.act === 2) actTwoIntro();
}

// =====================================================================
// S3 "מירוץ הכיכרות" — e-scooter race vs Boris's mobility scooter
// =====================================================================
async function S3() {
  if (!scooter.unlocked) return say(N('boris'), 'בלי קורקינט? אתה רוצה להתחרות ברגל? נגד קלנועית? יש גבול לכבוד.');
  await runMission('S3', async () => {
    if (G.flags.s3intro) await say(N('boris'), 'עוד מירוץ? טוב. אני אסע לאט יותר. לא, לא אסע. אבל תרגיש כאילו.');
    else { G.flags.s3intro = true;
    await lines([[N('boris'), 'יוסי. אתה עם קורקינט. אני עם קלנועית. אתה צעיר. אני חכם. מירוץ. עד גבעת מכוש.'], ['יוסי', 'בוריס, הקלנועית שלך נוסעת 12 קמ"ש.'], [N('boris'), '12 קמ"ש רשמית. הנכד שלי שיחק לי בצ\'יפ. עכשיו זה 13.']]);
    const c = await ask('יוסי', '...', ['"על מה אנחנו מתחרים?"', '"אני לא רוצה לנצח זקן."']);
    await say(N('boris'), ['אם אני מנצח – אתה נשאר עוד שבוע. אם אתה מנצח – אני אומר בפייסבוק שאתה בסדר. זה יותר קשה לי.', 'אתה לא תנצח זקן. אתה תנצח קלנועית. זה מכונה. אל תרחם על מכונה.'][c]);
    await say(N('boris'), 'חוק אחד: כל כיכר – סיבוב שלם. כמו בחיים. אי אפשר לקצר כיכר.');
    }
    // route: 6 roundabouts chained from here toward Makosh
    const start = { x: P.pos.x, z: P.pos.z }, fin = LM.makosh, pool = ROUNDABOUTS.filter(r => r.ir > 3 && r.r < 30), route = [];
    let cur = start;
    for (let i = 0; i < 6; i++) {
      const left = pool.filter(r => !route.includes(r) && !(r.name && route.some(q => q.name === r.name))), dirx = fin.x - cur.x, dirz = fin.z - cur.z, dl = Math.hypot(dirx, dirz);
      const next = left.map(r => ({ r, d: Math.hypot(r.x - cur.x, r.z - cur.z), prog: ((r.x - cur.x) * dirx + (r.z - cur.z) * dirz) / dl })).filter(o => o.d > 80 && o.prog > 20).sort((a, b) => a.d - b.d)[0]?.r || left[0];
      route.push(next); cur = next;
    }
    if (!P.onScooter) { toast('🛴 תעלה על הקורקינט (Q). הוא מחכה לך.'); M.targets = [scooter.pos]; await until(() => P.onScooter); }
    kalno.visible = true; const bo = npc('boris'); bo.talking = true;
    const bp = { x: P.pos.x + 3, z: P.pos.z + 3 };
    await lines([['סבתא רבקה', 'שלוש... שתיים... יוסי, אכלת?... אחת!']]);
    sfx('win'); music('chase');
    const names = route.map((r, i) => r.name || ['כיכר האבן', 'כיכר האירוסים', 'כיכר השושנים', 'כיכר המייסדים', 'כיכר החבצלת', 'כיכר ברוך'][i]);
    const RB_TOAST = [n => `🛴 ${n}: 1/6. בוריס מאחוריך. הוא שורק שיר רוסי מאיים.`, n => `🛴 ${n}: 2/6. אישה שקוראת מהמרפסת: "יוסי תאט!". זו לא סבתא. זו סבתא של מישהו.`, n => `🛴 ${n}: 3/6.`, n => `🛴 ${n}: 4/6. בוריס נעלם. זה חשוד.`, n => `🛴 ${n}: 5/6.`, n => `🛴 ${n}: 6/6! עכשיו לגבעת מכוש!`];
    // the mayor inaugurates roundabout #3 right now, with a ribbon on your lane
    const r3 = route[2], ribbon = mesh(boxG(r3.r * 2.2, 0.3, 0.1), 0xd62828, r3.x, H(r3.x, r3.z) + 1.2, r3.z + r3.r); let ribbonCut = false;
    show('mayor', { x: r3.x + r3.r + 4, z: r3.z + r3.r }); npc('mayor').pose = 'point';
    let ci = 0, ang = 0, lastA = null; const upd = () => setObjective('מירוץ הכיכרות', route.map((r, i) => [i < ci, `${names[i]} – סיבוב שלם${i === ci && G.lapPct ? ` (🔄 ${G.lapPct}%)` : ''}`]).concat([[false, 'גבעת מכוש']]));
    let updT = 0; const updHook = dt => { if ((updT -= dt) <= 0) { updT = 0.4; upd(); } }; M.hooks.add(updHook);
    upd();
    // Boris drives straight between checkpoints ("זה לא רמאות! זה ניסיון חיים!")
    const path = [...route.map(r => ({ x: r.x, z: r.z })), fin];
    let bi = 0, bpos = { ...bp }, total = 0; for (let i = 0; i < path.length; i++) total += Math.hypot(path[i].x - (i ? path[i - 1].x : bp.x), path[i].z - (i ? path[i - 1].z : bp.z));
    const bspeed = total / ((total * 1.15 + route.reduce((s, r) => s + 2 * Math.PI * r.r, 0)) / 22) * 0.92;
    let shortcut = false, won = null;
    const loop = dt => {
      if (bi < path.length) { const t = path[bi], dx = t.x - bpos.x, dz = t.z - bpos.z, d = Math.hypot(dx, dz); if (d < 2) { bi++; if (bi === 4 && !shortcut) { shortcut = true; bark(bo, 'זה לא רמאות! זה ניסיון חיים!'); } } else { bpos.x += dx / d * bspeed * dt; bpos.z += dz / d * bspeed * dt; bo.h.g.rotation.y = Math.atan2(dx, dz); } }
      bo.h.g.position.set(bpos.x, groundAt(bpos.x, bpos.z) + 0.5, bpos.z); kalno.position.set(bpos.x, groundAt(bpos.x, bpos.z), bpos.z); kalno.rotation.y = bo.h.g.rotation.y; animateHuman(bo.h, 0, 0); bo.h.legL.rotation.x = bo.h.legR.rotation.x = -1.4;
      if (bi >= path.length && won === null) won = false;
      // player laps
      if (ci < route.length) {
        const r = route[ci], dx = P.pos.x - r.x, dz = P.pos.z - r.z, d = Math.hypot(dx, dz);
        if (d < r.r + 10) { const a = Math.atan2(dz, dx); if (lastA !== null) { let da = a - lastA; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; ang += da; } lastA = a; G.lapPct = Math.min(100, Math.round(Math.abs(ang) / (Math.PI * 1.8) * 100)); if (Math.abs(ang) > Math.PI * 1.8) { G.lapPct = 0; toast(RB_TOAST[ci](names[ci]), 'good'); sfx('coin'); ci++; ang = 0; lastA = null; upd(); M.targets = [ci < route.length ? route[ci] : fin]; } }
        else { lastA = null; ang *= 0.98; }
      } else if (Math.hypot(P.pos.x - fin.x, P.pos.z - fin.z) < 10 && won === null) won = true;
      if (!ribbonCut && Math.hypot(P.pos.x - ribbon.position.x, P.pos.z - ribbon.position.z) < r3.r * 1.1 && Math.abs(P.pos.z - ribbon.position.z) < 1.5) { ribbonCut = true; P.speed *= 0.3; scene.remove(ribbon); sfx('ribbon'); toast('✂️ ראש העיר חונך את הכיכר בדיוק עכשיו. עם סרט. על הנתיב שלך.', 'bad'); bark(npc('mayor'), 'יוסי! תעצור רגע לתמונה! זה לאתר העירייה!'); }
    };
    M.hooks.add(loop); M.targets = [route[0]];
    try { await until(() => won !== null); } finally { M.hooks.delete(loop); M.hooks.delete(updHook); scene.remove(ribbon); }
    M.targets = []; kalno.visible = false; bo.talking = false; show('boris', LM.cityhall.boris); show('mayor', LM.cityhall.mayor);
    if (!won) { await card('בוריס ניצח. הוא נוסע 12 קמ"ש. אתה צריך לחשוב על החיים שלך.'); hideCard(); await say(N('boris'), 'ניצחתי. אל תבכה. גם סבא שלי ניצח אותי. בשחמט. ובמירוץ. ובריב על חניה.'); failMission('בוריס ניצח. נסה שוב – הוא מחכה ליד העירייה.'); await until(() => false); }
    await say(N('boris'), '...ניצחת. טוב. אני אכתוב בפייסבוק שאתה "בסדר". אל תבקש יותר מזה. זה מקסימום.');
    wa('בוריס', 'יוסי בסדר.'); setTimeout(() => wa('חנה מהקומה השלישית', 'בוריס מה קרה לך?? אתה חולה??'), 2500);
    G.perks.boris = true; toast('🎁 הטבה נפתחה: "בוריס פותח כיכר" – בגמר, בוריס חוסם עבורך את התנועה בכיכר אחת.', 'good', 7000);
    achieve('rbking', 'המלך של הכיכר', 'ניצחת את בוריס. הוא כתב בפייסבוק שאתה "בסדר".');
  }, async () => { kalno.visible = false; npc('boris').talking = false; show('boris', LM.cityhall.boris); teleport(LM.cityhall.boris.x + 3, LM.cityhall.boris.z + 3); });
  if (G.act === 2) actTwoIntro();
}

// =====================================================================
// Mitzi — background cameos, the chase, M7 horror
// =====================================================================
const cat = makeCat(); cat.visible = false; scene.add(cat); const catStamp = mesh(boxG(0.22, 0.18, 0.18), mat(0xd4af37, { metalness: 0.8, roughness: 0.3 }), 0, 0.72, 0.86, cat);
let catRun = null;
export function mitziRun(from, dist = 40) {
  const a = Math.random() * 6.28, x = from.x + Math.cos(a) * 6, z = from.z + Math.sin(a) * 6;
  cat.visible = true; cat.position.set(x, groundAt(x, z), z); catRun = { dir: [Math.cos(a), Math.sin(a)], t: dist / 9 }; sfx('meow');
}
export function tickCat(dt, t) {
  if (catRun) {
    catRun.t -= dt; cat.position.x += catRun.dir[0] * 9 * dt; cat.position.z += catRun.dir[1] * 9 * dt;
    cat.position.y = groundAt(cat.position.x, cat.position.z) + Math.abs(Math.sin(t * 14)) * 0.2; cat.rotation.y = Math.atan2(catRun.dir[0], catRun.dir[1]);
    if (catRun.t <= 0) { catRun = null; if (!G.flags.chase) cat.visible = false; }
  }
  // background cameos (Act 1–2): a ginger cat with something shiny, far away
  if (!G.active && (G.act === 1 || G.act === 2) && !catRun && Math.random() < dt / 70) { const a = P.yaw + (Math.random() - 0.5); mitziRun({ x: P.pos.x + Math.sin(a) * 45, z: P.pos.z + Math.cos(a) * 45 }, 60); }
}
async function mitziChase() {
  G.flags.chase = true;
  await until(near(LM.bus, 25));
  // path: bus station → around → Kikar HaIr side entrance
  const e = LM.kikar.entrance, b = LM.bus, pts = [[b.x + 6, b.z + 4], [(b.x + e.x) / 2 + 20, (b.z + e.z) / 2 - 10], [(b.x + e.x) / 2 - 10, (b.z + e.z) / 2 + 12], [e.x, e.z]];
  cat.visible = true; cat.position.set(b.x + 2, groundAt(b.x + 2, b.z), b.z); sfx('meow');
  setObjective('הקומה הנשכחת', [[false, 'לרדוף אחרי מיצי']]);
  const T = ['מיצי ברחה מתחת לאוטובוס. האוטובוס לא זז. הוא לא זז מ-2011.', 'מיצי עצרה ללקק את עצמה. היא יודעת שאתה פה. היא פשוט לא מתרשמת.'];
  let i = 0, toastI = 0;
  await new Promise(res => {
    const iv = dt => {
      const [tx, tz] = pts[i], dx = tx - cat.position.x, dz = tz - cat.position.z, d = Math.hypot(dx, dz), pd = Math.hypot(P.pos.x - cat.position.x, P.pos.z - cat.position.z);
      const sp = pd < 8 ? 11 : pd < 25 ? 6 : 0;
      if (d < 1.5) { i++; if (toastI < T.length) toast('🐈 ' + T[toastI++]); if (i >= pts.length) { M.hooks.delete(iv); res(); return; } }
      else if (sp) { cat.position.x += dx / d * sp * dt; cat.position.z += dz / d * sp * dt; cat.rotation.y = Math.atan2(dx, dz); }
      cat.position.y = groundAt(cat.position.x, cat.position.z) + (sp ? Math.abs(Math.sin(performance.now() / 70)) * 0.2 : 0);
      M.targets = [cat.position];
      if (pd < 1.2 && !G.flags.wriggle) { G.flags.wriggle = true; toast('🐈 מיצי השתחררה. היא החליקה כמו פקיד בשעה 12:55.', 'bad'); sfx('meow'); }
    };
    M.hooks.add(iv);
  });
  cat.visible = false; G.flags.chase = false; G.flags.chaseDone = true; toast('🐈 מיצי נכנסה לקניון הישן. דרך חור בגדר. כמובן. לאן עוד.', 'bad', 6000);
  M.targets = [npc('moti').h.g.position]; setObjective('הקומה הנשכחת', [[true, 'לרדוף אחרי מיצי'], [false, 'לדבר עם מוטי מהפלאפל']]);
}
async function M7() {
  await runMission('M7', async () => {
    await lines([[N('moti'), 'יוסי?! יוסי מהפלאפל של 2019?! זה אתה! עזבת מבחן בשביל הפלאפל שלי! אתה אגדה פה!'], ['יוסי', 'מוטי, אני צריך להיכנס לקניון. החתולה לקחה את החותמת של ראש העיר.'], [N('moti'), 'לקניון? יוסי... אני פה 30 שנה. אני מוכר פלאפל בכניסה. בפנים אני לא נכנס. אף אחד לא נכנס.']]);
    const c = await ask('יוסי', '...', ['"מה יש בפנים?"', '"אתה מפחד?"', '"הפלאפל ההוא היה שווה את זה."']);
    await say(N('moti'), ['פעם? הכול. שופרסל, באולינג, קולנוע, שני בנקים. היום? בובות. יונים. ועוד משהו. אל תשאל.', 'אני? אני גבר. אני פותח פה כל בוקר ב-6. אבל כשהרמקול בפנים מדבר לבד – כן. אני מפחד.', '(דמעה) ...אתה יודע כמה זמן חיכיתי שמישהו יגיד את זה? 7 שנים. קח חצי מנה. על חשבון הבית.'][c]);
    await lines([[N('moti'), 'קח פנס. קיבלתי מתנה מהבנק ב-98\'. הבנק סגר. הפנס עוד עובד. זה אומר משהו על העולם.'], [N('moti'), 'שלושה חוקים: אחד, לא מסתכלים לבובות בגב. שתיים, אם הרמקול מדבר – לא עונים. שלוש, לא הולכים לבאולינג.'], ['יוסי', 'החתולה בבאולינג, נכון?'], [N('moti'), '...תביא לי משהו מהבאולינג. יש לי שם נעליים מ-94\'. מידה 43. בלי לחץ.']]);
    setObjective('הקומה הנשכחת', [[false, 'להיכנס לקניון הישן']]);
    await goTo(LM.kikar.entrance, 3.5);
    if (P.onScooter) { const { dismount } = await import('./player.js'); dismount(); }
    await cards(['שלט על הדלת: "מבנה מסוכן. הכניסה אסורה."<br>מתחת, בטוש: "חוץ מחתולים".', '<small>זה משחק. בחיים האמיתיים: מבנה מסוכן = לא נכנסים.<br>גם לא בשביל חתול. גם לא בשביל חותמת.</small>']);
    fade(true); await sleep(700); traffic.enabled = false;
    const done = enterMall();
    while (horror.active) {   // the E press is read inside the per-frame check (pressed is cleared at frame end)
      let go = false;
      await until(() => !horror.active || (nearNest() && pressed.has('KeyE') && (go = true)));
      if (go) await takeStamp();
    }
    await done; traffic.enabled = true;
    teleport(LM.kikar.entrance.x + (LM.kikar.wp.nx * 3), LM.kikar.entrance.z + (LM.kikar.wp.nz * 3), LM.kikar.wp.rot);
    fade(false); sfx('sting');
    await say(N('moti'), 'יצאת! חי! עם החותמת! ...ומה עם הנעליים שלי?');
    if (horror.flags.shoes) { await lines([['יוסי', 'הנה. מידה 43.'], [N('moti'), '(מחבק את הנעליים) חשבתי שלא אראה אתכן יותר. תודה, יוסי. חצי מנה חינם. לנצח.']]); achieve('shoes', 'נעליים של מוטי', 'החזרת למוטי את נעלי הבאולינג מ-94\'. הוא בכה. לתוך הפלאפל.'); }
    else await lines([['יוסי', 'היה שם... כיכרון.'], [N('moti'), '(מחוויר) כיכרון עוד שם? הוא היה עובד החודש של 92\'. וגם של 93\'. הוא פשוט לא הלך הביתה.']]);
    show('savta', LM.savtaChair, LM.kikar.wp.rot);
    await lines([[N('savta'), '(יושבת על כיסא פלסטיק ליד הדוכן) יוסי. אכלת?'], ['יוסי', 'סבתא?! מה את עושה פה?!'], [N('savta'), 'באתי לקנות פלאפל. אני קונה פה מ-92\'. אתה חושב שאני מפחדת מבובה? אני הייתי בחתונה של שרית ואבי.']]);
    toast('יש לך חותמת. יש לך תואר. יש לך שלושה תנאים. אין לך יותר תירוצים.', '', 6000);
    openRoundabout('כיכר תל-אביב-אין-בה-אפילו-עציץ', 'אין לנו יותר שמות. ציפי מציעה "כיכר 185". זה לא שם, ציפי. זה ייאוש.');
    setTimeout(() => wa('מוטי', 'יוסי יצא מהקניון עם חותמת וחתולה. אני פתוח עד 4. פלאפל במחיר של 2019 למי שבא להגיד שלום.'), 2000);
    achieve('lastvisit', 'ביקור אחרון בכיכר', 'נכנסת לקניון הישן ויצאת. עם חותמת. ועם טראומה חמודה.');
    setTimeout(() => hideNPC('savta'), 6000);
  });
  G.act = 4; save(); refreshBlips();
  setObjective('הדרך החוצה', [[false, 'להביא את החותמת לראש העיר']]); M.targets = [npc('mayor').h.g.position];
}

// =====================================================================
// M8 "הדרך החוצה" — finale
// =====================================================================
const blocks = [];
function buildRoadblocks() {
  for (const b of blocks) for (const o of b.objs) scene.remove(o); blocks.length = 0;
  const a = LM.cityhall.door, s = LM.gate;
  const kinds = ['truck', 'dance', 'ceremony', 'bus'];
  kinds.forEach((k, i) => {
    const f = 0.22 + i * 0.19, x = a.x + (s.x - a.x) * f, z = a.z + (s.z - a.z) * f, r = nearestRoad(x, z, q => q.cls <= 3), objs = [], y = H(r.x, r.z), rot = Math.atan2(-r.tz, r.tx);
    const perp = { x: -r.tz, z: r.tx }, cols = [];
    const put = (m, px, pz) => { m.position.set(px, H(px, pz), pz); scene.add(m); objs.push(m); };
    if (k === 'truck') { const g = new THREE.Group(); mesh(boxG(5.5, 2.8, 2.3), 0xffffff, 0, 1.8, 0, g); mesh(boxG(1.8, 1.8, 2.2), 0xf6a01a, 3.4, 1.3, 0, g); g.rotation.y = rot; put(g, r.x, r.z); cols.push(addBoxCollider(r.x, r.z, 5.5, 2.3, rot)); }
    if (k === 'bus') { const g = new THREE.Group(); mesh(boxG(11, 3, 2.6), 0x3b9a57, 0, 1.9, 0, g); g.rotation.y = rot; put(g, r.x, r.z); cols.push(addBoxCollider(r.x, r.z, 11, 2.6, rot)); }
    if (k === 'dance' || k === 'ceremony') for (let j = -3; j <= 3; j++) { const h = makeHuman({ shirt: k === 'dance' ? [0xff4d8d, 0x4fc3f7, 0xffd166][(j + 3) % 3] : 0x2b2f3a, pants: 0x222222, hair: 0x2a1a10 }); const px = r.x + perp.x * j * 1.6, pz = r.z + perp.z * j * 1.6; put(h.g, px, pz); h.g.userData.dance = k === 'dance'; cols.push(addBoxCollider(px, pz, 1, 1)); objs.push(h.g); h.g.userData.h = h; }
    blocks.push({ k, x: r.x, z: r.z, objs, cols, done: false });
  });
}
function clearBlock(b) { for (const o of b.objs) scene.remove(o); for (const c of b.cols) { c.x0 = c.x1 = c.z0 = c.z1 = -1e9; } b.cleared = true; }
export function tickBlocks(t) { for (const b of blocks) for (const o of b.objs) if (o.userData.dance) { const h = o.userData.h; h.armL.rotation.z = -2.4 - Math.sin(t * 6) * 0.4; h.armR.rotation.z = 2.4 + Math.sin(t * 6) * 0.4; } }
async function M8() {
  await runMission('M8', async () => {
    if (!G.flags.m8signed) {
    await lines([['ראש העיר', 'יוסי. מצאת את החותמת. בתוך הקניון הישן. אתה יודע כמה אמיצים יש בעיר הזאת? אתה, מוטי, ומיצי.'], ['ראש העיר', 'עשית את שלושת התנאים. האכלת, רקדת, סיימת. אתה יודע מה זה אומר?'], ['יוסי', 'שאתה חותם?'], ['ראש העיר', 'שאתה התושב הכי כרמיאלי שיש. ואני חותם. (חותם) ...חתמתי. זה כואב כמו לסגור כיכר.']]);
    sfx('stamp');
    const c = await ask('יוסי', '...', ['"תודה, ראש העיר. באמת."', '"אפשר את המספריים הגדולות למזכרת?"', '"למה אכפת לך כל כך מכל תושב?"']);
    await say('ראש העיר', ['אל תודה. תחזור. ביקור. חתונה. ברית. פסטיבל. כיכר חדשה. תמיד יש סיבה.', 'את המספריים? יוסי... אני אתן לך את החצי שמיצי החזירה. את החצי השני אני צריך. יש לי כיכר ביום שלישי.', 'כי עיר זה לא בניינים וכיכרות. טוב, גם כיכרות. בעיקר כיכרות. אבל גם אנשים. בערך חצי-חצי.'][c]);
    await say('ראש העיר', 'ועכשיו – רגע אחד. יש לי הפתעה בחוץ.');
    await card('מחוץ לעירייה: כיכר חדשה. עם עציץ.<br>ושלט: "כיכר יוסי – כי אי אפשר לצאת מכיכר, רק להמשיך בה".'); hideCard();
    await lines([['ראש העיר', '(גוזר סרט) אני מכריז על כיכר יוסי פתוחה! ...הרכבת שלך יוצאת עוד שלוש וחצי דקות, דרך אגב.'], ['יוסי', 'מה?!'], ['ראש העיר', 'טקס זה טקס, יוסי. סע! סע!']]);
    G.rb++; setCounter(G.rb); toast(`✂️ ראש העיר חנך כיכר חדשה: כיכר יוסי. כיכרות: ${G.rb}. זמן לרכבת: 3:30. Waze: שעה ו-45.`, 'good', 7000);
    G.flags.m8signed = true;
    }
    buildRoadblocks();
    if (scooter.unlocked && !P.onScooter) placeScooter(P.pos.x + 2, P.pos.z + 2, P.yaw);
    music('chase'); startTimer(210, 'הרכבת יוצאת בעוד', () => failMission('הרכבת יצאה. איציק נופף בטופס שלך. הבאה בעוד 30 דקות. או בעוד 3:30 אם תנסה שוב.'));
    setObjective('הדרך החוצה', [[false, 'להגיע לרכבת לפני שהיא יוצאת']]); M.targets = [LM.gate];
    const seenB = new Set();
    await until(() => {
      for (const b of blocks) {
        if (seenB.has(b)) continue; const d = Math.hypot(P.pos.x - b.x, P.pos.z - b.z); if (d > 45) continue; seenB.add(b);
        if (b.k === 'truck') { if (G.perks.orna) { clearBlock(b); toast('🚗 אורנה: "יוסי! תקפוץ! אני מקפיצה אותך עד הכיכר הבאה! ...אני לא זוכרת איפה חניתי, אבל נוסעים!"', 'good', 6000); } else toast('🚚 משאית המאפייה בכיכר. סיבוב 34. הוא לא יוצא. אתה עוקף.'); }
        if (b.k === 'dance') toast('💃 גלית: "פלאש-מוב! ...זה לא נגדך, יוסי! זה בשבילך! זה פשוט באמצע הכביש!"');
        if (b.k === 'ceremony') { if (G.perks.boris) { clearBlock(b); toast('🦽 בוריס (עוצר את התנועה עם הקלנועית): "עבור! אני אעמוד פה! אני עומד טוב! זה מה שאני עושה הכי טוב!"', 'good', 6000); } else toast('✂️ טקס חנוכת כיכר. 40 אנשים. שני נאומים. תמצא דרך אחרת.'); }
        if (b.k === 'bus') toast('🚌 שלמה: "יוסי! אני לא חוסם! אני עוצר בתחנה! התחנה פשוט באמצע הנתיב שלך. מאז 2004."');
        if (G.perks.noa && b.k === 'dance') { clearBlock(b); toast('📻 נועה בקשר: "כולם דום!" – הרקדנים קפאו. גלית מתעצבנת. הכביש פנוי.', 'good', 6000); }
      }
      return near(LM.gate, 6)();
    });
    stopTimer(); for (const b of blocks) clearBlock(b);
    if (P.onScooter) { const { dismount } = await import('./player.js'); dismount(); }
    await lines([[N('itzik'), 'טופס 17-כ. חתום. עם חותמת... (מריח) של חתולה. ...תקין. עבור.'], [N('itzik'), '(בשקט) אני לא האמנתי שתביא אותו. תשמע, תחזור לבקר. מאז שאתה פה – יש לי על מה לדבר עם אמא שלי.']]);
    await cards(['על הרציף: כולם.<br>דודו עם בגט. גלית עם הרקדניות. פרופ\' שמשון עם מטפחת. בוריס עם לוח שחמט. מוטי עם נעליים.', 'וסבתא.<br>עם עגלה. עם קופסה. עומדת בדיוק מול דלת הקרון.']);
    show('savta', LM.platform);
    await lines([[N('savta'), 'יוסי. אכלת?'], ['יוסי', 'סבתא...'], [N('savta'), 'אני לא אעצור אותך. באמת. הבאתי לך שלוש קופסאות. אחת לנסיעה, אחת לשבוע, ואחת לכשתתגעגע.']]);
    const s = await ask('יוסי', '...', ['"סבתא, אני אבוא כל שישי."', '"אולי אני לא צריך ללכת."', '"למה את לא כועסת?"']);
    await say(N('savta'), ['כל שישי. הקלטתי. יש לי את האפליקציה של הנכד של אסתר, זוכר?', 'לא. אתה צריך. לך תראה. ואז תדע. ככה עשיתי כשהגעתי לפה ב-1970. חשבתי שזה לשנה.', 'כי סבתא לא כועסת. סבתא מאכילה. זה כמו לכעוס, רק עם רוטב.'][s]);
    await say(N('savta'), 'לך, מותק. ותסתכל בחלון. כרמיאל הכי יפה מהחלון של הרכבת. בעיקר כשהיא נגמרת. סתם. לך.');
    hideNPC('savta');
    await ending();
  }, async () => { teleport(LM.cityhall.mayor.x + 2, LM.cityhall.mayor.z + 2); if (scooter.unlocked) placeScooter(P.pos.x + 2, P.pos.z, P.yaw); });
  if (G.done.has('END')) freePlay();   // runMission clears the objective on its way out
}
function freePlay() {
  setObjective('משחק חופשי', [[false, `לבקר בכל ${ROUNDABOUTS.length} הכיכרות על המפה (בהצלחה)`], [G.done.has('S1') && G.done.has('S2') && G.done.has('S3'), 'כל משימות הצד'], [false, 'לדבר עם כל פיצרייה במדרחוב'], [false, 'למצוא את 30 האוצרות של מיצי']]);
}

// =====================================================================
// ENDING
// =====================================================================
export const cutscene = { train: null };
async function ending() {
  G.stage = 'ending'; P.frozen = true; const pl = (await import('./player.js')).player; pl.g.visible = false;
  // the train leaves along the real rails toward Haifa
  const T = LM.train, line = T.line; let i = T.i, t = T.t, v = 0, time = 0;
  traffic.enabled = true; music('sad');
  await new Promise(res => {
    cutscene.train = dt => {
      time += dt; v = Math.min(v + dt * 4, 40);
      let d = v * dt * T.dir;
      while (d !== 0) { const a = line[i], b = line[i + 1]; if (!b || !a) { d = 0; break; } const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01; t += d / L; if (t > 1) { d = (t - 1) * L; t = 0; i++; } else if (t < 0) { d = t * L; t = 1; i--; } else d = 0; if (i < 0 || i >= line.length - 1) { d = 0; i = Math.max(0, Math.min(line.length - 2, i)); } }
      const a = line[i], b = line[i + 1] || a, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      T.g.position.set(x, H(x, z) + 0.4, z); T.g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      camera.position.set(x + 35 - time * 2, H(x, z) + 14, z + 35); camera.lookAt(x, H(x, z) + 2, z);
      if (time > 8) { cutscene.train = null; res(); }
    };
  });
  fade(true); await sleep(900);
  await cards(['הרכבת יוצאת. יוסי מסתכל בחלון.<br>הכרמל ירוק. הכיכרות מתרחקות. הר כמון מנופף.<br><small>(הר לא יכול לנופף. אבל הרגיש ככה.)</small>', 'Waze: שעה ו-45.<br>אתה ברכבת. Waze לא יודע את זה. Waze רוצה שתחזור.', '<h2>תל אביב</h2><b>יום 1.</b> דירה: 7,800 ₪. חדר אחד. חלון לקיר.<br>הקיר יפה, אגב. יש עליו גרפיטי של לווייתן.', '<b>יום 3.</b> קפה: 48 ₪.<br>בוריס צדק. בוריס תמיד צודק. זה הכי מעצבן בבוריס.', '<b>יום 7.</b> חניה: אין. חיפשת 20 דקות.<br>אחרי שבוע גילית שאין לך רכב. זה לא עזר.', '<b>יום 9.</b> בפלורנטין: חתולה ג\'ינג\'ית. עם משהו נוצץ בפה. היא מסתכלת עליך.<br><b>היא לא מתנצלת.</b> גם לא שם.', '<b>יום 12.</b> השכנים לא יודעים איך קוראים לך.<br>אף אחד לא שאל אם אכלת. אכלת קרואסון ב-36 ₪. בכית עליו קצת.', '<b>יום 15.</b> הזמנת שניצל בבגט.<br>הגיע "שניצל פריך על בריוש, איולי כמהין". 89 ₪. חצי. עם עלה.', '<b>יום 15, ערב.</b> ליאור המבקר פרסם ביקורת:<br>"הבגט הכי טוב בארץ. בכרמיאל. אני לא חוזר."<br>הוא לא חזר.']);
  const PQ = [['כמה עולה כוס מים בבר בפלורנטין?', ['חינם', '5 ₪', '48 ₪'], 'טעות. 48 זה למים עם "נגיעות של לימון". מים רגילים זה 52. כי זה "רגיל".'], ['כמה זמן מחכים לשולחן בבראנץ\' בשבת?', ['10 דקות', 'שעה', 'שנה'], 'טעות. אין שולחן. יש "בר קטן בחוץ". הבר הוא אדן חלון. של שכן.'], ['כמה עולה חניה בשעה?', ['10 ₪', '30 ₪', 'הכליה השמאלית'], 'טעות. זה הכליה הימנית. השמאלית זה לשעה נוספת.']];
  for (const [q, a, r] of PQ) { await ask('חידון מחירים · תל אביב', q, a); sfx('fail'); await say('חידון מחירים · תל אביב', r); }
  await card('<b>יום 16.</b> הטלפון רוטט.<br>312 התראות חדשות: "כרמיאלים מדברים"'); hideCard();
  for (const [s, m] of [['בוריס', 'יוסי, בכרמיאל עגבניות ב-3.90. אני לא אומר כלום. אני רק אומר.'], ['ראש העיר', 'פתחנו כיכר חדשה. יש בה ספסל. הספסל ריק. סתם, רציתי שתדע.'], ['סבתא רבקה', 'יוסי תתקשר לסבתא'], ['נועה', 'עדיין פה. 85. כבר לא בטוחה שיש צבא.']]) { wa(s, m); await sleep(1600); }
  await card('יוסי מסתכל על הקיר עם הלווייתן.<br>הלווייתן מסתכל עליו בחזרה.<br><b>גם הלווייתן רוצה הביתה.</b>'); hideCard();
  const e = await ask('יוסי', '...', ['להישאר בתל אביב', 'לחזור הביתה']);
  if (e === 0) {
    await cards(['יוסי נשאר בתל אביב. הוא עובד בסטארט-אפ שמפתח אפליקציה למציאת חניה.<br>היא לא מוצאת חניה.', 'הוא משלם 7,800 ₪ על דירה עם חלון לקיר.<br>אחרי שנה הוא ביקש לקיר שיהיה חלון. בעל הבית העלה ב-400.', 'בכל שישי הוא מתקשר לסבתא. היא עונה: "אכלת?".<br>הוא משקר. היא יודעת.', '<h2>סוף.</h2>(לא באמת. כרמיאל עדיין מחכה. היא תמיד מחכה.<br>יש לה זמן. יש לה 186 כיכרות.)']);
    return ending2(false);
  }
  await cards(['יוסי עולה על הרכבת. לכיוון השני.<br>Waze: שעה ו-45. <b>בפעם הראשונה – זה נכון.</b>', 'תחנת כרמיאל. הדלתות נפתחות.<br>איציק ליד השער. הוא לא אומר כלום.<br>הוא רק מחזיק שלט: "טופס 17-כ – בוטל".']);
  const T2 = LM.train; T2.g.position.set(T2.line[T2.i][0], H(T2.line[T2.i][0], T2.line[T2.i][1]) + 0.4, T2.line[T2.i][1]); T2.g.rotation.y = T2.rot;
  pl.g.visible = true; P.frozen = false; teleport(LM.gate.x, LM.gate.z, LM.stationFace); fade(false); G.stage = 'play'; music('roam');
  await say(N('itzik'), 'תיק לבדיקה. ...אין שניצל? אתה חוזר בלי שניצל? טוב. ברוך הבא בכל זאת.');
  await card('בחוץ: ראש העיר. עם מספריים.<br>ועם כיכר חדשה ממש מול התחנה.'); hideCard();
  show('mayor', { x: LM.gate.x + 4, z: LM.gate.z + 3 });
  await say('ראש העיר', 'אני מכריז על כיכר השב – פתוחה! יוסי, תגזור אתה. בזהירות. הן כבדות. אחרי 186 כיכרות, אני כבר לא מרגיש את היד.');
  const r = await ask('יוסי', '...', ['(גוזר את הסרט)', '"חזרתי רק לביקור."']);
  if (r === 0) { sfx('ribbon'); G.rb++; setCounter(G.rb); await say('ראש העיר', `${G.rb}! (מוחה דמעה) סליחה. זה לא בגללך. זה הכיכר. כל כיכר מרגשת אותי.`); }
  else await say('ראש העיר', 'בטח, בטח. ביקור. (לציפי בשקט) תוציאי לו תעודת תושב חוזר. ותעשי בכיכר ספסל.');
  show('savta', { x: LM.gate.x - 3, z: LM.gate.z + 3 });
  await lines([[N('savta'), '(עם עגלה, כאילו חיכתה פה 16 יום. היא חיכתה פה 16 יום) יוסי. אכלת?'], ['יוסי', 'לא, סבתא. לא אכלתי.'], [N('savta'), '(פעם ראשונה במשחק: מחייכת) סוף סוף אמרת את האמת.']]);
  await ending2(true);
}
async function ending2(trueEnd) {
  const pl = (await import('./player.js')).player;
  if (trueEnd) {
    await card('<h1>כרמיאל: הדרך פנימה.</h1>כי מכל כיכר אפשר לצאת.<br>אבל כולן מובילות הביתה.', { big: true }); hideCard();
    achieve('home', 'הדרך פנימה', 'חזרת הביתה. העיר חנכה כיכר לכבודך. שוב.');
    if (G.done.has('S1') && G.done.has('S2') && G.done.has('S3')) {
      await cards(['באותו ערב, באמפי: מסיבה. גלית רוקדת.<br>בוריס מנצח בשחמט את מיצי. מיצי מתלוננת בפייסבוק.', 'אורנה מצאה את הרכב שוב.<br>בפעם הראשונה – בפעם הראשונה.', 'ונועה? נועה עלתה על הרכבת שיוסי ירד ממנה. אחרי 21 יום.<br>לא לטרמפ. לתל אביב. "לראות".']);
      wa('נועה', 'אני בתל אביב. קפה 48. חוזרת מחר. תשמרו לי את הספסל ב-85.'); achieve('allhome', 'כולם הביתה', 'סיימת את כל המשימות הצדדיות. כרמיאל מודה לך. בפייסבוק.');
    }
  }
  await credits();
  G.done.add('END'); save(); G.stage = 'play'; P.frozen = false; pl.g.visible = true; fade(false);
  if (!trueEnd) teleport(LM.gate.x, LM.gate.z, LM.stationFace);
  toast('💾 המשחק נשמר. אתה בכרמיאל. חופשי להסתובב. (בכיכרות. הרבה כיכרות.)', 'good', 8000);
  freePlay(); refreshBlips();
}
async function credits() {
  const secs = Math.round((performance.now() - G.t0) / 1000);
  const lines = ['עיצוב כיכרות: עיריית כרמיאל (בלי ידיעתה)', 'קבוצת פייסבוק: 214 חברים, 3 פעילים, סבתא אחת', 'תזונה: סבתא רבקה', 'פסיכולוגיה של בובות: אופנת כיכר 92', 'יועץ חניה: אורנה (עדיין מחפשת)', 'יועץ שחמט ותפיסת עולם: בוריס', 'חתולה: מיצי (לא חתמה על חוזה. גנבה את העט.)', 'אף עגבנייה לא נפגעה בהפקת המשחק. בוריס מבקש לציין שאחת נגנבה.', 'תודה מיוחדת: השניצליה, על הבגט שהחזיק את הצוות בחיים.', 'תודה לאמפי פארק הגליל, לפסטיבל, ולכל מי שרקד פעם ברגל הלא נכונה.', 'כל הדמויות, השמות והאירועים במשחק בדיוניים. כל דמיון למציאות מקרי בלבד. הכיכרות – אמיתיות מדי.', 'מפה: OpenStreetMap · גבהים: SRTM', 'זמן הגעה משוער לסוף הקרדיטים: שעה ו-45.'];
  await card(`<div class="credits"><h1>כרמיאל: הדרך החוצה</h1>${lines.map(l => `<p>${l}</p>`).join('')}<div class="stats">⏱ ${Math.floor(secs / 60)} דק' ${secs % 60} שנ' · 🚗 נדרסת ${G.hits} פעמים · 🏆 ${Object.keys((await import('./ui.js')).achievements).length} הישגים</div><h2>כיכרות: ${G.rb}/180</h2><small>ראש העיר מבקש לעדכן את השלט.</small></div>`, { big: true });
  await card('🌙 מוטי סוגר את הדוכן בלילה.<br>הוא תולה את התחפושת הריקה של כיכרון על וו.<br>האורות כבים.<br><br>התחפושת מנופפת.<br><br><b>"הקניון תמיד פתוח. בשבילך."</b>');
  hideCard();
}

// =====================================================================
// continue from save
// =====================================================================
export async function continueGame(s) {
  setName(s.name || 'יוסי', s.gender || 'm');
  G.stage = 'play'; G.t0 = performance.now(); G.done = new Set(s.done); G.perks = s.perks || {}; G.rb = s.rb || 180; G.hits = s.hits || 0; G.flags = s.flags || {};
  setCounter(G.rb);
  const d = id => G.done.has(id);
  G.act = d('M7') ? 4 : d('M4') && d('M5') && d('M6') ? 3 : d('M3') ? 2 : 1;
  if (d('M2')) placeScooter(LM.home.x + 2, LM.home.z + 2, LM.home.face);   // Itzik hands it over in M2, not M3
  teleport(LM.home.x, LM.home.z, LM.home.face);
  if (d('END')) { setupGivers(); refreshBlips(); freePlay(); return; }
  if (!d('M1')) return newGame();
  if (!d('M2')) return M2();
  if (!d('M3')) return M3();
  setupGivers(); refreshBlips();
  if (G.act === 2) actTwoIntro();
  if (G.act === 3) {
    if (G.flags.chaseDone) { setObjective('הקומה הנשכחת', [[true, 'לרדוף אחרי מיצי'], [false, 'לדבר עם מוטי מהפלאפל']]); M.targets = [npc('moti').h.g.position]; }   // the chase already happened — don't run it twice
    else { G.act = 2; checkActThree(); }
  }
  if (G.act === 4) { setObjective('הדרך החוצה', [[false, 'להביא את החותמת לראש העיר']]); M.targets = [npc('mayor').h.g.position]; }
  toast('👵 סבתא שמרה לך. ברוך השב.', 'good');
}
