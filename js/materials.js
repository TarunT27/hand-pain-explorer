// Shared materials, textures and the shader patch that gives every tissue
// the same "peel" dissolve, pain hotspot glow, hover glow and highlight.
import * as THREE from 'three';

export const LAYERS = [
  { key: 'skin', label: 'Skin', color: '#e3a88f' },
  { key: 'muscles', label: 'Muscles', color: '#d4515d' },
  { key: 'tendons', label: 'Tendons & ligaments', color: '#e9e0c9' },
  { key: 'nerves', label: 'Nerves & vessels', color: '#f3c343' },
  { key: 'bones', label: 'Bones & joints', color: '#f1e6cf' },
];
export const LAYER_INDEX = Object.fromEntries(LAYERS.map((l, i) => [l.key, i]));

// Global uniforms shared by every patched material.
export const G = {
  uTime: { value: 0 },
  uRootInv: { value: new THREE.Matrix4() },
  uHot: { value: new THREE.Vector4(0, 0, 0, 0) },   // xyz = skin-surface point, w = radius (0 = off)
  uHot2: { value: new THREE.Vector3() },            // deep end of the glowing column
  uHotAmt: { value: 0 },
  uHover: { value: new THREE.Vector4(0, 0, 0, 0) },
  uPins: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },   // saved pain spots: xyz + intensity
  uPinCount: { value: 0 },
};
// Dissolve progress per layer (0 = intact, 1 = fully peeled away).
export const layerQ = LAYERS.map(() => ({ value: 0 }));

// ---- Noise shared by GLSL and JS (must stay in sync for picking) ----
export const NOISE_GLSL = /* glsl */`
float hpHash(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hpNoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  float a = hpHash(i), b = hpHash(i+vec3(1,0,0)), c = hpHash(i+vec3(0,1,0)), d = hpHash(i+vec3(1,1,0));
  float e = hpHash(i+vec3(0,0,1)), f1 = hpHash(i+vec3(1,0,1)), g = hpHash(i+vec3(0,1,1)), h = hpHash(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,f1,u.x), mix(g,h,u.x), u.y), u.z);
}
float hpSegDist(vec3 p, vec3 a, vec3 b){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0); return length(pa - ba * h); }
float hpDissolve(vec3 lp, float q){
  float s = (lp.y + 12.0) / 33.0;
  float n = 0.6*hpNoise(lp*0.55) + 0.4*hpNoise(lp*1.2 + 7.1);
  float v = s + (n - 0.5) * 0.38;
  return v - (q * 1.42 - 0.21);
}
`;

const fract = (x) => x - Math.floor(x);
function hpHash(x, y, z) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}
function hpNoise(px, py, pz) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  const fx = px - ix, fy = py - iy, fz = pz - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const mix = (a, b, t) => a + (b - a) * t;
  const a = hpHash(ix, iy, iz), b = hpHash(ix + 1, iy, iz), c = hpHash(ix, iy + 1, iz), d = hpHash(ix + 1, iy + 1, iz);
  const e = hpHash(ix, iy, iz + 1), f = hpHash(ix + 1, iy, iz + 1), g = hpHash(ix, iy + 1, iz + 1), h = hpHash(ix + 1, iy + 1, iz + 1);
  return mix(mix(mix(a, b, ux), mix(c, d, ux), uy), mix(mix(e, f, ux), mix(g, h, ux), uy), uz);
}
// JS mirror of hpDissolve: returns < 0 where the tissue is peeled away.
export function dissolveValue(lp, q) {
  const s = (lp.y + 12) / 33;
  const n = 0.6 * hpNoise(lp.x * 0.55, lp.y * 0.55, lp.z * 0.55) +
    0.4 * hpNoise(lp.x * 1.2 + 7.1, lp.y * 1.2 + 7.1, lp.z * 1.2 + 7.1);
  const v = s + (n - 0.5) * 0.38;
  return v - (q * 1.42 - 0.21);
}

const FRAG_HEAD = /* glsl */`
varying vec3 vWPos;
uniform float uTime; uniform mat4 uRootInv; uniform vec4 uHot; uniform vec3 uHot2; uniform float uHotAmt; uniform vec4 uHover;
uniform float uQ; uniform float uHi;
uniform vec4 uPins[8]; uniform int uPinCount;
${NOISE_GLSL}
`;

const FRAG_CLIP = /* glsl */`
vec3 hpLocal = (uRootInv * vec4(vWPos, 1.0)).xyz;
float hpEdge = hpDissolve(hpLocal, uQ);
if (hpEdge < 0.0) discard;
float hpFade = smoothstep(-10.2, -7.6, hpLocal.y);
if (hpFade <= 0.002) discard;
`;

