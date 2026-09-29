// Skin: a smooth signed-distance surface (round cones blended with smooth-min)
// ray-marched on the GPU. It follows the skeleton every frame, so it bends,
// webs and bulges naturally, and it can dissolve ("peel") like the other layers.
import * as THREE from 'three';
import { FINGERS, THUMB } from './rig.js';
import { G, layerQ, NOISE_GLSL } from './materials.js';

const NSEG = 28;

function segmentSpecs() {
  const S = [];
  const seg = (a, b, ra, rb, k, type) => S.push({ a, b, ra, rb, k, type });
  // forearm (two lobes give an oval cross-section)
  seg(['fore', 1.0, -13.5, 0.1], ['fore', 1.35, -0.6, 0.1], 1.8, 1.72, 0, 0);
  seg(['fore', -1.3, -13.5, 0.0], ['fore', -1.35, -0.6, -0.05], 1.6, 1.42, 1.3, 0);
  // carpus
  seg(['wrist', 1.5, 1.2, 0.22], ['wrist', -1.25, 1.25, 0.15], 1.5, 1.4, 1.4, 1);
  // palm: one lobe along each metacarpal
  const pr = [1.1, 1.15, 1.1, 1.0];
  FINGERS.forEach((d, i) => {
    seg(['wrist', d.base.x * 0.95, 2.5, 0.3], ['wrist', d.mcp.x, d.mcp.y - 0.55, d.mcp.z + 0.26], pr[i], pr[i] * 0.93, 1.2, 1);
  });
  // distal palm pad and hypothenar eminence
  seg(['wrist', 2.35, 8.15, 0.72], ['wrist', -2.6, 7.45, 0.85], 0.85, 0.8, 1.0, 1);
  seg(['wrist', -1.55, 1.95, 0.8], ['wrist', -2.55, 6.3, 0.68], 1.15, 0.92, 1.0, 2);
  // thenar eminence around the thumb metacarpal, and the first web space
  seg(['T1', 0.3, 0.2, 0.3], ['T1', 0.25, 3.4, 0.4], 1.32, 1.0, 1.3, 3);
  seg(['T1', -0.35, 2.9, -0.1], ['wrist', 2.45, 6.3, 0.05], 0.72, 0.78, 1.0, 3);
  seg(['T2', -0.35, 0.3, 0.0], ['wrist', 2.35, 8.1, 0.15], 0.62, 0.6, 0.9, 3);
  // thumb
  seg(['T2', 0, 0, 0.05], ['T2', 0, THUMB.len[1], 0.06], 0.92, 0.84, 0.6, 4);
  seg(['T3', 0, 0, 0.08], ['T3', 0, THUMB.len[2] + 0.05, 0.12], 0.84, 0.7, 0.35, 4.2);
  // fingers
  FINGERS.forEach((d, f) => {
    const s = d.skin, c = d.code, L = d.len;
    seg([c + '1', 0, 0, 0.1], [c + '1', 0, L[0], 0.12], 0.86 * s, 0.78 * s, 0.7, 10 + f * 3);
    seg([c + '2', 0, 0, 0.12], [c + '2', 0, L[1], 0.12], 0.77 * s, 0.7 * s, 0.3, 11 + f * 3);
    seg([c + '3', 0, 0, 0.12], [c + '3', 0, L[2] + 0.02, 0.14], 0.69 * s, 0.6 * s, 0.3, 12 + f * 3);
  });
  return S;
}

const VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
#define NSEG ${NSEG}
uniform vec4 uA[NSEG];
uniform vec4 uB[NSEG];
uniform vec4 uS[NSEG];
uniform float uK[NSEG];
uniform int uCount;
uniform vec3 uBoxMin; uniform vec3 uBoxMax;
uniform vec3 uNailC[5]; uniform vec3 uNailY[5]; uniform vec3 uNailX[5]; uniform vec3 uNailD[5];
uniform vec3 uPalmN; uniform vec3 uSkin; uniform vec3 uKeyDir; uniform vec3 uFillDir;
uniform float uQ; uniform float uGhost; uniform mat4 uViewProj;
uniform vec3 uSegX[NSEG]; uniform vec3 uSegZ[NSEG]; uniform float uSegT[NSEG];
uniform vec3 uWristO; uniform vec3 uWristX; uniform float uNerveMap; uniform mat4 uWristInv;
uniform vec4 uPins[8]; uniform int uPinCount;
uniform mat4 uRootInv; uniform float uTime; uniform vec4 uHot; uniform vec3 uHot2; uniform float uHotAmt; uniform vec4 uHover;
varying vec3 vWorld;
${NOISE_GLSL}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float map(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < NSEG; i++) {
    if (i >= uCount) break;
    float bs = length(p - uS[i].xyz) - uS[i].w;
    if (bs > d + uK[i]) continue;
    d = smin(d, sdRoundCone(p, uA[i].xyz, uB[i].xyz, uA[i].w, uB[i].w), uK[i]);
  }
  return d;
}
vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.004;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// Sensory nerve territory at a skin point: 0 none, 1 median, 2 ulnar, 3 radial.
// Mirrors Skin.territoryAt() in JS.
int nearestSeg(vec3 p) {
  float best = 1e5; int bi = 0;
  for (int i = 0; i < NSEG; i++) {
    if (i >= uCount) break;
    float d = sdRoundCone(p, uA[i].xyz, uB[i].xyz, uA[i].w, uB[i].w);
    if (d < best) { best = d; bi = i; }
  }
  return bi;
}
int territory(vec3 p, vec3 N, int bi) {
  float t = uSegT[bi];
  bool palmar = dot(N, uSegZ[bi]) > 0.0;
  float lat = dot(p - uA[bi].xyz, uSegX[bi]);
  float wx = dot(p - uWristO, uWristX);
  if (t < 0.5) return 0;
  if (t < 1.5) return wx > -0.95 ? (palmar ? 1 : 3) : 2;
  if (t < 2.5) return 2;
  if (t < 4.5) return palmar ? 1 : 3;
  int fi = int(t + 0.5) - 10;
  int f = fi / 3; int s = fi - f * 3;
  if (f == 3) return 2;
  if (f == 2 && lat < 0.0) return 2;
  if (palmar) return 1;
  return s == 0 ? 3 : 1;
}

float ln(float d, float w) { return exp(-(d * d) / (w * w)); }

