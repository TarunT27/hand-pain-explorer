// Pose presets and animated exercises. Thumb placements are solved with a small
// inverse-kinematics search so the thumb really meets the fingertips.
import * as THREE from 'three';
import { makePose, clonePose } from './rig.js';

const RELAXED_F = [[0.22, 0.07, 0.3, 0.18], [0.26, 0.0, 0.36, 0.2], [0.3, -0.06, 0.4, 0.22], [0.34, -0.13, 0.42, 0.22]];

// Coordinate-descent IK: move the thumb so its pad reaches a point given in
// another frame (frameKey + local point). Mutates and returns pose.
export function solveThumb(rig, pose, frameKey, local, { gap = 0.15, prefer = [0.3, 0.2, 0.0, 0.3, 0.3], finger = -1 } = {}) {
  const pads = new THREE.Vector3();
  const target = new THREE.Vector3();
  const e = new THREE.Euler();
  // optional 6th parameter: how much the target finger curls toward the thumb
  const base = finger >= 0 ? { ...pose.fingers[finger] } : null;
  const pref = finger >= 0 ? [...prefer, 1] : [...prefer];
  const params = [...pref];
  const N = params.length;
  const lim = [[-0.6, 1.4], [-0.4, 1.0], [-0.9, 0.7], [-0.25, 1.1], [-0.3, 1.45], [0.6, 1.9]];
  const tip = new THREE.Vector3(0, 1.3, 0.72);
  // work in root space so the current pivot orientation doesn't matter
  const rootInv = new THREE.Matrix4();
  const evalP = (p) => {
    pose.thumb.cmc.setFromEuler(e.set(p[0], p[1], p[2]));
    pose.thumb.mcp = p[3];
    pose.thumb.ip = p[4];
    if (base) {
      const f = pose.fingers[finger];
      f.mcp = base.mcp * p[5]; f.pip = Math.min(1.9, base.pip * p[5]); f.dip = Math.min(1.4, base.dip * p[5]);
    }
    rig.applyPose(pose);
    rig.root.updateMatrixWorld(true);
    rootInv.copy(rig.root.matrixWorld).invert();
    target.copy(local).applyMatrix4(rig.frames[frameKey].matrixWorld).applyMatrix4(rootInv);
    pads.copy(tip).applyMatrix4(rig.thumb.j3.matrixWorld).applyMatrix4(rootInv);
    const d = pads.distanceTo(target) - gap;
    let reg = 0;
    for (let i = 0; i < N; i++) reg += (p[i] - pref[i]) ** 2;
    return d * d + 0.015 * reg;
  };
  let best = evalP(params);
  let step = 0.25;
  for (let it = 0; it < 140 && step > 0.003; it++) {
    let improved = false;
    for (let i = 0; i < N; i++) {
      for (const s of [1, -1]) {
        const trial = [...params];
        trial[i] = THREE.MathUtils.clamp(trial[i] + s * step, lim[i][0], lim[i][1]);
        const v = evalP(trial);
        if (v < best) { best = v; params.splice(0, N, ...trial); improved = true; }
      }
    }
    if (!improved) step *= 0.5;
  }
  evalP(params);
  return pose;
}

