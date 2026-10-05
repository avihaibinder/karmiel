// Landmarks: hand-made props placed at the real OpenStreetMap positions of Karmiel's famous spots.
import { THREE, scene, mat, mesh, boxG, cylG, sign, canvasTex, label, merge, vcMat, FONT } from './core.js';
import { H, POI, ROADS, RAILS, BUILDINGS, groundAt, addBoxCollider, addCircleCollider, addPlatform, groundExtra, pointInPoly, polySign, CAR_G, free, addInst } from './world.js';

export const LM = {};
// ---------------------------------------------------------------- geometry helpers
function nearestOnLine(pts, x, z) {
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez) || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (L * L)));
    const qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(x - qx, z - qz);
    if (!best || d < best.d) best = { x: qx, z: qz, d, tx: ex / L, tz: ez / L, i, t };
  }
  return best;
}
export function nearestRoad(x, z, filter = r => r.cls <= 4) {
  let best = null;
  for (const r of ROADS) { if (!filter(r)) continue; const n = nearestOnLine(r.pts, x, z); if (n && (!best || n.d < best.d)) best = { ...n, r }; }
  return best;
}
// point on a building's wall nearest to (x, z), with the outward normal
export function wallPoint(b, x, z) {
  const n = nearestOnLine([...b.pts, b.pts[0]], x, z), s = polySign(b.pts);
  const nx = n.tz * s, nz = -n.tx * s;   // outward, also on concave footprints
  return { x: n.x, z: n.z, nx, nz, rot: Math.atan2(nx, nz) };
}
export const nearestBuilding = (x, z, filter = () => true) => BUILDINGS.filter(filter).reduce((a, b) => { const d = Math.hypot(b.cx - x, b.cz - z); return !a || d < a.d ? { b, d } : a; }, null).b;
const off = (p, d, side = 0) => ({ x: p.x + p.nx * d - p.nz * side, z: p.z + p.nz * d + p.nx * side });
export function storefront(bld, x, z, lines, bg, fg = '#fff', w = 8) {
  const wp = wallPoint(bld, x, z), y = H(wp.x, wp.z);
  sign(wp.x + wp.nx * 0.2, y + 4.2, wp.z + wp.nz * 0.2, w, 1.6, lines, { bg, fg, rot: wp.rot });
  mesh(boxG(w * 0.8, 3, 0.2), mat(0x7fb3d5, { metalness: 0.3, roughness: 0.2 }), wp.x + wp.nx * 0.12, y + 1.5, wp.z + wp.nz * 0.12).rotation.y = wp.rot;
  return wp;
}
export function bench(x, z, rot) { const g = new THREE.Group(); mesh(boxG(2.4, 0.15, 0.7), 0x8a5a3b, 0, 0.55, 0, g); mesh(boxG(2.4, 0.6, 0.1), 0x8a5a3b, 0, 0.95, -0.3, g); for (const s of [-1, 1]) mesh(boxG(0.1, 0.55, 0.6), 0x333333, s * 1.05, 0.27, 0, g); g.position.set(x, H(x, z), z); g.rotation.y = rot; scene.add(g); addBoxCollider(x, z, 2.4, 0.7, rot); return g; }
export function umbrellaTable(x, z) { const y = H(x, z); mesh(cylG(0.6, 0.6, 0.08, 10), 0xffffff, x, y + 0.8, z); mesh(cylG(0.05, 0.05, 2.4, 5), 0x555555, x, y + 1.2, z); mesh(new THREE.ConeGeometry(1.6, 0.6, 8), 0xe63946, x, y + 2.5, z); addCircleCollider(x, z, 0.7); }
const flags = []; export const FLAGS = flags;
function flagTex(kind) {
  return canvasTex(300, 210, (x) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 300, 210);
    if (kind === 'il') { x.fillStyle = '#0038b8'; x.fillRect(0, 22, 300, 30); x.fillRect(0, 158, 300, 30); x.strokeStyle = '#0038b8'; x.lineWidth = 8; for (const s of [1, -1]) { x.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 * s + i * Math.PI * 2 / 3; x.lineTo(150 + Math.cos(a) * 40, 105 + Math.sin(a) * 40); } x.closePath(); x.stroke(); } }
    else { x.fillStyle = '#2d8a4e'; x.fillRect(0, 0, 300, 210); x.fillStyle = '#fff'; x.font = `900 64px ${FONT}`; x.textAlign = 'center'; x.fillText('כרמיאל', 150, 125); }
  }, false);
}
export function flagpole(x, z, kind = 'il', h = 9) {
  const y = H(x, z); mesh(cylG(0.1, 0.14, h), 0xdddddd, x, y + h / 2, z); addCircleCollider(x, z, 0.25);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.1).translate(1.5, 0, 0), new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide }));
  f.position.set(x, y + h - 1.2, z); f.castShadow = true; scene.add(f); flags.push(f);
}