const FRAG_EMISSIVE = /* glsl */`
{
  vec3 hpV = normalize(vViewPosition);
  float hpRim = pow(1.0 - clamp(abs(dot(normal, hpV)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += vec3(0.55, 0.7, 1.0) * hpRim * 0.12;
  float hpBurn = (1.0 - smoothstep(0.0, 0.03, hpEdge)) * step(0.001, uQ) * step(uQ, 0.999);
  totalEmissiveRadiance += vec3(1.0, 0.5, 0.2) * hpBurn * 2.2;
  if (uHot.w > 0.0) {
    float dd = hpSegDist(vWPos, uHot.xyz, uHot2) / uHot.w;
    float k = 1.0 - smoothstep(0.0, 1.0, dd);
    float pulse = 0.7 + 0.3 * sin(uTime * 4.0);
    float ripple = smoothstep(0.12, 0.0, abs(dd - fract(uTime * 0.55))) * (1.0 - fract(uTime * 0.55));
    totalEmissiveRadiance += vec3(1.0, 0.16, 0.1) * (k * k * pulse * 1.3 + ripple * 0.8) * uHotAmt;
  }
  if (uHover.w > 0.0) {
    float k = 1.0 - smoothstep(0.0, uHover.w, distance(vWPos, uHover.xyz));
    totalEmissiveRadiance += vec3(0.45, 0.75, 1.0) * k * k * 0.3;
  }
  float hpHeat = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uPinCount) break;
    float d = distance(vWPos, uPins[i].xyz);
    hpHeat += uPins[i].w * exp(-d * d / 1.6);
  }
  totalEmissiveRadiance += mix(vec3(1.0, 0.6, 0.15), vec3(1.0, 0.1, 0.05), clamp(hpHeat, 0.0, 1.0)) * smoothstep(0.03, 0.9, hpHeat) * 0.55;
  totalEmissiveRadiance += vec3(0.25, 0.62, 1.0) * uHi * (0.6 + 0.4 * sin(uTime * 6.0)) * (0.7 + 1.6 * hpRim);
}
`;

export function patchMaterial(mat, layerIndex) {
  mat.userData.uHi = { value: 0 };
  mat.userData.layer = layerIndex;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = G.uTime;
    shader.uniforms.uRootInv = G.uRootInv;
    shader.uniforms.uHot = G.uHot;
    shader.uniforms.uHot2 = G.uHot2;
    shader.uniforms.uHotAmt = G.uHotAmt;
    shader.uniforms.uHover = G.uHover;
    shader.uniforms.uPins = G.uPins;
    shader.uniforms.uPinCount = G.uPinCount;
    shader.uniforms.uQ = layerQ[layerIndex];
    shader.uniforms.uHi = mat.userData.uHi;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_CLIP)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.5, 0.95), uHi * 0.55);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_EMISSIVE)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor *= hpFade;');
  };
  mat.customProgramCacheKey = () => 'handpain-v1';
  return mat;
}

// ---- Procedural textures ----
function fiberCanvas({ w = 512, h = 64, base = 200, spread = 55, lines = 220, seed = 1 }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, w, h);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < lines; i++) {
    const y = rnd() * h;
    const v = Math.round(base + (rnd() - 0.5) * spread * 2);
    g.strokeStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 0.6);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let _tex;
function textures() {
  if (_tex) return _tex;
  _tex = {
    muscle: fiberCanvas({ base: 215, spread: 60, lines: 260, seed: 3 }),
    muscleBump: fiberCanvas({ base: 128, spread: 120, lines: 260, seed: 3 }),
    tendon: fiberCanvas({ base: 235, spread: 22, lines: 160, seed: 7 }),
  };
  _tex.muscleBump.colorSpace = THREE.NoColorSpace;
  return _tex;
}

// Material factories. Each structure gets its own instance so it can be highlighted alone.
export function makeMaterial(kind) {
  const t = textures();
  let m;
  switch (kind) {
    case 'bone':
      m = new THREE.MeshPhysicalMaterial({ color: 0xead8b4, roughness: 0.62, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xfff4e0) });
      m.userData.layerKey = 'bones'; break;
    case 'cartilage':
      m = new THREE.MeshPhysicalMaterial({ color: 0xbfd8e8, roughness: 0.18, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, transmission: 0 });
      m.userData.layerKey = 'bones'; break;
    case 'muscle':
      m = new THREE.MeshStandardMaterial({ color: 0xc23b48, roughness: 0.55, metalness: 0, map: t.muscle, bumpMap: t.muscleBump, bumpScale: 1.2 });
      m.userData.layerKey = 'muscles'; break;
    case 'muscleDeep':
      m = new THREE.MeshStandardMaterial({ color: 0xa82f3c, roughness: 0.55, metalness: 0, map: t.muscle, bumpMap: t.muscleBump, bumpScale: 1.2 });
      m.userData.layerKey = 'muscles'; break;
    case 'tendon':
      m = new THREE.MeshPhysicalMaterial({ color: 0xe4e9f0, roughness: 0.26, metalness: 0, map: t.tendon, sheen: 0.7, sheenColor: new THREE.Color(0xcfe0ff), sheenRoughness: 0.35, clearcoat: 0.3 });
      m.userData.layerKey = 'tendons'; break;
    case 'ligament':
      m = new THREE.MeshPhysicalMaterial({ color: 0xd9ceb4, roughness: 0.4, metalness: 0, map: t.tendon, sheen: 0.4, sheenColor: new THREE.Color(0xeef2ff) });
      m.userData.layerKey = 'tendons'; break;
    case 'fascia':
      m = new THREE.MeshPhysicalMaterial({ color: 0xe6dcc4, roughness: 0.35, metalness: 0, map: t.tendon, sheen: 0.5, sheenColor: new THREE.Color(0xeef2ff), side: THREE.DoubleSide });
      m.userData.layerKey = 'tendons'; break;
    case 'nerve':
      m = new THREE.MeshPhysicalMaterial({ color: 0xf2c53d, roughness: 0.35, metalness: 0, emissive: 0x3a2800, clearcoat: 0.4, map: t.tendon });
      m.userData.layerKey = 'nerves'; break;
    case 'vein':
      m = new THREE.MeshPhysicalMaterial({ color: 0x3f5fc8, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25, emissive: 0x05081a });
      m.userData.layerKey = 'nerves'; break;
    case 'artery':
      m = new THREE.MeshPhysicalMaterial({ color: 0xd8333b, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: 0x220000 });
      m.userData.layerKey = 'nerves'; break;
    default:
      throw new Error('unknown material ' + kind);
  }
  return patchMaterial(m, LAYER_INDEX[m.userData.layerKey]);
}