export function buildPoses(rig) {
  const P = {};
  P.relaxed = makePose({ f: RELAXED_F, thumb: { cmc: [0.12, 0.05, 0.12], mcp: 0.15, ip: 0.18 } });
  P.open = makePose({ f: [[0, 0.2, 0, 0], [0, 0.04, 0, 0], [0, -0.13, 0, 0], [0, -0.32, 0, 0]], thumb: { cmc: [-0.15, 0, -0.35], mcp: 0, ip: 0.05 } });
  P.together = makePose({ f: [[0, 0.0, 0, 0], [0, 0.0, 0, 0], [0, 0.0, 0, 0], [0, -0.03, 0, 0]], thumb: { cmc: [0.05, 0, 0.25], mcp: 0.05, ip: 0.05 } });
  P.spread = makePose({ f: [[0.05, 0.32, 0, 0], [0.05, 0.06, 0, 0], [0.05, -0.24, 0, 0], [0.05, -0.5, 0, 0]], thumb: { cmc: [-0.3, 0, -0.55], mcp: 0, ip: 0 } });
  P.hook = makePose({ f: [[0.05, 0.03, 1.65, 1.2], [0.05, 0, 1.7, 1.2], [0.05, -0.03, 1.7, 1.2], [0.05, -0.06, 1.65, 1.15]], thumb: { cmc: [0.1, 0, 0.1], mcp: 0.1, ip: 0.1 } });
  P.tabletop = makePose({ f: [[1.45, 0.03, 0.05, 0.02], [1.5, 0, 0.05, 0.02], [1.5, -0.03, 0.05, 0.02], [1.45, -0.06, 0.05, 0.02]], thumb: { cmc: [0.05, 0, 0.1], mcp: 0.05, ip: 0.05 } });
  P.straightFist = makePose({ f: [[1.45, 0.03, 1.55, 0.12], [1.5, 0, 1.6, 0.12], [1.5, -0.03, 1.6, 0.12], [1.45, -0.06, 1.55, 0.12]], thumb: { cmc: [0.2, 0.1, 0.1], mcp: 0.2, ip: 0.1 } });
  P.fist = makePose({ f: [[1.4, 0.03, 1.75, 1.1], [1.45, 0, 1.8, 1.1], [1.5, -0.03, 1.8, 1.05], [1.5, -0.06, 1.75, 1.0]] });
  solveThumb(rig, P.fist, 'I2', new THREE.Vector3(-0.55, 1.2, -0.95), { gap: 0.2, prefer: [0.7, 0.4, 0.1, 0.5, 0.35] });
  P.point = makePose({ f: [[0.05, 0.05, 0.05, 0.02], [1.45, 0, 1.8, 1.1], [1.5, -0.03, 1.8, 1.05], [1.5, -0.06, 1.75, 1.0]] });
  solveThumb(rig, P.point, 'M2', new THREE.Vector3(0.1, 1.1, -0.95), { gap: 0.2, prefer: [0.7, 0.4, 0.1, 0.5, 0.35] });
  P.pinch = makePose({ f: [[0.6, 0.05, 0.85, 0.45], [0.2, 0.0, 0.2, 0.1], [0.25, -0.1, 0.25, 0.12], [0.3, -0.2, 0.3, 0.14]] });
  solveThumb(rig, P.pinch, 'I3', new THREE.Vector3(0, 1.15, 0.75), { gap: 0.1, finger: 0, prefer: [0.55, 0.35, 0.1, 0.3, 0.3] });
  P.thumbOut = makePose({ f: [[0, 0.1, 0, 0], [0, 0.02, 0, 0], [0, -0.08, 0, 0], [0, -0.2, 0, 0]], thumb: { cmc: [-0.45, 0, -0.75], mcp: -0.1, ip: -0.1 } });
  P.fistThumbOut = makePose({ f: [[1.4, 0.03, 1.75, 1.1], [1.45, 0, 1.8, 1.1], [1.5, -0.03, 1.8, 1.05], [1.5, -0.06, 1.75, 1.0]], thumb: { cmc: [0.0, 0, 0.3], mcp: 0.1, ip: 0.1 } });

  // opposition targets
  const opp = [
    ['I3', [0.6, 0.05, 0.5, 0.3]],
    ['M3', [0.7, 0.0, 0.6, 0.3]],
    ['R3', [0.85, -0.02, 0.7, 0.35]],
    ['P3', [1.0, 0.05, 0.75, 0.35]],
  ];
  P.opp = opp.map(([frame, fl], i) => {
    const f = P.open.fingers.map((q) => [q.mcp, q.abd, q.pip, q.dip]);
    f[i] = fl;
    const pose = makePose({ f });
    const L = rig.fingers[i].def.len[2];
    return solveThumb(rig, pose, frame, new THREE.Vector3(0, L * 0.62, 0.72), { gap: 0.12, prefer: [0.6, 0.35, 0.1, 0.3, 0.35], finger: i });
  });
  rig.applyPose(P.relaxed);
  rig.pivot.updateMatrixWorld(true);
  return P;
}