// =====================================================================
// train station + the train (Israel Railways double-decker)
// =====================================================================
{
  const st = POI.station;
  let rail = null; for (const r of RAILS) { const n = nearestOnLine(r, st.x, st.z); if (!rail || n.d < rail.d) rail = { ...n, line: r }; }
  let nx = -rail.tz, nz = rail.tx; if (nx * (st.x - rail.x) + nz * (st.z - rail.z) < 0) { nx = -nx; nz = -nz; }
  const rot = Math.atan2(rail.tx, rail.tz), c = { x: rail.x, z: rail.z };
  const at = (d, s = 0) => ({ x: c.x + nx * d + rail.tx * s, z: c.z + nz * d + rail.tz * s });
  // platform (walkable)
  const pc = at(5.2), py = H(pc.x, pc.z) + 1.1;
  mesh(boxG(4.6, 1.2, 80), 0xcfc6b5, pc.x, py - 0.6, pc.z).rotation.y = rot;
  mesh(boxG(0.3, 0.02, 80), 0xf5c542, at(3.1).x, py + 0.01, at(3.1).z).rotation.y = rot;
  const corners = [[-2.3, -40], [2.3, -40], [2.3, 40], [-2.3, 40]].map(([a, b]) => [pc.x + nx * a + rail.tx * b, pc.z + nz * a + rail.tz * b]);
  addPlatform(corners, py);
  for (let s = -30; s <= 30; s += 12) { const p = at(6.8, s); mesh(cylG(0.12, 0.12, 4, 6), 0x777777, p.x, py + 2, p.z); }
  mesh(boxG(4, 0.3, 70), 0xd62828, at(5.8).x, py + 4, at(5.8).z).rotation.y = rot;
  // station building
  const sb = at(15), sy = H(sb.x, sb.z);
  const bldg = mesh(boxG(10, 7, 26), 0xf1f1f1, sb.x, sy + 3.5, sb.z); bldg.rotation.y = rot;
  mesh(boxG(10.3, 2, 26.3), mat(0x5d8aa8, { metalness: 0.3, roughness: 0.25 }), sb.x, sy + 4.5, sb.z).rotation.y = rot;
  mesh(boxG(14, 0.5, 30), 0xd62828, sb.x, sy + 7.2, sb.z).rotation.y = rot;
  addBoxCollider(sb.x, sb.z, 10, 26, rot);
  const sg = at(20.4); sign(sg.x, sy + 8.8, sg.z, 16, 2.6, ['כרמיאל', 'רכבת ישראל'], { bg: '#003d7a', rot: Math.atan2(nx, nz) });
  // gate where Itzik stands (city side of the building)
  LM.gate = at(22, 16); LM.platform = at(5, 0); LM.stationFace = Math.atan2(nx, nz);
  for (const s of [12.5, 19.5]) { const p = at(22, s); mesh(boxG(1.2, 1.1, 0.3), 0x555555, p.x, H(p.x, p.z) + 0.55, p.z).rotation.y = rot + Math.PI / 2; }
  // the train
  const train = new THREE.Group(), g = merge([
    [boxG(3.2, 4.2, 20).translate(0, 2.7, 0), 0xf4f4f4], [boxG(3.24, 0.9, 19).translate(0, 3.6, 0), 0x223344], [boxG(3.24, 0.8, 19).translate(0, 2.1, 0), 0x223344],
    [boxG(3.26, 0.25, 20).translate(0, 1.2, 0), 0xd62828], [boxG(3.26, 0.2, 20).translate(0, 4.5, 0), 0x0b4ea2], [boxG(3, 0.3, 19.6).translate(0, 4.95, 0), 0x9aa1a8],
  ]);
  const tm = vcMat({ roughness: 0.6 });
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(g, tm); m.position.z = (i - 1.5) * 20.6; m.castShadow = true; train.add(m); }
  train.position.set(c.x, H(c.x, c.z) + 0.4, c.z); train.rotation.y = rot; scene.add(train);
  const trainCol = addBoxCollider(c.x, c.z, 3.4, 83, rot);
  LM.train = { g: train, line: rail.line, i: rail.i, t: rail.t, col: trainCol, dir: rail.tx < 0 ? 1 : -1, rot };
  LM.stationSign = at(20.4);
}
// green highway sign on Road 85 by the station
{ const r = nearestRoad(POI.station.x, POI.station.z, r => r.cls === 0); const y = H(r.x, r.z); sign(r.x - r.tz * 12, y, r.z + r.tx * 12, 12, 3.2, ['כרמיאל ⟵  עכו | צפת ⟶', 'תל אביב 130 ק"מ (בהצלחה)'], { bg: '#0b6e3a', posts: 2.2, rot: Math.atan2(-r.tz, r.tx) + Math.PI / 2 }); }

