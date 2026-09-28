// The hand skeleton: joint frames, bone meshes and pose application.
// Units are centimetres. Base model is a RIGHT hand in its own frame:
//   +X = radial (thumb side), +Y = distal (toward fingertips), +Z = palmar.
import * as THREE from 'three';
import { makeMaterial } from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const FINGERS = [
  { key: 'index', code: 'I', label: 'Index finger', mcp: V(2.45, 9.3, 0.0), base: V(1.55, 2.95, -0.05), len: [4.0, 2.4, 1.85], r: [0.5, 0.44, 0.38], skin: 1.0 },
  { key: 'middle', code: 'M', label: 'Middle finger', mcp: V(0.65, 9.6, -0.05), base: V(0.45, 3.05, -0.1), len: [4.45, 2.75, 1.95], r: [0.53, 0.46, 0.4], skin: 1.04 },
  { key: 'ring', code: 'R', label: 'Ring finger', mcp: V(-1.15, 9.15, 0.1), base: V(-0.75, 2.9, 0.0), len: [4.15, 2.65, 1.9], r: [0.49, 0.43, 0.37], skin: 0.97 },
  { key: 'pinky', code: 'P', label: 'Little finger', mcp: V(-2.8, 8.25, 0.35), base: V(-1.85, 2.65, 0.15), len: [3.3, 1.95, 1.65], r: [0.42, 0.37, 0.33], skin: 0.86 },
];

export const THUMB = {
  key: 'thumb', code: 'T', label: 'Thumb',
  cmc: V(2.5, 2.7, 0.7),
  dir: V(0.5, 0.8, 0.3).normalize(),
  flexDir: V(-0.9, 0.05, 0.45),
  len: [4.6, 3.2, 2.45],
  r: [0.52, 0.5, 0.44],
};

// Basis of the thumb chain: Y along the metacarpal, Z toward the pad (flexion side), X hinge axis.
export function thumbBasisQuat() {
  const y = THUMB.dir.clone();
  const z = THUMB.flexDir.clone().addScaledVector(y, -THUMB.flexDir.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ---------- geometry helpers ----------
function arc(pts, cx, cy, rx, ry, a0, a1, n) {
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push(new THREE.Vector2(Math.max(0.0005, cx + Math.cos(a) * rx), cy + Math.sin(a) * ry));
  }
}

// Lathe profile of a long bone (metacarpal / phalanx) from y=0 to y=L.
// headLen = length of the rounded head; the joint centre sits headLen below the end.
function longBoneGeometry(L, rb, rs, rh, kind = 'phalanx', headLen = rh * 0.9) {
  const pts = [];
  const baseCap = Math.min(rb * 0.55, L * 0.12);
  arc(pts, 0, baseCap, rb, baseCap, -Math.PI / 2, 0, 5);
  const add = (r, t) => pts.push(new THREE.Vector2(r, t * L));
  if (kind === 'distal') {
    add(rb * 0.95, 0.22);
    add(rs, 0.45);
    add(rs * 0.95, 0.62);
    add(rh * 0.92, 0.8);
    const hl = L * 0.14;
    arc(pts, 0, L - hl, rh, hl, 0, Math.PI / 2, 5);
  } else {
    add(rb * 0.9, 0.17);
    add(rs * 1.08, 0.3);
    add(rs, 0.5);
    add(rs * 1.05, 0.66);
    add(rh * 0.9, 1 - (headLen * 1.5) / L);
    arc(pts, 0, L - headLen, rh, headLen, 0, Math.PI / 2, 7);
  }
  return new THREE.LatheGeometry(pts, 22);
}

// Organic blob for carpal bones.
function blobGeometry(sx, sy, sz, seed = 0, amp = 0.1) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.3 + seed) * Math.cos(v.y * 1.9 - seed * 0.7) * Math.sin(v.z * 2.1 + seed * 1.3);
    v.multiplyScalar(1 + amp * n);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

