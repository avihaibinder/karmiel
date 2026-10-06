// Kikar HaIr mall — the horror level. Built off-map (x = 9000) and entered through the boarded door.
import { THREE, scene, camera, mat, mesh, boxG, cylG, sign, canvasTex, label, pick, clamp, FONT } from './core.js';
import { addBoxCollider, collide, groundAt } from './world.js';
import { makeHuman, makeCat, makePigeon, poseHuman } from './characters.js';
import { P, teleport, cam, pressed } from './player.js';
import { setInterior, hemi } from './sky.js';
import { toast, pa, card, hideCard, say, ask, startTimer, stopTimer, fade, achieve, setObjective, UI } from './ui.js';
import { sfx, music } from './audio.js';

const IX = 9000, IZ = 0;
const root = new THREE.Group(); root.visible = false; scene.add(root);
const W = (x, z) => [IX + x, IZ + z];
// ---------------------------------------------------------------- layout (local coords, see design)
const ROOMS = {
  A: { x: [-20, 20], z: [-20, 20], y: 0, floor: 0x8f887a, name: 'atrium' },
  S: { x: [-52, -20], z: [-20, 20], y: 0, floor: 0x9a9486, name: 'shoprite' },
  F: { x: [-52, -20], z: [-50, -20], y: 0, floor: 0x7d6f6a, name: 'fashion' },
  K: { x: [-20, 20], z: [-50, -38], y: 0, floor: 0x8a8578, name: 'banks' },
  C: { x: [20, 52], z: [-50, -20], y: 0, floor: 0x4a2030, name: 'cinema' },
  B: { x: [20, 64], z: [-4, 26], y: -6, floor: 0x9c7a4c, name: 'bowling' },
  V: { x: [20, 52], z: [26, 50], y: -6, floor: 0x6b5a7a, name: 'events' },
  L: { x: [-12, 4], z: [34, 42], y: 0, floor: 0x8f887a, name: 'landing' },
};
const DOORS = [   // [room, side, from, to]
  ['A', 'w', -5, 5], ['S', 'e', -5, 5], ['S', 'n', -42, -32], ['F', 's', -42, -32], ['F', 'e', -47, -41], ['K', 'w', -47, -41],
  ['K', 'e', -47, -41], ['C', 'w', -47, -41], ['C', 's', 40, 46], ['B', 'n', 40, 46], ['B', 's', 24, 32], ['V', 'n', 24, 32],
  ['V', 'w', 34, 42], ['L', 'e', 34, 42], ['L', 'w', 36, 40],
];
const ESC1 = { x: [40, 46], z: [-20, -4] }, ESC2 = { x: [4, 20], z: [34, 42] };
const inR = (r, x, z) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];
export function roomAt(x, z) { const lx = x - IX, lz = z - IZ; for (const [k, r] of Object.entries(ROOMS)) if (inR(r, lx, lz)) return k; if (inR(ESC1, lx, lz)) return 'E1'; if (inR(ESC2, lx, lz)) return 'E2'; return null; }
export function interiorGround(x, z) {
  const lx = x - IX, lz = z - IZ;
  if (inR(ESC1, lx, lz)) return -6 * (lz - ESC1.z[0]) / 16;
  if (inR(ESC2, lx, lz)) return -6 * (lx - ESC2.x[0]) / 16;
  for (const r of Object.values(ROOMS)) if (inR(r, lx, lz)) return r.y;
  return 0;
}
// ---------------------------------------------------------------- build
const wallMat = new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (x) => { x.fillStyle = '#b8ae9c'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(40,30,20,${Math.random() * 0.15})`; x.fillRect(Math.random() * 64, Math.random() * 20, 2 + Math.random() * 5, 20 + Math.random() * 44); } x.fillStyle = '#7a6f5f'; x.fillRect(0, 56, 64, 8); }), roughness: 1 });
const addWall = (x0, z0, x1, z1, y) => {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.max(0.6, Math.abs(x1 - x0)), d = Math.max(0.6, Math.abs(z1 - z0));
  const m = new THREE.Mesh(boxG(w, 6.2, d), wallMat); m.position.set(IX + cx, y + 3, IZ + cz); m.receiveShadow = true; root.add(m);
  addBoxCollider(IX + cx, IZ + cz, w, d);
};
for (const [k, r] of Object.entries(ROOMS)) {
  const [x0, x1] = r.x, [z0, z1] = r.z;
  const fl = mesh(boxG(x1 - x0, 0.4, z1 - z0), r.floor, IX + (x0 + x1) / 2, r.y - 0.2, IZ + (z0 + z1) / 2, root); fl.castShadow = false;
  const ce = mesh(boxG(x1 - x0, 0.4, z1 - z0), 0x2a2724, IX + (x0 + x1) / 2, r.y + 6.2, IZ + (z0 + z1) / 2, root); ce.castShadow = false;
  const sides = { n: [[x0, z0], [x1, z0]], s: [[x0, z1], [x1, z1]], w: [[x0, z0], [x0, z1]], e: [[x1, z0], [x1, z1]] };
  for (const [side, [[ax, az], [bx, bz]]] of Object.entries(sides)) {
    const horiz = side === 'n' || side === 's', a = horiz ? ax : az, b = horiz ? bx : bz;
    const gaps = DOORS.filter(d => d[0] === k && d[1] === side).map(d => [d[2], d[3]]).sort((p, q) => p[0] - q[0]);
    let cur = a;
    for (const [g0, g1] of [...gaps, [b, b]]) {
      if (g0 > cur + 0.1) horiz ? addWall(cur, az, g0, az, r.y) : addWall(ax, cur, ax, g0, r.y);
      cur = Math.max(cur, g1);
    }
  }
}
// escalators (ramps with side walls)
function ramp(e, alongZ, yFrom, yTo) {
  const [x0, x1] = e.x, [z0, z1] = e.z, len = alongZ ? z1 - z0 : x1 - x0, dy = yTo - yFrom;
  const g = new THREE.Mesh(boxG(alongZ ? x1 - x0 : Math.hypot(len, dy), 0.4, alongZ ? Math.hypot(len, dy) : z1 - z0), mat(0x55585d));
  g.position.set(IX + (x0 + x1) / 2, (yFrom + yTo) / 2 - 0.2, IZ + (z0 + z1) / 2);
  if (alongZ) g.rotation.x = -Math.atan2(dy, len); else g.rotation.z = Math.atan2(dy, len);
  root.add(g);
  if (alongZ) { addWall(x0, z0, x0, z1, Math.min(yFrom, yTo)); addWall(x1, z0, x1, z1, Math.min(yFrom, yTo)); }
  else { addWall(x0, z0, x1, z0, Math.min(yFrom, yTo)); addWall(x0, z1, x1, z1, Math.min(yFrom, yTo)); }
  return g;
}
ramp(ESC1, true, 0, -6); const esc2 = ramp(ESC2, false, 0, -6);
const stepTex = canvasTex(64, 64, (x) => { x.fillStyle = '#3d4046'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#8f949b'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 3); });
stepTex.repeat.set(1, 8); esc2.material = new THREE.MeshStandardMaterial({ map: stepTex });
const hsign = (lx, y, lz, w, h, lines, bg, rot = 0, fg = '#e8dcc8') => sign(IX + lx, y, IZ + lz, w, h, lines, { bg, fg, rot, parent: root });

// atrium: dry fountain, info desk, storefront shutters
mesh(cylG(4.5, 4.8, 1, 24), 0xa39b8c, IX, 0.5, IZ, root); mesh(cylG(4, 4, 0.1, 24), 0x6b5d3a, IX, 0.95, IZ, root); addBoxCollider(IX, IZ, 9, 9);
for (let i = 0; i < 30; i++) mesh(cylG(0.12, 0.12, 0.03, 8), mat(0xd4af37, { metalness: 0.9, roughness: 0.2 }), IX + (Math.random() - 0.5) * 6, 1.02, IZ + (Math.random() - 0.5) * 6, root);
mesh(boxG(5, 1.2, 1.6), 0x6b4a45, IX + 12, 0.6, IZ + 14, root); addBoxCollider(IX + 12, IZ + 14, 5, 1.6);
hsign(12, 2.2, 13.1, 4, 0.8, ['מודיעין'], '#1d3557');
const shutters = [['פוטו כיכר', -19.5, -12], ['אופטיקה 92', -19.5, 12], ['צעצועי דני', 19.5, -12], ['בורקס הכיכר', 19.5, 12]];
for (const [n, x, z] of shutters) { const rot = x < 0 ? Math.PI / 2 : -Math.PI / 2; mesh(boxG(0.2, 3.6, 7), 0x8f949b, IX + x, 1.8, IZ + z, root); hsign(x + (x < 0 ? 0.3 : -0.3), 4.4, z, 6, 0.9, [n], '#3a2f2a', rot); }
hsign(0, 5, 19.6, 14, 1.4, ['ברוכים הבאים לקניון כיכר העיר'], '#6b4a45', Math.PI);
// the one escalator that still moves (going nowhere)
const decoEsc = mesh(boxG(3, 0.4, 12), new THREE.MeshStandardMaterial({ map: stepTex.clone() }), IX - 12, 2.5, IZ - 13, root); decoEsc.rotation.x = -0.45; decoEsc.material.map.repeat.set(1, 6); decoEsc.material.map.needsUpdate = true;
addBoxCollider(IX - 12, IZ - 13, 3.4, 12);
// Shoprite
hsign(-36, 4.8, 19.6, 12, 1.4, ['שופרייט'], '#b3261e', Math.PI);
hsign(-36, 3.6, -19.6, 12, 1, ['מבצע: 3 ב-10 (בתוקף עד 1996)'], '#f5c542', 0, '#222');
for (let r = 0; r < 4; r++) for (const z of [-12, 4]) { const x = -48 + r * 7; mesh(boxG(2, 2.4, 10), 0x6d6a60, IX + x, 1.2, IZ + z + 4, root); addBoxCollider(IX + x, IZ + z + 4, 2, 10); for (let k = 0; k < 8; k++) mesh(boxG(0.5, 0.5, 0.5), pick([0xe63946, 0xffd166, 0x2a9d8f, 0xf4a261]), IX + x + (Math.random() - 0.5), 1.2 + (k % 2) * 0.8, IZ + z + (k - 4), root); }
// fashion store
hsign(-36, 4.6, -20.3, 12, 1.2, ['אופנת כיכר 92'], '#8e2de2');
for (let i = 0; i < 4; i++) { mesh(boxG(4, 0.1, 0.1), 0x999999, IX - 46 + i * 7, 2.6, IZ - 30, root); for (let k = 0; k < 5; k++) mesh(boxG(0.6, 1.2, 0.1), pick([0xff4d8d, 0x4fc3f7, 0xb388ff, 0x7ee787]), IX - 47.6 + i * 7 + k * 0.8, 1.9, IZ - 30, root); }
// banks + ATMs
hsign(-10, 4.6, -49.6, 10, 1, ['בנק הגליל (נסגר)'], '#1d3557'); hsign(10, 4.6, -49.6, 10, 1, ['הבנק הצפוני (נסגר)'], '#264653');
const atmTex = canvasTex(256, 192, (x) => { x.fillStyle = '#0a2a4a'; x.fillRect(0, 0, 256, 192); x.fillStyle = '#7ee787'; x.font = `700 26px ${FONT}`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('יתרתך: 12.50 ₪', 128, 80); x.fillText('(1994)', 128, 120); }, false);
const atm = mesh(boxG(1.4, 2, 0.8), 0x44484f, IX, 1, IZ - 49.3, root); const atmScreen = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshBasicMaterial({ color: 0x111111 })); atmScreen.position.set(IX, 1.5, IZ - 48.88); root.add(atmScreen);
// cinema
const slideTex = canvasTex(512, 256, (x) => { x.fillStyle = '#f5ecd0'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#222'; x.font = `900 48px ${FONT}`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('נא לכבות ביפרים', 256, 110); x.font = `600 26px ${FONT}`; x.fillText('קולנוע כיכר · 1993', 256, 170); }, false);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ color: 0x222222 })); screen.position.set(IX + 51.6, 3.2, IZ - 35); screen.rotation.y = -Math.PI / 2; root.add(screen);
for (let r = 0; r < 5; r++) for (let s = 0; s < 8; s++) mesh(boxG(1, 1, 1), 0x7a1f2b, IX + 26 + r * 4, 0.5, IZ - 46 + s * 1.6 + (s > 3 ? 3 : 0), root);
hsign(22, 4.6, -20.3, 8, 1, ['קולנוע כיכר'], '#7a1f2b');
// bowling alley (basement)
const lanes = [];
for (let l = 0; l < 8; l++) { const z = -1 + l * 3.2; mesh(boxG(38, 0.1, 2.6), 0xc49a6c, IX + 42, -5.94, IZ + z, root); lanes.push(z); }
const pins = [];
const pinG = cylG(0.12, 0.18, 0.8, 8);
for (const z of lanes) for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) { const p = mesh(pinG, 0xf5f5f5, IX + 58 + r * 0.6, -5.5, IZ + z - r * 0.3 + c * 0.6, root); pins.push({ m: p, down: false }); }
hsign(42, -1.2, -3.7, 16, 1.4, ['באולינג כיכר · מסלולים 1–8'], '#e63946');
const curtain = mesh(boxG(0.3, 5.6, 10), 0x7a1f2b, IX + 63.5, -3.2, IZ + 11, root);
// Mitzi's nest on lane 7
const nestZ = lanes[6], nest = new THREE.Group(); nest.position.set(IX + 60, -6, IZ + nestZ); root.add(nest);
for (let i = 0; i < 25; i++) mesh(boxG(0.3, 0.3, 0.3), pick([mat(0xd4af37, { metalness: 0.9, roughness: 0.2 }), mat(0xc0c0c0, { metalness: 0.9, roughness: 0.2 })]), (Math.random() - 0.5) * 2, 0.15 + Math.random() * 0.4, (Math.random() - 0.5) * 2, nest);
const stamp = mesh(boxG(0.5, 0.6, 0.5), mat(0xd4af37, { metalness: 0.8, roughness: 0.25, emissive: 0x553300 }), 0, 0.9, 0, nest);
const mitzi = makeCat(); mitzi.position.set(IX + 59, -6, IZ + nestZ + 1.4); mitzi.rotation.y = -Math.PI / 2; root.add(mitzi);
const shoes = mesh(boxG(0.8, 0.4, 0.5), 0xb3261e, IX + 24, -5.8, IZ + lanes[0], root);
// events hall — a 1994 wedding frozen in time
hsign(36, -1.4, 49.6, 14, 1.4, ['מזל טוב שרית ואבי · 1994'], '#b388ff', Math.PI);
const discoBall = mesh(new THREE.IcosahedronGeometry(0.8, 1), mat(0xdddddd, { metalness: 1, roughness: 0.1 }), IX + 36, -1.2, IZ + 38, root);
for (const [x, z] of [[28, 32], [44, 32], [28, 44], [44, 44]]) { mesh(cylG(2, 2, 0.1, 16), 0xffffff, IX + x, -5.2, IZ + z, root); mesh(cylG(0.2, 0.2, 0.8, 6), 0x999999, IX + x, -5.6, IZ + z, root); addBoxCollider(IX + x, IZ + z, 3, 3); }
mesh(boxG(4, 1.2, 1.6), 0x222222, IX + 50, -5.4, IZ + 38, root); hsign(49.1, -3.8, 38, 3, 0.7, ['DJ צביקה'], '#222', -Math.PI / 2);
// exit door (daylight)
const exitDoor = mesh(boxG(0.3, 4, 4), mat(0xfff6d0, { emissive: 0xfff2c0, emissiveIntensity: 2 }), IX - 11.8, 2, IZ + 38, root);
hsign(-11.5, 4.6, 38, 3, 0.7, ['יציאה'], '#1b7a3a', Math.PI / 2, '#fff');

// ---------------------------------------------------------------- lights
const flashlight = new THREE.SpotLight(0xfff1d0, 60, 45, 0.42, 0.45, 1.3); flashlight.castShadow = false;
camera.add(flashlight); flashlight.position.set(0, 0, 0); flashlight.target.position.set(0, 0, -40); camera.add(flashlight.target);   // beam dead-centre on the view axis (an offset origin with a 1 m target aimed it 2 m off to the side)
if (!camera.parent) scene.add(camera);
flashlight.visible = false;
const tubes = [[0, 5.6, 0], [0, 5.6, -44], [-36, 5.6, 0], [36, -0.6, 11], [36, -0.6, 38], [-4, 5.6, 38]].map(([x, y, z]) => { const l = new THREE.PointLight(0xcfe8ff, 0, 26, 1.6); l.position.set(IX + x, y, IZ + z); root.add(l); const tube = mesh(boxG(2.4, 0.12, 0.3), mat(0xeef6ff, { emissive: 0xcfe8ff, emissiveIntensity: 0 }), IX + x, y + 0.4, IZ + z, root); return { l, tube, base: 0 }; });
const disco = [0xff4d8d, 0x4fc3f7, 0xffd166].map((c, i) => { const l = new THREE.PointLight(c, 0, 30, 1.4); l.position.set(IX + 30 + i * 8, -1.5, IZ + 10 + i * 12); root.add(l); return l; });

// ---------------------------------------------------------------- mannequins ("ועד הסוחרים הנצחי") and כיכרון
const WHISPERS = ['גם אתה עוזב?', 'כולם עוזבים...', 'היה פה באולינג... היה פה הכול...', 'יש לנו כריות כתפיים. מה יש להם בתל אביב?', 'תישאר... נמדוד אותך...', 'יש מידה שלך... במחסן... משנת 92...', 'לא הסתכלת... אז זזנו... סליחה...', 'אנחנו לא מפחידות. אנחנו בודדות. זה שונה.',
  'אכלת?... סליחה. הרגל. סבתא שלך קנתה פה חזייה ב-93...', 'יש לך פנים של מידה L. אל תתווכח עם בובה.', 'בתל אביב הבובות עירומות. בלי כבוד. בלי כריות כתפיים.', 'תעמוד רגע ישר... ככה... עכשיו אל תזוז 30 שנה. זה נעים.', 'המבצע נגמר ב-96. אנחנו לא. אנחנו אף פעם לא.', 'ראש העיר רצה לחנוך אותנו ככיכר... כמעט הסכמנו...', 'יש לנו קבוצת פייסבוק. 17 חברות. כולן אנחנו.', 'ששש... מיצי ישנה... היא גנבה לנו את העיניים... רק את הטובות...',
  'אנחנו לא תקועות. אנחנו בחרנו. כמו אמא שלך עם אבא שלך.', 'מדדנו את סבתא שלך ב-93. היא עדיין אותה מידה. אנחנו עדיין אותה שנה.', 'בתל אביב היית מידה S. מרעב. פה אתה L. מאהבה. ומקציצות.', 'שרית ואבי התגרשו ב-96. אנחנו עדיין בחתונה. אף אחד לא סיפר לנו. אל תספר. יש עוגה.'];
const MAN = [];
function mannequin(x, z, group) {
  const h = makeHuman({ skin: 0xe8e0d0, shirt: pick([0xff4d8d, 0x4fc3f7, 0xb388ff, 0x7ee787, 0xffd166]), pants: pick([0x1d3557, 0x222222, 0xffffff]), hair: null, shoes: 0xe8e0d0 });
  h.body.scale.x = 1.35;   // 1992 shoulder pads
  h.head.children.forEach((c, i) => { if (i > 0 && i < 4) c.visible = false; });
  h.g.position.set(IX + x, interiorGround(IX + x, IZ + z), IZ + z); h.g.rotation.y = Math.random() * 6; poseHuman(h, 'mannequin'); root.add(h.g);
  const m = { h, x0: IX + x, z0: IZ + z, group, moved: false, seenT: 0, whisper: null };
  MAN.push(m); return m;
}
for (const [x, z] of [[-44, -26], [-30, -28], [-40, -36], [-26, -40], [-48, -44], [-34, -46], [-22, -34]]) mannequin(x, z, 'F');
for (const [x, z] of [[-6, -44], [8, -41], [14, -46]]) mannequin(x, z, 'K');
for (const [x, z] of [[26, 30], [30, 34], [42, 30], [46, 34], [26, 42], [30, 46], [42, 46], [46, 42], [36, 30], [50, 44]]) mannequin(x, z, 'V');
for (const [x, z] of [[24, 10], [34, 22], [50, 24], [30, 2]]) mannequin(x, z, 'B');
const kikaron = new THREE.Group();
{
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.8, 20), [new THREE.MeshStandardMaterial({ map: canvasTex(64, 16, (x) => { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#fff' : '#d62828'; x.fillRect(i * 16, 0, 16, 16); } }) }), mat(0x6f9a43), mat(0x6f9a43)]);
  ring.position.y = 2.2; kikaron.add(ring);
  const face = canvasTex(256, 128, (x) => { x.fillStyle = '#6f9a43'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.beginPath(); x.arc(80, 50, 22, 0, 7); x.arc(176, 50, 22, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(84, 54, 10, 0, 7); x.arc(172, 54, 10, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 8; x.beginPath(); x.arc(128, 70, 42, 0.2, Math.PI - 0.2); x.stroke(); }, false);
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: face, transparent: true })); fm.position.set(0, 2.2, 1.62); kikaron.add(fm);
  mesh(cylG(0.15, 0.2, 1.4, 6), 0x8a6a45, 0, 3.8, 0, kikaron); for (let i = 0; i < 6; i++) mesh(boxG(1.4, 0.05, 0.4).translate(0.7, 0, 0).rotateZ(-0.4).rotateY(i), 0x4f8a3a, 0, 4.5, 0, kikaron);
  for (const s of [-0.7, 0.7]) mesh(boxG(0.4, 1.3, 0.4), 0xffd166, s, 0.65, 0, kikaron);
  const sash = mesh(boxG(3.3, 0.35, 0.05), 0xe63946, 0, 2.5, 1.66, kikaron); sash.rotation.z = -0.4;
  kikaron.position.set(IX + 62, -6, IZ + 11); kikaron.rotation.y = -Math.PI / 2; kikaron.visible = false; root.add(kikaron);
}
const KIKARON_LINES = ['ברוכים הבאים!!!', 'יש חניה חינם!!!', 'באולינג! קולנוע! שני בנקים!!!', 'למה ללכת? הכול פה!!!', 'אל תצא מהכיכר!!! אי אפשר לצאת מכיכר!!!', 'מבצע לזוגות צעירים!!! 1992!!!', 'תסתובב!!! סיבוב נוסף!!! תמיד סיבוב נוסף!!!', 'חיבוק!!! חיבוק חינם!!! לא משחררים!!!', 'מועדון לקוחות!!! 40 נקודות!!! תממש!!! תממש ב-1996!!!', 'תל אביב?!?! אין שם כיכרון!!! יש שם רק יובל המבולבל!!!', 'אני עובד החודש!!! 400 חודשים ברצף!!!', 'יוסי!!! סבתא שלך בקומה 2!!! אין קומה 2!!! תעלה!!!', 'ארבעים שנה אותה תחפושת!!! מי שבפנים כבר לא בפנים!!! התחפושת ממשיכה!!! בשבילך!!!'];
// pigeons + carts
const pigeons = []; for (let i = 0; i < 40; i++) { const p = makePigeon(); p.visible = false; root.add(p); pigeons.push({ g: p, v: new THREE.Vector3() }); }
const carts = [];
function cartMesh() { const g = new THREE.Group(); mesh(boxG(0.9, 0.7, 1.3), 0xb0b5bb, 0, 0.9, 0, g); mesh(boxG(0.9, 0.05, 0.05), 0x222222, 0, 1.4, -0.7, g); for (const [a, b] of [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]]) mesh(cylG(0.1, 0.1, 0.08, 8).rotateZ(Math.PI / 2), 0x111111, a, 0.1, b, g); root.add(g); return g; }
for (let i = 0; i < 13; i++) { const g = cartMesh(); g.visible = false; carts.push({ g, v: new THREE.Vector3(), on: false }); }

// ---------------------------------------------------------------- runtime state
const H = { active: false, phase: 'explore', cp: null, flags: {}, resolve: null, crumbs: [], kT: 0, kLine: 0, fashionMoved: false, pinsDown: 0, lightsOn: false, flash: true, safeT: 0 };
export const horror = H;
const CPS = { 1: [0, 14, Math.PI], 2: [-37, -17, Math.PI], 3: [22, -44, -Math.PI / 2], 4: [56, 16, -Math.PI / 2], 5: [30, 30, -Math.PI / 2] };
const FAILS = ['מדדו אותך. אתה מידה M. בתל אביב היית S, כי שם אוכלים רק עלה.', 'הבובות הושיבו אותך ליד השולחן של המשפחה של אבי. דודה אחת שאלה מתי אתה מתחתן.', 'הבובות תפסו אותך. הן מדדו אותך. אתה מידה M. תתחיל מהצ\'קפוינט.', 'כיכרון חיבק אותך. חזק. לנצח. טוב, לא לנצח – עד הצ\'קפוינט.', 'הסתכלת על הטלפון. הבובות לא סולחות על טלפונים.', 'היונים החליטו שאתה פסל. נסה שוב.', 'נתקעת בחתונה של שרית ואבי. רקדת את כל הערב. עכשיו 1995. חוזרים לצ\'קפוינט.', 'הרמקול אמר את השם שלך. עצרת להקשיב. זו הייתה טעות.', 'כיכרון הכריח אותך להיכנס למועדון הלקוחות. חוזרים.',
  'בובה אחת הלבישה אותך ז\'קט עם כריות כתפיים. עכשיו אתה לא עובר בדלתות. חוזרים.', 'ניסית להסביר לבובה שאתה עוזב. היא הנהנה. היא לא מבינה. היא בובה. היא הנהנה 400 פעם.', 'הבובות צילמו אותך לקטלוג של 1993. יצאת טוב. לא מצאת אותך. חוזרים.', 'שרית ואבי ביקשו שתהיה עד בחתונה. חתמת. עכשיו אתה בוועד הבית של הקניון. לנצח.', 'סבתא שלך הייתה שם. היא שאלה אם אכלת. ענית "לא". זה היה שקר. הבובות יודעות.'];
function setCP(n) { if (H.cp === n) return; H.cp = n; toast(`💾 נקודת שמירה ${n}/5`, '', 2500); }
// a few seconds after every respawn nothing may touch you — checkpoint 5 is inside the events hall and used to be a death loop
const GRACE = 3;
function resetEnemies() {
  for (const m of MAN) { m.h.g.position.set(m.x0, interiorGround(m.x0, m.z0), m.z0); poseHuman(m.h, 'mannequin'); if (m.whisper) { m.h.g.remove(m.whisper); m.whisper = null; } }
  for (const c of carts) { c.on = false; c.g.visible = false; }
  H.crumbs = []; H.kT = 3;
  if (H.phase === 'escape') { const [x, z] = CPS[H.cp]; kikaron.position.set(IX + x + 12, interiorGround(IX + x + 12, IZ + z), IZ + z); }
}
const DEATH_LINES = { 3: 'הבובות כבר יודעות את המידה שלך בעל פה. אחת מהן סרגה לך סוודר. חוזרים לצ\'קפוינט.', 5: 'פעם חמישית. הבובות פתחו לך כרטיס מועדון לקוחות. יש לך 40 נקודות. אפשר לממש ב-1996.', 8: 'בובה אחת לחשה: "תישאר, נו". בובה אחרת: "הוא לא יישאר. הם אף פעם לא נשארים." אתם בזוגיות עכשיו.', 12: 'פעם 12. הבובות הפסיקו לרדוף. הן פשוט מחכות ליד הצ\'קפוינט עם כיסא. ועוגה. ושאלות על החיים שלך.', 20: 'פעם 20. ראש העיר נכנס לקניון וחנך את הצ\'קפוינט ככיכר. יש בו עציץ. אתה עדיין פה.' };
async function fail(msg) {
  if (H.failing) return; H.failing = true; P.frozen = true; sfx('sting');
  H.deaths = (H.deaths || 0) + 1; if (!msg) msg = DEATH_LINES[H.deaths];
  await card(`<div class="fail">😱</div>${msg || pick(FAILS)}`); hideCard();
  const [x, z, yaw] = CPS[H.cp]; teleport(IX + x, IZ + z, yaw); resetEnemies(); H.safeT = GRACE;
  if (H.phase === 'escape') { startTimer(120, 'לצאת מהקניון', () => fail('נגמר הזמן. הקניון נסגר איתך בפנים. מוטי ישמור לך מנה. חוזרים לצ\'קפוינט.')); toast('🏃 3 שניות של חסד. הבובות סופרות. רוץ (Shift).', 'good', 3000); }
  P.frozen = false; H.failing = false;
}
function burstPigeons() { sfx('flap'); pigeons.forEach(p => { p.g.visible = true; p.g.position.set(IX + 50 + Math.random(), 3 + Math.random() * 2, IZ - 35 + (Math.random() - 0.5) * 10); p.v.set(-6 - Math.random() * 10, (Math.random() - 0.3) * 4, (Math.random() - 0.5) * 14); }); }
function launchCarts(line) {
  const n = line ? 12 : 1;
  for (let i = 0; i < n; i++) { const c = carts[i]; c.on = true; c.g.visible = true; if (line) { c.g.position.set(IX - 44.5, 0, IZ - 19 - i * 2.4); c.v.set(0, 0, 7); } else { c.g.position.set(IX - 37.5, 0, IZ - 16); c.v.set(0, 0, 3); } c.g.rotation.y = 0; }
}
// ---------------------------------------------------------------- enter / update
export function enterMall() {
  return new Promise(async res => {
    H.resolve = res; H.active = true; H.phase = 'explore'; H.flags = {}; H.cp = null; H.lightsOn = false; H.pinsDown = 0; H.fashionMoved = false;
    root.visible = true; setInterior(true); flashlight.visible = true; flashlight.intensity = 60;
    tubes.forEach(t => { t.l.intensity = 0; t.tube.material.emissiveIntensity = 0; }); disco.forEach(l => l.intensity = 0);
    kikaron.visible = false; curtain.visible = true; stamp.visible = true; mitzi.visible = true; pins.forEach(p => { p.down = false; p.m.rotation.set(0, 0, 0); });
    screen.material = new THREE.MeshBasicMaterial({ color: 0x222222 }); atmScreen.material = new THREE.MeshBasicMaterial({ color: 0x111111 });
    P.interior = true; P.ground = interiorGround; P.collide = collide;
    setCP(1); const [x, z, yaw] = CPS[1]; teleport(IX + x, IZ + z, yaw); cam.pitch = 0.2; cam.dist = 6;
    resetEnemies(); music('horror'); fade(false);
    setObjective('הקניון הישן: הקומה הנשכחת', [[false, 'למצוא את הקן של מיצי'], [false, 'לקחת את החותמת'], [false, 'לצאת. חי.']]);
    toast('🔦 F – פנס. הבובות זזות רק כשאתה לא מסתכל. אז תסתכל. כל הזמן. כמו שכנה מהמרפסת.', '', 7000);
    setTimeout(() => pa('לקו-חות נ-כ-ב-דים... ב-רו-כים ה-ב-אים ל-קני-ון כי-כר ה-עיר... ה-מ-קום ש-ל-כם...'), 1500);
  });
}
function exitMall() {
  H.active = false; root.visible = false; setInterior(false); flashlight.visible = false; stopTimer();
  P.interior = false; P.ground = groundAt; P.pushX = 0; cam.dist = 10; cam.pitch = 0.36; music('roam'); const r = H.resolve; H.resolve = null; r && r();
}
const once = (k, f) => { if (!H.flags[k]) { H.flags[k] = true; f(); } };
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
function seen(obj) {
  _v.copy(obj.position).setY(obj.position.y + 1.5).sub(camera.position); const d = _v.length(); _v.normalize();
  camera.getWorldDirection(_f);
  const dot = _v.dot(_f);
  if (d < 7 && dot > 0.55) return true;                        // close & roughly in view
  return H.flash && d < 34 && dot > Math.cos(0.42) || H.lightsOn && dot > 0.62;
}
export function updateHorror(dt, t) {
  if (!H.active) return;
  if (pressed.has('KeyF')) { H.flash = !H.flash; flashlight.visible = H.flash; sfx('blip'); }
  const room = roomAt(P.pos.x, P.pos.z), lx = P.pos.x - IX, lz = P.pos.z - IZ, safe = (H.safeT -= dt) > 0;
  // flickering tubes
  tubes.forEach((tb, i) => { const on = H.lightsOn ? 1 : (Math.random() < (i === 1 ? 0.08 : 0.02) ? 1 : 0); tb.l.intensity = on * (H.lightsOn ? 10 : 6); tb.tube.material.emissiveIntensity = on * 2; });
  decoEsc.material.map.offset.y -= dt * 0.5; stepTex.offset.y += dt * (H.phase === 'escape' ? 1.2 : 0);
  if (H.lightsOn) { disco.forEach((l, i) => { l.intensity = 8 + Math.sin(t * 6 + i * 2) * 6; }); discoBall.rotation.y += dt * 2; }
  // --- scripted beats
  if (room === 'A' && H.flags.pa3 && Math.hypot(lx - 12, lz - 14) < 4) once('infodesk', () => { UI.stats.savtaAsked++; toast('🍱 על דלפק המודיעין: קופסה של סבתא. פתק: "ידעתי שתגיע לפה. תאכל לפני הבובות". היא עוד חמה.', 'good', 6500); setTimeout(() => toast('🧍 בובה אחת מסתכלת על הקופסה. גם היא לא אכלה מאז 1992.'), 2500); });
  if (room === 'A') once('fountain', () => setTimeout(() => toast('⛲ המזרקה מלאה במטבעות מ-1995. מישהו ביקש משאלה. היא לא התגשמה. המזרקה יבשה.'), 2500));
  if (room === 'S') {
    once('pa2', () => { pa('מב-צע ב-ש-ו-פ-ר-י-י-ט... ע-ג-ב-נ-י-ו-ת... ש-ק-ל ו-ח-צי... ל-ק-י-ל-ו...'); toast('🛒 שלט: "מבצע: 3 ב-10 (בתוקף עד 1996)". עדיין זול יותר מתל אביב.'); setTimeout(() => pa('...ח-ת-ו-ל-ה... נ-צ-פ-ת-ה... ב-מ-ר-ת-ף... מ-ס-ל-ו-ל ש-ב-ע...'), 9000); setTimeout(() => { launchCarts(false); sfx('cart'); toast('עגלת קניות מתגלגלת אליך מהחושך. היא נוגעת לך ברגל. בעדינות. זה הכי מפחיד.'); }, 3500); });
    if (lx < -40) once('cartline', () => { launchCarts(true); sfx('cart'); sfx('sting'); toast('🛒🛒🛒 שורה של 12 עגלות. זה כבר לא עדין.', 'bad'); });
    if (lz < -14) once('paws', () => toast('🐾 עקבות של חתולה בקמח: "מיצי הייתה פה".'));
  }
  if (room === 'F') { setCP(2); once('pa3', () => { pa('ה-נ-כ-ד י-ו-ס-י... ס-ב-ת-א ש-ל-ך... מ-ח-כ-ה... ב-ד-ל-פ-ק ה-מ-ו-ד-י-ע-י-ן... ה-י-א ש-א-ל-ה... א-כ-ל-ת...'); toast('🧍 הבובות של "אופנת כיכר 92". תסתכל עליהן כדי שיקפאו. תלך אחורה.'); }); }
  if (room === 'K') {
    once('pa4', () => { pa('ה-ב-נ-ק... נ-ס-ג-ר... ב-ע-ו-ד... ח-מ-ש... ד-ק-ו-ת... ל-פ-נ-י... ש-ל-ו-ש-י-ם... ש-נ-ה...'); if (!H.fashionMoved) achieve('noblink', 'לא מצמצתי', 'עברת את חנות הבובות בלי שאף בובה תזוז. יש לך עיניים של סבתא.'); });
    if (Math.abs(lx) < 5) once('atm', () => { atmScreen.material = new THREE.MeshBasicMaterial({ map: atmTex }); sfx('beep', 0.6); toast('🏧 הכספומט נדלק: "יתרתך: 12.50 ₪ (1994)". פעם זה היה פלאפל ושתייה.'); setTimeout(() => toast('🧾 הכספומט מדפיס קבלה: "למה אתה עוזב?"', 'bad'), 3000); });
  }
  if (room === 'C') {
    setCP(3); once('pa5', () => { pa('ה-ה-ק-ר-נ-ה... מ-ת-ח-י-ל-ה... נ-א... ל-כ-ב-ו-ת... ב-י-פ-ר-י-ם...'); setTimeout(() => { screen.material = new THREE.MeshBasicMaterial({ map: slideTex }); toast('📽️ המקרן מקרין: "נא לכבות ביפרים". אתה לא יודע מה זה ביפר. הבובות יודעות.'); }, 2500); });
    if (lx > 38) once('pigeons', () => { burstPigeons(); toast('🕊️ 40 יונים פרצו מהמסך. הן לא תקפו. הן רק הסתכלו. בשיפוטיות.', 'bad'); });
  }
  if (room === 'B' && H.phase === 'explore') once('pa6', () => pa('מ-ס-ל-ו-ל... ש-ב-ע... ה-ח-ת-ו-ל-ה... מ-ח-כ-ה... ל-ך...'));
  if (shoes.visible && Math.hypot(P.pos.x - shoes.position.x, P.pos.z - shoes.position.z) < 2) { shoes.visible = false; H.flags.shoes = true; sfx('pickup'); toast('👟 נעלי באולינג מידה 43. של מוטי. נאסף. (בונוס)', 'good'); }
  if (room === 'V' && H.phase === 'escape') { setCP(5); once('wed', () => { toast('💃 אולם האירועים: חתונה מ-1994. הדי-ג\'יי עדיין מחכה לסלואו. אל תעצור לרקוד.'); H.slowT = 4; toast('🎶 די-ג\'יי צביקה שם סלואו. הבובות מתחלקות לזוגות. יש לך 4 שניות. אף אחד לא הזמין אותך.', 'good', 5000); }); }
  if (H.slowT > 0) H.slowT -= dt;
  if (room === 'E2') {
    if (H.phase === 'escape') { P.pushX = 3.5; once('esc', () => { toast('↘️ המדרגות הנעות נוסעות בכיוון ההפוך. כמו החיים שלך. תחזיק Shift ותרוץ.', 'bad', 6000); pa('תודה שקניתם בקניון הישן! אל תשכחו לחזור! אל תשכחו! לחזור! לחזור!', false); }); }
  } else P.pushX = 0;
  if (room === 'L' && H.phase === 'escape') { once('pa9', () => { pa('ה-ק-נ-י-ו-ן... נ-ס-ג-ר... ת-ו-ד-ה... ש-ב-א-ת-ם... ש-ו-ב...'); toast('🚪 האור של היציאה! או שזה עוד שלט של בנק. לא, זו היציאה!'); }); if (lx < -10) { P.pushX = 0; exitMall(); return; } }
  // nest interaction
  const nd = Math.hypot(P.pos.x - nest.position.x, P.pos.z - nest.position.z);
  H.nearNest = H.phase === 'explore' && nd < 4;
  // carts
  for (const c of carts) {
    if (!c.on) continue; c.g.position.addScaledVector(c.v, dt); c.g.position.y = interiorGround(c.g.position.x, c.g.position.z);
    if (Math.hypot(c.g.position.x - P.pos.x, c.g.position.z - P.pos.z) < 1.1) { if (c.v.length() > 5 && !safe) { fail('עגלת קניות דרסה אותך. במהירות של 4 קמ"ש. זה לא כואב. זה משפיל.'); return; } c.v.multiplyScalar(0); }
    if (c.g.position.z > IZ + 19) c.on = false;
  }
  // pigeons
  for (const p of pigeons) if (p.g.visible) { p.g.position.addScaledVector(p.v, dt); p.v.y -= dt * 0.5; p.g.userData.wings.forEach((w, i) => w.rotation.z = Math.sin(t * 30 + i * 3) * 0.8 * (i ? 1 : -1)); if (p.g.position.x < IX + 20 || p.g.position.y < 0.3) p.g.visible = false; }
  // mannequins — they move only when unobserved
  const activeGroups = H.phase === 'explore' ? { F: 1, K: 1 } : { V: 1, B: 1, K: 0 };
  for (const m of MAN) {
    if (!activeGroups[m.group] || safe) continue;
    if (H.slowT > 0 && m.group === 'V') { m.h.armL.rotation.z = -1.2; m.h.armR.rotation.z = 1.2; m.h.g.rotation.y += dt * 2; continue; }
    const g = m.h.g, d = Math.hypot(g.position.x - P.pos.x, g.position.z - P.pos.z);
    if (d > 36 || Math.abs(g.position.y - P.pos.y) > 3) continue;
    if (seen(g)) { if (m.moved) { m.moved = false; sfx('scrape'); poseHuman(m.h, pick(['mannequin', 'reach', 'point', 'arms-up'])); } continue; }
    const sp = H.phase === 'explore' ? 4.8 : 6.5, dx = P.pos.x - g.position.x, dz = P.pos.z - g.position.z;
    g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; collide(g.position, 0.45);
    g.position.y = interiorGround(g.position.x, g.position.z); g.rotation.y = Math.atan2(dx, dz); m.moved = true;
    if (m.group === 'F') H.fashionMoved = true;
    if (!m.whisper && Math.random() < dt * 0.35) { m.whisper = label(pick(WHISPERS), { bg: 'rgba(0,0,0,.6)', fg: '#e8dcc8', px: 26, k: 0.012 }); m.whisper.position.y = 3; g.add(m.whisper); sfx('whisper'); setTimeout(() => { g.remove(m.whisper); m.whisper = null; }, 2500); }
    if (d < 1.25) { fail(); return; }
  }
  // escape: כיכרון follows your breadcrumbs, pins fall
  if (H.phase === 'escape') {
    if ((H.crumbT = (H.crumbT || 0) - dt) <= 0) { H.crumbT = 0.25; H.crumbs.push([P.pos.x, P.pos.z]); }
    if (!safe && (H.kT -= dt) <= 0 && H.crumbs.length) {
      const [tx, tz] = H.crumbs[0], dx = tx - kikaron.position.x, dz = tz - kikaron.position.z, d = Math.hypot(dx, dz), sp = 10.5 * dt;
      if (d < sp) H.crumbs.shift(); else { kikaron.position.x += dx / d * sp; kikaron.position.z += dz / d * sp; kikaron.rotation.y = Math.atan2(dx, dz); }
      kikaron.position.y = interiorGround(kikaron.position.x, kikaron.position.z) + Math.abs(Math.sin(t * 9)) * 0.3;
    }
    if ((H.kLineT = (H.kLineT || 0) - dt) <= 0) { H.kLineT = 4; if (H.kLabel) kikaron.remove(H.kLabel); H.kLabel = label(KIKARON_LINES[H.kLine++ % KIKARON_LINES.length], { bg: '#e63946', px: 40, k: 0.016 }); H.kLabel.position.y = 5.6; kikaron.add(H.kLabel); }
    if (!safe && Math.hypot(kikaron.position.x - P.pos.x, kikaron.position.z - P.pos.z) < 1.8) { fail('כיכרון חיבק אותך. חזק. לנצח. טוב, לא לנצח – עד הצ\'קפוינט.'); return; }
    for (const p of pins) if (!p.down && Math.hypot(p.m.position.x - P.pos.x, p.m.position.z - P.pos.z) < 0.9) { p.down = true; p.m.rotation.z = 1.5; p.m.position.y = -5.8; sfx('pin'); if (++H.pinsDown === 10) achieve('bowl', 'באולינג בחושך', 'הפלת 10 פינים תוך כדי בריחה מכיכרון. סטרייק!'); }
  }
}
export const nearNest = () => H.nearNest;
export async function takeStamp() {
  H.nearNest = false;
  await say('יוסי', 'מיצי. תני לי את החותמת. בבקשה.');
  await say('מיצי', 'מיאו. (תרגום: לא.)');
  const c = await ask('יוסי', '...', ['אני אתן לך שניצל של סבתא.', 'זה של ראש העיר! זה רכוש ציבורי!', 'למה את לוקחת דברים נוצצים?']);
  await say('מיצי', ['מיאו. (תרגום: ...מהקופסה? העסקה מקובלת. לסבתא שלך יש ידיים של מלאך.)', 'מיאו. (תרגום: אני רכוש ציבורי. כל העיר מאכילה אותי. גם אתה, בקרוב.)', 'מיאו. (תרגום: כי פה נשארו רק דברים שאף אחד לא בא לקחת. אני אוספת אותם. מישהו צריך.)'][c]);
  stamp.visible = false; mitzi.visible = false; sfx('stamp');
  toast('🔏 נאספה: החותמת העירונית. היא דביקה. אל תשאל ממה.', 'good');
  setTimeout(() => toast('גם בקן: חצי מספריים ענקיות, דיסק של "כוורת", ומפתחות של רכב כסוף. של אורנה? כנראה לא. אולי.'), 2500);
  // the mall wakes up
  H.lightsOn = true; H.phase = 'escape'; hemi.intensity = 0.45; sfx('sting'); music('mall92'); pa('הקניון נפתח מחדש! כל הסחורה ב-50% הנחה! אף אחד לא יוצא!', false);
  setObjective('הקניון הישן: הקומה הנשכחת', [[true, 'למצוא את הקן של מיצי'], [true, 'לקחת את החותמת'], [false, 'לצאת. חי. (היציאה – במעלה המדרגות הנעות)']]);
  await new Promise(r => setTimeout(r, 1500));
  curtain.visible = false; kikaron.visible = true; H.cp = null; setCP(4); resetEnemies(); H.safeT = GRACE;
  kikaron.position.set(IX + 62, -6, IZ + 11);
  toast('⏱️ 2:00 לצאת. הבובות כבר לא מתביישות.', 'bad', 6000); music('chase');
  startTimer(120, 'לצאת מהקניון', () => fail('נגמר הזמן. הקניון נסגר איתך בפנים. מוטי ישמור לך מנה. חוזרים לצ\'קפוינט.'));
}
