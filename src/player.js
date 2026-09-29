// Player: Yossi on foot or on the municipal e-scooter, input and the follow camera.
import { THREE, scene, camera, clamp, lerpAngle, pick } from './core.js';
import { groundAt, collide } from './world.js';
import { makeHuman, makeScooter, animateHuman, danceHuman } from './characters.js';
import { sfx } from './audio.js';
import { toast } from './ui.js';
import { touch } from './touch.js';

// ---------------------------------------------------------------- input
export const keys = new Set(), pressed = new Set();
export const mouse = { dragging: false };
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); if (!e.repeat) pressed.add(e.code); keys.add(e.code); });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const cvs = document.querySelector('canvas');
// drag to look — track positions ourselves (touch pointers report no movementX)
let lastX = 0, lastY = 0;
cvs.addEventListener('pointerdown', e => { mouse.dragging = true; lastX = e.clientX; lastY = e.clientY; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointerup', () => mouse.dragging = false);
cvs.addEventListener('pointermove', e => { if (!mouse.dragging) return; cam.yaw -= (e.clientX - lastX) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - lastY) * 0.004, 0.03, 1.3); lastX = e.clientX; lastY = e.clientY; cam.manualT = 1.5; });
cvs.addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * 0.012, 4, 40); }, { passive: true });
const k = c => keys.has(c);

// ---------------------------------------------------------------- state
export const player = makeHuman({ shirt: 0x2f80c8, pants: 0x34466e, hair: 0x3b2a1e, backpack: true, print: 0xffffff });
scene.add(player.g);
const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0x5a3a1e, flatShading: true }));
ponytail.position.set(0, 0.28, -0.42); ponytail.rotation.x = 0.75; ponytail.visible = false; player.head.add(ponytail);
export function setPlayerGender(g) { ponytail.visible = g === 'f'; }
export const P = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, onGround: true, knock: 0, hop: 0,
  onScooter: false, speed: 0, frozen: false, dancing: false, beat: 0,
  ground: groundAt, collide, walkMul: 1, pushX: 0, pushZ: 0, interior: false,
};
export const cam = { yaw: Math.PI, pitch: 0.36, dist: 10, manualT: 0, fixed: null };
export const scooter = { g: makeScooter(), unlocked: false, pos: new THREE.Vector3(), yaw: 0 };
scooter.g.visible = false; scene.add(scooter.g);
const CRASH = ['התנגשת בשיח. השיח בסדר. תודה ששאלת.', 'הקורקינט הלך לכיוון אחד, אתה לכיוון השני. כמו רוב מערכות היחסים בכרמיאל.', 'הרכבת את עצמך על עמוד תאורה. העמוד נדלק. הוא שמח שמישהו שם לב אליו.', 'עפת מהקורקינט באמצע כיכר. הקורקינט המשיך להסתובב. הוא מקומי.'];

export function teleport(x, z, yaw = P.yaw) {
  P.pos.set(x, P.ground(x, z), z); P.vel.set(0, 0, 0); P.yaw = yaw; P.knock = 0;
  cam.yaw = yaw + Math.PI; camera.position.set(x - Math.sin(yaw) * 10, P.pos.y + 5, z - Math.cos(yaw) * 10);
}
export function placeScooter(x, z, yaw = 0) { scooter.unlocked = true; scooter.g.visible = true; scooter.pos.set(x, groundAt(x, z), z); scooter.yaw = yaw; }
export function knock(dx, dz, power = 20, up = 14) {
  if (P.knock > 0) return false;
  if (P.onScooter) dismount(true);
  P.knock = 1.3; P.onGround = false; P.vel.set(dx * power, up, dz * power); return true;
}
export function mount() { P.onScooter = true; P.speed = 0; P.yaw = scooter.yaw; P.pos.copy(scooter.pos); sfx('jump'); cam.dist = Math.max(cam.dist, 12); }
export function dismount(crash = false) {
  P.onScooter = false; scooter.pos.copy(P.pos); scooter.yaw = P.yaw;
  if (crash) { toast('🛴 ' + pick(CRASH), 'bad'); sfx('crash'); }
}
export const nearScooter = () => scooter.unlocked && !P.onScooter && !P.interior && P.pos.distanceTo(scooter.pos) < 3.2;

