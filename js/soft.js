// Soft tissues as dynamic tubes anchored to the skeleton: muscles, tendons,
// ligaments, pulleys, nerves and arteries. Each tube is rebuilt from its
// anchor points whenever the hand moves, so tendons slide and wrap joints.
import * as THREE from 'three';
import { FINGERS, THUMB } from './rig.js';
import { makeMaterial } from './materials.js';

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _r = new THREE.Vector3();

// Radius profiles along u in [0,1]
const PROFILES = {
  tendon: (u) => Math.min(1, Math.pow(Math.min(u, 1 - u) / 0.04, 0.5)),
  muscle: (u) => 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.75),
  belly: (u) => Math.min(1, Math.sqrt(u / 0.06)) * (1 - 0.72 * THREE.MathUtils.smootherstep(u, 0.45, 1)),
  band: (u) => Math.min(1, Math.min(u, 1 - u) / 0.06 + 0.35),
  const: () => 1,
  nerve: (u) => Math.min(1, Math.pow(Math.min(u, 1 - u) / 0.02, 0.4)) * (1 - 0.35 * u),
};

export class Tube {
  constructor(rig, spec) {
    this.rig = rig;
    this.spec = spec;
    this.anchors = spec.pts.map(([f, x, y, z]) => ({ frame: rig.frames[f], local: new THREE.Vector3(x, y, z), world: new THREE.Vector3(), ref: new THREE.Vector3() }));
    this.points = this.anchors.map((a) => a.world);
    this.curve = new THREE.CatmullRomCurve3(this.points, false, 'centripetal');
    const spans = this.anchors.length - 1;
    this.S = spec.seg || Math.max(8, spans * (spec.segPerSpan || 6));
    this.R = spec.radial || 10;
    this.r = spec.r;
    this.rw = spec.rw || 1;          // width/thickness ratio for flat bands
    this.profile = PROFILES[spec.profile || 'tendon'];
    const S = this.S, R = this.R;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((S + 1) * (R + 1) * 3);
    this.nor = new Float32Array((S + 1) * (R + 1) * 3);
    const uv = new Float32Array((S + 1) * (R + 1) * 2);
    const idx = [];
    const rep = spec.uvRepeat || Math.max(1, Math.round((spec.approxLen || 6) / 2.5));
    for (let i = 0; i <= S; i++) {
      for (let j = 0; j <= R; j++) {
        const k = i * (R + 1) + j;
        uv[k * 2] = (i / S) * rep;
        uv[k * 2 + 1] = j / R;
        if (i < S && j < R) {
          const a = k, b = k + R + 1, c = k + 1, d = k + R + 2;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, makeMaterial(spec.kind));
    this.mesh.frustumCulled = false;
    this.mesh.userData = { name: spec.name, desc: spec.desc, tag: spec.tag, finger: spec.finger, layer: this.mesh.material.userData.layerKey, tube: this };
    this.update();
  }

  update() {
    const S = this.S, R = this.R, pos = this.pos, nor = this.nor;
    for (const a of this.anchors) {
      a.world.copy(a.local).applyMatrix4(a.frame.matrixWorld);
      // reference "up" = the frame's palmar (Z) axis in world space
      const e = a.frame.matrixWorld.elements;
      a.ref.set(e[8], e[9], e[10]).normalize();
    }
    const n = this.anchors.length;
    let prevN = null;
    for (let i = 0; i <= S; i++) {
      const u = i / S;
      this.curve.getPoint(u, _v);
      this.curve.getTangent(Math.min(0.999, Math.max(0.001, u)), _t);
      // blend reference axis between neighbouring anchors
      const fu = u * (n - 1);
      const k0 = Math.min(n - 2, Math.floor(fu));
      _r.copy(this.anchors[k0].ref).lerp(this.anchors[k0 + 1].ref, fu - k0);
      _n.copy(_r).addScaledVector(_t, -_r.dot(_t));
      if (_n.lengthSq() < 1e-4) {
        // tube runs along the reference axis: fall back to previous frame / any perpendicular
        if (prevN) _n.copy(prevN).addScaledVector(_t, -prevN.dot(_t));
        else _n.set(1, 0, 0).addScaledVector(_t, -_t.x);
      }
      _n.normalize();
      _b.crossVectors(_t, _n).normalize();
      prevN = prevN || new THREE.Vector3();
      prevN.copy(_n);
      const rad = (typeof this.r === 'number' ? this.r : this.r[0] + (this.r[1] - this.r[0]) * u) * this.profile(u);
      const rN = rad, rB = rad * this.rw;
      for (let j = 0; j <= R; j++) {
        const th = (j / R) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        const k = (i * (R + 1) + j) * 3;
        pos[k] = _v.x + (_n.x * c * rN + _b.x * s * rB);
        pos[k + 1] = _v.y + (_n.y * c * rN + _b.y * s * rB);
        pos[k + 2] = _v.z + (_n.z * c * rN + _b.z * s * rB);
        // ellipse normal
        let nx = _n.x * c / Math.max(rN, 1e-4) * rB + _b.x * s;
        let ny = _n.y * c / Math.max(rN, 1e-4) * rB + _b.y * s;
        let nz = _n.z * c / Math.max(rN, 1e-4) * rB + _b.z * s;
        const l = Math.hypot(nx, ny, nz) || 1;
        nor[k] = nx / l; nor[k + 1] = ny / l; nor[k + 2] = nz / l;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------------------
// Anatomy definitions. Frames: fore, wrist, I1..I3, M1..M3, R1..R3, P1..P3,
// T1..T3. Coordinates are local to the frame (cm). For finger frames +Y runs
// along the bone, +X radial, +Z palmar. For thumb frames +Y along the bone,
// +Z = pad (volar), -Z = nail, +X = radial side, -X = side facing the index.
// ---------------------------------------------------------------------------
const lerp3 = (a, b, t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t];
const W = (x, y, z) => ['wrist', x, y, z];
const F = (x, y, z) => ['fore', x, y, z];

export function buildSoftTissues(rig) {
  const specs = [];
  const add = (s) => specs.push(s);

  FINGERS.forEach((d, fi) => {
    const c = d.code, L = d.len, M = d.mcp, B = d.base;
    const x = M.x;
    const label = d.label;
    const mid = (t, z, dx = 0) => { const p = lerp3(B, M, t); return W(p[0] + dx, p[1], p[2] + z); };

    // --- Flexor digitorum profundus
    add({
      name: `Flexor digitorum profundus tendon — ${label.toLowerCase()}`, desc: 'Deep flexor tendon: bends the fingertip (DIP). Runs through the carpal tunnel.',
      tag: 'fdp', finger: d.key, kind: 'tendon', r: 0.13, profile: 'tendon', approxLen: 26,
      pts: [F(x * 0.28 - 0.1, -9, 0.45), F(x * 0.3 + 0.2, -3.5, 0.62), W(x * 0.3 + 0.35, 0.7, 0.88), W(x * 0.45 + 0.3, 2.9, 0.85), mid(0.62, 0.72), W(M.x, M.y - 0.75, M.z + 0.7),
        [c + '1', 0, 0.35, 0.6], [c + '1', 0, L[0] * 0.55, 0.52], [c + '2', 0, 0.02, 0.53], [c + '2', 0, L[1] * 0.55, 0.46], [c + '3', 0, 0.05, 0.42], [c + '3', 0, 0.55, 0.3]],
    });
    // --- Flexor digitorum superficialis
    add({
      name: `Flexor digitorum superficialis tendon — ${label.toLowerCase()}`, desc: 'Superficial flexor tendon: bends the middle knuckle (PIP).',
      tag: 'fds', finger: d.key, kind: 'tendon', r: 0.14, profile: 'tendon', approxLen: 24,
      pts: [F(x * 0.3 + 0.3, -9, 0.75), F(x * 0.32 + 0.35, -3.5, 0.85), W(x * 0.32 + 0.4, 0.8, 1.05), W(x * 0.5 + 0.35, 3.0, 1.0), mid(0.64, 0.88), W(M.x, M.y - 0.7, M.z + 0.86),
        [c + '1', 0, 0.35, 0.74], [c + '1', 0, L[0] * 0.55, 0.64], [c + '2', 0, 0.05, 0.62], [c + '2', 0, L[1] * 0.42, 0.44]],
    });
    // --- Extensor digitorum (and extensor mechanism)
    add({
      name: `Extensor tendon — ${label.toLowerCase()}`, desc: 'Straightens the finger. Runs over the knuckle and becomes the flat extensor mechanism.',
      tag: 'edc', finger: d.key, kind: 'tendon', r: 0.08, rw: 2.4, profile: 'tendon', approxLen: 26,
      pts: [F(x * 0.3 + 0.2, -9.5, -0.95), F(x * 0.35 + 0.25, -3, -1.02), W(x * 0.4 + 0.25, -0.3, -1.02), W(x * 0.62 + 0.2, 2.7, -0.82), mid(0.55, -0.6), W(M.x, M.y - 0.45, M.z - 0.66),
        [c + '1', 0, 0.2, -0.6], [c + '1', 0, L[0] * 0.5, -0.42], [c + '2', 0, 0.02, -0.5], [c + '2', 0, L[1] * 0.6, -0.36], [c + '3', 0, 0.02, -0.4], [c + '3', 0, 0.45, -0.3]],
    });
    // --- Pulleys A1 (at the knuckle), A2, A4
    const pulley = (frame, y, z, w, nm, tg) => add({
      name: `${nm} — ${label.toLowerCase()}`, desc: tg === 'a1' ? 'Tunnel that holds the flexor tendons at the finger base. Thickening here causes trigger finger.' : 'Fibrous pulley keeping the flexor tendons close to the bone.',
      tag: tg, finger: d.key, kind: 'ligament', r: 0.05, rw: w, profile: 'const', seg: 10, radial: 8,
      pts: [[frame, -0.5, y, z - 0.3], [frame, -0.38, y, z + 0.12], [frame, 0, y, z + 0.3], [frame, 0.38, y, z + 0.12], [frame, 0.5, y, z - 0.3]],
    });
    pulley(c + '1', 0.35, 0.55, 5.5, 'A1 pulley', 'a1');
    pulley(c + '1', L[0] * 0.5, 0.45, 7, 'A2 pulley', 'pulley');
    pulley(c + '2', L[1] * 0.5, 0.36, 5, 'A4 pulley', 'pulley');
    // --- Collateral ligaments at PIP and DIP
    for (const side of [1, -1]) {
      const sn = side > 0 ? 'radial' : 'ulnar';
      add({
        name: `PIP collateral ligament (${sn}) — ${label.toLowerCase()}`, desc: 'Side ligament of the middle knuckle; sprained in "jammed" fingers.',
        tag: 'collateral', finger: d.key, kind: 'ligament', r: 0.07, rw: 2.2, profile: 'band', seg: 8, radial: 8,
        pts: [[c + '1', side * 0.5, L[0] - 0.35, 0.02], [c + '1', side * 0.56, L[0] + 0.05, 0.05], [c + '2', side * 0.5, 0.45, 0.1]],
      });
      add({
        name: `DIP collateral ligament (${sn}) — ${label.toLowerCase()}`, desc: 'Side ligament of the end knuckle.',
        tag: 'collateral', finger: d.key, kind: 'ligament', r: 0.055, rw: 2, profile: 'band', seg: 8, radial: 8,
        pts: [[c + '2', side * 0.44, L[1] - 0.3, 0.02], [c + '2', side * 0.48, L[1] + 0.05, 0.05], [c + '3', side * 0.42, 0.4, 0.08]],
      });
      // proper digital nerve & artery along each side
      const toThumbSide = side > 0;
      const nerveName = (d.key === 'pinky' || (d.key === 'ring' && !toThumbSide)) ? 'ulnar' : 'median';
      add({
        name: `Digital nerve (${sn} side) — ${label.toLowerCase()}`, desc: `Sensation for this side of the finger, from the ${nerveName} nerve.`,
        tag: nerveName === 'median' ? 'digital-median' : 'digital-ulnar', finger: d.key, kind: 'nerve', r: 0.075, profile: 'nerve', approxLen: 14,
        pts: [nerveName === 'median' ? W(0.6, 3.6, 1.2) : W(-1.0, 2.8, 1.25), W(M.x + side * 0.45, M.y - 2.4, 1.0), W(M.x + side * 0.5 * d.skin, M.y - 0.2, M.z + 0.7),
          [c + '1', side * 0.52 * d.skin, L[0] * 0.5, 0.4], [c + '2', side * 0.48 * d.skin, L[1] * 0.5, 0.34], [c + '3', side * 0.4 * d.skin, L[2] * 0.7, 0.2]],
      });
      add({
        name: `Digital artery (${sn} side) — ${label.toLowerCase()}`, desc: 'Blood supply to the finger.',
        tag: 'digital-artery', finger: d.key, kind: 'artery', r: 0.065, profile: 'nerve', approxLen: 12,
        pts: [W(M.x * 0.9 + side * 0.4, M.y - 3.5, 1.2), W(M.x + side * 0.48 * d.skin, M.y - 0.3, M.z + 0.55),
          [c + '1', side * 0.56 * d.skin, L[0] * 0.5, 0.22], [c + '2', side * 0.52 * d.skin, L[1] * 0.5, 0.18], [c + '3', side * 0.42 * d.skin, L[2] * 0.7, 0.05]],
      });
    }
    // --- Lumbrical
    add({
      name: `Lumbrical — ${label.toLowerCase()}`, desc: 'Small worm-like muscle from the flexor tendon to the extensor hood; bends the knuckle while straightening the finger.',
      tag: 'lumbrical', finger: d.key, kind: 'muscle', r: 0.2, profile: 'muscle', approxLen: 5,
      pts: [mid(0.5, 0.95, 0.3), mid(0.8, 0.9, 0.45), W(M.x + 0.55, M.y - 0.45, M.z + 0.4), [c + '1', 0.5, 0.9, -0.05]],
    });
    // --- Palmar aponeurosis slip
    add({
      name: 'Palmar aponeurosis (fascia)', desc: 'Tough fan of fascia under the palm skin. Thickens into nodules and cords in Dupuytren\'s disease.',
      tag: 'aponeurosis', finger: d.key, kind: 'fascia', r: 0.04, rw: 9, profile: 'const', seg: 10, radial: 8,
      pts: [W(0.35, 2.7, 1.3), W((0.35 + M.x) / 2, (2.7 + M.y) / 2 - 0.5, 1.25), W(M.x, M.y - 1.0, M.z + 0.98)],
    });
  });

  // Dorsal interossei 2-4 and palmar interossei
  const I = FINGERS[0], Mi = FINGERS[1], Ri = FINGERS[2], Pi = FINGERS[3];
  const between = (a, b, t, z) => { const p = lerp3(a.base, a.mcp, t), q = lerp3(b.base, b.mcp, t); return W((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z); };
  add({ name: 'Second dorsal interosseous', desc: 'Spreads the fingers apart (middle finger toward the thumb).', tag: 'interossei', kind: 'muscleDeep', r: 0.34, rw: 0.9, profile: 'muscle', approxLen: 7,
    pts: [between(I, Mi, 0.08, -0.25), between(I, Mi, 0.55, -0.38), W(Mi.mcp.x + 0.5, Mi.mcp.y - 0.4, -0.2), ['M1', 0.46, 0.55, -0.1]] });
  add({ name: 'Third dorsal interosseous', desc: 'Spreads the middle finger toward the little finger.', tag: 'interossei', kind: 'muscleDeep', r: 0.32, rw: 0.9, profile: 'muscle', approxLen: 7,
    pts: [between(Mi, Ri, 0.08, -0.25), between(Mi, Ri, 0.55, -0.38), W(Mi.mcp.x - 0.5, Mi.mcp.y - 0.4, -0.2), ['M1', -0.46, 0.55, -0.1]] });
  add({ name: 'Fourth dorsal interosseous', desc: 'Spreads the ring finger away from the middle finger.', tag: 'interossei', kind: 'muscleDeep', r: 0.3, rw: 0.9, profile: 'muscle', approxLen: 7,
    pts: [between(Ri, Pi, 0.08, -0.2), between(Ri, Pi, 0.55, -0.3), W(Ri.mcp.x - 0.5, Ri.mcp.y - 0.4, -0.15), ['R1', -0.46, 0.55, -0.05]] });
  add({ name: 'Palmar interosseous (index)', desc: 'Pulls the index finger toward the middle finger.', tag: 'interossei', kind: 'muscleDeep', r: 0.24, profile: 'muscle', approxLen: 7,
    pts: [W(1.2, 3.8, 0.35), W(1.55, 6.8, 0.38), ['I1', -0.42, 0.5, 0.18]] });
  add({ name: 'Palmar interosseous (ring)', desc: 'Pulls the ring finger toward the middle finger.', tag: 'interossei', kind: 'muscleDeep', r: 0.24, profile: 'muscle', approxLen: 7,
    pts: [W(-0.5, 3.8, 0.38), W(-0.7, 6.8, 0.4), ['R1', 0.42, 0.5, 0.18]] });
  add({ name: 'Palmar interosseous (little)', desc: 'Pulls the little finger toward the ring finger.', tag: 'interossei', kind: 'muscleDeep', r: 0.24, profile: 'muscle', approxLen: 6,
    pts: [W(-1.55, 3.6, 0.42), W(-2.2, 6.5, 0.48), ['P1', 0.4, 0.45, 0.18]] });

  // ---------------- Thumb ----------------
  const TL = THUMB.len;
  add({ name: 'First dorsal interosseous', desc: 'The muscle bulge between thumb and index on the back of the hand. Powers pinch.', tag: 'di1', kind: 'muscle', r: 0.44, rw: 0.85, profile: 'muscle', approxLen: 8,
    pts: [['T1', -0.35, 0.9, -0.2], ['T1', -0.7, 2.4, -0.25], W(2.6, 6.2, -0.28), W(2.75, 8.2, -0.15), ['I1', 0.48, 0.55, -0.1]] });
  add({ name: 'Abductor pollicis brevis', desc: 'Most superficial thenar muscle; lifts the thumb away from the palm. Wastes in severe carpal tunnel.', tag: 'thenar', finger: 'thumb', kind: 'muscle', r: 0.55, rw: 1.15, profile: 'muscle', approxLen: 7,
    pts: [W(2.0, 1.3, 1.3), W(2.6, 2.4, 1.55), ['T1', 0.5, 1.8, 0.8], ['T1', 0.55, 3.6, 0.6], ['T2', 0.45, 0.4, 0.2]] });
  add({ name: 'Flexor pollicis brevis', desc: 'Thenar muscle that bends the thumb at its knuckle.', tag: 'thenar', finger: 'thumb', kind: 'muscle', r: 0.46, profile: 'muscle', approxLen: 7,
    pts: [W(1.5, 1.8, 1.35), W(1.9, 2.8, 1.45), ['T1', -0.1, 2.0, 0.85], ['T1', -0.05, 3.8, 0.6], ['T2', -0.1, 0.35, 0.4]] });
  add({ name: 'Opponens pollicis', desc: 'Deep thenar muscle that rotates the thumb across the palm (opposition).', tag: 'thenar', finger: 'thumb', kind: 'muscleDeep', r: 0.42, profile: 'muscle', approxLen: 6,
    pts: [W(1.9, 2.0, 1.0), ['T1', 0.35, 1.2, 0.35], ['T1', 0.5, 3.2, 0.2], ['T1', 0.45, 4.1, 0.1]] });
  add({ name: 'Adductor pollicis', desc: 'Fan-shaped muscle pulling the thumb toward the palm — key for strong pinch and grip.', tag: 'adductor', finger: 'thumb', kind: 'muscleDeep', r: 0.26, rw: 1.9, profile: 'muscle', approxLen: 7,
    pts: [W(0.4, 4.2, 0.62), W(0.9, 6.0, 0.62), W(2.0, 5.8, 0.55), ['T2', -0.42, 0.35, 0.1]] });
  add({ name: 'Adductor pollicis (oblique head)', desc: 'Oblique head of the thumb adductor.', tag: 'adductor', finger: 'thumb', kind: 'muscleDeep', r: 0.34, profile: 'muscle', approxLen: 6,
    pts: [W(0.5, 3.0, 0.72), W(1.5, 4.0, 0.85), ['T1', -0.6, 3.6, 0.35], ['T2', -0.45, 0.3, 0.1]] });
  add({ name: 'Flexor pollicis longus tendon', desc: 'Bends the thumb tip. Runs through the carpal tunnel.', tag: 'fpl', finger: 'thumb', kind: 'tendon', r: 0.14, profile: 'tendon', approxLen: 24,
    pts: [F(1.05, -8, 0.35), F(1.0, -3, 0.65), W(1.25, 0.8, 0.95), W(1.85, 2.6, 1.0), ['T1', 0.0, 1.8, 0.55], ['T1', 0.0, 3.9, 0.55], ['T2', 0, 0.2, 0.52], ['T2', 0, TL[1] * 0.6, 0.45], ['T3', 0, 0.05, 0.42], ['T3', 0, 0.5, 0.3]] });
  add({ name: 'Extensor pollicis longus tendon', desc: 'Lifts the thumb. Turns around Lister\'s tubercle — can rupture after a wrist fracture.', tag: 'epl', finger: 'thumb', kind: 'tendon', r: 0.1, profile: 'tendon', approxLen: 22,
    pts: [F(0.3, -9, -0.95), F(0.75, -2.5, -1.1), F(1.2, -0.9, -1.12), W(1.9, 1.5, -0.72), ['T1', -0.25, 1.4, -0.62], ['T1', -0.1, 3.6, -0.55], ['T2', 0, 0.3, -0.55], ['T2', 0, TL[1] * 0.6, -0.45], ['T3', 0, 0.05, -0.45], ['T3', 0, 0.45, -0.32]] });
  add({ name: 'Abductor pollicis longus tendon', desc: 'First dorsal compartment. Inflamed with EPB in De Quervain\'s tenosynovitis.', tag: 'apl-epb', finger: 'thumb', kind: 'tendon', r: 0.15, profile: 'tendon', approxLen: 12,
    pts: [F(2.0, -5.5, -0.45), F(2.45, -2.5, -0.1), F(2.75, -0.7, 0.1), W(2.75, 1.3, 0.45), ['T1', 0.45, 0.45, -0.1]] });
  add({ name: 'Extensor pollicis brevis tendon', desc: 'First dorsal compartment (with APL) — the De Quervain\'s tendons.', tag: 'apl-epb', finger: 'thumb', kind: 'tendon', r: 0.12, profile: 'tendon', approxLen: 14,
    pts: [F(1.9, -5.5, -0.6), F(2.35, -2.5, -0.3), F(2.65, -0.7, -0.15), W(2.65, 1.4, 0.2), ['T1', 0.2, 1.5, -0.45], ['T1', 0.1, 3.8, -0.5], ['T2', 0, 0.5, -0.5]] });
  add({ name: 'Outcropping muscles (APL & EPB)', desc: 'Muscle bellies crossing the radius; friction here causes intersection syndrome.', tag: 'apl-epb', kind: 'muscle', r: 0.5, rw: 0.75, profile: 'belly', approxLen: 9,
    pts: [F(0.2, -12, -0.85), F(1.1, -9, -0.9), F(1.9, -6.5, -0.65), F(2.2, -4.5, -0.3)] });
  add({ name: 'Thumb A1 pulley', desc: 'Pulley at the thumb base; thickening causes trigger thumb.', tag: 'a1', finger: 'thumb', kind: 'ligament', r: 0.05, rw: 5.5, profile: 'const', seg: 10, radial: 8,
    pts: [['T2', -0.52, 0.35, 0.25], ['T2', -0.38, 0.35, 0.62], ['T2', 0, 0.35, 0.82], ['T2', 0.38, 0.35, 0.62], ['T2', 0.52, 0.35, 0.25]] });
  add({ name: 'Ulnar collateral ligament of the thumb', desc: 'Stabilises the thumb knuckle for pinch. Torn in skier\'s / gamekeeper\'s thumb.', tag: 'ucl', finger: 'thumb', kind: 'ligament', r: 0.09, rw: 2.2, profile: 'band', seg: 8, radial: 8,
    pts: [['T1', -0.55, TL[0] - 0.45, 0.0], ['T1', -0.6, TL[0], 0.05], ['T2', -0.52, 0.55, 0.12]] });
  add({ name: 'Radial collateral ligament of the thumb', desc: 'Outer side ligament of the thumb knuckle.', tag: 'collateral', finger: 'thumb', kind: 'ligament', r: 0.08, rw: 2, profile: 'band', seg: 8, radial: 8,
    pts: [['T1', 0.55, TL[0] - 0.45, 0.0], ['T1', 0.6, TL[0], 0.05], ['T2', 0.52, 0.55, 0.12]] });
  for (const side of [1, -1]) {
    add({ name: `Digital nerve of the thumb (${side > 0 ? 'radial' : 'ulnar'} side)`, desc: 'Sensation for the thumb, from the median nerve.', tag: 'digital-median', finger: 'thumb', kind: 'nerve', r: 0.075, profile: 'nerve', approxLen: 12,
      pts: [W(0.6, 3.6, 1.2), W(1.7, 4.3, 1.35), ['T1', side * 0.45, 3.6, 0.6], ['T2', side * 0.48, TL[1] * 0.5, 0.42], ['T3', side * 0.4, TL[2] * 0.6, 0.25]] });
  }

  // ---------------- Hypothenar ----------------
  add({ name: 'Abductor digiti minimi', desc: 'Hypothenar muscle that spreads the little finger.', tag: 'hypothenar', finger: 'pinky', kind: 'muscle', r: 0.5, rw: 0.95, profile: 'muscle', approxLen: 7,
    pts: [W(-1.3, 1.25, 1.0), W(-2.4, 3.2, 0.95), W(-2.9, 5.8, 0.55), ['P1', -0.45, 0.45, 0.05]] });
  add({ name: 'Flexor digiti minimi brevis', desc: 'Hypothenar muscle that bends the little finger at the knuckle.', tag: 'hypothenar', finger: 'pinky', kind: 'muscle', r: 0.4, profile: 'muscle', approxLen: 6,
    pts: [W(-0.85, 2.45, 1.1), W(-1.8, 4.2, 1.2), W(-2.4, 6.4, 0.95), ['P1', -0.15, 0.35, 0.4]] });
  add({ name: 'Opponens digiti minimi', desc: 'Deep hypothenar muscle; cups the palm.', tag: 'hypothenar', finger: 'pinky', kind: 'muscleDeep', r: 0.36, profile: 'muscle', approxLen: 6,
    pts: [W(-0.9, 2.5, 0.9), W(-1.9, 4.6, 0.6), W(-2.55, 7.0, 0.4)] });

  // ---------------- Wrist & forearm tendons ----------------
  add({ name: 'Flexor carpi radialis', desc: 'Bends the wrist toward the thumb side. Its tendon can get inflamed at the wrist crease.', tag: 'fcr', kind: 'tendon', r: 0.17, profile: 'tendon', approxLen: 14,
    pts: [F(1.35, -8.5, 1.1), F(1.5, -3, 1.2), W(1.9, 0.6, 1.1), W(1.95, 1.9, 0.95), W(1.6, 3.1, 0.4)] });
  add({ name: 'Palmaris longus', desc: 'Thin superficial tendon (absent in ~15% of people) feeding the palmar fascia.', tag: 'pl', kind: 'tendon', r: 0.11, profile: 'tendon', approxLen: 12,
    pts: [F(0.3, -8.5, 1.15), F(0.35, -3, 1.3), W(0.35, 0.6, 1.35), W(0.35, 2.7, 1.3)] });
  add({ name: 'Flexor carpi ulnaris', desc: 'Bends the wrist toward the little-finger side; attaches to the pisiform.', tag: 'fcu', kind: 'tendon', r: 0.19, profile: 'tendon', approxLen: 12,
    pts: [F(-1.9, -8.5, 0.75), F(-1.75, -3, 0.95), W(-1.4, 0.4, 1.0), W(-1.25, 1.05, 0.95)] });
  add({ name: 'Extensor carpi ulnaris', desc: 'Stabilises the little-finger side of the wrist; can snap or get inflamed with twisting.', tag: 'ecu', kind: 'tendon', r: 0.17, profile: 'tendon', approxLen: 14,
    pts: [F(-1.95, -8.5, -0.7), F(-2.15, -3, -0.72), F(-2.25, -0.9, -0.62), W(-2.1, 1.4, -0.4), W(-1.95, 2.8, -0.35)] });
  add({ name: 'Extensor carpi radialis longus', desc: 'Lifts the wrist toward the thumb side.', tag: 'ecr', kind: 'tendon', r: 0.15, profile: 'tendon', approxLen: 14,
    pts: [F(1.8, -8.5, -0.55), F(1.85, -3, -0.72), F(1.7, -0.6, -0.95), W(1.6, 1.6, -0.62), W(1.45, 3.1, -0.45)] });
  add({ name: 'Extensor carpi radialis brevis', desc: 'Main wrist extensor — the tendon involved in tennis elbow.', tag: 'ecr', kind: 'tendon', r: 0.15, profile: 'tendon', approxLen: 14,
    pts: [F(1.5, -8.5, -0.75), F(1.45, -3, -0.9), F(1.35, -0.6, -1.05), W(0.9, 1.6, -0.72), W(0.55, 3.2, -0.5)] });
  // Forearm muscle bellies
  const belly = (name, desc, tg, kind, r, rw, pts) => add({ name, desc, tag: tg, kind, r, rw, profile: 'belly', approxLen: 9, pts });
  belly('Flexor muscles of the forearm', 'Muscle bellies that power grip. Overuse causes forearm aching.', 'forearm-flexors', 'muscle', 0.6, 1.7, [F(0.3, -12.5, 0.75), F(0.35, -9.5, 0.8), F(0.4, -6.5, 0.85), F(0.45, -4.3, 0.85)]);
  belly('Flexor carpi ulnaris (muscle)', 'Muscle on the little-finger side of the forearm.', 'fcu', 'muscle', 0.5, 1.0, [F(-1.95, -12.5, 0.55), F(-1.95, -10, 0.6), F(-1.9, -7.5, 0.7), F(-1.9, -6.0, 0.72)]);
  belly('Flexor carpi radialis (muscle)', 'Muscle on the thumb side of the forearm.', 'fcr', 'muscle', 0.45, 1.0, [F(1.3, -12.5, 0.9), F(1.35, -10.5, 1.0), F(1.35, -8.8, 1.05)]);
  belly('Extensor muscles of the forearm', 'Muscle bellies that lift the wrist and fingers. Overworked by typing and racquet sports.', 'forearm-extensors', 'muscle', 0.58, 1.8, [F(0.0, -12.5, -0.78), F(0.1, -10, -0.82), F(0.2, -7.5, -0.86), F(0.25, -5.5, -0.88)]);
  belly('Extensor carpi ulnaris (muscle)', 'Muscle on the back, little-finger side of the forearm.', 'ecu', 'muscle', 0.48, 1.0, [F(-1.95, -12.5, -0.55), F(-2.0, -10, -0.6), F(-2.0, -8.0, -0.65)]);
  belly('Wrist extensors (ECRL/ECRB)', 'Muscles on the back, thumb side of the forearm.', 'ecr', 'muscle', 0.52, 1.1, [F(1.65, -12.5, -0.45), F(1.7, -10.5, -0.5), F(1.75, -8.4, -0.55)]);
  add({ name: 'Pronator quadratus', desc: 'Square muscle deep on the front of the wrist; turns the palm down.', tag: 'pq', kind: 'muscleDeep', r: 0.2, rw: 4.2, profile: 'muscle', approxLen: 4,
    pts: [F(1.45, -3.1, 0.55), F(0.0, -3.0, 0.62), F(-1.7, -2.9, 0.35)] });

  // Retinacula & ligaments
  add({ name: 'Transverse carpal ligament (flexor retinaculum)', desc: 'Roof of the carpal tunnel. The median nerve is squeezed under it in carpal tunnel syndrome.', tag: 'tcl', kind: 'ligament', r: 0.12, rw: 10, profile: 'const', seg: 16, radial: 12,
    pts: [W(2.1, 1.9, 0.9), W(1.4, 1.95, 1.4), W(0.35, 2.0, 1.55), W(-0.55, 2.05, 1.4), W(-1.05, 2.1, 1.0)] });
  add({ name: 'Extensor retinaculum', desc: 'Band across the back of the wrist holding the extensor tendons in their six compartments.', tag: 'ext-retinaculum', kind: 'ligament', r: 0.09, rw: 8, profile: 'const', seg: 16, radial: 12,
    pts: [F(2.95, -0.8, 0.25), F(2.2, -0.7, -0.95), F(0.4, -0.6, -1.2), F(-1.4, -0.6, -1.0), F(-2.45, -0.6, -0.1)] });
  add({ name: 'Scapholunate ligament', desc: 'Key wrist ligament joining the scaphoid and lunate; injured in falls.', tag: 'sl', kind: 'ligament', r: 0.1, rw: 2.2, profile: 'band', seg: 6, radial: 8,
    pts: [W(1.15, 1.0, -0.42), W(0.9, 0.92, -0.55), W(0.62, 0.85, -0.45)] });
  add({ name: 'TFCC (triangular fibrocartilage complex)', desc: 'Cushion and stabiliser between the ulna and the wrist bones. Tears cause little-finger-side wrist pain and clicking.', tag: 'tfcc', kind: 'ligament', r: 0.45, rw: 0.3, profile: 'band', seg: 8, radial: 10,
    pts: [F(-2.1, -0.55, -0.1), F(-1.45, -0.42, 0.0), F(-0.55, -0.32, 0.05)] });

  // ---------------- Nerves ----------------
  add({ name: 'Median nerve', desc: 'Feels the thumb, index, middle and half the ring finger; runs through the carpal tunnel.', tag: 'median', kind: 'nerve', r: 0.26, rw: 1.25, profile: 'nerve', approxLen: 18,
    pts: [F(0.35, -12.5, 0.72), F(0.45, -6, 0.95), F(0.5, -2, 1.1), W(0.5, 0.4, 1.2), W(0.55, 2.2, 1.25), W(0.6, 3.6, 1.2)] });
  add({ name: 'Recurrent motor branch (median)', desc: 'Nerve branch powering the thenar muscles.', tag: 'median', kind: 'nerve', r: 0.08, profile: 'nerve', approxLen: 3,
    pts: [W(0.6, 3.2, 1.25), W(1.3, 3.1, 1.4), W(1.9, 2.9, 1.6)] });
  add({ name: 'Ulnar nerve', desc: 'Feels the little finger and half the ring finger; passes through Guyon\'s canal at the wrist.', tag: 'ulnar-nerve', kind: 'nerve', r: 0.22, profile: 'nerve', approxLen: 18,
    pts: [F(-1.7, -12.5, 0.55), F(-1.65, -6, 0.75), F(-1.5, -2, 0.95), W(-0.95, 0.9, 1.25), W(-0.9, 2.2, 1.3), W(-1.0, 2.8, 1.25)] });
  add({ name: 'Deep branch of the ulnar nerve', desc: 'Motor branch curving around the hook of the hamate to the small hand muscles.', tag: 'ulnar-nerve', kind: 'nerve', r: 0.09, profile: 'nerve', approxLen: 7,
    pts: [W(-1.0, 2.6, 1.2), W(-0.55, 3.0, 0.85), W(0.4, 4.3, 0.55), W(1.5, 4.5, 0.6), W(2.2, 4.8, 0.7)] });
  add({ name: 'Superficial radial nerve', desc: 'Skin nerve on the back of the thumb side. A tight watch or cast can irritate it (Wartenberg\'s).', tag: 'sup-radial', kind: 'nerve', r: 0.08, profile: 'nerve', approxLen: 14,
    pts: [F(1.9, -8, -0.35), F(2.45, -3, -0.3), F(2.6, -0.4, -0.35), W(2.45, 1.8, -0.5), W(2.15, 4.0, -0.6), W(2.25, 6.0, -0.62)] });
  add({ name: 'Superficial radial nerve (thumb branch)', desc: 'Sensation on the back of the thumb.', tag: 'sup-radial', kind: 'nerve', r: 0.06, profile: 'nerve', approxLen: 6,
    pts: [W(2.55, 1.2, -0.45), ['T1', 0.2, 1.8, -0.6], ['T1', 0.1, 3.9, -0.62], ['T2', 0.1, 1.2, -0.52]] });
  add({ name: 'Dorsal branch of the ulnar nerve', desc: 'Sensation on the back of the little-finger side of the hand.', tag: 'ulnar-nerve', kind: 'nerve', r: 0.07, profile: 'nerve', approxLen: 10,
    pts: [F(-1.8, -5, 0.2), F(-2.35, -2, -0.35), W(-2.15, 2.0, -0.55), W(-2.2, 5.5, -0.6)] });

  // ---------------- Arteries ----------------
  add({ name: 'Radial artery', desc: 'Where you feel the pulse at the wrist. Dives through the anatomical snuffbox.', tag: 'radial-artery', kind: 'artery', r: 0.14, profile: 'nerve', approxLen: 20,
    pts: [F(1.5, -12.5, 0.95), F(1.8, -5, 1.1), F(2.05, -1.2, 1.1), W(2.55, 0.8, 0.5), W(2.65, 1.9, -0.25), W(2.1, 3.6, -0.5), W(1.7, 4.2, 0.25), W(0.4, 4.4, 0.35), W(-1.2, 4.1, 0.4)] });
  add({ name: 'Ulnar artery & superficial palmar arch', desc: 'Main blood supply to the fingers. Damaged by using the palm as a hammer (hypothenar hammer syndrome).', tag: 'ulnar-artery', kind: 'artery', r: 0.14, profile: 'nerve', approxLen: 20,
    pts: [F(-1.4, -12.5, 0.8), F(-1.35, -5, 0.95), F(-1.2, -1.5, 1.05), W(-0.7, 0.9, 1.3), W(-0.65, 2.6, 1.42), W(-0.9, 4.6, 1.3), W(0.4, 5.6, 1.32), W(1.8, 5.3, 1.35), W(2.6, 4.6, 1.3)] });

  const tubes = specs.map((s) => new Tube(rig, s));
  return tubes;
}
