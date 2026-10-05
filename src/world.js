// World: real Karmiel terrain (SRTM), buildings, roads, roundabouts, parks and trees (OpenStreetMap).
import { THREE, scene, mat, mesh, merge, vcMat, canvasTex, R, rnd, rpick, clamp, boxG, cylG, icoG } from './core.js';
import { KDATA as D } from './data.js';

export const S = D.S;
export const BOUNDS = D.bounds;
export const POI = Object.fromEntries(Object.entries(D.poi).map(([k, [x, z]]) => [k, { x, z }]));
export const PLACES = D.places.map(([name, x, z, hood]) => ({ name, x, z, hood }));

// =====================================================================
// terrain heights: bicubic-upsampled SRTM, 1 unit = 1/S metres
// =====================================================================
const E = D.elev, STEP = 14;
const TX0 = E.x0, TZ0 = E.z0, TW = E.x1 - E.x0, TD = E.z1 - E.z0;
const NX = Math.floor(TW / STEP) + 1, NZ = Math.floor(TD / STEP) + 1;
const raw = (i, j) => (E.h[clamp(j, 0, E.nz - 1) * E.nx + clamp(i, 0, E.nx - 1)] - 250) * S;
const cubic = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
function sampleRaw(x, z) {
  const u = (x - E.x0) / TW * (E.nx - 1), v = (z - E.z0) / TD * (E.nz - 1), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, r = [];
  for (let k = -1; k <= 2; k++) r.push(cubic(raw(i - 1, j + k), raw(i, j + k), raw(i + 1, j + k), raw(i + 2, j + k), fu));
  return cubic(r[0], r[1], r[2], r[3], fv);
}
const HG = new Float32Array(NX * NZ);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HG[j * NX + i] = sampleRaw(TX0 + i * STEP, TZ0 + j * STEP);
export function H(x, z) {
  const u = clamp((x - TX0) / STEP, 0, NX - 1.001), v = clamp((z - TZ0) / STEP, 0, NZ - 1.001), i = u | 0, j = v | 0, fu = u - i, fv = v - j;
  const a = HG[j * NX + i], b = HG[j * NX + i + 1], c = HG[(j + 1) * NX + i], d = HG[(j + 1) * NX + i + 1];
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

// =====================================================================
// ground texture (land use painted on a canvas) + occupancy map for placement
// =====================================================================
const GW = 4096, GH = Math.round(4096 * TD / TW), GS = GW / TW;
const gx = x => (x - TX0) * GS, gz = z => (z - TZ0) * GS;
const groundCanvas = document.createElement('canvas'); groundCanvas.width = GW; groundCanvas.height = GH;
const gctx = groundCanvas.getContext('2d');
const occ = document.createElement('canvas'); occ.width = GW; occ.height = GH;   // black = occupied
const octx = occ.getContext('2d', { willReadFrequently: true });
octx.fillStyle = '#fff'; octx.fillRect(0, 0, GW, GH);
{
  gctx.fillStyle = '#c5ad68'; gctx.fillRect(0, 0, GW, GH);
  for (let i = 0; i < 9000; i++) {
    gctx.fillStyle = rpick(['rgba(120,150,70,.16)', 'rgba(160,130,80,.14)', 'rgba(210,190,120,.18)', 'rgba(95,120,60,.12)']);
    gctx.beginPath(); gctx.ellipse(rnd() * GW, rnd() * GH, R(4, 40), R(3, 26), rnd() * 3, 0, 7); gctx.fill();
  }
}
const AREA_COL = { residential: '#cdc3a4', park: '#86a84e', grass: '#9cb35c', forest: '#5d7d3b', scrub: '#909a56', orchard: '#8aa14e', farm: '#bea865', pitch: '#4f9a48', retail: '#bcb6a8', industrial: '#aaa79e', parking: '#707275', platform: '#bdb3a0' };
const AREA_ORDER = ['residential', 'farm', 'scrub', 'grass', 'orchard', 'forest', 'park', 'pitch', 'retail', 'industrial', 'parking', 'platform'];
export const AREAS = D.a.map(a => { const pts = []; for (let i = 1; i < a.length; i += 2) pts.push([a[i], a[i + 1]]); return { cls: a[0], pts }; });
function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(([x, z], i) => i ? ctx.lineTo(gx(x), gz(z)) : ctx.moveTo(gx(x), gz(z))); ctx.closePath(); }
for (const cls of AREA_ORDER) for (const a of AREAS) if (a.cls === cls) { gctx.fillStyle = AREA_COL[cls]; polyPath(gctx, a.pts); gctx.fill(); if (cls === 'pitch') { gctx.strokeStyle = 'rgba(255,255,255,.6)'; gctx.lineWidth = 1; gctx.stroke(); } }