// =====================================================================
// central bus station
// =====================================================================
{
  const b = POI.bus, r = nearestRoad(b.x, b.z), rot = Math.atan2(r.tx, r.tz), y = H(b.x, b.z);
  const c = { x: b.x, z: b.z };
  mesh(boxG(8, 0.5, 30), 0x2e8b57, c.x, y + 4.5, c.z).rotation.y = rot;
  for (let s = -12; s <= 12; s += 12) for (const d of [-3.5, 3.5]) { const x = c.x + r.tx * s - r.tz * d, z = c.z + r.tz * s + r.tx * d; mesh(cylG(0.15, 0.15, 4.5, 6), 0x777777, x, y + 2.25, z); }
  sign(c.x + r.tz * 4.2, y + 5.6, c.z - r.tx * 4.2, 14, 1.6, ['התחנה המרכזית כרמיאל'], { bg: '#2e8b57', rot: Math.atan2(r.tz, -r.tx) });
  LM.bus = { x: c.x, z: c.z, rot };
}

// =====================================================================
// Kikar HaIr mall — 1992, once the heart of the city, now "a dangerous building"
// =====================================================================
{
  const b = BUILDINGS.find(b => b.lm === 'kikar'), wp = wallPoint(b, POI.bus.x, POI.bus.z), y = H(wp.x, wp.z);
  LM.kikar = { b, entrance: off(wp, 2.5), wp };
  sign(wp.x + wp.nx * 0.4, b.top - 1.6, wp.z + wp.nz * 0.4, 18, 2.6, ['קניון כיכר העיר', 'נפתח ב-1992'], { bg: '#6b4a45', fg: '#e8dcc8', rot: wp.rot }).children[0].rotation.z = 0.07;
  const door = mesh(boxG(8, 5, 0.3), 0x15171a, wp.x + wp.nx * 0.2, y + 2.5, wp.z + wp.nz * 0.2); door.rotation.y = wp.rot;
  for (const r of [0.5, -0.5]) { const p = mesh(boxG(7, 0.4, 0.15), 0x7a5a3a, wp.x + wp.nx * 0.45, y + 2.5, wp.z + wp.nz * 0.45); p.rotation.set(0, wp.rot, r); }
  const ds = off(wp, 5, 7); sign(ds.x, H(ds.x, ds.z), ds.z, 4.4, 1.4, ['⚠ מבנה מסוכן', 'הכניסה אסורה (חוץ מחתולים)'], { bg: '#f5c542', fg: '#222', posts: 1.6, rot: wp.rot });
  for (let i = -3; i <= 3; i++) { const p = off(wp, 4, i * 1.6); mesh(new THREE.ConeGeometry(0.3, 0.8, 8), 0xff7a1a, p.x, H(p.x, p.z) + 0.4, p.z); }
  // graffiti "Yossi was here"
  const graffiti = (name, g) => canvasTex(256, 128, (c) => { c.font = `900 52px ${FONT}`; c.fillStyle = '#e63946'; c.save(); c.translate(128, 70); c.rotate(-0.12); c.textAlign = 'center'; c.direction = 'rtl'; c.fillText(`${name} ${g === 'f' ? 'היתה' : 'היה'} פה`, 0, 0, 240); c.restore(); c.strokeStyle = '#4fc3f7'; c.lineWidth = 6; c.beginPath(); c.moveTo(20, 110); c.bezierCurveTo(80, 80, 160, 125, 240, 95); c.stroke(); }, false);
  const gr = graffiti('יוסי');
  const gp = off(wp, 0.35, -9), gm = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshStandardMaterial({ map: gr, transparent: true }));
  gm.position.set(gp.x, y + 2.5, gp.z); gm.rotation.y = wp.rot; scene.add(gm);
  LM.setGraffiti = (name, g) => { gm.material.map = graffiti(name, g); gm.material.needsUpdate = true; };
  LM.kikarLamp = mesh(boxG(1.2, 0.3, 0.6), mat(0xfff2c0, { emissive: 0xffe08a, emissiveIntensity: 1 }), wp.x + wp.nx * 0.6, y + 5.6, wp.z + wp.nz * 0.6);
  // Moti's falafel stand — the last business standing
  const m = off(wp, 6, -6), my = H(m.x, m.z);
  const st = new THREE.Group(); mesh(boxG(3.2, 1.1, 1.2), 0xf4a261, 0, 0.55, 0, st); mesh(boxG(3.6, 0.2, 2), 0xe63946, 0, 2.7, -0.3, st); for (const s of [-1, 1]) mesh(cylG(0.06, 0.06, 2.7, 5), 0x555555, s * 1.6, 1.35, -1.1, st);
  sign(0, 3.3, -0.3, 3.4, 0.7, ['פלאפל מוטי · מאז 1992'], { bg: '#ffd166', fg: '#222', parent: st });
  st.position.set(m.x, my, m.z); st.rotation.y = wp.rot; scene.add(st); addBoxCollider(m.x, m.z, 3.2, 1.2, wp.rot);
  LM.moti = off(wp, 4.6, -6); LM.motiRot = wp.rot + Math.PI;
  for (let i = 0; i < 2; i++) { const p = off(wp, 8 + i * 1.2, -2 + i * 1.5); mesh(boxG(0.5, 0.5, 0.5), 0xffffff, p.x, H(p.x, p.z) + 0.45, p.z); }   // plastic chairs
  LM.savtaChair = off(wp, 8, -2);
}

