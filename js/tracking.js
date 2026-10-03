// Webcam hand tracking (MediaPipe Hand Landmarker), gesture reading and
// retargeting of the user's hand onto the 3D rig.
import * as THREE from 'three';
import { makePose } from './rig.js';

const MP_VER = '0.10.21';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export class Tracker {
  constructor() {
    this.landmarker = null;
    this.stream = null;
    this.video = null;
    this.lastVideoTime = -1;
    this.running = false;
  }

  // Load the model first and ask for the camera last, so a failed download
  // never leaves the camera light on. Later starts reuse the loaded model.
  async start(video, onStatus = () => {}) {
    this.video = video;
    if (!this.landmarker) {
      onStatus('Loading hand-tracking model…');
      const { FilesetResolver, HandLandmarker } = await import(`${MP_URL}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU'));
      } catch (err) {
        console.warn('GPU delegate failed, using CPU', err);
        this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU'));
      }
    }
    onStatus('Requesting camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false });
      video.srcObject = this.stream;
      await video.play();
    } catch (err) {
      this.stop();
      throw err;
    }
    this.running = true;
    onStatus('Tracking');
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  // Returns a fresh result when the video has a new frame, otherwise null.
  detect() {
    const v = this.video;
    if (!this.running || !this.landmarker || !v || v.readyState < 2) return null;
    if (v.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = v.currentTime;
    const res = this.landmarker.detectForVideo(v, performance.now());
    const hands = [];
    const handed = res.handedness || res.handednesses || [];
    for (let i = 0; i < res.landmarks.length; i++) {
      const cat = handed[i] && handed[i][0];
      hands.push({
        lm: res.landmarks[i],
        world: res.worldLandmarks[i],
        label: cat ? cat.categoryName : 'Right',
        score: cat ? cat.score : 0.5,
      });
    }
    return { hands, aspect: v.videoWidth / Math.max(1, v.videoHeight) };
  }
}

// ---------- gesture helpers ----------
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function extension(w, a, b, c, d) {
  const path = d3(w[a], w[b]) + d3(w[b], w[c]) + d3(w[c], w[d]);
  return d3(w[a], w[d]) / Math.max(1e-6, path);
}
// Reads gestures from a (smoothed) hand. `st` is per-hand state kept across
// frames so pointing and pinching use hysteresis instead of flickering.
export function describeHand(h, swap, st = {}) {
  const w = h.world;
  // MediaPipe labels assume a mirrored (selfie) image; our frames are not mirrored.
  let isRight = h.label === 'Left';
  if (swap) isRight = !isRight;
  const ext = [extension(w, 5, 6, 7, 8), extension(w, 9, 10, 11, 12), extension(w, 13, 14, 15, 16), extension(w, 17, 18, 19, 20)];
  const palmW = Math.max(0.03, d3(w[5], w[17]));
  const pinchD = d3(w[4], w[8]);
  const pinchR = pinchD / palmW;
  const others = Math.max(ext[1], ext[2], ext[3] - 0.04);
  st.pointing = st.pointing
    ? ext[0] > 0.8 && others < 0.88
    : ext[0] > 0.88 && others < 0.8;
  st.pinching = st.pinching ? pinchR < 0.62 : pinchR < 0.38;
  const cx = h.lm.reduce((s, p) => s + p.x, 0) / 21, cy = h.lm.reduce((s, p) => s + p.y, 0) / 21;
  return { ...h, isRight, ext, pinchD, pinchR, pointing: st.pointing, pinching: st.pinching, center: { x: cx, y: cy }, chirality: chiralityEvidence(w) };
}

// ---------- smoothing & identity ----------
// One Euro filter: heavy smoothing when still, light smoothing when moving fast.
class OneEuro {
  constructor(minCutoff, beta, dCutoff = 1.0) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff; this.x = null; this.dx = 0; this.t = 0; }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1 / 240, t - this.t);
    this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

export const SMOOTHING = { worldCutoff: 1.0, worldBeta: 0.06, imageCutoff: 1.6, imageBeta: 0.035 };

// Keeps a stable identity for each hand across frames (MediaPipe may reorder
// hands or flicker their labels), smooths landmarks and votes on handedness.
export class HandTracks {
  constructor() { this.tracks = []; this.nextId = 1; }
  update(raw, t) {
    const centers = raw.map((h) => ({ x: h.lm.reduce((s, p) => s + p.x, 0) / 21, y: h.lm.reduce((s, p) => s + p.y, 0) / 21 }));
    // greedy nearest matching
    const pairs = [];
    raw.forEach((h, i) => this.tracks.forEach((tr) => pairs.push({ i, tr, d: Math.hypot(centers[i].x - tr.center.x, centers[i].y - tr.center.y) })));
    pairs.sort((a, b) => a.d - b.d);
    const usedI = new Set(), usedT = new Set(), match = new Map();
    for (const p of pairs) {
      if (p.d > 0.25 || usedI.has(p.i) || usedT.has(p.tr)) continue;
      usedI.add(p.i); usedT.add(p.tr); match.set(p.i, p.tr);
    }
    const out = raw.map((h, i) => {
      let tr = match.get(i);
      if (!tr) {
        const S = SMOOTHING;
        tr = {
          id: this.nextId++, votes: [], state: {},
          fw: Array.from({ length: 63 }, () => new OneEuro(S.worldCutoff, S.worldBeta)),
          fi: Array.from({ length: 42 }, () => new OneEuro(S.imageCutoff, S.imageBeta)),
        };
        this.tracks.push(tr);
      }
      tr.center = centers[i];
      tr.lastSeen = t;
      tr.votes.push(h.label === 'Left' ? h.score : -h.score);
      if (tr.votes.length > 24) tr.votes.shift();
      const world = h.world.map((p, k) => ({
        x: tr.fw[k * 3].filter(p.x * 100, t) / 100,
        y: tr.fw[k * 3 + 1].filter(p.y * 100, t) / 100,
        z: tr.fw[k * 3 + 2].filter(p.z * 100, t) / 100,
      }));
      const lm = h.lm.map((p, k) => ({ x: tr.fi[k * 2].filter(p.x * 100, t) / 100, y: tr.fi[k * 2 + 1].filter(p.y * 100, t) / 100, z: p.z }));
      const vote = tr.votes.reduce((a, b) => a + b, 0);
      const smoothed = { lm, world, rawLm: h.lm, label: vote >= 0 ? 'Left' : 'Right', score: h.score, trackId: tr.id, track: tr };
      tr.last = smoothed;
      return smoothed;
    });
    this.tracks = this.tracks.filter((tr) => t - tr.lastSeen < 1.0);
    return out;
  }
  // A hand that was seen recently but is missing right now (e.g. hidden behind the other hand)
  recent(excludeIds, maxAge, t) {
    return this.tracks.find((tr) => !excludeIds.includes(tr.id) && t - tr.lastSeen < maxAge && tr.last);
  }
  reset() { this.tracks = []; }
}

// Fingers always curl toward the palm. Using the right-hand palm normal, curled
// fingertips give a positive score for a right hand and negative for a left one.
function chiralityEvidence(world) {
  const P = toThree(world, false);
  const n = new THREE.Vector3().crossVectors(P[5].clone().sub(P[17]), P[9].clone().sub(P[0])).normalize();
  let e = 0;
  for (const [m, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) e += P[t].clone().sub(P[m]).dot(n);
  e += P[4].clone().sub(P[2]).dot(n) * 0.5;
  return e;
}

// Convert MediaPipe world landmarks (m, camera frame) into first-person
// Three.js coordinates (cm): X = user's right, Y = up, Z = toward the user.
// Left hands are mirrored so they can drive the right-hand base model.
function toThree(world, mirror) {
  return world.map((l) => new THREE.Vector3((mirror ? 1 : -1) * l.x * 100, -l.y * 100, l.z * 100));
}
function palmBasis(P) {
  const y = P[9].clone().sub(P[0]).normalize();
  const r = P[5].clone().sub(P[17]);
  const z = new THREE.Vector3().crossVectors(r, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
export function modelRestQuat(localLm) {
  return palmBasis(localLm);
}
export function palmFacesCamera(h) {
  const P = toThree(h.world, !h.isRight);
  const n = new THREE.Vector3().crossVectors(P[5].clone().sub(P[17]), P[9].clone().sub(P[0]));
  return n.z < 0;
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;

// Retarget one tracked hand. Returns { pose, quat (pivot orientation), mirror }.
export function retarget(h, restQ, thumbBaseQ) {
  const mirror = !h.isRight;
  const P = toThree(h.world, mirror);
  const userQ = palmBasis(P);
  const rootQ = userQ.clone().multiply(restQ.clone().invert());
  const inv = rootQ.clone().invert();
  const dir = (i, j) => P[j].clone().sub(P[i]).normalize().applyQuaternion(inv);

  const chains = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  const fingers = chains.map(([a, b, c, d]) => {
    const d1 = dir(a, b);
    const flex = Math.atan2(d1.z, d1.y);
    const abd = Math.atan2(d1.x, Math.hypot(d1.y, d1.z));
    const R1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(flex, 0, -abd));
    const y1 = Y.clone().applyQuaternion(R1), z1 = Z.clone().applyQuaternion(R1);
    const d2 = dir(b, c);
    const pip = Math.atan2(d2.dot(z1), d2.dot(y1));
    const R2 = R1.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, pip));
    const y2 = Y.clone().applyQuaternion(R2), z2 = Z.clone().applyQuaternion(R2);
    const d3v = dir(c, d);
    const dip = Math.atan2(d3v.dot(z2), d3v.dot(y2));
    return [clamp(flex, -0.45, 1.75), clamp(abd, -0.55, 0.55), clamp(pip, -0.1, 1.95), clamp(dip, -0.25, 1.5)];
  });

  // Thumb: swing the metacarpal to its direction, add twist from the bend plane.
  const invB = thumbBaseQ.clone().invert();
  const dm = dir(1, 2), dp = dir(2, 3), dd = dir(3, 4);
  const tLocal = dm.clone().applyQuaternion(invB);
  const swing = new THREE.Quaternion().setFromUnitVectors(Y, tLocal);
  let cmc = swing.clone();
  const n = new THREE.Vector3().crossVectors(dm, dp).add(new THREE.Vector3().crossVectors(dp, dd));
  const nl = n.length();
  if (nl > 0.12) {
    const swingX = X.clone().applyQuaternion(thumbBaseQ.clone().multiply(swing));
    const xt = n.clone().addScaledVector(dm, -n.dot(dm)).normalize();
    if (xt.dot(swingX) < 0) xt.negate();
    const zt = new THREE.Vector3().crossVectors(xt, dm).normalize();
    const full = invB.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xt, dm, zt)));
    if (full.angleTo(swing) < 1.1) cmc.slerp(full, THREE.MathUtils.smoothstep(nl, 0.12, 0.45));
  }
  const B1 = thumbBaseQ.clone().multiply(cmc);
  const ty = Y.clone().applyQuaternion(B1), tz = Z.clone().applyQuaternion(B1);
  const mcp = Math.atan2(dp.dot(tz), dp.dot(ty));
  const B2 = B1.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, mcp));
  const ty2 = Y.clone().applyQuaternion(B2), tz2 = Z.clone().applyQuaternion(B2);
  const ip = Math.atan2(dd.dot(tz2), dd.dot(ty2));

  const pose = makePose({ f: fingers, thumb: { cmcQ: cmc, mcp: clamp(mcp, -0.35, 1.2), ip: clamp(ip, -0.45, 1.5) } });
  const quat = mirror ? new THREE.Quaternion(rootQ.x, -rootQ.y, -rootQ.z, rootQ.w) : rootQ;
  return { pose, quat, mirror };
}

// ---------- pointing: where on the target hand is the fingertip? ----------
const SEGS = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17], [21, 0]];

export function mapPointOnHand(target, tip, aspect) {
  const P = target.lm.map((l) => ({ x: l.x * aspect, y: l.y }));
  P[21] = { x: P[0].x - (P[9].x - P[0].x) * 0.45, y: P[0].y - (P[9].y - P[0].y) * 0.45 };
  const q = { x: tip.x * aspect, y: tip.y };
  const scale = Math.hypot(P[9].x - P[0].x, P[9].y - P[0].y);
  let best = null;
  for (const [a, b] of SEGS) {
    const A = P[a], Bp = P[b];
    const ux = Bp.x - A.x, uy = Bp.y - A.y;
    const len2 = ux * ux + uy * uy || 1e-9;
    const t = clamp(((q.x - A.x) * ux + (q.y - A.y) * uy) / len2, 0, 1);
    const px = A.x + ux * t, py = A.y + uy * t;
    const dist = Math.hypot(q.x - px, q.y - py);
    if (!best || dist < best.dist) {
      const len = Math.sqrt(len2);
      const nx = -uy / len, ny = ux / len;
      const sPerp = (q.x - px) * nx + (q.y - py) * ny;
      const rx = P[5].x - P[17].x, ry = P[5].y - P[17].y;
      const sign = Math.sign(rx * nx + ry * ny) || 1;
      best = { a, b, t, dist, lateral: sPerp * sign };
    }
  }
  if (!best || best.dist > scale * 0.42) return null;
  const width = Math.hypot(P[5].x - P[17].x, P[5].y - P[17].y) || scale * 0.55;
  best.lateralCm = (best.lateral / width) * 5.3;
  best.near = best.dist / scale;
  return best;
}

// ---------- overlay drawing (mirrored preview) ----------
export function drawOverlay(ctx, w, h, hands, info = {}) {
  ctx.clearRect(0, 0, w, h);
  const X2 = (p) => (1 - p.x) * w, Y2 = (p) => p.y * h;
  hands.forEach((hand) => {
    const role = hand === info.pointer ? 'pointer' : hand === info.target ? 'target' : 'main';
    const col = role === 'pointer' ? '#7fd3ff' : role === 'target' ? '#ffb3a1' : '#e8f1ff';
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo(X2(hand.lm[a]), Y2(hand.lm[a]));
      ctx.lineTo(X2(hand.lm[b]), Y2(hand.lm[b]));
    }
    ctx.stroke();
    ctx.fillStyle = col;
    for (const p of hand.lm) {
      ctx.beginPath();
      ctx.arc(X2(p), Y2(p), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  if (info.pointer) {
    const p = info.pointer.lm[8];
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(X2(p), Y2(p), 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = info.onHand ? '#ff5a4a' : '#7fd3ff';
    ctx.beginPath();
    ctx.arc(X2(p), Y2(p), 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (info.onHand ? (info.dwell || 0) : 1));
    ctx.stroke();
  }
  if (info.staleTarget) {
    ctx.fillStyle = 'rgba(255,179,161,.9)';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText('holding last position of hidden hand', 14, 30);
  }
  if (info.pinchPts) {
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo((1 - info.pinchPts[0].x) * w, info.pinchPts[0].y * h);
    ctx.lineTo((1 - info.pinchPts[1].x) * w, info.pinchPts[1].y * h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
