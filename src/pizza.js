// מדרחוב כרמיאל (sderot KKL pedestrian mall, where HaSchnitzelia is): paving, trees, benches, string lights —
// and a war of far too many pizzerias with far too many opinions.
import { THREE, scene, mat, mesh, boxG, cylG, canvasTex, sign, pick } from './core.js';
import { H, addTree, addInst, groundExtra } from './world.js';
import { LM, storefront, bench, umbrellaTable, nearestBuilding, wallPoint } from './landmarks.js';
import { addNPC, bark, npc } from './npc.js';
import { say, toast, wa, achieve } from './ui.js';

// real line of the midrachov (OSM shop nodes: פיצה רימיני in the south → פיצה רשב"י in the north), same projection as data.js
const S = 0.7, MX = Math.cos(32.914 * Math.PI / 180) * 111320 * S, MZ = 110900 * S;
const geo = (lat, lon) => ({ x: (lon - 35.2985) * MX, z: -(lat - 32.914) * MZ });
const A = geo(32.90862, 35.29282), B = geo(32.91030, 35.29282);
const LEN = Math.hypot(B.x - A.x, B.z - A.z), DX = (B.x - A.x) / LEN, DZ = (B.z - A.z) / LEN, NX = -DZ, NZ = DX;
const at = (t, side = 0) => ({ x: A.x + DX * t * LEN + NX * side, z: A.z + DZ * t * LEN + NZ * side });
export const MIDRACHOV = { center: at(0.5), len: LEN };
// the paving below is laid 0.5 above the terrain — walk on it, not in it
groundExtra.push((x, z) => { const t = ((x - A.x) * DX + (z - A.z) * DZ) / LEN, s = (x - A.x) * NX + (z - A.z) * NZ; return t > 0 && t < 1 && Math.abs(s) < 11 ? H(x, z) + 0.5 : -Infinity; });

// ---------------------------------------------------------------- paving (warm stone tiles with a red-brick band)
{
  const tex = canvasTex(128, 128, x => {
    x.fillStyle = '#d8c7a6'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 32) for (let j = 0; j < 128; j += 16) { x.fillStyle = (i + j) % 64 ? '#cdb994' : '#e2d3b5'; x.fillRect(i + (j % 32 ? 16 : 0) % 128, j, 30, 14); }
    x.fillStyle = '#a0522d'; x.fillRect(58, 0, 12, 128);
  });
  tex.repeat.set(1, 1);
  const W = 22, n = Math.ceil(LEN / 3), pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const s of [-1, 1]) { const p = at(t, s * W / 2); pos.push(p.x, H(p.x, p.z) + 0.5, p.z); uv.push((s + 1) / 2, t * LEN / W); }
    if (i) { const q = (i - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 })); m.receiveShadow = true; scene.add(m);
}
// planters with trees, benches, lamps down the middle + string lights between lamp rows
for (let t = 0.06; t < 0.97; t += 0.085) {
  for (const s of [-1, 1]) {
    const p = at(t, s * 5.5), y = H(p.x, p.z);
    const pl = mesh(boxG(2.2, 0.7, 2.2), 0xb8a07a, p.x, y + 0.35, p.z); pl.rotation.y = Math.atan2(DX, DZ);
    addTree(Math.random() < 0.5 ? 'olive' : 'palm', p.x, p.z, 0.8);
    const b = at(t + 0.04, s * 5.5); bench(b.x, b.z, Math.atan2(NX * -s, NZ * -s));
    const l = at(t + 0.02, s * 8.5); addInst('lamp', l.x, H(l.x, l.z), l.z, Math.atan2(-NX * s, -NZ * s), 1);
  }
}
{
  const bulbs = [0xffd166, 0xff6b6b, 0x7ee787, 0x4fc3f7];
  for (let t = 0.05; t < 0.97; t += 0.03) for (const s of [-1, 1]) { const p = at(t, s * 7), c = bulbs[Math.floor(t * 100) % 4]; mesh(new THREE.SphereGeometry(0.14, 6, 4), mat(c, { emissive: c, emissiveIntensity: 1.2 }), p.x, H(p.x, p.z) + 5.4 + Math.sin(t * 60) * 0.25, p.z).castShadow = false; }
}
// street sign at the south entrance
{ const p = at(0.02, 9); sign(p.x, H(p.x, p.z), p.z, 5.5, 1.3, ['המדרחוב · שד׳ קק״ל', 'פיצה? כן.'], { bg: '#2d6a4f', posts: 1.8, rot: Math.atan2(-DX, -DZ) }); }

