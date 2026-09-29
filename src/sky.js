// Sky dome, sun, fog, clouds and the day/interior lighting switch.
import { THREE, scene, camera, merge, icoG, R } from './core.js';

export const hemi = new THREE.HemisphereLight(0xcfe6ff, 0xb59a6b, 1.05);
export const sun = new THREE.DirectionalLight(0xffe4bd, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 700 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
scene.add(hemi, sun, sun.target);
const OUT_FOG = new THREE.Fog(0xe9dcc6, 500, 3800);
scene.fog = OUT_FOG;

export const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `varying float vy; void main(){
    vec3 hor = vec3(1.0,.86,.68), mid = vec3(.62,.80,.94), top = vec3(.30,.55,.86);
    float h = clamp(vy, 0., 1.);
    vec3 c = h < .18 ? mix(hor, mid, h/.18) : mix(mid, top, (h-.18)/.82);
    gl_FragColor = vec4(c, 1.); }`,
}));
sky.renderOrder = -1; scene.add(sky);

export const clouds = new THREE.Group();
{
  const g = merge([[icoG(30), 0xffffff], [icoG(22).translate(30, -5, 8), 0xffffff], [icoG(20).translate(-28, -8, -5), 0xffffff], [icoG(17).translate(10, 12, -10), 0xfafafa]]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, fog: false, emissive: 0xffffff, emissiveIntensity: 0.3 });
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(g, m), a = R(0, 6.28), r = R(500, 3500);
    c.position.set(Math.cos(a) * r, R(450, 700), Math.sin(a) * r); c.scale.set(R(1, 2.2), R(0.6, 1), R(1, 1.6)); clouds.add(c);
  }
  scene.add(clouds);
}

// follow a focus point so shadows stay crisp around the player
export function updateSky(focus, dt) {
  sun.position.set(focus.x - 160, focus.y + 260, focus.z + 120); sun.target.position.copy(focus);
  sky.position.copy(camera.position); clouds.rotation.y += dt * 0.002;
}
const INSIDE_FOG = new THREE.Fog(0x020203, 2, 40);
export function setInterior(on) {
  scene.fog = on ? INSIDE_FOG : OUT_FOG;
  sky.visible = clouds.visible = !on;
  hemi.intensity = on ? 0.06 : 1.05; sun.intensity = on ? 0 : 2.6;
  scene.background = on ? new THREE.Color(0x000000) : null;
}