// Radius / ulna: lathe with custom widening toward the wrist.
function forearmBoneGeometry({ y0, y1, rShaft, rEnd, widen, cx, tilt = 0 }) {
  const pts = [];
  const L = y1 - y0;
  const add = (r, t) => pts.push(new THREE.Vector2(r, t * L));
  add(rShaft, 0);
  add(rShaft, 0.55);
  add(rShaft * 1.1, 0.75);
  add(rEnd * 0.85, 0.88);
  add(rEnd, 0.94);
  arc(pts, 0, L - rEnd * 0.3, rEnd, rEnd * 0.3, 0, Math.PI / 2, 4);
  const g = new THREE.LatheGeometry(pts, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / L;
    const w = 1 + widen * THREE.MathUtils.smoothstep(t, 0.55, 0.95);
    const x = p.getX(i) * w;
    const z = p.getZ(i) * (1 + 0.15 * THREE.MathUtils.smoothstep(t, 0.6, 0.95));
    const y = p.getY(i) + (t > 0.85 ? x * tilt * THREE.MathUtils.smoothstep(t, 0.85, 1.0) : 0);
    p.setXYZ(i, x + cx, y + y0, z);
  }
  g.computeVertexNormals();
  return g;
}

function tag(mesh, info) {
  Object.assign(mesh.userData, info);
  return mesh;
}

// ---------- the rig ----------
export class HandRig {
  constructor() {
    this.pivot = new THREE.Group();               // orientation + mirroring, sits at palm centre
    this.pivot.position.set(0, 5, 0);
    this.root = new THREE.Group();                // base model frame
    this.root.position.set(0, -5, 0);
    this.pivot.add(this.root);
    this.fore = new THREE.Group();
    this.wrist = new THREE.Group();
    this.root.add(this.fore, this.wrist);
    this.frames = { fore: this.fore, wrist: this.wrist };
    this.meshes = [];   // pickable bone meshes

    this.fingers = FINGERS.map((def) => {
      const j1 = new THREE.Group(); j1.position.copy(def.mcp); this.wrist.add(j1);
      const j2 = new THREE.Group(); j2.position.set(0, def.len[0], 0); j1.add(j2);
      const j3 = new THREE.Group(); j3.position.set(0, def.len[1], 0); j2.add(j3);
      const tip = new THREE.Group(); tip.position.set(0, def.len[2] + 0.45, 0.12); j3.add(tip);
      this.frames[def.code + '1'] = j1; this.frames[def.code + '2'] = j2; this.frames[def.code + '3'] = j3;
      return { def, j1, j2, j3, tip };
    });

    const tb = new THREE.Group();
    tb.position.copy(THUMB.cmc);
    tb.quaternion.copy(thumbBasisQuat());
    this.wrist.add(tb);
    const t1 = new THREE.Group(); tb.add(t1);
    const t2 = new THREE.Group(); t2.position.set(0, THUMB.len[0], 0); t1.add(t2);
    const t3 = new THREE.Group(); t3.position.set(0, THUMB.len[1], 0); t2.add(t3);
    const ttip = new THREE.Group(); ttip.position.set(0, THUMB.len[2] + 0.45, 0.15); t3.add(ttip);
    this.thumb = { def: THUMB, base: tb, j1: t1, j2: t2, j3: t3, tip: ttip };
    this.frames.T1 = t1; this.frames.T2 = t2; this.frames.T3 = t3;

    this.buildBones();
    this.pivot.updateMatrixWorld(true);
  }

  addBone(parent, geo, info, kind = 'bone') {
    const m = new THREE.Mesh(geo, makeMaterial(kind));
    tag(m, { layer: 'bones', ...info });
    parent.add(m);
    this.meshes.push(m);
    return m;
  }

