// Core: renderer, scene, shared helpers (materials, geometry merging, Hebrew text textures).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE };

export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * clamp(t, 0, 1); };
// deterministic RNG so the city looks the same every time
let seed = 1964;
export function rnd() { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const R = (a, b) => a + rnd() * (b - a);
export const rpick = a => a[Math.floor(rnd() * a.length)];

// ---------------------------------------------------------------- renderer
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 9000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- materials & meshes
const matCache = {};
export const mat = (c, o = {}) => matCache[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...o });
export const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cylG = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
export const icoG = r => new THREE.IcosahedronGeometry(r, 0);
export function mesh(geo, m, x = 0, y = 0, z = 0, parent = scene) {
  const me = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; parent.add(me); return me;
}
export function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g;
}
export const merge = parts => mergeGeometries(parts.map(([g, c]) => colored(g, c)));
export const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, ...o });

// ---------------------------------------------------------------- canvas textures
export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export const FONT = 'Rubik, "Segoe UI Emoji", system-ui, sans-serif';
export function textTex(lines, w, h, { bg = '#1d3557', fg = '#fff', border = true } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (border) { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = Math.max(4, h * 0.04); x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    const s = Math.min(h / lines.length * 0.6, h * 0.5);
    lines.forEach((l, i) => { x.font = `700 ${s}px ${FONT}`; x.fillText(l, w / 2, h * (i + 0.55) / lines.length, w * 0.9); });
  }, false);
}
// A sign board; front faces local +z. Returns the group.
export function sign(x, y, z, w, h, lines, { bg = '#1d3557', fg = '#fff', rot = 0, posts = 0, parent = scene } = {}) {
  const g = new THREE.Group(), frame = mat(0x3a3a3a);
  const tex = textTex(lines, 1024, Math.max(96, Math.round(1024 * h / w)), { bg, fg });
  const board = new THREE.Mesh(boxG(w, h, 0.25), [frame, frame, frame, frame, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), frame]);
  board.position.y = posts ? posts + h / 2 : 0; board.castShadow = true; g.add(board);
  if (posts) for (const s of [-1, 1]) mesh(boxG(0.18, posts + h / 2, 0.18), 0x555555, s * (w / 2 - 0.4), (posts + h / 2) / 2, -0.1, g);
  g.position.set(x, y, z); g.rotation.y = rot; parent.add(g); return g;
}
// Floating text sprite (name tags, markers)
export function label(text, { fg = '#fff', bg = 'rgba(18,20,32,.75)', px = 34, k = 0.012 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d'), font = `700 ${px}px ${FONT}`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + 28, h = px + 20; c.width = w; c.height = h;
  x.font = font; x.direction = 'rtl'; x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, h / 2); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(w * k, h * k, 1); s.renderOrder = 5; return s;
}