// +1 when the polygon winds so that (ez, -ex) is the outward edge normal, else -1
export function polySign(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return a > 0 ? 1 : -1; }
export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// =====================================================================
// collision: spatial hash of polygons and circles
// =====================================================================
const CELL = 32, hash = new Map();
const key = (i, j) => i * 100003 + j;
function hashAdd(o, x0, z0, x1, z1) {
  for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
    const k = key(i, j); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(o);
  }
}
export function addPolyCollider(pts, top = 1e9) {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const o = { poly: pts, x0, z0, x1, z1, top }; hashAdd(o, x0, z0, x1, z1); return o;
}
export function addCircleCollider(x, z, r) { const o = { x, z, r }; hashAdd(o, x - r, z - r, x + r, z + r); return o; }
export function addBoxCollider(x, z, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
  return addPolyCollider(pts);
}
// Push circle (p.x, p.z, r) out of everything nearby. Returns true on contact.
export function collide(p, r, y = -1e9) {
  let hit = false; const seen = new Set();
  for (let i = Math.floor((p.x - r) / CELL); i <= Math.floor((p.x + r) / CELL); i++) for (let j = Math.floor((p.z - r) / CELL); j <= Math.floor((p.z + r) / CELL); j++) {
    const a = hash.get(key(i, j)); if (!a) continue;
    for (const o of a) {
      if (seen.has(o)) continue; seen.add(o);
      if (o.poly) {
        if (p.x < o.x0 - r || p.x > o.x1 + r || p.z < o.z0 - r || p.z > o.z1 + r || y > o.top) continue;
        const ins = pointInPoly(p.x, p.z, o.poly);
        let best = 1e9, bx = 0, bz = 0;
        for (let k = 0, m = o.poly.length - 1; k < o.poly.length; m = k++) {
          const [ax, az] = o.poly[m], [cx, cz] = o.poly[k], ex = cx - ax, ez = cz - az, L = ex * ex + ez * ez || 1e-9;
          const t = clamp(((p.x - ax) * ex + (p.z - az) * ez) / L, 0, 1), qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(p.x - qx, p.z - qz);
          if (d < best) { best = d; bx = qx; bz = qz; }
        }
        if (ins) { const dx = bx - p.x, dz = bz - p.z, d = Math.hypot(dx, dz) || 1e-6; p.x = bx + dx / d * r; p.z = bz + dz / d * r; hit = true; }
        else if (best < r) { const dx = p.x - bx, dz = p.z - bz, d = best || 1e-6; p.x = bx + dx / d * r; p.z = bz + dz / d * r; hit = true; }
      } else {
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m && d > 1e-6) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; hit = true; }
      }
    }
  }
  return hit;
}
// walkable raised surfaces (platforms, stages, roundabout islands)
const platforms = [];
export function addPlatform(pts, top) { platforms.push({ pts, top, x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), z0: Math.min(...pts.map(p => p[1])), z1: Math.max(...pts.map(p => p[1])) }); }
export const groundExtra = [];   // functions (x, z) -> height | -Infinity
export function groundAt(x, z) {
  let h = H(x, z);
  for (const p of platforms) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && pointInPoly(x, z, p.pts)) h = Math.max(h, p.top);
  for (const f of groundExtra) h = Math.max(h, f(x, z));
  return h;
}