  buildBones() {
    const segNames = ['proximal phalanx', 'middle phalanx', 'distal phalanx'];
    const segDesc = [
      'Bone between the knuckle (MCP) and the middle knuckle (PIP).',
      'Bone between the middle (PIP) and end (DIP) knuckles.',
      'Fingertip bone; supports the nail and pulp.',
    ];
    // Fingers
    for (const f of this.fingers) {
      const { def } = f;
      // metacarpal (static, under wrist)
      const dir = def.mcp.clone().sub(def.base);
      const mrh = def.r[0] * 1.1, mhl = mrh * 0.85;
      const mg = longBoneGeometry(dir.length() + mhl, def.r[0] * 1.02, def.r[0] * 0.7, mrh, 'meta', mhl);
      const mc = this.addBone(this.wrist, mg, {
        name: `${def.label} metacarpal`, desc: 'Long bone of the palm; its head forms the knuckle.', tag: 'metacarpal', finger: def.key,
      });
      mc.position.copy(def.base);
      mc.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      mc.scale.set(1.08, 1, 0.9);
      // phalanges: each starts just beyond the parent's head and wraps its own head past the next joint
      const joints = [f.j1, f.j2, f.j3];
      let prevHl = mhl;
      for (let s = 0; s < 3; s++) {
        const Ls = def.len[s];
        const r = def.r[s];
        const start = prevHl + 0.06;
        const rh = r * 0.92, hl = rh * 0.85;
        const g = s === 2
          ? longBoneGeometry(Ls - start + 0.1, r * 0.95, r * 0.5, r * 0.78, 'distal')
          : longBoneGeometry(Ls - start + hl, r, r * 0.68, rh, 'phalanx', hl);
        const b = this.addBone(joints[s], g, {
          name: `${def.label} — ${segNames[s]}`, desc: segDesc[s], tag: 'phalanx', finger: def.key,
        });
        b.position.y = start;
        b.scale.set(1.14, 1, s === 2 ? 0.72 : 0.84);
        // articular cartilage cap between the head and the next base
        const c = this.addBone(joints[s], new THREE.SphereGeometry(1, 20, 10), {
          name: `${def.label} — ${['MCP (knuckle)', 'PIP (middle knuckle)', 'DIP (end knuckle)'][s]} joint cartilage`,
          desc: 'Smooth cartilage that lets the joint glide. Wears thin in osteoarthritis.', tag: 'cartilage', finger: def.key,
        }, 'cartilage');
        c.scale.set(r * 1.02, 0.07, r * 0.88);
        c.position.y = start - 0.02;
        prevHl = hl;
      }
    }

    // Thumb
    {
      const t = this.thumb;
      const names = ['metacarpal', 'proximal phalanx', 'distal phalanx'];
      const joints = [t.j1, t.j2, t.j3];
      let prevHl = 0.3;
      for (let s = 0; s < 3; s++) {
        const Ls = THUMB.len[s];
        const r = THUMB.r[s];
        const start = prevHl + 0.06;
        const rh = r * 0.95, hl = rh * 0.85;
        const g = s === 2
          ? longBoneGeometry(Ls - start + 0.1, r * 0.95, r * 0.52, r * 0.8, 'distal')
          : longBoneGeometry(Ls - start + hl, r * 1.02, r * 0.68, rh, 'phalanx', hl);
        const b = this.addBone(joints[s], g, {
          name: `Thumb ${names[s]}`, desc: s === 0 ? 'Sits on the trapezium at the thumb base (CMC joint) — a common arthritis site.' : 'Thumb bone.', tag: s === 0 ? 'thumb-metacarpal' : 'phalanx', finger: 'thumb',
        });
        b.position.y = start;
        b.scale.set(1.12, 1, s === 2 ? 0.74 : 0.86);
        const c = this.addBone(joints[s], new THREE.SphereGeometry(1, 20, 10), {
          name: `Thumb ${['CMC (base)', 'MCP', 'IP'][s]} joint cartilage`, desc: s === 0 ? 'Cartilage of the thumb basal joint — thins in basal thumb arthritis.' : 'Joint cartilage.', tag: s === 0 ? 'cmc-cartilage' : 'cartilage', finger: 'thumb',
        }, 'cartilage');
        c.scale.set(r * 1.05, 0.07, r * 0.9);
        c.position.y = start - 0.02;
        prevHl = hl;
      }
    }

    // Carpal bones (in wrist frame)
    const carpals = [
      ['Scaphoid', V(1.5, 1.0, 0.2), [0.62, 0.98, 0.5], V(0.3, 0, -0.75), 'Boat-shaped bone below the thumb. Often fractured in falls; tender in the "snuffbox".', 'scaphoid'],
      ['Lunate', V(0.3, 0.8, 0.05), [0.56, 0.5, 0.62], V(0, 0, 0), 'Moon-shaped central bone. Site of Kienböck\'s disease.', 'lunate'],
      ['Triquetrum', V(-0.95, 1.05, -0.1), [0.5, 0.45, 0.45], V(0, 0, 0.4), 'Pyramid-shaped bone on the little-finger side.', 'triquetrum'],
      ['Pisiform', V(-1.2, 1.2, 0.72), [0.3, 0.36, 0.3], V(0, 0, 0), 'Pea-shaped bone you can feel at the base of the little-finger side of the palm.', 'pisiform'],
      ['Trapezium', V(2.1, 2.25, 0.4), [0.56, 0.5, 0.5], V(0, 0, -0.5), 'Saddle for the thumb metacarpal — the thumb basal (CMC) joint.', 'trapezium'],
      ['Trapezoid', V(1.3, 2.45, 0.02), [0.42, 0.46, 0.45], V(0, 0, 0), 'Small wedge under the index metacarpal.', 'trapezoid'],
      ['Capitate', V(0.35, 2.15, 0.0), [0.55, 0.86, 0.56], V(0, 0, 0), 'Largest carpal bone, in the centre of the wrist.', 'capitate'],
      ['Hamate', V(-0.95, 2.2, 0.0), [0.55, 0.72, 0.52], V(0, 0, 0.1), 'Has a hook on the palm side; the hook can break in golf/racquet sports.', 'hamate'],
      ['Hook of hamate', V(-0.78, 2.3, 0.68), [0.22, 0.36, 0.32], V(0.3, 0, 0), 'Bony hook forming the outer wall of Guyon\'s canal.', 'hamate'],
    ];
    carpals.forEach(([name, pos, s, rot, desc, tg], i) => {
      const m = this.addBone(this.wrist, blobGeometry(s[0], s[1], s[2], i * 1.7, 0.09), { name, desc, tag: tg });
      m.position.copy(pos);
      m.rotation.set(rot.x, rot.y, rot.z);
    });

    // Radius & ulna (forearm frame)
    const radius = this.addBone(this.fore, forearmBoneGeometry({ y0: -13, y1: -0.25, rShaft: 0.62, rEnd: 0.95, widen: 0.75, cx: 0.95, tilt: 0.22 }), {
      name: 'Radius', desc: 'Forearm bone on the thumb side. Its end (distal radius) is the most commonly broken bone in falls.', tag: 'radius',
    });
    radius.scale.z = 0.95;
    const styloid = this.addBone(this.fore, blobGeometry(0.42, 0.55, 0.45, 2.2, 0.05), { name: 'Radial styloid', desc: 'Bony point on the thumb side of the wrist. De Quervain\'s tendons glide over it.', tag: 'radius' });
    styloid.position.set(2.25, -0.55, 0.05);
    const ulna = this.addBone(this.fore, forearmBoneGeometry({ y0: -13, y1: -0.85, rShaft: 0.48, rEnd: 0.62, widen: 0.15, cx: -1.75, tilt: 0 }), {
      name: 'Ulna', desc: 'Forearm bone on the little-finger side.', tag: 'ulna',
    });
    ulna.position.z = -0.1;
    const ustyl = this.addBone(this.fore, blobGeometry(0.2, 0.42, 0.2, 5.1, 0.05), { name: 'Ulnar styloid', desc: 'Small bony point on the little-finger side of the wrist.', tag: 'ulna' });
    ustyl.position.set(-2.1, -0.65, -0.35);
    // Lister's tubercle
    const lister = this.addBone(this.fore, blobGeometry(0.25, 0.5, 0.2, 1.1, 0.05), { name: 'Lister\'s tubercle', desc: 'Bump on the back of the radius; the thumb extensor (EPL) tendon turns around it.', tag: 'radius' });
    lister.position.set(1.0, -1.1, -0.9);
  }