// =====================================================================
// City Hall, the plaza, flags, the eternal ribbon
// =====================================================================
{
  const b = BUILDINGS.find(b => b.lm === 'cityhall'), r = nearestRoad(b.cx, b.cz), wp = wallPoint(b, r.x, r.z), y = H(wp.x, wp.z);
  sign(wp.x + wp.nx * 0.4, b.top - 1.4, wp.z + wp.nz * 0.4, 16, 2.4, ['עיריית כרמיאל'], { bg: '#1f4e9c', rot: wp.rot });
  for (let i = -1; i <= 1; i++) { const p = off(wp, 9, i * 4); flagpole(p.x, p.z, i ? 'il' : 'k'); }
  const rb = off(wp, 12, 7); for (const s of [-3, 3]) { const p = off(wp, 12, 7 + s); mesh(cylG(0.08, 0.08, 1.6, 6), 0xd4af37, p.x, H(p.x, p.z) + 0.8, p.z); }
  const rib = mesh(boxG(6, 0.3, 0.04), 0xd62828, rb.x, H(rb.x, rb.z) + 1.3, rb.z); rib.rotation.y = wp.rot;
  LM.cityhall = { door: off(wp, 3), tsipi: off(wp, 3.5, -3), mayor: off(wp, 11, 4), ribbon: rb, face: wp.rot, boris: off(wp, 20, -12) };
  bench(LM.cityhall.boris.x, LM.cityhall.boris.z, wp.rot + Math.PI);
  // the number board: "Now serving: 3"
  const nb = off(wp, 0.35, 5); LM.numberBoard = sign(nb.x, y + 3.2, nb.z, 2.4, 1.2, ['תור: 3'], { bg: '#111', fg: '#ff4d4d', rot: wp.rot });
}