// ---------------------------------------------------------------- the pizzerias
const PIZZA = [
  { name: 'פיצה כיכר', col: '#e63946', owner: 'שלום', lines: ['אצלנו כל משולש עושה סיבוב בקופסה לפני שהוא יוצא. זה לא באג. זה כרמיאל.', 'רוצה אקסטרה גבינה? אין בעיה. רק תיכנס מהצד הנכון של הכיכר.', 'ראש העיר ניסה לחנוך את התנור שלנו. בטעות גזר את הכבל.'] },
  { name: 'פיצה שעה ו-45', col: '#33ccff', owner: 'Waze-י', lines: ['זמן משלוח: שעה ו-45. גם אם אתה עומד ליד הדלפק. במיוחד אם אתה עומד ליד הדלפק.', 'שאלת כמה זמן לוקח? שעה ו-45. שאלת שוב? עכשיו שעתיים.', 'יש לנו גם אקספרס. שעה ו-44.'] },
  { name: 'פיצה אכלת?', col: '#ff8fab', owner: 'רבקה (לא סבתא שלך. או שכן)', lines: ['אכלת? לא משנה. הנה משולש. ועוד אחד. ואחד לדרך.', 'אצלנו אין "אני שבע". יש "עוד משולש קטן".', 'המגש המשפחתי שלנו בא עם טאפרוור. אי אפשר להחזיר אותו. אף פעם.'] },
  { name: 'פיצה טופס 17-כ', col: '#1d3557', owner: 'איציק ג׳וניור', lines: ['להזמנה יש למלא טופס. הטופס עולה 48 ₪. הפיצה חינם. אתה עדיין מפסיד.', 'צריך חתימה של שכן לתוספת זיתים. זה נוהל.', 'בדקתי את הפיצה ביטחונית. חסרים שני משולשים. חשוד.'] },
  { name: 'פיצה בזמני', col: '#6b705c', owner: 'אברהם, חבר של עדי', lines: ['פיצה משפחתית עם זית אחד. בזמני זה הספיק לשבע נפשות.', 'בזמני המשלוח הגיע ברגל. עם השליח. ועם אבא שלו.', 'עדי אלדר אוכל פה כל יום שלישי. הוא אומר שהפיצה של קונינסקי עם עציץ.'] },
  { name: 'פיצה ח׳', col: '#f4a261', owner: 'מאיר מהחתים', lines: ['המגש שלנו בצורת ח׳. המשולש האמצעי חסר. יש שם מעבר להולכי רגל.', 'לקוחות מהחתים מקבלים הנחה. הם גם מקבלים את המגש מהקומה ה-11. בחבל.', 'ניסינו לעשות פיצה בצורת כ׳. יצאה עגולה. כמו כל דבר פה.'] },
  { name: 'פיצה מיצי', col: '#ffb703', owner: 'דנה', lines: ['כל מגש מגיע בלי משולש אחד. אנחנו לא יודעים לאן הוא נעלם. יש לנו חשד ג׳ינג׳י.', 'שמנו מצלמה. ראינו זנב. אחרי זה המצלמה נעלמה.', 'המשולש החסר זה מתכון סודי. גם לנו הוא סוד.'] },
  { name: 'פיצה 48 ₪', col: '#264653', owner: 'ליאור מתל אביב (בחופש)', lines: ['פיצה תל אביבית: חצי מגש, עלה אחד, 48 ₪. בלי גבינה, כי "גבינה זה סטייטמנט".', 'הזמנת חריף? זה עוד 12 ₪. ובקבוק מים עם "נגיעות של לימון" – 52.', 'פה בכרמיאל אף אחד לא קונה אצלי. אז אני אוכל בשניצליה. אל תספר.'] },
  { name: 'פיצה 1992', col: '#8e2de2', owner: 'כיכרון (בפנסיה)', lines: ['המבצע מ-1992 עדיין בתוקף: 3 פיצות ב-10. גם המגש מ-1992.', 'ברוכים הבאים!!! יש חניה חינם!!! ...סליחה, הרגל ישן מהקניון הישן.', 'אל תצא מהפיצריה!!! אי אפשר לצאת מפיצריה!!! ...טוב, אפשר. אבל למה?'] },
  { name: 'פיצה 85 אקספרס', col: '#e76f51', owner: 'נועם', lines: ['השליח שלנו חוצה את כביש 85 ברגל. הפיצה תמיד מגיעה. השליח – בערך.', 'הזמנה לטרמפיאדה? נועה כבר הזמינה. מיום שלישי.', 'משלוח חינם לכל מי שגר בצד הנכון של 85. כלומר, אף אחד.'] },
  { name: 'פיצה ביג פרקינג', col: '#d62828', owner: 'אורנה (משמרת לילה)', lines: ['המשלוח מחכה לך בחניון ביג. שורה ג׳. אולי ד׳. הוא כסוף.', 'הזמנת פיצה? תזכור איפה חנית. אנחנו לא נזכור.', 'יש לנו גם פיצה אישית. שכחנו איפה שמנו אותה.'] },
  { name: 'פיצה הנדסית', col: '#0b4ea2', owner: 'סטודנט מבראודה', lines: ['משולשים שווי שוקיים, מחושבים עד המילימטר. עם שארית של 0.3 משולש.', 'פרופ׳ שמשון הזמין פיצה ב-2019. עדיין מחכה לציון.', 'כל מגש עובר בדיקת עומסים. בוריס עמד עליה. היא החזיקה.'] },
  { name: 'פיצה מט', col: '#2b2d31', owner: 'בוריס (ניהול בלבד)', lines: ['מט בשלושה משולשים. אתה אכלת את הראשון – טעות קלאסית.', 'בתל אביב פיצה 48 שקל. אני לא הייתי. אבל אני יודע.', 'פיצה זה כמו שחמט. מי שחותך ראשון – מפסיד.'] },
  { name: 'פיצה 20 דקות', col: '#2a9d8f', owner: 'אבי הרץ', lines: ['20 דקות מהכל! מהים, מהכנרת, מחיפה. מהתנור – 45.', 'המשלוחן שלנו מתאמן לחצי מרתון. בדרך הוא אוכל את הפיצה.', 'הזמנה בטלפון? 20 דקות. הזמנה בפייסבוק של ״כרמיאלים מדברים״? 20 תגובות. אחת מרבקה.'] },
  { name: 'פיצה בזמני', col: '#6b4a45', owner: 'עדי (לא ההוא. כן ההוא)', lines: ['בזמני פיצה הייתה עגולה, בלי בזיליקום באמצע. היום שמים עלה. כאילו זה כיכר עם עציץ.', 'משה חנך את התנור שלי. עם סרט. התנור לא עבד שבוע. הוא היה מרגש מדי. התנור.', 'מבצע לפנסיונרים: המשולש הראשון חינם. הנאום – חובה. 40 דקות. על ביוב. הם נשארים. יש להם זמן.'] },
  { name: 'פיצה טרמפ', col: '#5b6b3a', owner: 'נועה (משמרת שנייה, מהספסל)', lines: ['המשלוח יוצא מהטרמפיאדה. כשמישהו עוצר. אף אחד לא עוצר. הפיצה ותיקה. היא כבר סמלת.', 'רונן העורב בודק כל מגש. מוריד זית אחד. זו העמלה שלו. הוא לא מתפשר.', 'הזמנת פיצה ביום שלישי? איזה שלישי? אני כבר לא יודעת מה זה ימים. היא תגיע. מתישהו. יש בה כומתה.'] },
];
const HAWK = ['משולש ב-5! משולש ב-5! הפרה מכרמיאל!', 'הפיצה שלהם תל אביבית! שלנו ישראלית! עם עגבנייה של בוריס!', 'שניצל בבגט זה לא פיצה! תחשוב על זה! ...טוב, תחשוב על זה אחרי הפיצה!', 'מי שקונה אצלנו – סבתא שלו גאה!', 'אצלנו המשלוח עושה רק סיבוב אחד בכיכר! הבטחה!', 'אקסטרה גבינה בחינם למי שמתחייב להישאר בכרמיאל!', 'פיצה משפחתית! גם למי שאין לו משפחה! אצלנו מאמצים!',
  'פיצה עם זיתים מהכיכר! קטפנו מהעציץ של ראש העיר! הוא לא יודע! אל תתייגו!', 'מי שאוכל אצלנו לא עוזב את כרמיאל! בדקנו! יש סטטיסטיקה! אפס יוצאים! גם לא מהחנות!', 'משפחתית ב-48! לא שקל! 48 דקות! בחוץ! בכיכר! עם הנהג של המאפייה!', 'הפיצה שלנו עברה בדיקה ביטחונית! איציק טעם! החרים חצי! חשוד מאוד! טעים מאוד!', 'מגש בצורת כיכר! עם עציץ באמצע! אוכלים מסביב! לא יוצאים!'];