export const PRESETS = [
  ['relaxed', 'Relaxed'], ['open', 'Open'], ['fist', 'Fist'], ['point', 'Point'], ['pinch', 'Pinch'], ['hook', 'Hook'],
];

// Exercise timelines: list of { pose, caption, hold } (seconds)
export function buildExercises(P) {
  const withWrist = (pose, flex, dev = 0) => { const p = clonePose(pose); p.wrist.flex = flex; p.wrist.dev = dev; return p; };
  const E = {};
  E.tendonGlides = [
    { pose: P.together, caption: 'Straight hand — fingers long and together', hold: 1.2 },
    { pose: P.hook, caption: 'Hook fist — bend the middle and end knuckles, big knuckles straight', hold: 1.2 },
    { pose: P.fist, caption: 'Full fist — fold everything down, thumb across', hold: 1.2 },
    { pose: P.tabletop, caption: 'Tabletop — bend only at the big knuckles, fingers straight', hold: 1.2 },
    { pose: P.straightFist, caption: 'Straight fist — fingertips to the base of the palm', hold: 1.2 },
    { pose: P.together, caption: 'Back to straight. Repeat 10 times, hold each 3 seconds', hold: 1.0 },
  ];
  E.thumbOpposition = [
    { pose: P.open, caption: 'Start with the hand open', hold: 0.6 },
    ...P.opp.flatMap((pose, i) => [
      { pose, caption: `Touch thumb to ${['index', 'middle', 'ring', 'little'][i]} fingertip — make a round "O"`, hold: 0.9 },
      { pose: P.open, caption: 'Open wide', hold: 0.4 },
    ]),
  ];
  E.fingerSpreads = [
    { pose: P.together, caption: 'Fingers together', hold: 0.8 },
    { pose: P.spread, caption: 'Spread as wide as is comfortable', hold: 1.0 },
    { pose: P.together, caption: 'Bring them back together', hold: 0.8 },
    { pose: P.spread, caption: 'Spread again — 10 times', hold: 1.0 },
    { pose: P.together, caption: 'Relax', hold: 0.6 },
  ];
  E.wristFlexExtend = [
    { pose: P.relaxed, caption: 'Wrist neutral, fingers relaxed', hold: 0.8 },
    { pose: withWrist(P.relaxed, 1.0), caption: 'Bend the wrist down gently — hold 5 s', hold: 1.3 },
    { pose: P.relaxed, caption: 'Back to neutral', hold: 0.6 },
    { pose: withWrist(P.open, -0.95), caption: 'Lift the wrist back gently — hold 5 s', hold: 1.3 },
    { pose: P.relaxed, caption: 'Neutral. Repeat 10 times, no forcing', hold: 0.8 },
  ];
  E.medianNerveGlide = [
    { pose: P.fistThumbOut, caption: '1 · Fist, wrist straight, thumb outside', hold: 1.1 },
    { pose: P.together, caption: '2 · Straighten fingers and thumb, wrist straight', hold: 1.1 },
    { pose: withWrist(P.together, -0.9), caption: '3 · Bend wrist back, fingers straight', hold: 1.1 },
    { pose: withWrist(P.thumbOut, -0.9), caption: '4 · Keep wrist back and move the thumb out to the side', hold: 1.3 },
    { pose: P.relaxed, caption: 'Relax. Only go as far as is comfortable — stop before tingling', hold: 0.9 },
  ];
  const circ = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circ.push({ pose: makePose({ f: RELAXED_F.map((q) => [q[0] * 0.5, q[1], q[2] * 0.5, q[3] * 0.5]), thumb: { cmc: [0.25 + 0.42 * Math.cos(a), 0.1 + 0.15 * Math.sin(a), -0.2 + 0.4 * Math.sin(a)], mcp: 0.1, ip: 0.1 } }), caption: 'Slow, smooth circles with the thumb', hold: 0.05 });
  }
  E.thumbCircles = circ;
  E.thumbCircles.loops = 3;
  E.thumbCircles.tr = 0.32;

  // ---- self-check demonstrations (play once)
  const tuck = { cmc: [0.95, 0.35, 0.35], mcp: 0.9, ip: 1.0 };
  const fingersOf = (pose) => pose.fingers.map((q) => [q.mcp, q.abd, q.pip, q.dip]);
  const thumbTuck = makePose({ f: fingersOf(P.relaxed), thumb: tuck });
  const fistOverThumb = makePose({ f: fingersOf(P.fist), thumb: tuck });
  const crossed = makePose({ f: [[0.32, -0.3, 0.05, 0], [-0.18, 0.4, 0.05, 0], [0.1, -0.08, 0.1, 0.05], [0.15, -0.2, 0.12, 0.05]], thumb: { cmc: [0.05, 0, 0.2], mcp: 0.05, ip: 0.05 } });
  const once = (frames, tr = 0.7) => { frames.loops = 1; frames.tr = tr; return frames; };
  E.finkelstein = once([
    { pose: P.relaxed, caption: 'Start relaxed', hold: 0.3 },
    { pose: thumbTuck, caption: 'Tuck the thumb into the palm', hold: 0.5 },
    { pose: fistOverThumb, caption: 'Close the fingers over the thumb', hold: 0.5 },
    { pose: withWrist(fistOverThumb, 0.05, -0.55), caption: 'Gently tilt the wrist toward the little finger — pain on the thumb side?', hold: 2.4 },
    { pose: P.relaxed, caption: 'Relax', hold: 0.4 },
  ]);
  E.phalen = once([
    { pose: P.relaxed, caption: 'Start with the wrist straight', hold: 0.4 },
    { pose: withWrist(P.relaxed, 1.3), caption: 'Let the wrist hang fully bent — hold up to 60 s. Tingling in thumb, index or middle?', hold: 60 },
    { pose: P.relaxed, caption: 'Relax', hold: 0.4 },
  ], 0.9);
  E.tinel = once([
    { pose: withWrist(P.open, -0.25), caption: 'Tap firmly over the middle of the wrist crease, 4–6 times', hold: 3.2 },
    { pose: P.relaxed, caption: 'Any electric tingle into the fingers?', hold: 1.0 },
  ]);
  E.grind = Object.assign(circ.map((k) => ({ ...k, caption: 'Push the thumb gently toward its base and circle it — deep ache or grinding?', hold: 0.12 })), { loops: 2, tr: 0.4 });
  E.tabletop = once([
    { pose: P.relaxed, caption: 'Hand palm-down on a table', hold: 0.3 },
    { pose: P.together, caption: 'Try to lay the palm and every finger completely flat', hold: 2.6 },
    { pose: P.relaxed, caption: 'Can\'t get flat? That\'s a positive test.', hold: 0.8 },
  ]);
  E.fistOpen = once([
    ...[0, 1, 2, 3].flatMap(() => [
      { pose: P.fist, caption: 'Make a firm fist…', hold: 0.25 },
      { pose: P.open, caption: '…then open quickly. Does a finger catch or click?', hold: 0.25 },
    ]),
    { pose: P.relaxed, caption: 'Relax', hold: 0.4 },
  ], 0.35);
  E.cross = once([
    { pose: P.together, caption: 'Fingers straight', hold: 0.4 },
    { pose: crossed, caption: 'Cross the middle finger over the index', hold: 0.9 },
    { pose: P.together, caption: 'Uncross', hold: 0.3 },
    { pose: crossed, caption: 'Cross again — clumsy or weak compared with the other hand?', hold: 0.9 },
    { pose: P.relaxed, caption: 'Relax', hold: 0.4 },
  ], 0.45);
  E.pressUp = once([
    { pose: P.relaxed, caption: 'Hands flat on the chair armrests', hold: 0.3 },
    { pose: withWrist(P.open, -1.15, -0.25), caption: 'Push yourself up — pain on the little-finger side of the wrist?', hold: 2.4 },
    { pose: P.relaxed, caption: 'Relax', hold: 0.4 },
  ]);
  E.snuffbox = once([
    { pose: P.relaxed, caption: 'Start relaxed', hold: 0.3 },
    { pose: P.thumbOut, caption: 'Lift the thumb up and out — press into the hollow at its base', hold: 2.6 },
    { pose: P.relaxed, caption: 'Sharp pinpoint pain after a fall? Get an X-ray.', hold: 1.0 },
  ]);
  return E;
}