// =====================================================================
// Midrachov: HaSchnitzelia + copy shop + Lev Karmiel mall
// =====================================================================
{
  const s = POI.schnitzelia, b = nearestBuilding(s.x, s.z), wp = storefront(b, s.x, s.z, ['השניצליה'], '#f6a01a', '#5b1a00', 7);
  LM.schnitzelia = { door: off(wp, 3), dudu: off(wp, 3.2, 2), critic: off(wp, 8, -4), rot: wp.rot };
  for (let i = 0; i < 3; i++) { const p = off(wp, 7 + (i % 2) * 3, -5 + i * 4); umbrellaTable(p.x, p.z); }
  // copy shop two storefronts down the midrachov
  const cb = nearestBuilding(s.x + 30, s.z - 20, x => x !== b), cw = storefront(cb, s.x + 30, s.z - 20, ['מכון צילום · העתקות'], '#3a86ff', '#fff', 7);
  LM.copyShop = off(cw, 2.5);
  const lev = BUILDINGS.find(b => b.lm === 'lev'), lr = nearestRoad(lev.cx, lev.cz), lw = wallPoint(lev, lr.x, lr.z);
  sign(lw.x + lw.nx * 0.4, lev.top - 1.8, lw.z + lw.nz * 0.4, 22, 3, ['קניון לב כרמיאל'], { bg: '#e63946', rot: lw.rot });
  const pb = off(lw, 3, 6); const booth = mesh(boxG(1.4, 2.2, 1.4), 0x3a86ff, pb.x, H(pb.x, pb.z) + 1.1, pb.z); booth.rotation.y = lw.rot; addBoxCollider(pb.x, pb.z, 1.4, 1.4, lw.rot);
  sign(pb.x + lw.nx * 0.75, H(pb.x, pb.z) + 2.5, pb.z + lw.nz * 0.75, 1.4, 0.4, ['📸 תא צילום'], { bg: '#ffd166', fg: '#222', rot: lw.rot });
  LM.photoBooth = off(lw, 4.6, 6); LM.lev = off(lw, 4);
  LM.savtaMidrachov = off(wp, 10, 9);
}