// =====================================================================
// roads
// =====================================================================
export const ROAD_W = [15, 11, 10, 8.5, 7, 4.6, 6];
export const LOCAL_NAMES = { 'כיכר השלום': 'כיכר האבן' };   // what Karmiel residents actually call things
// the stretch of בירנית through the midrachov (next to HaSchnitzelia) is a pedestrian mall — no cars, stone paving
const _mx = Math.cos(32.914 * Math.PI / 180) * 111320 * S, _mz = 110900 * S;
const MIDR = { x0: (35.2922 - 35.2985) * _mx, x1: (35.2934 - 35.2985) * _mx, z0: -(32.9106 - 32.914) * _mz, z1: -(32.9083 - 32.914) * _mz };
const inMidr = pts => pts.every(([x, z]) => x > MIDR.x0 && x < MIDR.x1 && z > MIDR.z0 && z < MIDR.z1);
export const ROADS = D.r.map(([cls, oneway, rb, name, js, flat]) => {
  name = LOCAL_NAMES[name] || name;
  const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  const junc = new Map(); for (let i = 0; i < js.length; i += 2) junc.set(js[i], js[i + 1]);
  if (name === 'בירנית' && inMidr(pts)) { cls = 6; oneway = 0; name = 'המדרחוב'; }
  return { cls, oneway, rb, name, pts, junc, w: ROAD_W[cls] * (oneway && cls <= 1 && !rb ? 0.75 : 1) };
});
function roadTex(kind) {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = kind === 'ped' ? '#d9ccb0' : kind === 'side' ? '#cfc8ba' : kind === 'svc' ? '#65676b' : '#54575c'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    if (kind === 'ped' || kind === 'side') { x.fillStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < 128; i += 16) { x.fillRect(0, i, 128, 1); x.fillRect(i, 0, 1, 128); } if (kind === 'side') { for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#fff' : '#c62828'; x.fillRect(0, j * 32, 6, 32); x.fillRect(122, j * 32, 6, 32); } } return; }
    x.fillStyle = '#eee';
    if (kind !== 'svc') { x.fillRect(5, 0, 3, 128); x.fillRect(120, 0, 3, 128); }
    if (kind === 'main') x.fillRect(62, 0, 4, 64);
    if (kind === 'hwy') { x.fillRect(62, 0, 4, 60); }
  });
}
const RMAT = {};
const roadMat = (kind, depth) => RMAT[kind] ||= new THREE.MeshStandardMaterial({ map: roadTex(kind), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -depth });
const CLASS_KIND = ['hwy', 'main', 'main', 'main', 'res', 'svc', 'ped'];
const buckets = new Map();   // kind -> {pos, uv, idx}
function bucket(kind) { let b = buckets.get(kind); if (!b) buckets.set(kind, b = { pos: [], uv: [], idx: [] }); return b; }
function densify(pts, maxLen) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / maxLen);
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}
export function ribbon(kind, pts, w, yOff, closed = false) {
  const p = densify(closed ? [...pts, pts[0]] : pts, 5), b = bucket(kind), base = b.pos.length / 3;
  let len = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], c = p[Math.min(p.length - 1, i + 1)];
    let tx = c[0] - a[0], tz = c[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    if (i) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    for (const s of [-1, 1]) { const x = p[i][0] - tz * w / 2 * s, z = p[i][1] + tx * w / 2 * s; b.pos.push(x, H(x, z) + yOff, z); b.uv.push((s + 1) / 2, len / w); }
    if (i) { const q = base + (i - 1) * 2; b.idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
}
const YOFF = [0.42, 0.4, 0.38, 0.36, 0.34, 0.3, 0.28];
for (const r of ROADS) {
  if (r.cls <= 4 && r.cls >= 1 && !r.rb) ribbon('side', r.pts, r.w + 4.4, 0.2);
  ribbon(CLASS_KIND[r.cls], r.pts, r.w, YOFF[r.cls], false);
}
// roundabout islands (Karmiel has ~180 of them — each gets its own art)
export const ROUNDABOUTS = [];
const curbTex = canvasTex(64, 16, (x) => { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#fff' : '#d62828'; x.fillRect(i * 16, 0, 16, 16); } });
// OSM often splits one roundabout into several ways — join them through their shared junction nodes
const rbRoads = ROADS.filter(r => r.rb), rbParent = rbRoads.map((_, i) => i), rbFind = i => rbParent[i] === i ? i : (rbParent[i] = rbFind(rbParent[i]));
{ const byJ = new Map(); rbRoads.forEach((r, i) => { for (const j of r.junc.values()) { if (byJ.has(j)) rbParent[rbFind(i)] = rbFind(byJ.get(j)); else byJ.set(j, i); } }); }
const rbGroups = new Map(); rbRoads.forEach((r, i) => { const k = rbFind(i); if (!rbGroups.has(k)) rbGroups.set(k, []); rbGroups.get(k).push(r); });
for (const grp of rbGroups.values()) {
  const pts = grp.flatMap(r => r.pts); if (pts.length < 5) continue;
  const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cz = pts.reduce((s, p) => s + p[1], 0) / n, w = Math.max(...grp.map(r => r.w));
  const rad = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / n, ir = rad - w / 2 - 0.4;
  if (rad > 60) continue;
  ROUNDABOUTS.push({ x: cx, z: cz, r: rad, ir, name: grp.find(r => r.name)?.name || '' });
  if (ir < 1.5) continue;
  const y = H(cx, cz), ct = curbTex.clone(); ct.needsUpdate = true; ct.repeat.set(Math.round(ir), 1);
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(ir, ir + 0.2, 2.4, Math.max(16, Math.round(ir * 3))), [new THREE.MeshStandardMaterial({ map: ct }), mat(0x6f9a43), mat(0x6f9a43)]);
  isl.position.set(cx, y - 0.7, cz); isl.receiveShadow = true; scene.add(isl);
  addPlatform(Array.from({ length: 12 }, (_, k) => [cx + Math.cos(k / 12 * 6.283) * ir, cz + Math.sin(k / 12 * 6.283) * ir]), y + 0.5);
}

// =====================================================================
// buildings — extruded from real OpenStreetMap footprints
// =====================================================================
export const FLOOR = 2.5;
export const BUILDINGS = [];
function wallTex(kind) {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#d9d4ca'; x.fillRect(0, 118, 128, 10);
    if (kind === 'apt') {
      x.fillStyle = '#56616b'; x.fillRect(22, 26, 84, 60); x.fillStyle = '#9fb6c6'; x.fillRect(26, 30, 76, 52);
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(26, 30, 76, 9);
      x.fillStyle = '#e6e0d2'; x.fillRect(26, 30, 76, 22); x.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 32; i < 52; i += 3) x.fillRect(26, i, 76, 1);
      x.fillStyle = '#c9c2b2'; x.fillRect(14, 86, 100, 8); x.fillStyle = '#8f9aa3'; for (let i = 16; i < 112; i += 6) x.fillRect(i, 94, 2, 14);
    } else if (kind === 'house') {
      x.fillStyle = '#6b5a48'; x.fillRect(36, 34, 56, 56); x.fillStyle = '#a9bfcc'; x.fillRect(40, 38, 48, 48); x.fillStyle = '#7a4f2a'; x.fillRect(30, 30, 6, 64); x.fillRect(92, 30, 6, 64);
    } else if (kind === 'shop') {
      x.fillStyle = '#44525d'; x.fillRect(0, 20, 128, 80); x.fillStyle = '#86a7bd'; for (let i = 4; i < 128; i += 32) x.fillRect(i, 24, 28, 72); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 24, 128, 10);
    } else if (kind === 'kikar') {
      x.fillStyle = '#9c9282'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,30,20,${Math.random() * 0.12})`; x.fillRect(Math.random() * 128, Math.random() * 40, 3 + Math.random() * 8, 40 + Math.random() * 88); }
      x.fillStyle = '#16191c'; x.fillRect(8, 26, 112, 64);
      x.strokeStyle = '#6b7780'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, 26); x.lineTo(52, 60); x.lineTo(40, 90); x.moveTo(90, 26); x.lineTo(76, 52); x.stroke();
    }
  });
}
const WALLMAT = {
  apt: new THREE.MeshStandardMaterial({ map: wallTex('apt'), vertexColors: true, roughness: 0.9 }),
  house: new THREE.MeshStandardMaterial({ map: wallTex('house'), vertexColors: true, roughness: 0.9 }),
  shop: new THREE.MeshStandardMaterial({ map: wallTex('shop'), vertexColors: true, roughness: 0.6 }),
  kikar: new THREE.MeshStandardMaterial({ map: wallTex('kikar'), vertexColors: true, roughness: 1 }),
};
const roofFlat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const TINT = {
  apt: [0xf3ecdc, 0xf7f4ee, 0xefdcc6, 0xe6e2da, 0xf1e6cf, 0xe9d8c8], house: [0xf6f1e7, 0xefe3cc, 0xf3ece4, 0xe8d9c4, 0xdfe6e9],
  shop: [0xd9d9d9, 0xc9d3dc, 0xe0d6c6, 0xcfc9bf], kikar: [0xffffff],
};
const TILE = { apt: 3.4, house: 5, shop: 6, kikar: 5 };
const wallB = {}, roofB = { pos: [], col: [] }, tileB = { pos: [], col: [] };
const wb = k => wallB[k] ||= { pos: [], uv: [], col: [] };
const _c = new THREE.Color(), _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
function tri(b, a, c, d, want, col, uvs) { // push triangle; flip winding so the face normal matches `want`
  _e1.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _e2.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]); _n.crossVectors(_e1, _e2);
  const flip = _n.dot(want) < 0, v = flip ? [a, d, c] : [a, c, d], u = uvs && (flip ? [uvs[0], uvs[2], uvs[1]] : uvs);
  for (let i = 0; i < 3; i++) { b.pos.push(...v[i]); b.col.push(col.r, col.g, col.b); if (u) b.uv.push(...u[i]); }
}
const UP = new THREE.Vector3(0, 1, 0);
export const ROOFTOPS = [];
const CHET_SRC = [];
for (const bd of D.b) {
  const [typ, levels, lm] = bd, pts = [];
  for (let i = 3; i < bd.length; i += 2) pts.push([bd[i], bd[i + 1]]);
  if (lm === 'chet') { CHET_SRC.push(pts); continue; }
  let y0 = 1e9, yMax = -1e9;
  for (const [x, z] of pts) { const h = H(x, z); y0 = Math.min(y0, h); yMax = Math.max(yMax, h); }
  y0 -= 0.6;
  const kind = lm === 'kikar' ? 'kikar' : lm ? 'shop' : typ === 1 ? 'house' : typ === 2 || typ === 5 || typ === 0 ? 'apt' : 'shop';
  const lv = lm === 'kikar' ? 3 : lm ? Math.max(levels, 3) : levels;
  const top = yMax + lv * FLOOR + (kind === 'shop' ? 1 : 0);
  _c.set(lm === 'cityhall' ? 0xe8e0cc : lm === 'lev' ? 0xf1e7d4 : rpick(TINT[kind]));
  const b = wb(kind), tile = TILE[kind], vTop = lv; let per = 0;
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  // outward normal from the winding (signed area) — a centroid test fails on L/U-shaped footprints and left ~600 buildings with inside-out walls
  const sgn = polySign(pts);
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) * sgn, nz = -(bx - ax) * sgn;
    const want = new THREE.Vector3(nx, 0, nz), u0 = per / tile, u1 = (per + L) / tile, vb = vTop - (top - y0) / FLOOR;
    const A = [ax, y0, az], Bp = [bx, y0, bz], C = [bx, top, bz], Dp = [ax, top, az];
    tri(b, A, Bp, C, want, _c, [[u0, vb], [u1, vb], [u1, vTop]]); tri(b, A, C, Dp, want, _c, [[u0, vb], [u1, vTop], [u0, vTop]]);
    per += L;
  }
  // roof
  const hip = typ === 1 && pts.length <= 8 && !lm && rnd() < 0.7;
  if (hip) {
    const apex = [cx, top + R(1.8, 2.8), cz]; _c.set(rpick([0xb5502f, 0xa84528, 0xc0623a, 0x9e3f25]));
    for (let i = 0; i < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; tri(tileB, [ax, top, az], [bx, top, bz], apex, new THREE.Vector3((ax + bx) / 2 - cx, 3, (az + bz) / 2 - cz), _c); }
  } else {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    _c.set(kind === 'kikar' ? 0x6d665c : rpick([0xcfc8bb, 0xc7c2b8, 0xd8d2c4]));
    for (const [a, c, d] of tris) tri(roofB, [pts[a][0], top, pts[a][1]], [pts[c][0], top, pts[c][1]], [pts[d][0], top, pts[d][1]], UP, _c);
    if ((kind === 'apt' || typ === 1) && !lm) ROOFTOPS.push({ pts, top, cx, cz });
  }
  const o = addPolyCollider(pts, top);
  BUILDINGS.push({ typ, lm, pts, cx, cz, top, y0, kind, col: o });
}
// "החתים" on Sha'ar HaGai St. — named for the letter ח: two towers joined at the top by a bridge, with a walk-through passage below
export const CHETS = [];
{
  const chetTex = wallTex('apt');
  for (const pts of CHET_SRC) {
    // minimum-area oriented box of the real footprint; u = long axis
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
      for (const [ux, uz] of [[(bx - ax) / L, (bz - az) / L], [-(bz - az) / L, (bx - ax) / L]]) {
        let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
        for (const [x, z] of pts) { const a = x * ux + z * uz, b = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
        if (a1 - a0 < b1 - b0) continue;
        const area = (a1 - a0) * (b1 - b0); if (!best || area < best.area) best = { area, ux, uz, a0, a1, b0, b1 };
      }
    }
    const { ux, uz, a0, a1, b0, b1 } = best, L = a1 - a0, Wd = b1 - b0, ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
    const cx = ac * ux - bc * uz, cz = ac * uz + bc * ux, rot = Math.atan2(-uz, ux);
    let y0 = 1e9; for (const [x, z] of pts) y0 = Math.min(y0, H(x, z)); y0 -= 0.5;
    const LV = 11, Hh = LV * FLOOR + 0.6, tw = L * 0.36, gap = L - 2 * tw;
    const g = new THREE.Group(); g.position.set(cx, y0, cz); g.rotation.y = rot; scene.add(g);
    const wall = (w, h, d, floors) => { const t = chetTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 3.4)), floors); return new THREE.MeshStandardMaterial({ map: t, color: 0xf3e7cf, roughness: 0.9 }); };
    for (const sgn of [-1, 1]) {
      const m = new THREE.Mesh(boxG(tw, Hh, Wd), wall(tw, Hh, Wd, LV)); m.position.set(sgn * (L / 2 - tw / 2), Hh / 2, 0); m.castShadow = m.receiveShadow = true; g.add(m);
      for (const f of [-1, 1]) mesh(boxG(0.9, Hh, 0.35), 0xd4b483, sgn * (L / 2 - 0.45), Hh / 2, f * (Wd / 2 + 0.1), g);      // tan corner pilasters
      mesh(boxG(tw + 0.4, 0.5, Wd + 0.4), 0xe9dcc2, sgn * (L / 2 - tw / 2), Hh + 0.25, 0, g);                                     // parapet
      const wx = cx + ux * sgn * (L / 2 - tw / 2), wz = cz + uz * sgn * (L / 2 - tw / 2);
      addBoxCollider(wx, wz, tw, Wd, rot);
      const cs = [[-tw / 2, -Wd / 2], [tw / 2, -Wd / 2], [tw / 2, Wd / 2], [-tw / 2, Wd / 2]].map(([a, b]) => [wx + a * ux - b * uz, wz + a * uz + b * ux]);
      ROOFTOPS.push({ pts: cs, top: y0 + Hh + 0.5, cx: wx, cz: wz });   // solar heaters get added with the other rooftops
    }
    const bh = 3 * FLOOR, bridge = new THREE.Mesh(boxG(gap, bh, Wd * 0.92), wall(gap, bh, Wd, 3)); bridge.position.set(0, Hh - bh / 2, 0); bridge.castShadow = true; g.add(bridge);
    mesh(boxG(gap, 0.35, Wd * 0.92), 0xc9b48f, 0, Hh - bh - 0.15, 0, g);                                                          // underside of the "roof" of the ח
    mesh(boxG(gap + 0.4, 0.5, Wd * 0.92 + 0.4), 0xe9dcc2, 0, Hh + 0.25, 0, g);
    CHETS.push({ x: cx, z: cz, ux, uz, rot, L, Wd, y0 });
    BUILDINGS.push({ typ: 2, lm: 'chet', pts, cx, cz, top: y0 + Hh, y0, kind: 'apt' });
  }
}
function buildMesh(b, material, withUv = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
}
for (const [k, b] of Object.entries(wallB)) buildMesh(b, WALLMAT[k]);
buildMesh(roofB, roofFlat, false); buildMesh(tileB, roofFlat, false);
for (const [kind, b] of buckets) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setIndex(b.idx); g.computeVertexNormals();
  const depth = { hwy: 7, main: 6, res: 5, svc: 4, ped: 4, side: 2, ballast: 3, rail: 8 }[kind] ?? 3;
  const m = new THREE.Mesh(g, kind === 'ballast' ? mat(0x8a7f72, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }) : kind === 'rail' ? mat(0xa0a6ad, { metalness: 0.6, roughness: 0.4 }) : roadMat(kind, depth));
  m.receiveShadow = true; scene.add(m);
}

// occupancy: roads, buildings, rails → black
octx.fillStyle = '#000'; octx.strokeStyle = '#000'; octx.lineCap = 'round';
for (const r of ROADS) { octx.lineWidth = (r.w + 5) * GS; octx.beginPath(); r.pts.forEach(([x, z], i) => i ? octx.lineTo(gx(x), gz(z)) : octx.moveTo(gx(x), gz(z))); octx.stroke(); }
for (const b of BUILDINGS) { polyPath(octx, b.pts); octx.fill(); }
export const RAILS = D.rail.map(f => { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i], f[i + 1]]); return p; });
for (const r of RAILS) { octx.lineWidth = 8 * GS; octx.beginPath(); r.forEach(([x, z], i) => i ? octx.lineTo(gx(x), gz(z)) : octx.moveTo(gx(x), gz(z))); octx.stroke(); }
const occData = octx.getImageData(0, 0, GW, GH).data;
export const free = (x, z) => { const i = Math.round(gx(x)), j = Math.round(gz(z)); return i >= 0 && j >= 0 && i < GW && j < GH && occData[(j * GW + i) * 4] > 128; };

// asphalt under the road meshes in the ground texture (fills junction gaps)
gctx.strokeStyle = '#55585d'; gctx.lineCap = 'round'; gctx.lineJoin = 'round';
for (const r of ROADS) { gctx.lineWidth = r.w * GS; gctx.beginPath(); r.pts.forEach(([x, z], i) => i ? gctx.lineTo(gx(x), gz(z)) : gctx.moveTo(gx(x), gz(z))); gctx.stroke(); }

// railway
for (const r of RAILS) { ribbon('ballast', r, 4.4, 0.25); for (const s of [-0.75, 0.75]) ribbon('rail', offsetLine(r, s), 0.16, 0.45); }
function offsetLine(pts, d) {
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return [p[0] - tz / l * d, p[1] + tx / l * d]; });
}
{ // rails were pushed into buckets after the bucket meshes were built — build them now
  for (const kind of ['ballast', 'rail']) {
    const b = buckets.get(kind); if (!b) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setIndex(b.idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, kind === 'ballast' ? mat(0x8a7f72, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }) : mat(0xa0a6ad, { metalness: 0.6, roughness: 0.4 }));
    m.receiveShadow = true; scene.add(m);
  }
}

// =====================================================================
// terrain mesh
// =====================================================================
{
  const pos = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2), col = new Float32Array(NX * NZ * 3);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, h = HG[k];
    pos.set([TX0 + i * STEP, h, TZ0 + j * STEP], k * 3); uv.set([i / (NX - 1), 1 - j / (NZ - 1)], k * 2);
    const sx = (HG[j * NX + Math.min(i + 1, NX - 1)] - HG[j * NX + Math.max(i - 1, 0)]) / (2 * STEP), sz = (HG[Math.min(j + 1, NZ - 1) * NX + i] - HG[Math.max(j - 1, 0) * NX + i]) / (2 * STEP);
    const steep = clamp(Math.hypot(sx, sz) * 1.6, 0, 1), shade = 1 - steep * 0.25;
    col.set([shade, shade * (1 - steep * 0.05), shade * (1 - steep * 0.1)], k * 3);
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let n = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx.set([a, c, b, b, c, d], n); n += 6; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const tex = new THREE.CanvasTexture(groundCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
  m.receiveShadow = true; scene.add(m);
}

// =====================================================================
// vegetation & street furniture (instanced)
// =====================================================================
const INST = {};
const defInst = (type, geo) => INST[type] = { geo, list: [], col: [] };
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
export function addInst(type, x, y, z, rot = 0, s = 1, color) {
  INST[type].list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone().setFromAxisAngle(_up, rot), new THREE.Vector3(s, s, s)));
  if (color !== undefined) INST[type].col.push(color);
}
export function addTree(type, x, z, s = 1) { addInst(type, x, H(x, z) - 0.2, z, rnd() * 6.283, s); if (type !== 'bush' && type !== 'flowers') addCircleCollider(x, z, 0.45 * s); }
defInst('olive', merge([[cylG(0.22, 0.34, 2.2, 6).translate(0, 1.1, 0), 0x6b5236], [icoG(1.7).scale(1.3, 0.85, 1.3).translate(0, 3, 0), 0x8a9a64], [icoG(1.1).translate(0.9, 3.5, 0.4), 0x7d8f5a]]));
defInst('pine', merge([[cylG(0.25, 0.35, 3, 6).translate(0, 1.5, 0), 0x5e4630], [new THREE.ConeGeometry(2.4, 5, 7).translate(0, 4.5, 0), 0x3e6b3a], [new THREE.ConeGeometry(1.7, 3.5, 7).translate(0, 6.8, 0), 0x46783f]]));
defInst('cypress', merge([[cylG(0.18, 0.25, 1.2, 5).translate(0, 0.6, 0), 0x5e4630], [new THREE.ConeGeometry(0.95, 7, 7).translate(0, 4.5, 0), 0x2f5a33]]));
defInst('bush', merge([[icoG(1).scale(1.2, 0.7, 1.2).translate(0, 0.5, 0), 0x6f8a45], [icoG(0.6).translate(0.6, 0.6, 0.3), 0xc2407a]]));
defInst('flowers', merge([[icoG(0.7).scale(1.4, 0.5, 1.4).translate(0, 0.3, 0), 0x5e8a3a], [icoG(0.35).translate(0.4, 0.5, 0), 0xe63946], [icoG(0.35).translate(-0.4, 0.5, 0.2), 0xffd166], [icoG(0.3).translate(0, 0.55, -0.4), 0xb388ff]]));
defInst('rock', merge([[icoG(1.2).scale(1, 0.6, 0.9).translate(0, 0.3, 0), 0xd8d2c4]]));
{
  const parts = [[cylG(0.22, 0.38, 7, 6).translate(0, 3.5, 0), 0x8a6a45]];
  for (let i = 0; i < 8; i++) parts.push([boxG(3.2, 0.08, 0.8).translate(1.6, 0, 0).rotateZ(-0.45).rotateY(i * Math.PI / 4).translate(0, 7, 0), 0x4f8a3a]);
  defInst('palm', merge(parts));
}
defInst('solar', merge([[boxG(1.9, 0.08, 1.3).rotateX(0.55).translate(0, 0.7, 0.35), 0x1d3557], [cylG(0.35, 0.35, 1.9, 8).rotateZ(Math.PI / 2).translate(0, 1.15, -0.45), 0xeeeeee], [boxG(1.9, 0.6, 0.08).translate(0, 0.3, -0.45), 0x999999]]));
defInst('ac', merge([[boxG(1.2, 0.8, 0.7).translate(0, 0.4, 0), 0xdedede], [cylG(0.3, 0.3, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0.4, 0.36), 0x777777]]));
defInst('lamp', merge([[cylG(0.08, 0.12, 6, 6).translate(0, 3, 0), 0x4a4f55], [boxG(0.1, 0.1, 1.6).translate(0, 5.9, 0.7), 0x4a4f55], [boxG(0.45, 0.2, 0.6).translate(0, 5.8, 1.4), 0xfff2c0]]));
defInst('sculpt', merge([[cylG(0.9, 1.1, 1.2, 8).translate(0, 0.6, 0), 0xcfc6b5], [new THREE.TorusKnotGeometry(0.9, 0.28, 40, 6).translate(0, 2.6, 0), 0xe76f51]]));
defInst('mill', merge([[cylG(1.6, 1.6, 0.6, 16).translate(0, 0.3, 0), 0xbdb3a1], [cylG(1.4, 1.4, 0.5, 16).rotateX(Math.PI / 2 - 0.1).translate(0.6, 1.9, 0), 0xa99f8d]]));
export const CAR_G = merge([
  [boxG(4.2, 0.9, 1.9).translate(0, 0.75, 0), 0xffffff], [boxG(2.3, 0.75, 1.72).translate(-0.25, 1.55, 0), 0x2a3440],
  ...[[1.3, 0.9], [1.3, -0.9], [-1.3, 0.9], [-1.3, -0.9]].map(([x, z]) => [cylG(0.4, 0.4, 0.3, 10).rotateX(Math.PI / 2).translate(x, 0.4, z), 0x111111]),
  [boxG(0.1, 0.25, 1.5).translate(2.11, 0.85, 0), 0xfff2b0], [boxG(0.1, 0.25, 1.5).translate(-2.11, 0.85, 0), 0xd62828],
]);
defInst('parked', CAR_G);
export const CAR_COLS = [0xf2f2f2, 0xf2f2f2, 0xf2f2f2, 0xc0c4c8, 0x9aa0a6, 0x2b2d31, 0xb3261e, 0x1f4e8c, 0xe8e1d0, 0x3d6b4f];

// parks, forests, orchards: scatter
const DENS = { park: 0.0035, forest: 0.008, scrub: 0.002, orchard: 0.006, grass: 0.0008, pitch: 0 };
for (const a of AREAS) {
  const d = DENS[a.cls]; if (!d) continue;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of a.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const n = Math.min(900, Math.round((x1 - x0) * (z1 - z0) * d));
  for (let i = 0; i < n; i++) {
    const x = R(x0, x1), z = R(z0, z1);
    if (!pointInPoly(x, z, a.pts) || !free(x, z)) continue;
    const t = a.cls === 'forest' ? (rnd() < 0.8 ? 'pine' : 'olive') : a.cls === 'orchard' ? 'olive' : a.cls === 'scrub' ? rpick(['bush', 'olive', 'rock']) : rpick(['olive', 'pine', 'cypress', 'bush', 'flowers', 'palm']);
    addTree(t, x, z, R(0.8, 1.3));
  }
}
// street trees + lamps + parked cars along roads
for (const r of ROADS) {
  if (r.rb || r.cls > 4) continue;
  const p = densify(r.pts, 2); let acc = R(0, 10);
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i], L = Math.hypot(bx - ax, bz - az); acc += L;
    const tx = (bx - ax) / (L || 1), tz = (bz - az) / (L || 1);
    const spacing = r.cls <= 3 ? 22 : 16;
    if (acc < spacing) continue; acc = 0;
    for (const s of [-1, 1]) {
      const off = r.w / 2 + 3.2, x = bx - tz * off * s, z = bz + tx * off * s;
      if (!free(x, z)) continue;
      if (r.cls <= 3 && s === 1) addInst('lamp', x, H(x, z), z, Math.atan2(tz * s, -tx * s) + Math.PI, 1);
      else if (rnd() < 0.55) addTree(r.cls <= 2 ? rpick(['palm', 'palm', 'cypress']) : rpick(['olive', 'pine', 'cypress', 'bush']), x, z, R(0.8, 1.1));
      if (r.cls === 4 && rnd() < 0.3) {   // parked car on the kerb side
        const px = bx - tz * (r.w / 2 - 1.1) * s, pz = bz + tx * (r.w / 2 - 1.1) * s, rot = Math.atan2(-tz, tx);
        addInst('parked', px, H(px, pz) + 0.12, pz, rot, 1, rpick(CAR_COLS)); addBoxCollider(px, pz, 4.2, 1.9, rot);
      }
    }
  }
}
// parking lots
for (const a of AREAS) {
  if (a.cls !== 'parking') continue;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of a.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let x = x0 + 2; x < x1 - 2; x += 3) for (let z = z0 + 3; z < z1 - 3; z += 7) {
    if (rnd() > 0.45 || !pointInPoly(x, z, a.pts) || !free(x, z)) continue;
    addInst('parked', x, H(x, z) + 0.12, z, Math.PI / 2, 1, rpick(CAR_COLS)); addBoxCollider(x, z, 1.9, 4.2);
  }
}
// rooftop solar water heaters (the Israeli skyline)
for (const rt of ROOFTOPS) {
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) { const x = rt.cx + R(-3, 3), z = rt.cz + R(-3, 3); if (pointInPoly(x, z, rt.pts)) addInst(rnd() < 0.8 ? 'solar' : 'ac', x, rt.top, z, 0, 1); }
}
// roundabout art
for (const rb of ROUNDABOUTS) {
  if (rb.ir < 1.5) continue;
  if (rb.name === 'כיכר האבן') { const st = mesh(new THREE.DodecahedronGeometry(clamp(rb.ir * 0.45, 1.5, 4), 0), 0xb8ae9a, rb.x, H(rb.x, rb.z) + clamp(rb.ir * 0.45, 1.5, 4) * 0.9, rb.z); st.scale.set(1, 1.35, 0.85); st.rotation.set(0.2, 0.7, 0.1); addCircleCollider(rb.x, rb.z, clamp(rb.ir * 0.45, 1.5, 4)); continue; }
  const y = H(rb.x, rb.z) + 0.5, t = rpick(['olive', 'palm', 'flowers', 'sculpt', 'mill', 'olive', 'cypress']);
  if (t === 'flowers') for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; addInst('flowers', rb.x + Math.cos(a) * rb.ir * 0.6, y, rb.z + Math.sin(a) * rb.ir * 0.6, a, 1); }
  else addInst(t, rb.x, y, rb.z, rnd() * 6, clamp(rb.ir / 4, 0.8, 1.8));
  if (t !== 'flowers') addCircleCollider(rb.x, rb.z, 1.2);
}
// countryside around the city: olives, pines on the ridges, limestone
for (let i = 0; i < 7000; i++) {
  const x = R(BOUNDS.x0 - 800, BOUNDS.x1 + 2200), z = R(BOUNDS.z0 - 700, BOUNDS.z1 + 700);
  if (!free(x, z) || AREAS.some(a => a.cls === 'residential' && Math.abs(a.pts[0][0] - x) < 600 && pointInPoly(x, z, a.pts))) continue;
  const h = H(x, z);
  addTree(h > 90 ? rpick(['pine', 'pine', 'olive', 'rock']) : rpick(['olive', 'olive', 'bush', 'rock', 'pine']), x, z, R(0.8, 1.4));
}
export function finishInstances() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const c = new THREE.Color();
  for (const v of Object.values(INST)) {
    if (!v.list.length) continue;
    const im = new THREE.InstancedMesh(v.geo, v.col.length ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5 }) : m, v.list.length);
    v.list.forEach((mm, i) => { im.setMatrixAt(i, mm); if (v.col.length) im.setColorAt(i, c.set(v.col[i])); });
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  }
}

// =====================================================================
// lookups for the HUD: street names, neighbourhoods
// =====================================================================
const streetHash = new Map();
for (const r of ROADS) {
  if (!r.name) continue;
  for (let i = 1; i < r.pts.length; i++) {
    const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i];
    for (const [x, z] of [[ax, az], [(ax + bx) / 2, (az + bz) / 2], [bx, bz]]) { const k = key(Math.floor(x / 60), Math.floor(z / 60)); let a = streetHash.get(k); if (!a) streetHash.set(k, a = new Set()); a.add(r); }
  }
}
export function streetAt(x, z) {
  let best = null, bd = 18;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const r of streetHash.get(key(Math.floor(x / 60) + i, Math.floor(z / 60) + j)) || []) {
    for (let k = 1; k < r.pts.length; k++) {
      const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k], ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1);
      const d = Math.hypot(x - ax - ex * t, z - az - ez * t); if (d < bd) { bd = d; best = r.name; }
    }
  }
  return best;
}
export function placeAt(x, z) {
  let best = null, bd = 700;
  for (const p of PLACES) { const d = Math.hypot(p.x - x, p.z - z) * (p.hood ? 1 : 1.6); if (d < bd) { bd = d; best = p.name; } }
  return best;
}
// nearest drivable road point (used for spawning)
export function nearestRoadPoint(x, z, maxCls = 4) {
  let best = null, bd = 1e9;
  for (const r of ROADS) { if (r.cls > maxCls) continue; for (const p of r.pts) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = p; } } }
  return best;
}
export { groundCanvas, TX0, TZ0, TW, TD };