  // ---------- pose ----------
  applyPose(p) {
    this.wrist.rotation.set(p.wrist.flex, 0, -p.wrist.dev);
    for (let i = 0; i < 4; i++) {
      const f = this.fingers[i], q = p.fingers[i];
      f.j1.rotation.set(q.mcp, 0, -q.abd);
      f.j2.rotation.set(q.pip, 0, 0);
      f.j3.rotation.set(q.dip, 0, 0);
    }
    this.thumb.j1.quaternion.copy(p.thumb.cmc);
    this.thumb.j2.rotation.set(p.thumb.mcp, 0, 0);
    this.thumb.j3.rotation.set(p.thumb.ip, 0, 0);
  }

  // World positions of MediaPipe-equivalent landmarks (0..20) plus 21 = forearm point.
  landmarks(out = []) {
    const w = (obj, x, y, z, i) => {
      out[i] = out[i] || new THREE.Vector3();
      out[i].set(x, y, z).applyMatrix4(obj.matrixWorld);
    };
    w(this.wrist, 0.2, 0.2, 0.3, 0);
    const t = this.thumb;
    w(t.j1, 0, 0, 0, 1); w(t.j2, 0, 0, 0, 2); w(t.j3, 0, 0, 0, 3); w(t.tip, 0, 0, 0, 4);
    this.fingers.forEach((f, k) => {
      const b = 5 + k * 4;
      w(f.j1, 0, 0, 0, b); w(f.j2, 0, 0, 0, b + 1); w(f.j3, 0, 0, 0, b + 2); w(f.tip, 0, 0, 0, b + 3);
    });
    w(this.fore, 0.2, -4.3, 0.3, 21);
    return out;
  }