// =====================================================================
// Amphi Park HaGalil — Karmiel Dance Festival stage (seats climb the real slope)
// =====================================================================
{
  const a = POI.amphi; let best = 0, dir = 0;
  for (let k = 0; k < 16; k++) { const ang = k / 16 * Math.PI * 2, h = H(a.x + Math.sin(ang) * 18, a.z + Math.cos(ang) * 18); if (k === 0 || h > best) { best = h; dir = ang; } }
  const y0 = H(a.x, a.z), g = new THREE.Group(); g.position.set(a.x, y0, a.z); g.rotation.y = dir; scene.add(g);
  const prof = [new THREE.Vector2(6, -2)];
  for (let k = 0; k < 8; k++) { const r = 6 + 2 * k; prof.push(new THREE.Vector2(r, 0.7 * (k + 1)), new THREE.Vector2(r + 2, 0.7 * (k + 1))); }
  prof.push(new THREE.Vector2(22, -3));
  mesh(new THREE.LatheGeometry(prof, 28, -Math.PI / 2, Math.PI), mat(0xd9cfbf, { side: THREE.DoubleSide }), 0, 0, 0, g);
  mesh(boxG(18, 1.4, 8), 0x8a5a3b, 0, 0.7, -5, g);
  mesh(boxG(20, 9, 0.5), 0x2b1d3a, 0, 4.5, -9.3, g);
  const bs = sign(0, 6.4, -9, 16, 3.2, ['פסטיבל כרמיאל למחול', 'אמפי פארק הגליל'], { bg: '#8e2de2', parent: g });
  for (const s of [-1, 1]) mesh(boxG(0.4, 11, 0.4), 0x333333, s * 10.5, 5.5, -3, g);
  mesh(boxG(21.4, 0.4, 0.4), 0x333333, 0, 11, -3, g);
  const spots = [0xff4d8d, 0x4fc3f7, 0xffd166, 0x7ee787, 0xb388ff];
  LM.spots = spots.map((c, i) => mesh(boxG(0.8, 0.8, 0.8), mat(c, { emissive: c, emissiveIntensity: 1.5 }), -8 + i * 4, 10.5, -3, g));
  const L = (lx, lz) => { const c = Math.cos(dir), s = Math.sin(dir); return { x: a.x + lx * c + lz * s, z: a.z - lx * s + lz * c }; };
  const corners = [[-9, -9], [9, -9], [9, -1], [-9, -1]].map(([lx, lz]) => { const p = L(lx, lz); return [p.x, p.z]; });
  addPlatform(corners, y0 + 1.4);
  const back = [[-10, -9.6], [10, -9.6], [10, -9], [-10, -9]].map(([lx, lz]) => { const p = L(lx, lz); return [p.x, p.z]; });
  addBoxCollider(L(0, -9.3).x, L(0, -9.3).z, 20, 0.6, dir);
  groundExtra.push((x, z) => {
    const dx = x - a.x, dz = z - a.z, c = Math.cos(dir), s = Math.sin(dir), lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (lz <= 0) return -Infinity; const r = Math.hypot(lx, lz); if (r < 6 || r >= 22) return -Infinity;
    return y0 + 0.7 * (Math.floor((r - 6) / 2) + 1);
  });
  LM.amphi = { stage: L(0, -3.5), galit: L(-4, -2), y: y0 + 1.4, cam: L(0, 16), dir, backstage: L(-12, -10), front: L(0, 4), seat: L(-11, 10) };
}

// =====================================================================
// ORT Braude — the exam courtyard
// =====================================================================
{
  const c = POI.braude, r = nearestRoad(c.x, c.z);
  sign(r.x - r.tz * 8, H(r.x, r.z), r.z + r.tx * 8, 12, 2.2, ['מכללת אורט בראודה', 'להנדסה'], { bg: '#0b4ea2', posts: 2, rot: Math.atan2(-r.tz, r.tx) + Math.PI / 2 });
  // find a free patch near the college for the exam courtyard
  let spot = null;
  for (let rad = 0; rad < 200 && !spot; rad += 8) for (let a = 0; a < 6.28 && !spot; a += 0.4) {
    const x = c.x + Math.cos(a) * rad, z = c.z + Math.sin(a) * rad; let ok = true;
    for (let i = -14; i <= 14 && ok; i += 4) for (let j = -12; j <= 12 && ok; j += 4) if (!free(x + i, z + j)) ok = false;
    if (ok) spot = { x, z };
  }
  spot ||= { x: c.x + 40, z: c.z };
  const y = H(spot.x, spot.z);
  const floor = mesh(boxG(28, 0.3, 24), 0xcfc8ba, spot.x, y + 0.05, spot.z); floor.receiveShadow = true;
  sign(spot.x, y, spot.z - 13, 8, 1.4, ['אולם בחינות 3 · שקט!'], { bg: '#333', posts: 1.6 });
  LM.desks = [];
  let n = 40;
  for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
    const x = spot.x + i * 3.6, z = spot.z + j * 4; n++;
    mesh(boxG(1.4, 0.1, 0.8), 0xb08a5a, x, H(x, z) + 0.8, z); mesh(boxG(0.1, 0.8, 0.1), 0x444444, x, H(x, z) + 0.4, z);
    mesh(boxG(0.6, 0.5, 0.6), 0x3a86ff, x, H(x, z) + 0.25, z + 0.8);
    LM.desks.push({ x, z: z + 0.8, n });
  }
  LM.exam = { center: spot, entrance: { x: spot.x, z: spot.z + 15 }, seat: LM.desks.find(d => d.n === 47), shimshon: { x: spot.x - 6, z: spot.z + 16 } };
  LM.examPath = [[spot.x - 12, spot.z - 10], [spot.x + 12, spot.z - 10], [spot.x + 12, spot.z + 3], [spot.x - 12, spot.z + 3]];
}