const talked = new Set(); export const PIZZERIAS = [];
{
  const used = [];
  let k = 0;
  for (let t = 0.06; t < 0.97 && k < PIZZA.length; t += 0.07) for (const s of [-1, 1]) {
    if (k >= PIZZA.length) break;
    const p = at(t, s * 16), b = nearestBuilding(p.x, p.z); if (!b) continue;
    if (Math.hypot(b.cx - p.x, b.cz - p.z) > 40) continue;
    const pz = PIZZA[k], cand = wallPoint(b, p.x, p.z);
    if (Math.hypot(cand.x - p.x, cand.z - p.z) > 16 || used.some(u => Math.hypot(u.x - cand.x, u.z - cand.z) < 7) || Math.hypot(cand.x - LM.schnitzelia.door.x, cand.z - LM.schnitzelia.door.z) < 9) continue;
    const wp = storefront(b, cand.x, cand.z, [pz.name], pz.col, '#fff', 6.5);
    used.push(wp); const y = H(wp.x, wp.z);
    // striped awning + a giant pizza slice on the sign
    const aw = canvasTex(64, 16, x => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff' : pz.col; x.fillRect(i * 8, 0, 8, 16); } });
    const awn = mesh(boxG(6, 0.15, 2), new THREE.MeshStandardMaterial({ map: aw }), wp.x + wp.nx * 1, y + 3.3, wp.z + wp.nz * 1); awn.rotation.set(0, wp.rot, 0); awn.rotateX(0.25);
    const slice = new THREE.Group();
    mesh(new THREE.CylinderGeometry(2, 2, 0.25, 3, 1, false, -0.35, 0.7).rotateX(Math.PI / 2), 0xffc94d, 0, 0, 0, slice);
    mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.35, 8, 1, true, -0.35, 0.7).rotateX(Math.PI / 2), 0xc98a3a, 0, 0, 0, slice);
    for (const [a, r] of [[0.1, 1.2], [-0.15, 1.6], [0.2, 1.7], [0, 0.8]]) mesh(cylG(0.18, 0.18, 0.1, 8).rotateX(Math.PI / 2), 0xb3261e, Math.sin(a) * r, Math.cos(a) * r, 0.16, slice);
    slice.position.set(wp.x + wp.nx * 0.4, y + 6.4, wp.z + wp.nz * 0.4); slice.rotation.y = wp.rot; slice.rotateZ(Math.PI); scene.add(slice);
    const o = { x: wp.x + wp.nx * 2.8 + wp.nz * 1.5, z: wp.z + wp.nz * 2.8 - wp.nx * 1.5 };
    const n = addNPC({ id: 'pizza' + k, name: `${pz.name} · ${pz.owner}`, x: o.x, z: o.z, rot: wp.rot, look: { shirt: 0xffffff, apron: parseInt(pz.col.slice(1), 16), chef: true, pants: 0x333333, hair: 0x2a1a10, mustache: k % 3 ? 0x2a1a10 : undefined, belly: k % 2 === 0 } });
    let i = 0; n.talk = async () => { await say(pz.name, pz.lines[i++ % pz.lines.length]); talked.add(k); if (talked.size === PIZZA.length) achieve('pizza', 'מבקר הפיצות של המדרחוב', `דיברת עם כל ${PIZZA.length} הפיצריות. הכולסטרול שלך קיבל כיכר על שמו.`); };
    if (k % 3 === 0) umbrellaTable(wp.x + wp.nx * 6 - wp.nz * 3, wp.z + wp.nz * 6 + wp.nx * 3);
    PIZZERIAS.push({ ...pz, wp, npc: n }); k++;
  }
}
// hawkers in the middle of the street
const hawkers = [0.2, 0.45, 0.7, 0.9].map((t, i) => {
  const p = at(t, i % 2 ? 2.5 : -2.5);
  const n = addNPC({ id: 'hawk' + i, name: 'מחלק פליירים', x: p.x, z: p.z, look: { shirt: pick([0xe63946, 0xffd166, 0x2a9d8f, 0xf4a261]), pants: 0x222222, cap: 0xffffff, hair: 0x2a1a10 } });
  n.pose = 'point'; let j = i; n.talk = () => say('מחלק פליירים', HAWK[j++ % HAWK.length]); n.hawkT = 3 + i * 2; return n;
});