// Surface detail from anatomy: x = flexion crease, y = knuckle wrinkle, z = vein, w = tint (+ fingertip pad, - knuckle)
vec4 skinDetail(vec3 p, vec3 N, int bi) {
  float t = uSegT[bi];
  vec3 A = uA[bi].xyz;
  vec3 ax = uB[bi].xyz - A; float len = length(ax); ax /= max(len, 1e-4);
  float along = dot(p - A, ax);
  float lat = dot(p - A, uSegX[bi]);
  float pal = dot(N, uSegZ[bi]);
  float palmar = smoothstep(0.05, 0.55, pal), dorsal = smoothstep(0.05, 0.55, -pal);
  float crease = 0.0, wrinkle = 0.0, vein = 0.0, tint = 0.0;
  if (t > 3.5) {
    // fingers (types 10+) and thumb (4.0 proximal, 4.2 distal); s = which phalanx
    int s;
    if (t < 9.5) s = t > 4.1 ? 2 : 1;
    else { int fi = int(t + 0.5) - 10; s = fi - (fi / 3) * 3; }
    float side = 1.0 - smoothstep(0.45, 0.95, abs(lat) / max(uA[bi].w, 0.3));
    if (s == 0) crease += ln(along - 1.25, 0.05) * 0.85 + ln(along - 1.45, 0.04) * 0.45;
    if (s == 0) crease += ln(along - len + 0.02, 0.04) + ln(along - len + 0.16, 0.035) * 0.8;
    if (s == 1) crease += ln(along + 0.02, 0.04) + ln(along - 0.12, 0.035) * 0.8 + ln(along - len + 0.02, 0.04) * 0.9;
    if (s == 2) crease += ln(along - 0.03, 0.04) * 0.9;
    crease *= palmar * side;
    float c = lat * lat * 1.1;
    float wr = 0.0;
    if (s == 1) wr += ln(along + c - 0.02, 0.028) + ln(along + c - 0.14, 0.026) * 0.8 + ln(along + c + 0.1, 0.026) * 0.8 + ln(along + c + 0.22, 0.024) * 0.5;
    if (s == 0) wr += ln(along - len + c - 0.02, 0.028) + ln(along - len + c + 0.12, 0.026) * 0.7;
    if (s == 2) wr += (ln(along + c - 0.02, 0.026) + ln(along + c - 0.12, 0.024) * 0.7) * 0.7;
    if (s == 1) wr += ln(along - len + c - 0.02, 0.026) * 0.5;
    wrinkle = wr * dorsal * side;
    tint = s == 2 ? palmar * 0.8 : 0.0;
    tint -= dorsal * (ln(along, 0.35) + ln(along - len, 0.35)) * (s == 2 ? 0.25 : 0.5);
  } else {
    // palm, wrist and forearm, in wrist-frame centimetres
    vec3 w = (uWristInv * vec4(p, 1.0)).xyz;
    vec3 wn = normalize((uWristInv * vec4(N, 0.0)).xyz);
    float palmS = smoothstep(0.15, 0.5, wn.z), backS = smoothstep(0.15, 0.5, -wn.z);
    float x = w.x, y = w.y;
    crease += ln(y - (7.3 + 0.2 * (x + 3.1) + 0.12 * sin(x * 1.3)), 0.055) * smoothstep(-3.4, -3.0, x) * (1.0 - smoothstep(1.2, 1.6, x));
    crease += ln(y - (5.75 + 0.2 * (x + 1.8) - 0.1 * sin(x * 1.1)), 0.055) * smoothstep(-2.1, -1.7, x) * (1.0 - smoothstep(2.9, 3.3, x));
    float ty = clamp((y - 1.7) / 5.0, 0.0, 1.0);
    crease += ln(x - (1.2 + 1.7 * pow(sin(ty * 1.5708), 0.85)), 0.06) * smoothstep(1.7, 2.2, y) * (1.0 - smoothstep(6.4, 6.8, y));
    crease += (ln(y - 0.45, 0.05) + ln(y + 0.35, 0.05) * 0.7) * smoothstep(-2.6, -2.2, x) * (1.0 - smoothstep(2.4, 2.8, x));
    crease *= palmS;
    float v = 0.0;
    v += ln(x - (2.05 + 0.25 * (7.0 - y) / 7.0 + 0.16 * sin(y * 1.3)), 0.11) * smoothstep(-6.0, -4.0, y) * (1.0 - smoothstep(6.6, 7.2, y));
    v += ln(x - (0.45 + 0.15 * sin(y * 1.1 + 1.0)), 0.1) * smoothstep(0.8, 1.6, y) * (1.0 - smoothstep(6.6, 7.1, y));
    v += ln(x - (-1.85 + 0.2 * sin(y * 0.9 + 2.0)), 0.11) * smoothstep(-6.0, -4.0, y) * (1.0 - smoothstep(6.3, 6.9, y));
    v += ln(y - (6.9 + 0.3 * sin(x * 0.8)), 0.1) * smoothstep(-2.6, -2.0, x) * (1.0 - smoothstep(2.1, 2.6, x));
    vein = min(v, 1.0) * backS;
    tint -= backS * smoothstep(7.7, 8.8, y) * 0.35;
  }
  return vec4(crease, wrinkle, vein, tint);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.05 + 0.2 * float(i);
    occ += (h - map(p + n * h)) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.25 * occ, 0.0, 1.0);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 inv = 1.0 / (rd + vec3(1e-7));
  vec3 t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv;
  vec3 tmn = min(t0, t1), tmx = max(t0, t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
  float tf = min(min(tmx.x, tmx.y), tmx.z);
  if (tn >= tf) discard;
  float t = tn; bool hit = false;
  for (int i = 0; i < 96; i++) {
    float d = map(ro + rd * t);
    if (d < 0.003 + t * 0.0003) { hit = true; break; }
    t += d;
    if (t > tf) break;
  }
  if (!hit) discard;
  vec3 p = ro + rd * t;
  vec3 N = calcNormal(p);
  vec3 V = -rd;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 lp = (uRootInv * vec4(p, 1.0)).xyz;
  float e = hpDissolve(lp, uQ);
  float fade = smoothstep(-12.2, -8.2, lp.y);
  vec3 col; float alpha;
  if (e < 0.0) {
    if (uGhost < 0.5) discard;
    col = vec3(0.6, 0.78, 1.0) * (0.35 + fres * 1.2);
    alpha = (0.03 + fres * 0.42) * 0.6;
  } else {
    vec3 base = uSkin;
    int bi = nearestSeg(p);
    vec4 det = skinDetail(p, N, bi);
    float palm = clamp(dot(N, uPalmN), 0.0, 1.0);
    base = mix(base, base * vec3(1.1, 0.95, 0.93) + vec3(0.025, 0.004, 0.0), palm * 0.55);
    float nail = 0.0; vec2 nl = vec2(0.0);
    for (int i = 0; i < 5; i++) {
      vec3 d = p - uNailC[i];
      vec2 q = vec2(dot(d, uNailX[i]), dot(d, uNailY[i]));
      float m = 1.0 - smoothstep(0.72, 1.0, length(q));
      m *= smoothstep(0.25, 0.6, dot(N, uNailD[i]));
      if (m > nail) { nail = m; nl = q; }
    }
    // fine skin texture (bump) everywhere except nails
    vec3 tp = lp * 9.0;
    float n0 = hpNoise(tp);
    vec3 gn = vec3(hpNoise(tp + vec3(0.08, 0.0, 0.0)), hpNoise(tp + vec3(0.0, 0.08, 0.0)), hpNoise(tp + vec3(0.0, 0.0, 0.08))) - n0;
    N = normalize(N + gn * 0.28 * (1.0 - nail));
    float cr = clamp(det.x, 0.0, 1.0), wr = clamp(det.y, 0.0, 1.0);
    base = mix(base, base * vec3(0.74, 0.58, 0.56), cr * 0.42);
    base = mix(base, base * vec3(0.84, 0.7, 0.68), wr * 0.38);
    base = mix(base, base * vec3(0.7, 0.8, 1.08), det.z * 0.36);
    base = mix(base, base * vec3(1.05, 0.88, 0.88) + vec3(0.02, 0.0, 0.0), max(det.w, 0.0) * 0.3);
    base = mix(base, base * vec3(0.9, 0.79, 0.77), max(-det.w, 0.0) * 0.4);
    vec3 nailCol = vec3(0.8, 0.56, 0.53);
    nailCol = mix(nailCol, vec3(0.93, 0.84, 0.8), smoothstep(-0.42, -0.68, nl.y) * (1.0 - smoothstep(0.5, 0.78, abs(nl.x))));
    nailCol = mix(nailCol, vec3(0.96, 0.93, 0.88), smoothstep(0.7, 0.9, nl.y));
    base = mix(base, nailCol, nail * 0.85);
    float wrap = clamp((dot(N, uKeyDir) + 0.3) / 1.3, 0.0, 1.0);
    float wrap2 = clamp((dot(N, uFillDir) + 0.5) / 1.5, 0.0, 1.0);
    vec3 H = normalize(uKeyDir + V);
    float spec = pow(max(dot(N, H), 0.0), mix(24.0, 110.0, nail)) * mix(0.1, 0.7, nail) * (1.0 - 0.7 * cr) * (1.0 + 0.6 * det.z);
    vec3 sss = vec3(0.85, 0.22, 0.12) * (1.0 - abs(dot(N, uKeyDir))) * 0.1 + vec3(0.55, 0.12, 0.06) * fres * 0.2;
    float ao = calcAO(p, N);
    float aoS = mix(0.35, 1.0, ao);
    col = (base * (0.2 + 0.95 * wrap) + base * vec3(0.5, 0.62, 0.9) * 0.28 * wrap2) * aoS + sss * mix(0.6, 1.0, ao) + spec * ao + vec3(0.65, 0.78, 1.0) * fres * 0.16 * ao;
    col = mix(col, col * vec3(0.93, 0.78, 0.74), (1.0 - ao) * 0.5);
    if (uNerveMap > 0.01) {
      int tr = territory(p, N, bi);
      if (tr > 0) {
        vec3 nc = tr == 1 ? vec3(0.95, 0.52, 0.06) : tr == 2 ? vec3(0.42, 0.28, 0.95) : vec3(0.04, 0.62, 0.52);
        col = mix(col, nc * (0.35 + 0.8 * wrap) * aoS + spec, 0.62 * uNerveMap);
      }
    }
    float heat = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uPinCount) break;
      float d = distance(p, uPins[i].xyz);
      heat += uPins[i].w * exp(-d * d / 1.2);
    }
    if (heat > 0.01) {
      vec3 hc = mix(vec3(1.0, 0.72, 0.2), vec3(0.8, 0.06, 0.04), clamp(heat, 0.0, 1.0));
      col = mix(col, hc * (0.45 + 0.75 * wrap) * aoS, smoothstep(0.02, 0.75, heat) * 0.66);
    }
    float burn = (1.0 - smoothstep(0.0, 0.03, e)) * step(0.001, uQ);
    col += vec3(1.0, 0.5, 0.2) * burn * 2.2;
    alpha = 1.0;
  }
  if (uHot.w > 0.0) {
    float dd = hpSegDist(p, uHot.xyz, uHot2) / uHot.w;
    float k = 1.0 - smoothstep(0.0, 1.0, dd);
    float pulse = 0.7 + 0.3 * sin(uTime * 4.0);
    float ripple = smoothstep(0.12, 0.0, abs(dd - fract(uTime * 0.55))) * (1.0 - fract(uTime * 0.55));
    float core = smoothstep(1.0, 0.25, dd);
    col = mix(col, vec3(0.78, 0.07, 0.05), core * uHotAmt * 0.82);
    col += vec3(1.0, 0.2, 0.1) * (core * pulse * 0.55 + ripple * 1.4) * uHotAmt;
    col += vec3(1.0, 0.35, 0.2) * smoothstep(0.06, 0.0, abs(dd - 1.0)) * 0.9 * uHotAmt;
    alpha = max(alpha, (k * k * 0.6 + ripple * 0.5) * uHotAmt);
  }
  if (uHover.w > 0.0) {
    float k = 1.0 - smoothstep(0.0, uHover.w, distance(p, uHover.xyz));
    col += vec3(0.45, 0.75, 1.0) * k * k * 0.25;
  }
  gl_FragColor = vec4(col, alpha * fade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_FragDepth = clamp((clip.z / clip.w) * 0.5 + 0.5, 0.0, 1.0);
}`;

// ---- CPU copy of the distance function (picking & pointing) ----
function sdRoundCone(p, a, b, r1, r2) {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = p.x - a.x, pay = p.y - a.y, paz = p.z - a.z;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export class Skin {
  constructor(rig) {
    this.rig = rig;
    this.segs = segmentSpecs().map((s) => ({
      fa: rig.frames[s.a[0]], la: new THREE.Vector3(s.a[1], s.a[2], s.a[3]),
      fb: rig.frames[s.b[0]], lb: new THREE.Vector3(s.b[1], s.b[2], s.b[3]),
      ra: s.ra, rb: s.rb, k: s.k, type: s.type, A: new THREE.Vector3(), B: new THREE.Vector3(), C: new THREE.Vector3(), R: 0,
      X: new THREE.Vector3(), Z: new THREE.Vector3(),
    }));
    const vec4s = () => Array.from({ length: NSEG }, () => new THREE.Vector4());
    const vec3s = (n) => Array.from({ length: n }, () => new THREE.Vector3());
    this.uniforms = {
      uA: { value: vec4s() }, uB: { value: vec4s() }, uS: { value: vec4s() }, uK: { value: new Array(NSEG).fill(0) },
      uCount: { value: this.segs.length },
      uBoxMin: { value: new THREE.Vector3() }, uBoxMax: { value: new THREE.Vector3() },
      uNailC: { value: vec3s(5) }, uNailY: { value: vec3s(5) }, uNailX: { value: vec3s(5) }, uNailD: { value: vec3s(5) },
      uPalmN: { value: new THREE.Vector3(0, 0, 1) },
      uSkin: { value: new THREE.Vector3() },
      uKeyDir: { value: new THREE.Vector3(0.45, 0.6, 0.66).normalize() },
      uFillDir: { value: new THREE.Vector3(-0.7, 0.1, -0.7).normalize() },
      uQ: layerQ[0], uGhost: { value: 1 }, uViewProj: { value: new THREE.Matrix4() },
      uSegX: { value: vec3s(NSEG) }, uSegZ: { value: vec3s(NSEG) }, uSegT: { value: new Array(NSEG).fill(0) },
      uWristO: { value: new THREE.Vector3() }, uWristX: { value: new THREE.Vector3(1, 0, 0) }, uNerveMap: { value: 0 }, uWristInv: { value: new THREE.Matrix4() },
      uPins: G.uPins, uPinCount: G.uPinCount,
      uRootInv: G.uRootInv, uTime: G.uTime, uHot: G.uHot, uHot2: G.uHot2, uHotAmt: G.uHotAmt, uHover: G.uHover,
    };
    this.setTone('#dca58c');
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material);
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.mesh.userData = { layer: 'skin', name: 'Skin', desc: 'Outer layer. Peel it back to see what lies beneath.' };
    this.box = new THREE.Box3();
    this.nails = [...FINGERS.map((d, i) => ({ frame: rig.fingers[i].j3, L: d.len[2], s: d.skin })), { frame: rig.thumb.j3, L: THUMB.len[2], s: 1.12 }];
  }

  setTone(hex) {
    const c = new THREE.Color(hex);
    this.uniforms.uSkin.value.set(c.r, c.g, c.b);
  }

  update() {
    const u = this.uniforms;
    this.box.makeEmpty();
    const pad = new THREE.Vector3();
    this.segs.forEach((s, i) => {
      s.A.copy(s.la).applyMatrix4(s.fa.matrixWorld);
      s.B.copy(s.lb).applyMatrix4(s.fb.matrixWorld);
      s.C.copy(s.A).add(s.B).multiplyScalar(0.5);
      s.R = s.A.distanceTo(s.B) * 0.5 + Math.max(s.ra, s.rb);
      u.uA.value[i].set(s.A.x, s.A.y, s.A.z, s.ra);
      u.uB.value[i].set(s.B.x, s.B.y, s.B.z, s.rb);
      u.uS.value[i].set(s.C.x, s.C.y, s.C.z, s.R);
      u.uK.value[i] = s.k;
      s.X.setFromMatrixColumn(s.fa.matrixWorld, 0).normalize();
      s.Z.setFromMatrixColumn(s.fa.matrixWorld, 2).normalize();
      u.uSegX.value[i].copy(s.X);
      u.uSegZ.value[i].copy(s.Z);
      u.uSegT.value[i] = s.type;
      const r = Math.max(s.ra, s.rb) + s.k * 0.3 + 0.05;
      pad.set(r, r, r);
      this.box.expandByPoint(pad.clone().add(s.A)).expandByPoint(s.A.clone().sub(pad));
      this.box.expandByPoint(pad.clone().add(s.B)).expandByPoint(s.B.clone().sub(pad));
    });
    // clip the far end of the forearm (it fades out anyway)
    u.uBoxMin.value.copy(this.box.min);
    u.uBoxMax.value.copy(this.box.max);
    this.box.getCenter(this.mesh.position);
    this.box.getSize(this.mesh.scale);
    // nails
    const e = new THREE.Vector3();
    this.nails.forEach((n, i) => {
      const m = n.frame.matrixWorld;
      u.uNailC.value[i].set(0, n.L * 0.62, -0.42 * n.s).applyMatrix4(m);
      const ax = e.setFromMatrixColumn(m, 0).normalize();
      u.uNailX.value[i].copy(ax).multiplyScalar(1 / (0.4 * n.s));
      u.uNailY.value[i].setFromMatrixColumn(m, 1).normalize().multiplyScalar(1 / (0.5 * n.s + n.L * 0.12));
      u.uNailD.value[i].setFromMatrixColumn(m, 2).normalize().negate();
    });
    u.uPalmN.value.setFromMatrixColumn(this.rig.wrist.matrixWorld, 2).normalize();
    u.uWristO.value.setFromMatrixPosition(this.rig.wrist.matrixWorld);
    u.uWristX.value.setFromMatrixColumn(this.rig.wrist.matrixWorld, 0).normalize();
    u.uWristInv.value.copy(this.rig.wrist.matrixWorld).invert();
  }

  map(p) {
    let d = 1e5;
    for (const s of this.segs) {
      const bs = p.distanceTo(s.C) - s.R;
      if (bs > d + s.k) continue;
      d = smin(d, sdRoundCone(p, s.A, s.B, s.ra, s.rb), s.k);
    }
    return d;
  }

  // Sphere-trace a ray against the skin. Returns distance or null.
  raycast(origin, dir, maxT = 200) {
    const tBox = new THREE.Ray(origin, dir).intersectBox(this.box, new THREE.Vector3());
    let t = tBox ? Math.max(0, tBox.distanceTo(origin) - 0.01) : null;
    if (t === null) return null;
    const p = new THREE.Vector3();
    for (let i = 0; i < 160 && t < maxT; i++) {
      p.copy(dir).multiplyScalar(t).add(origin);
      const d = this.map(p);
      if (d < 0.004) return t;
      t += d;
      if (!this.box.containsPoint(p) && t > 1 && i > 3) {
        // left the box
        const back = p.clone().sub(this.box.getCenter(new THREE.Vector3()));
        if (back.dot(dir) > 0) return null;
      }
    }
    return null;
  }

  // Which sensory nerve supplies the skin at p (same rules as the shader).
  territoryAt(p) {
    const N = this.normal(p);
    let best = Infinity, s = this.segs[0];
    for (const g of this.segs) {
      const d = sdRoundCone(p, g.A, g.B, g.ra, g.rb);
      if (d < best) { best = d; s = g; }
    }
    const t = s.type;
    const palmar = N.dot(s.Z) > 0;
    const lat = p.clone().sub(s.A).dot(s.X);
    const wx = p.clone().sub(this.uniforms.uWristO.value).dot(this.uniforms.uWristX.value);
    const name = ['', 'median', 'ulnar', 'radial'];
    if (t === 0) return null;
    if (t === 1) return name[wx > -0.95 ? (palmar ? 1 : 3) : 2];
    if (t === 2) return 'ulnar';
    if (t < 4.5) return palmar ? 'median' : 'radial';
    const fi = t - 10, f = Math.floor(fi / 3), sg = fi - f * 3;
    if (f === 3) return 'ulnar';
    if (f === 2 && lat < 0) return 'ulnar';
    if (palmar) return 'median';
    return sg === 0 ? 'radial' : 'median';
  }

  // Move a point onto the nearest skin surface (follows the distance gradient).
  project(p) {
    const q = p.clone();
    for (let i = 0; i < 6; i++) {
      const d = this.map(q);
      if (Math.abs(d) < 0.002) break;
      q.addScaledVector(this.normal(q), -d);
    }
    return q;
  }

  normal(p) {
    const e = 0.004, n = new THREE.Vector3();
    const q = new THREE.Vector3();
    const f = (x, y, z) => this.map(q.set(p.x + x, p.y + y, p.z + z));
    n.set(f(e, 0, 0) - f(-e, 0, 0), f(0, e, 0) - f(0, -e, 0), f(0, 0, e) - f(0, 0, -e));
    return n.normalize();
  }
}