// ---------------------------------------------------------------- update
export function updatePlayer(dt) {
  if (P.frozen) { P.vel.set(0, 0, 0); return 0; }
  let ix = (k('KeyD') || k('ArrowRight')) - (k('KeyA') || k('ArrowLeft')), iz = (k('KeyW') || k('ArrowUp')) - (k('KeyS') || k('ArrowDown'));
  if (touch.active) { ix = touch.x; iz = touch.y; }
  const jump = pressed.has('Space');
  if (P.onScooter) {
    // e-scooter physics
    const max = 30, acc = iz > 0 ? 16 : iz < 0 ? -26 : -5;
    P.speed = clamp(P.speed + acc * dt * (iz < 0 && P.speed <= 0 ? 0.3 : 1), -5, max);
    if (iz === 0 && Math.abs(P.speed) < 0.3) P.speed = 0;
    P.yaw -= ix * dt * (1.4 + 1.2 * (1 - Math.abs(P.speed) / max)) * Math.sign(P.speed || 1);
    P.vel.x = Math.sin(P.yaw) * P.speed; P.vel.z = Math.cos(P.yaw) * P.speed;
    if (jump && P.onGround) { P.vel.y = 7; P.onGround = false; sfx('jump'); }
  } else if (P.knock > 0) {
    P.knock -= dt; if (P.onGround) { P.vel.x *= 0.88; P.vel.z *= 0.88; }
  } else {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix; const dl = Math.hypot(dx, dz); if (dl) { dx /= dl; dz /= dl; }
    const speed = (k('ShiftLeft') || k('ShiftRight') || touch.run ? 14 : 7) * P.walkMul, a = P.onGround ? 12 : 3;
    P.vel.x += (dx * speed - P.vel.x) * Math.min(1, a * dt); P.vel.z += (dz * speed - P.vel.z) * Math.min(1, a * dt);
    if (jump && P.onGround) { P.vel.y = 11; P.onGround = false; sfx('jump'); }
  }
  P.vel.y -= 30 * dt;
  P.pos.x += (P.vel.x + P.pushX) * dt; P.pos.z += (P.vel.z + P.pushZ) * dt; P.pos.y += P.vel.y * dt;
  const hit = P.collide(P.pos, P.onScooter ? 0.7 : 0.5, P.pos.y + 0.5);
  if (hit && P.onScooter && Math.abs(P.speed) > 13) { const s = P.speed; knock(-Math.sin(P.yaw), -Math.cos(P.yaw), 5, 9); P.vel.x = Math.sin(P.yaw) * s * 0.4; P.vel.z = Math.cos(P.yaw) * s * 0.4; }
  else if (hit && P.onScooter) P.speed *= 0.5;
  const g = P.ground(P.pos.x, P.pos.z);
  if (P.pos.y <= g || (P.onGround && P.vel.y <= 0 && P.pos.y - g < (P.onScooter ? 1.2 : 0.7))) { P.pos.y = g; P.vel.y = 0; P.onGround = true; } else P.onGround = false;
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (!P.onScooter && hs > 0.5 && P.knock <= 0) P.yaw = lerpAngle(P.yaw, Math.atan2(P.vel.x, P.vel.z), 12 * dt);
  if (P.onScooter) scooter.pos.copy(P.pos);
  return hs;
}
// visual sync (animation, scooter, knock spin)
export function syncPlayer(hs, t, dt) {
  const g = player.g;
  g.position.copy(P.pos); g.rotation.set(0, P.yaw, 0);
  if (P.dancing) { g.position.y += danceHuman(player, P.beat, 0.3) + P.hop * 0.4; P.hop = Math.max(0, P.hop - dt * 5); g.rotation.y = Math.sin(P.beat * Math.PI / 2) * 0.5; }
  else if (P.knock > 0) { g.rotation.z = Math.sin(t * 20) * 0.8; g.rotation.x = t * 12; }
  else if (P.onScooter) { animateHuman(player, 0, t); player.legL.rotation.x = 0.25; player.armL.rotation.x = player.armR.rotation.x = -1.1; g.position.y += 0.35; g.rotation.z = clamp(-P.speed * 0.004 * ((keys.has('KeyD') || keys.has('ArrowRight')) - (keys.has('KeyA') || keys.has('ArrowLeft'))), -0.25, 0.25); }
  else if (!P.onGround) { animateHuman(player, 0, t); player.legL.rotation.x = 0.6; player.legR.rotation.x = -0.3; player.armL.rotation.z = -0.6; player.armR.rotation.z = 0.6; }
  else animateHuman(player, hs, t);
  if (scooter.unlocked) { scooter.g.position.copy(scooter.pos); scooter.g.rotation.y = P.onScooter ? P.yaw : scooter.yaw; }
}
export function updateCamera(dt) {
  if (cam.fixed) { camera.position.lerp(cam.fixed.pos, 1 - Math.exp(-dt * 4)); camera.lookAt(cam.fixed.look); return; }
  cam.manualT -= dt;
  const moving = P.onScooter ? Math.abs(P.speed) > 1 : (keys.has('KeyW') || keys.has('ArrowUp') || touch.y > 0.5);
  if (moving && cam.manualT <= 0) cam.yaw = lerpAngle(cam.yaw, P.yaw + Math.PI, dt * (P.onScooter ? 3 : 1.2));
  const d = P.onScooter ? Math.max(cam.dist, 12) : cam.dist, tgt = new THREE.Vector3(P.pos.x, P.pos.y + 1.7, P.pos.z), cp = Math.cos(cam.pitch);
  const want = new THREE.Vector3(tgt.x + Math.sin(cam.yaw) * cp * d, tgt.y + Math.sin(cam.pitch) * d, tgt.z + Math.cos(cam.yaw) * cp * d);
  if (!P.interior) want.y = Math.max(want.y, groundAt(want.x, want.z) + 1.2);
  camera.position.lerp(want, 1 - Math.exp(-dt * 10));
  camera.lookAt(tgt);
}
