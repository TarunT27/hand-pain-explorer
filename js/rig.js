// The hand skeleton: joint frames, bone meshes and pose application.
// Units are centimetres. Base model is a RIGHT hand in its own frame:
//   +X = radial (thumb side), +Y = distal (toward fingertips), +Z = palmar.
import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { phalanxGeometry, distalPhalanxGeometry, metacarpalGeometry, carpalGeometries, radiusGeometry, ulnaGeometry } from './bonemesh.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

import { FINGER_DATA, THUMB_DATA } from './hand-data.js';

export const FINGERS = FINGER_DATA.map((f) => ({ ...f, mcp: V(...f.mcp), base: V(...f.base) }));

export const THUMB = {
  ...THUMB_DATA,
  cmc: V(...THUMB_DATA.cmc),
  dir: V(...THUMB_DATA.dir).normalize(),
  flexDir: V(...THUMB_DATA.flexDir),
};

// Basis of the thumb chain: Y along the metacarpal, Z toward the pad (flexion side), X hinge axis.
export function thumbBasisQuat() {
  const y = THUMB.dir.clone();
  const z = THUMB.flexDir.clone().addScaledVector(y, -THUMB.flexDir.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
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
      const mg = metacarpalGeometry(dir.length() + mhl, def.r[0] * 1.02, def.r[0] * 0.7, mrh, mhl);
      const mc = this.addBone(this.wrist, mg, {
        name: `${def.label} metacarpal`, desc: 'Long bone of the palm; its head forms the knuckle.', tag: 'metacarpal', finger: def.key,
      });
      mc.position.copy(def.base);
      mc.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      // phalanges: each starts just beyond the parent's head and wraps its own head past the next joint
      const joints = [f.j1, f.j2, f.j3];
      let prevHl = mhl;
      for (let s = 0; s < 3; s++) {
        const Ls = def.len[s];
        const r = def.r[s];
        const start = prevHl + 0.06;
        const rh = r * 0.92, hl = rh * 0.85;
        const g = s === 2
          ? distalPhalanxGeometry(Ls - start + 0.1, r * 0.95, r * 0.5, r * 0.78)
          : phalanxGeometry(Ls - start + hl, r, r * 0.68, rh);
        const b = this.addBone(joints[s], g, {
          name: `${def.label} — ${segNames[s]}`, desc: segDesc[s], tag: 'phalanx', finger: def.key,
        });
        b.position.y = start;
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
          ? distalPhalanxGeometry(Ls - start + 0.1, r * 0.95, r * 0.52, r * 0.8)
          : s === 0 ? metacarpalGeometry(Ls - start + hl, r * 1.02, r * 0.68, rh, hl) : phalanxGeometry(Ls - start + hl, r * 1.02, r * 0.68, rh);
        const b = this.addBone(joints[s], g, {
          name: `Thumb ${names[s]}`, desc: s === 0 ? 'Sits on the trapezium at the thumb base (CMC joint) — a common arthritis site.' : 'Thumb bone.', tag: s === 0 ? 'thumb-metacarpal' : 'phalanx', finger: 'thumb',
        });
        b.position.y = start;
        const c = this.addBone(joints[s], new THREE.SphereGeometry(1, 20, 10), {
          name: `Thumb ${['CMC (base)', 'MCP', 'IP'][s]} joint cartilage`, desc: s === 0 ? 'Cartilage of the thumb basal joint — thins in basal thumb arthritis.' : 'Joint cartilage.', tag: s === 0 ? 'cmc-cartilage' : 'cartilage', finger: 'thumb',
        }, 'cartilage');
        c.scale.set(r * 1.05, 0.07, r * 0.9);
        c.position.y = start - 0.02;
        prevHl = hl;
      }
    }

    // Carpal bones (shaped in wrist-frame coordinates)
    for (const c of carpalGeometries()) this.addBone(this.wrist, c.geo, { name: c.name, desc: c.desc, tag: c.tag });

    // Radius & ulna (forearm frame)
    this.addBone(this.fore, radiusGeometry(), {
      name: 'Radius', desc: 'Forearm bone on the thumb side. Its end (distal radius) is the most commonly broken bone in falls; the radial styloid and Lister\'s tubercle are its bumps at the wrist.', tag: 'radius',
    });
    this.addBone(this.fore, ulnaGeometry(), {
      name: 'Ulna', desc: 'Forearm bone on the little-finger side, ending in the ulnar head and styloid.', tag: 'ulna',
    });
  }

  // ---------- pose ----------
  // Applies a pose and returns true if any joint moved by more than a hair,
  // so callers can skip rebuilding tendons when the hand is still.
  applyPose(p) {
    const eps = 1e-4;
    let changed = false;
    const setRot = (o, x, y, z) => {
      if (Math.abs(o.rotation.x - x) > eps || Math.abs(o.rotation.y - y) > eps || Math.abs(o.rotation.z - z) > eps) { o.rotation.set(x, y, z); changed = true; }
    };
    setRot(this.wrist, p.wrist.flex, 0, -p.wrist.dev);
    for (let i = 0; i < 4; i++) {
      const f = this.fingers[i], q = p.fingers[i];
      setRot(f.j1, q.mcp, 0, -q.abd);
      setRot(f.j2, q.pip, 0, 0);
      setRot(f.j3, q.dip, 0, 0);
    }
    if (Math.abs(this.thumb.j1.quaternion.dot(p.thumb.cmc)) < 1 - eps) { this.thumb.j1.quaternion.copy(p.thumb.cmc); changed = true; }
    setRot(this.thumb.j2, p.thumb.mcp, 0, 0);
    setRot(this.thumb.j3, p.thumb.ip, 0, 0);
    if (this._lastMirror !== undefined && this._lastMirror !== this.pivot.scale.x) changed = true;
    this._lastMirror = this.pivot.scale.x;
    if (!this._posed) { this._posed = true; changed = true; }
    return changed;
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