// =====================================================================
// BIG Karmiel: pylon + the parking lot of silver cars
// =====================================================================
{
  const b = POI.big, r = nearestRoad(b.x, b.z, r => r.cls <= 3), y = H(r.x, r.z);
  const px = r.x - r.tz * 10, pz = r.z + r.tx * 10;
  mesh(boxG(1.2, 12, 1.2), 0x333333, px, H(px, pz) + 6, pz); addCircleCollider(px, pz, 0.8);
  sign(px, H(px, pz) + 13, pz, 6, 3.6, ['BIG', 'כרמיאל'], { bg: '#d62828', rot: Math.atan2(-r.tz, r.tx) + Math.PI / 2 });
  // a lot of silver cars (S1): find an open area near the centre
  let spot = null;
  for (let rad = 0; rad < 250 && !spot; rad += 10) for (let a = 0; a < 6.28 && !spot; a += 0.35) {
    const x = b.x + Math.cos(a) * rad, z = b.z + Math.sin(a) * rad; let ok = true;
    for (let i = -20; i <= 20 && ok; i += 5) for (let j = -14; j <= 14 && ok; j += 5) if (!free(x + i, z + j)) ok = false;
    if (ok) spot = { x, z };
  }
  spot ||= b; const ly = H(spot.x, spot.z);
  const lot = mesh(boxG(46, 0.3, 34), 0x5a5d62, spot.x, ly + 0.05, spot.z); lot.receiveShadow = true; lot.castShadow = false;
  LM.bigLot = { center: spot, cars: [] };
  const ROWS = ['א', 'ב', 'ג', 'ד', 'ה'];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
    const x = spot.x - 18 + i * 6, z = spot.z - 13 + j * 6.5, silver = Math.random() < 0.85;
    const m = new THREE.Mesh(CAR_G, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0.4, color: silver ? 0xc9ccd1 : [0xb3261e, 0x1f4e8c, 0x2b2d31][i % 3] }));
    m.position.set(x, H(x, z) + 0.12, z); m.rotation.y = Math.PI / 2; m.castShadow = true; scene.add(m); addBoxCollider(x, z, 1.9, 4.2);
    LM.bigLot.cars.push({ m, x, z, row: ROWS[j], n: i + 1 });
  }
  for (let j = 0; j < 5; j++) { const x = spot.x - 23, z = spot.z - 13 + j * 6.5; sign(x, H(x, z), z, 1.4, 1, [ROWS[j]], { bg: '#1d3557', posts: 1.8, rot: Math.PI / 2 }); }
  LM.orna = { x: spot.x - 26, z: spot.z + 17 };
}

