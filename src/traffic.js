// Traffic: cars driving the real OpenStreetMap road graph (junctions, one-ways, roundabouts).
import { THREE, scene, clamp, lerpAngle, pick } from './core.js';
import { ROADS, H, CAR_G, CAR_COLS } from './world.js';
import { BUS_G } from './characters.js';

const DRIVE = ROADS.map((r, idx) => ({ r, idx })).filter(o => o.r.cls <= 4 && o.r.pts.length >= 2);
const JUNC = new Map();   // junction id -> [{r, i}]
for (const { r } of DRIVE) for (const [i, j] of r.junc) { let a = JUNC.get(j); if (!a) JUNC.set(j, a = []); a.push({ r, i }); }
const SPEED = [27, 21, 17, 14, 9.5];
export const cars = [];
export const traffic = { enabled: true, onHit: null, boost: null };
const mk = bus => { const m = new THREE.Mesh(bus ? BUS_G : CAR_G, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, color: bus ? 0x3b9a57 : pick(CAR_COLS) })); m.castShadow = true; scene.add(m); return m; };
for (let i = 0; i < 60; i++) { const bus = Math.random() < 0.06; cars.push({ m: mk(bus), bus, r: null, i: 0, t: 0, dir: 1, v: 10, yaw: 0, x: 0, z: 0, hx: 1, hz: 0 }); }

function allowed(r, i) { const d = []; if (i < r.pts.length - 1 && r.oneway !== -1) d.push(1); if (i > 0 && r.oneway !== 1) d.push(-1); return d; }
function spawn(c, px, pz, near = 140, far = 520) {
  const pool = traffic.boost && Math.random() < 0.6 ? traffic.boost.roads : DRIVE;
  for (let tries = 0; tries < 40; tries++) {
    const { r } = pick(pool), i = Math.floor(Math.random() * r.pts.length), [x, z] = r.pts[i], d = Math.hypot(x - px, z - pz);
    const lim = traffic.boost && pool === traffic.boost.roads ? [20, 400] : [near, far];
    if (d < lim[0] || d > lim[1]) continue;
    const dirs = allowed(r, i); if (!dirs.length) continue;
    Object.assign(c, { r, i, t: Math.random(), dir: pick(dirs), v: SPEED[r.cls] * (0.85 + Math.random() * 0.3) });
    if (c.bus) c.v *= 0.8;
    return true;
  }
  return false;
}
function nextRoad(c) {
  const { r, i } = c, jid = r.junc.get(i), end = (c.dir > 0 && i >= r.pts.length - 1) || (c.dir < 0 && i <= 0);
  if (jid !== undefined) {
    const opts = [];
    for (const o of JUNC.get(jid) || []) { if (o.r === r) continue; for (const d of allowed(o.r, o.i)) opts.push({ r: o.r, i: o.i, dir: d }); }
    if (!end && allowed(r, i).includes(c.dir)) opts.push({ r, i, dir: c.dir }, { r, i, dir: c.dir });   // bias: keep going
    if (r.rb && !end && Math.random() < 0.55) return true;                                               // one more lap. always one more lap.
    if (opts.length) { const o = pick(opts); c.r = o.r; c.i = o.i; c.dir = o.dir; c.v = SPEED[o.r.cls] * (0.85 + Math.random() * 0.3) * (c.bus ? 0.8 : 1); return true; }
  }
  if (!end) return true;
  if (r.oneway) return false;
  c.dir = -c.dir; return true;
}
export function updateTraffic(dt, player) {
  if (!traffic.enabled) { for (const c of cars) c.m.visible = false; return; }
  const px = player.pos.x, pz = player.pos.z;
  for (const c of cars) {
    c.m.visible = true;
    if (!c.r || Math.hypot(c.x - px, c.z - pz) > 650) { if (!spawn(c, px, pz)) { c.m.visible = false; continue; } }
    let dist = c.v * dt;
    for (let guard = 0; guard < 8 && dist > 0; guard++) {
      const a = c.r.pts[c.i], b = c.r.pts[c.i + c.dir];
      if (!b) { if (!nextRoad(c)) { spawn(c, px, pz); break; } continue; }
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01, rem = (1 - c.t) * L;
      if (dist < rem) { c.t += dist / L; dist = 0; }
      else { dist -= rem; c.i += c.dir; c.t = 0; if (!nextRoad(c)) { spawn(c, px, pz); break; } }
    }
    const a = c.r.pts[c.i], b = c.r.pts[c.i + c.dir] || a;
    let hx = b[0] - a[0], hz = b[1] - a[1]; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    const off = c.r.oneway ? 0 : c.r.w * 0.25;
    c.x = a[0] + (b[0] - a[0]) * c.t - hz * off; c.z = a[1] + (b[1] - a[1]) * c.t + hx * off;
    c.yaw = lerpAngle(c.yaw, Math.atan2(-hz, hx), clamp(dt * 8, 0, 1)); c.hx = Math.cos(c.yaw); c.hz = -Math.sin(c.yaw);
    c.m.position.set(c.x, H(c.x, c.z) + 0.42, c.z); c.m.rotation.y = c.yaw;
    // pedestrian collision — nobody brakes
    if (!player.onScooter || true) {
      const dx = px - c.x, dz = pz - c.z, along = dx * c.hx + dz * c.hz, side = -dx * c.hz + dz * c.hx;
      if (Math.abs(along) < (c.bus ? 5.8 : 2.4) && Math.abs(side) < (c.bus ? 1.6 : 1.3) && player.pos.y < c.m.position.y + 3 && traffic.onHit) traffic.onHit(c, side);
    }
  }
}
// concentrate traffic on specific roads (Road 85 crossing mission)
export function boostTraffic(filter) { traffic.boost = filter ? { roads: DRIVE.filter(o => filter(o.r)) } : null; if (filter) for (const c of cars) c.r = null; }