// ---------------------------------------------------------------- arriving on the midrachov
let visited = false;
export function tickPizza(dt, player, playing) {
  if (!playing) return;
  const c = MIDRACHOV.center, d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
  if (d > LEN / 2 + 25) return;
  if (!visited) {
    visited = true;
    toast(`🍕 ברוכים הבאים למדרחוב: ${PIZZA.length} פיצריות, שניצליה אחת, ואף אחד לא יודע למה.`, '', 7000);
    const WAR = [['פיצה כיכר', 'מי שאוכל פיצה בפיצה 48 ₪ – שידע שהגבינה שלהם עברה לתל אביב.'], ['פיצה 48 ₪', 'לפחות אצלנו המשולש לא עושה סיבוב בקופסה.'], ['מנהל הקבוצה', 'מלחמת פיצות בקבוצה?! רק דברים חשובים!!! ...מישהו מזמין משפחתית? אני נכנס לחצי.']];
    WAR.forEach(([s, t], i) => setTimeout(() => wa(s, t), 2500 + i * 3200));
  }
  for (const h of hawkers) if ((h.hawkT -= dt) <= 0) { h.hawkT = 6 + Math.random() * 5; if (Math.hypot(player.pos.x - h.h.g.position.x, player.pos.z - h.h.g.position.z) < 30) bark(h, pick(HAWK)); }
}
