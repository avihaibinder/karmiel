// NPCs: named characters, wandering residents, followers, patrols and stealth view cones.
import { THREE, scene, label, lerpAngle, pick } from './core.js';
import { groundAt, collide, H } from './world.js';
import { makeHuman, animateHuman, danceHuman, poseHuman } from './characters.js';
import { T } from './ui.js';

export const npcs = [];
export function addNPC({ id, name, x, z, look = {}, talk = null, rot = 0, wander = 0, news = () => false, tagY = 3.05, ground = groundAt }) {
  const h = makeHuman(look);
  h.g.position.set(x, ground(x, z), z); h.g.rotation.y = rot; scene.add(h.g);
  const tag = label(name, { px: 30 }); tag.position.y = tagY; h.g.add(tag);
  const mark = label('!', { bg: '#ffd166', fg: '#16161e', px: 46 }); mark.position.y = tagY + 0.8; mark.visible = false; h.g.add(mark);
  const n = { id, name, h, talk, tag, mark, wander, home: { x, z }, dir: [0, 0], t: 0, moving: false, talking: false, news, follow: null, path: null, pi: 0, speed: 1.6, pose: null, dance: false, ground, hidden: false, cone: null, say: null, sayT: 0 };
  npcs.push(n); return n;
}
export const npc = id => npcs.find(n => n.id === id);
export function placeNPC(id, x, z, rot) { const n = npc(id); n.h.g.position.set(x, n.ground(x, z), z); n.home = { x, z }; if (rot !== undefined) n.h.g.rotation.y = rot; n.h.g.visible = true; n.hidden = false; return n; }
export function hideNPC(id, hidden = true) { const n = npc(id); n.hidden = hidden; n.h.g.visible = !hidden; }
export function bark(n, text, sec = 3.5) {
  if (n.say) n.h.g.remove(n.say);
  n.say = label(T(text), { bg: 'rgba(255,255,255,.92)', fg: '#16161e', px: 30, k: 0.011 }); n.say.position.y = n.tag.position.y + 0.9; n.h.g.add(n.say); n.sayT = sec;
}
// flat translucent view cone on the ground; returns detector
export function addCone(n, range = 14, angle = 0.55) {
  const g = new THREE.CircleGeometry(range, 20, Math.PI / 2 - angle, angle * 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.28, depthWrite: false }));
  m.position.y = 0.15; n.h.g.add(m); n.cone = { m, range, angle }; return n.cone;
}
export function removeCone(n) { if (n.cone) { n.h.g.remove(n.cone.m); n.cone = null; } }
export function sees(n, p) {
  if (!n.cone || n.hidden) return false;
  const g = n.h.g.position, dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
  if (d > n.cone.range) return false;
  const a = Math.atan2(dx, dz), diff = Math.abs(((a - n.h.g.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
  return diff < n.cone.angle;
}
export function nearestNPC(p, maxD = 3.8) {
  let best = null, bd = maxD;
  for (const n of npcs) { if (n.hidden || !n.talk) continue; const q = n.h.g.position, d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd && Math.abs(q.y - p.y) < 3.5) { bd = d; best = n; } }
  return best;
}
export function updateNPCs(dt, t, P) {
  for (const n of npcs) {
    if (n.hidden) continue;
    const g = n.h.g, p = g.position, d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    const far = d > 320; g.visible = !far; if (far && !n.follow && !n.path) continue;
    n.tag.visible = d < 45; n.mark.visible = !n.talking && n.news(); if (n.mark.visible) n.mark.position.y = n.tag.position.y + 0.8 + Math.sin(t * 4) * 0.12;
    if (n.say) { n.sayT -= dt; if (n.sayT <= 0) { g.remove(n.say); n.say = null; } }
    if (n.talking) { animateHuman(n.h, 0, t); continue; }
    let moving = false;
    if (n.follow) {
      const f = n.follow, dx = f.x - p.x, dz = f.z - p.z, dd = Math.hypot(dx, dz);
      if (dd > 3.2) { const s = Math.min(dd * 1.5, 13); p.x += dx / dd * s * dt; p.z += dz / dd * s * dt; g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), dt * 8); moving = true; n.curSpeed = s; }
      if (dd > 60) { p.x = f.x - 2; p.z = f.z - 2; }
    } else if (n.path) {
      const [tx, tz] = n.path[n.pi], dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz);
      if (dd < 0.5) { n.pi = (n.pi + 1) % n.path.length; if (n.pathWait) n.waitT = n.pathWait; }
      else if ((n.waitT = (n.waitT || 0) - dt) <= 0) { p.x += dx / dd * n.speed * dt; p.z += dz / dd * n.speed * dt; g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), dt * 6); moving = true; n.curSpeed = n.speed; }
      else g.rotation.y += Math.sin(t * 1.5) * dt * 1.2;   // look around while waiting
    } else if (n.wander) {
      n.t -= dt;
      if (n.t < 0) { n.t = 2 + Math.random() * 4; n.moving = Math.random() < 0.6; const a = Math.random() * 6.28; n.dir = [Math.sin(a), Math.cos(a)]; }
      if (Math.hypot(p.x - n.home.x, p.z - n.home.z) > n.wander) { const hx = n.home.x - p.x, hz = n.home.z - p.z, l = Math.hypot(hx, hz); n.dir = [hx / l, hz / l]; }
      moving = n.moving && d > 4;
      if (moving) { p.x += n.dir[0] * 1.5 * dt; p.z += n.dir[1] * 1.5 * dt; collide(p, 0.5); g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(n.dir[0], n.dir[1]), dt * 6); n.curSpeed = 1.5; }
      else if (d < 4) g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(P.pos.x - p.x, P.pos.z - p.z), dt * 6);
    } else if (d < 6 && !n.pose && !n.dance) g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(P.pos.x - p.x, P.pos.z - p.z), dt * 3);
    const base = n.ground(p.x, p.z);
    if (n.dance) p.y = base + danceHuman(n.h, t * 2 + n.home.x, 0.18);
    else { p.y = base; if (n.pose) poseHuman(n.h, n.pose); else animateHuman(n.h, moving ? (n.curSpeed || 1.5) : 0, t + n.home.x); }
  }
}