// =====================================================================
// Road 85: tremp stop + the median
// =====================================================================
{
  const target = { x: POI.station.x - 520, z: POI.station.z + 60 };
  const r = nearestRoad(target.x, target.z, r => r.cls === 0);
  let nx = -r.tz, nz = r.tx; const cityward = { x: POI.cityhall.x - r.x, z: POI.cityhall.z - r.z }; if (nx * cityward.x + nz * cityward.z < 0) { nx = -nx; nz = -nz; }
  const other = nearestRoad(r.x - nx * 20, r.z - nz * 20, q => q.cls === 0 && q !== r.r);
  const median = other && other.d < 40 ? { x: (r.x + other.x) / 2, z: (r.z + other.z) / 2 } : { x: r.x - nx * 10, z: r.z - nz * 10 };
  const s = { x: r.x + nx * (r.r.w / 2 + 5), z: r.z + nz * (r.r.w / 2 + 5) }, y = H(s.x, s.z), rot = Math.atan2(nx, nz);
  const g = new THREE.Group(); mesh(boxG(6, 0.3, 2.5), 0xd9d9d9, 0, 3, 0, g); mesh(boxG(6, 2.6, 0.15), mat(0x9fc5e8, { transparent: true, opacity: 0.6 }), 0, 1.6, 1.2, g); mesh(boxG(4, 0.5, 0.8), 0x6b6b6b, 0, 0.6, 0.6, g);
  g.position.set(s.x, y, s.z); g.rotation.y = rot + Math.PI; scene.add(g); addBoxCollider(s.x + nx * 0.9, s.z + nz * 0.9, 6, 1.4, rot);
  sign(s.x + r.tx * 5, y, s.z + r.tz * 5, 5, 1.1, ['טרמפיאדה'], { bg: '#f5c542', fg: '#222', posts: 1.8, rot: rot + Math.PI });
  LM.tremp = { stop: s, noa: { x: s.x - nx * 1.5, z: s.z - nz * 1.5 }, median, rot, road: r };
}

// =====================================================================
// Makosh hill viewpoint (race finish) + Yossi's home on Nesiei Israel Blvd
// =====================================================================
{
  const m = POI.makosh; let top = m, th = -1e9;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const x = m.x + i * 12, z = m.z + j * 12, h = H(x, z); if (h > th && free(x, z)) { th = h; top = { x, z }; } }
  flagpole(top.x + 3, top.z, 'il', 8); bench(top.x - 2, top.z + 2, 0);
  sign(top.x + 5, H(top.x + 5, top.z - 4), top.z - 4, 5.5, 1.3, ['תצפית גבעת מכוש'], { bg: '#2d6a4f', posts: 1.6 });
  LM.makosh = top;
  // Yossi lives on Nesiei Israel Blvd, on the stretch closest to the city centre
  const cx = (POI.station.x + POI.cityhall.x) / 2, cz = (POI.station.z + POI.cityhall.z) / 2;
  const p = ROADS.filter(r => r.name === 'שדרות נשיאי ישראל').flatMap(r => r.pts).reduce((a, q) => Math.hypot(q[0] - cx, q[1] - cz) < Math.hypot(a[0] - cx, a[1] - cz) ? q : a);
  const nb = nearestBuilding(p[0], p[1], b => b.kind === 'apt'), wp = wallPoint(nb, p[0], p[1]);
  LM.home = { ...off(wp, 5), face: wp.rot, wp };
  bench(off(wp, 7, 5).x, off(wp, 7, 5).z, wp.rot + Math.PI);
  const mb = off(wp, 1.2, -4); mesh(boxG(1.2, 1.2, 0.5), 0x9aa1a8, mb.x, H(mb.x, mb.z) + 2.2, mb.z).rotation.y = wp.rot;   // mailboxes
  const pl = off(wp, 2.2, -4); mesh(boxG(2, 1, 1.4), 0x8a7f72, pl.x, H(pl.x, pl.z) + 0.5, pl.z).rotation.y = wp.rot; addBoxCollider(pl.x, pl.z, 2, 1.4, wp.rot);
  addPlatform([[pl.x - 1, pl.z - 1], [pl.x + 1, pl.z - 1], [pl.x + 1, pl.z + 1], [pl.x - 1, pl.z + 1]], H(pl.x, pl.z) + 1);
  const cl = off(wp, 9, -8); for (const s of [-2.5, 2.5]) { const q = off(wp, 9, -8 + s); mesh(cylG(0.06, 0.06, 3, 5), 0x777777, q.x, H(q.x, q.z) + 1.5, q.z); }
  mesh(boxG(5, 0.03, 0.03), 0xeeeeee, cl.x, H(cl.x, cl.z) + 2.9, cl.z).rotation.y = wp.rot + Math.PI / 2;
  LM.items1 = { charger: { ...off(wp, 7, 5), y: 1.1 }, id: { ...mb, y: 2.2 }, shirt: { ...cl, y: 2.6 } };
}
