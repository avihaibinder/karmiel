// Characters: blocky humans, animals, the e-scooter, vehicles.
import { THREE, mat, mesh, boxG, cylG, merge, label } from './core.js';

export function makeHuman(o = {}) {
  const g = new THREE.Group(), skin = o.skin ?? 0xe6b98f;
  const mk = (w, h, d, c, x, y, z, p = g) => { const m = new THREE.Mesh(boxG(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const bw = o.belly ? 0.98 : 0.75, bd = o.belly ? 0.62 : 0.42;
  const leg = sx => { const p = new THREE.Group(); p.position.set(sx * 0.19, 0.95, 0); g.add(p); mk(0.3, 0.9, 0.32, o.pants ?? 0x34466e, 0, -0.45, 0, p); mk(0.32, 0.14, 0.44, o.shoes ?? 0x2a2a2a, 0, -0.88, 0.06, p); return p; };
  const legL = leg(-1), legR = leg(1);
  const body = mk(bw, 0.95, bd, o.shirt ?? 0x888888, 0, 1.42, 0);
  const arm = sx => { const p = new THREE.Group(); p.position.set(sx * (bw / 2 + 0.13), 1.85, 0); g.add(p); mk(0.24, 0.8, 0.26, o.sleeve ?? o.shirt ?? 0x888888, 0, -0.38, 0, p); mk(0.22, 0.2, 0.22, skin, 0, -0.86, 0, p); return p; };
  const armL = arm(-1), armR = arm(1);
  const head = new THREE.Group(); head.position.y = 2.15; g.add(head);
  mk(0.52, 0.52, 0.52, skin, 0, 0, 0, head);
  mk(0.08, 0.09, 0.02, 0x1a1a1a, -0.12, 0.04, 0.265, head); mk(0.08, 0.09, 0.02, 0x1a1a1a, 0.12, 0.04, 0.265, head);
  mk(0.16, 0.04, 0.02, 0x7a3b2e, 0, -0.13, 0.265, head);
  if (o.hair !== null) { mk(0.56, 0.16, 0.56, o.hair ?? 0x3b2a1e, 0, 0.3, 0, head); mk(0.56, 0.36, 0.14, o.hair ?? 0x3b2a1e, 0, 0.1, -0.22, head); }
  if (o.bigHair) mk(0.72, 0.32, 0.72, o.hair, 0, 0.36, -0.03, head);
  if (o.sideHair) { for (const s of [-1, 1]) mk(0.07, 0.22, 0.42, o.sideHair, s * 0.29, 0.02, -0.05, head); mk(0.58, 0.18, 0.08, o.sideHair, 0, -0.01, -0.28, head); }   // bald on top
  if (o.ponytail) mk(0.14, 0.5, 0.14, o.hair, 0, 0, -0.38, head).rotation.x = 0.4;
  if (o.glasses) mk(0.46, 0.1, 0.03, 0x111111, 0, 0.05, 0.28, head);
  if (o.shades) mk(0.48, 0.14, 0.03, 0x050505, 0, 0.05, 0.28, head);
  if (o.beard) mk(0.54, 0.24, 0.12, o.beard, 0, -0.2, 0.22, head);
  if (o.mustache) mk(0.3, 0.07, 0.04, o.mustache, 0, -0.08, 0.275, head);
  if (o.cap) { mk(0.58, 0.14, 0.58, o.cap, 0, 0.33, 0, head); mk(0.5, 0.05, 0.3, o.cap, 0, 0.27, 0.36, head); }
  if (o.kippah) mk(0.3, 0.05, 0.3, o.kippah, 0, 0.4, -0.05, head);
  if (o.beret) mk(0.62, 0.1, 0.62, o.beret, 0.06, 0.35, 0, head).rotation.z = -0.2;
  if (o.chef) { mk(0.5, 0.45, 0.5, 0xffffff, 0, 0.5, 0, head); mk(0.6, 0.12, 0.6, 0xffffff, 0, 0.3, 0, head); }
  if (o.scarf) { mk(0.6, 0.14, 0.6, o.scarf, 0, 0.3, 0, head); mk(0.6, 0.5, 0.14, o.scarf, 0, 0.05, -0.25, head); for (const s of [-1, 1]) mk(0.05, 0.42, 0.5, o.scarf, s * 0.29, 0.08, -0.02, head); }
  if (o.dress) mk(bw + 0.12, 0.6, bd + 0.12, o.dress, 0, 0.72, 0);
  if (o.coat) mk(bw + 0.06, 0.55, bd + 0.06, o.coat, 0, 0.75, 0);
  if (o.apron) mk(bw * 0.8, 0.9, 0.04, o.apron, 0, 1.2, bd / 2 + 0.02);
  if (o.vest) { mk(bw + 0.04, 0.8, bd + 0.04, o.vest, 0, 1.45, 0); }
  if (o.tie) { mk(0.34, 0.12, 0.03, 0xffffff, 0, 1.84, bd / 2 + 0.01); mk(0.12, 0.55, 0.03, o.tie, 0, 1.5, bd / 2 + 0.02); }
  if (o.print) mk(0.4, 0.3, 0.03, o.print, 0, 1.5, bd / 2 + 0.01);
  if (o.backpack) { mk(0.7, 0.95, 0.4, 0xe07a2f, 0, 1.45, -0.42); mk(0.8, 0.3, 0.3, 0x5a7d3a, 0, 2.02, -0.42); }
  if (o.scissors) { const s = new THREE.Group(); s.position.set(0, -0.9, 0.15); armR.add(s); for (const r of [-0.18, 0.18]) mk(0.08, 0.05, 1.4, 0xe0b43a, 0, 0, 0.7, s).rotation.y = r; mk(0.3, 0.3, 0.1, 0xd62828, 0, 0, -0.05, s); }
  if (o.wand) mk(0.08, 0.7, 0.08, 0x222222, 0, -1.1, 0.1, armL);
  if (o.phone) mk(0.12, 0.22, 0.03, 0x111111, 0, -0.95, 0.12, armR);
  if (o.duffel) mk(0.95, 0.38, 0.38, 0x4b5a2e, 0, 1.3, -0.4).rotation.z = 0.2;
  if (o.flashlight) { const f = mk(0.1, 0.1, 0.4, 0x333333, 0, -0.92, 0.2, armR); o.flashlightMesh = f; }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, legL, legR, armL, armR, head, body };
}
export function animateHuman(h, speed, t) {
  const a = Math.min(1, speed / 2) * 0.75, sw = Math.sin(t * (5 + speed * 0.9)) * a;
  h.legL.rotation.x = sw; h.legR.rotation.x = -sw; h.armL.rotation.x = -sw * 0.8; h.armR.rotation.x = sw * 0.8;
  h.armL.rotation.z = 0; h.armR.rotation.z = 0; h.head.rotation.set(0, 0, 0);
}
export function danceHuman(h, beat, lift = 0.25) {
  const ph = beat * Math.PI, b = Math.abs(Math.sin(ph));
  h.armL.rotation.z = -(2.3 + Math.sin(ph) * 0.5); h.armR.rotation.z = 2.3 + Math.cos(ph) * 0.5;
  h.armL.rotation.x = h.armR.rotation.x = 0;
  h.legL.rotation.x = Math.sin(ph) * 0.6; h.legR.rotation.x = -Math.sin(ph) * 0.6;
  return b * lift;
}
export function poseHuman(h, pose) {
  animateHuman(h, 0, 0);
  if (pose === 'arms-up') { h.armL.rotation.z = -2.8; h.armR.rotation.z = 2.8; }
  if (pose === 'point') { h.armR.rotation.x = -1.5; }
  if (pose === 'phone') { h.armR.rotation.x = -1.9; h.head.rotation.x = 0.35; }
  if (pose === 'mannequin') { h.armL.rotation.z = -0.5; h.armR.rotation.x = -1.2; h.head.rotation.y = 0.4; }
  if (pose === 'reach') { h.armL.rotation.x = -1.6; h.armR.rotation.x = -1.6; }
}

export function makeCat(color = 0xe8903a) {
  const g = new THREE.Group(), mk = (w, h, d, col, x, y, z) => mesh(boxG(w, h, d), col, x, y, z, g);
  mk(0.5, 0.45, 1, color, 0, 0.55, 0); mk(0.46, 0.4, 0.42, color, 0, 0.85, 0.6);
  for (const s of [-1, 1]) { mk(0.12, 0.18, 0.08, color, s * 0.14, 1.12, 0.6); mk(0.06, 0.07, 0.02, 0x2ecc71, s * 0.1, 0.9, 0.82); mk(0.12, 0.35, 0.12, color, s * 0.15, 0.17, 0.35); mk(0.12, 0.35, 0.12, color, s * 0.15, 0.17, -0.35); }
  mk(0.1, 0.1, 0.7, color, 0, 0.9, -0.7).rotation.x = -0.8;
  return g;
}
export function makePigeon() {
  const g = new THREE.Group(), mk = (w, h, d, col, x, y, z) => mesh(boxG(w, h, d), col, x, y, z, g);
  mk(0.3, 0.3, 0.5, 0x8a8f99, 0, 0.3, 0); mk(0.2, 0.2, 0.2, 0x6b7a8a, 0, 0.55, 0.25); mk(0.06, 0.05, 0.12, 0xe0a030, 0, 0.53, 0.38);
  const wl = mk(0.05, 0.22, 0.4, 0x7a808a, -0.17, 0.33, 0), wr = mk(0.05, 0.22, 0.4, 0x7a808a, 0.17, 0.33, 0);
  g.userData.wings = [wl, wr]; return g;
}

// The shared e-scooter (קורקינט חשמלי)
export function makeScooter(color = 0x2ecc71) {
  const g = new THREE.Group();
  mesh(boxG(0.36, 0.1, 1.3), 0x222222, 0, 0.25, 0, g);
  mesh(boxG(0.3, 0.04, 1.1), color, 0, 0.31, 0, g);
  const stem = mesh(cylG(0.04, 0.04, 1.2, 6), 0x444444, 0, 0.85, 0.6, g); stem.rotation.x = -0.15;
  mesh(boxG(0.7, 0.06, 0.06), 0x222222, 0, 1.43, 0.69, g);
  mesh(boxG(0.14, 0.1, 0.08), 0xfff2b0, 0, 1.25, 0.72, g);
  for (const z of [-0.6, 0.62]) mesh(cylG(0.17, 0.17, 0.1, 12).rotateZ(Math.PI / 2), 0x111111, 0, 0.17, z, g);
  return g;
}

// traffic car / bus geometry shared with the parked-car instances
export const BUS_G = merge([
  [boxG(11, 2.9, 2.6).translate(0, 1.85, 0), 0xffffff], [boxG(10.2, 0.9, 2.64).translate(0.2, 2.3, 0), 0x1f2a33], [boxG(0.1, 1.3, 2.2).translate(5.51, 2.1, 0), 0x1f2a33],
  ...[[3.8, 1.2], [3.8, -1.2], [-3.8, 1.2], [-3.8, -1.2]].map(([x, z]) => [cylG(0.55, 0.55, 0.35, 10).rotateX(Math.PI / 2).translate(x, 0.55, z), 0x111111]),
]);
export function nameTag(g, text, y = 3.05) { const t = label(text, { px: 30 }); t.position.y = y; g.add(t); return t; }