  // Same landmarks but in base-model (root) coordinates with the current wrist pose.
  landmarksLocal() {
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    return this.landmarks([]).map((p) => p.applyMatrix4(inv));
  }
}

// ---------- pose objects ----------
const TB_Q = () => thumbBasisQuat();
export function makePose(spec = {}) {
  const f = spec.f || [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const th = spec.thumb || {};
  const cmc = th.cmcQ ? th.cmcQ.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(th.cmc || [0, 0, 0])));
  return {
    wrist: { flex: spec.wrist ? spec.wrist[0] : 0, dev: spec.wrist ? spec.wrist[1] : 0 },
    fingers: f.map(([mcp, abd, pip, dip]) => ({ mcp, abd, pip, dip })),
    thumb: { cmc, mcp: th.mcp || 0, ip: th.ip || 0 },
  };
}
export function clonePose(p) {
  return {
    wrist: { ...p.wrist },
    fingers: p.fingers.map((q) => ({ ...q })),
    thumb: { cmc: p.thumb.cmc.clone(), mcp: p.thumb.mcp, ip: p.thumb.ip },
  };
}
// out = a + (b - a) * t
export function lerpPose(out, a, b, t) {
  const L = THREE.MathUtils.lerp;
  out.wrist.flex = L(a.wrist.flex, b.wrist.flex, t);
  out.wrist.dev = L(a.wrist.dev, b.wrist.dev, t);
  for (let i = 0; i < 4; i++) {
    const o = out.fingers[i], x = a.fingers[i], y = b.fingers[i];
    o.mcp = L(x.mcp, y.mcp, t); o.abd = L(x.abd, y.abd, t); o.pip = L(x.pip, y.pip, t); o.dip = L(x.dip, y.dip, t);
  }
  out.thumb.cmc.slerpQuaternions(a.thumb.cmc, b.thumb.cmc, t);
  out.thumb.mcp = L(a.thumb.mcp, b.thumb.mcp, t);
  out.thumb.ip = L(a.thumb.ip, b.thumb.ip, t);
  return out;
}
export function poseDelta(a, b) {
  let d = Math.abs(a.wrist.flex - b.wrist.flex) + Math.abs(a.wrist.dev - b.wrist.dev);
  for (let i = 0; i < 4; i++) {
    const x = a.fingers[i], y = b.fingers[i];
    d += Math.abs(x.mcp - y.mcp) + Math.abs(x.abd - y.abd) + Math.abs(x.pip - y.pip) + Math.abs(x.dip - y.dip);
  }
  d += 1 - Math.abs(a.thumb.cmc.dot(b.thumb.cmc)) + Math.abs(a.thumb.mcp - b.thumb.mcp) + Math.abs(a.thumb.ip - b.thumb.ip);
  return d;
}
export { TB_Q };
