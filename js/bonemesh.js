// Anatomical bone shapes. Each bone is described as a signed-distance function
// (spheres, ellipsoids and tapered capsules blended with smooth min/max) and
// turned into a mesh once at load time with naive surface nets.
import * as THREE from 'three';

// ---------------------------------------------------------------- SDF primitives
const hypot = Math.hypot;
export function sphere(x, y, z, cx, cy, cz, r) { return hypot(x - cx, y - cy, z - cz) - r; }
export function ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = hypot(px, py, pz);
  const k1 = hypot(px / rx, py / ry, pz / rz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
export function roundCone(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
}
export function roundBox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
// smooth subtraction of b from a
export function ssub(a, b, k) {
  const h = Math.max(k - Math.abs(-b - a), 0) / k;
  return Math.max(a, -b) + h * h * k * 0.25;
}

// ---------------------------------------------------------------- mesher
// Naive surface nets over the box [min, max] with cell size h.
export function surfaceNets(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 2, ny = Math.ceil((max[1] - min[1]) / h) + 2, nz = Math.ceil((max[2] - min[2]) / h) + 2;
  const x0 = min[0] - h * 0.5, y0 = min[1] - h * 0.5, z0 = min[2] - h * 0.5;
  const vals = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    vals[i + nx * (j + ny * k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);
  }
  const V = (i, j, k) => vals[i + nx * (j + ny * k)];
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellIdx = new Int32Array(cx * cy * cz).fill(-1);
  const C = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { cv[c] = V(i + corner[c][0], j + corner[c][1], k + corner[c][2]); if (cv[c] < 0) inside++; }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += corner[a][0] + t * (corner[b][0] - corner[a][0]);
      sy += corner[a][1] + t * (corner[b][1] - corner[a][1]);
      sz += corner[a][2] + t * (corner[b][2] - corner[a][2]);
      n++;
    }
    cellIdx[C(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  const idx = [];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const others = [[[0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0]]];
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    const a = cellIdx[C(i, j, k)];
    if (a < 0) continue;
    const v0 = V(i, j, k);
    for (let ax = 0; ax < 3; ax++) {
      const d = axes[ax];
      const v1 = V(i + d[0], j + d[1], k + d[2]);
      if ((v0 < 0) === (v1 < 0)) continue;
      const [u, w] = others[ax];
      const iu = i - u[0], ju = j - u[1], ku = k - u[2];
      const iw = i - w[0], jw = j - w[1], kw = k - w[2];
      if (iu < 0 || ju < 0 || ku < 0 || iw < 0 || jw < 0 || kw < 0) continue;
      const b = cellIdx[C(iu, ju, ku)], c = cellIdx[C(iu - w[0], ju - w[1], ku - w[2])], e = cellIdx[C(iw, jw, kw)];
      if (b < 0 || c < 0 || e < 0) continue;
      // winding so faces point out of the solid (axis 1's neighbour order is mirrored)
      const flip = (v0 < 0) !== (ax === 1);
      if (flip) idx.push(a, b, c, a, c, e); else idx.push(a, e, c, a, c, b);
    }
  }
  const nor = new Float32Array(pos.length);
  const eps = h * 0.5;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2];
    const gx = f(x + eps, y, z) - f(x - eps, y, z), gy = f(x, y + eps, z) - f(x, y - eps, z), gz = f(x, y, z + eps) - f(x, y, z - eps);
    const l = hypot(gx, gy, gz) || 1;
    nor[p] = gx / l; nor[p + 1] = gy / l; nor[p + 2] = gz / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Low-amplitude surface texture so bones don't look machined.
function rough(x, y, z, amp) {
  return amp * (Math.sin(x * 7.1 + y * 3.3) * Math.sin(y * 5.7 - z * 4.1) * Math.sin(z * 6.3 + x * 2.9));
}

// ---------------------------------------------------------------- long bones (local frame: Y along bone 0..L, X radial, Z palmar)
// Phalanx: flared base with a shallow cup, oval shaft flattened on the palm side, two-knobbed (bicondylar) head.
export function phalanxGeometry(L, rb, rs, rh, h = 0.058) {
  const hc = L - rh * 0.72;
  const f = (x, y, z) => {
    const bow = 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, y / L)));
    const X = x / 1.2, Z = (z + bow) / 0.82;
    let d = roundCone(X, y, Z, 0, rb * 0.55, 0, 0, hc, 0, rs * 1.12, rs * 0.92) * 0.82;
    d = smin(d, ellipsoid(x, y, z, 0, rb * 0.5, 0.03, rb * 1.12, rb * 0.62, rb * 0.92), 0.22);
    d = ssub(d, sphere(x, y, z, 0, -rb * 0.62, 0.02, rb * 0.82), 0.1);
    const cond = smin(
      ellipsoid(x, y, z, rh * 0.43, hc, 0.06 * rh, rh * 0.55, rh * 0.74, rh * 0.8),
      ellipsoid(x, y, z, -rh * 0.43, hc, 0.06 * rh, rh * 0.55, rh * 0.74, rh * 0.8), 0.1);
    d = smin(d, cond, 0.18);
    return d + rough(x, y, z, 0.006);
  };
  return surfaceNets(f, [-rb * 1.3, -0.1, -rb * 1.1], [rb * 1.3, L + 0.05, rb * 1.1], h);
}

// Distal phalanx: broad base, slim waist, spade-shaped tuft that is flat and slightly hooked to the palm side.
export function distalPhalanxGeometry(L, rb, rs, rt, h = 0.048) {
  const f = (x, y, z) => {
    const X = x / 1.15, Z = z / 0.78;
    let d = roundCone(X, y, Z, 0, rb * 0.5, 0, 0, L * 0.72, 0.02, rs * 1.05, rs * 0.85) * 0.78;
    d = smin(d, ellipsoid(x, y, z, 0, rb * 0.48, 0.02, rb * 1.1, rb * 0.55, rb * 0.85), 0.2);
    d = ssub(d, sphere(x, y, z, 0, -rb * 0.6, 0.02, rb * 0.8), 0.1);
    d = smin(d, ellipsoid(x, y, z, 0, L - rt * 0.55, 0.08, rt * 1.08, rt * 0.62, rt * 0.46), 0.22);
    return d + rough(x, y, z, 0.004);
  };
  return surfaceNets(f, [-rb * 1.3, -0.1, -rb * 1.0], [rb * 1.3, L + 0.05, rb * 1.0], h);
}

// Metacarpal: boxy base, shaft bowed toward the back of the hand, round head that is broader on the palm side.
export function metacarpalGeometry(L, rb, rs, rh, hl, h = 0.065) {
  const hc = L - hl;
  const f = (x, y, z) => {
    const t = Math.min(1, Math.max(0, y / L));
    const bow = 0.14 * Math.sin(Math.PI * t);
    const X = x / 1.1, Z = (z + bow) / 0.9;
    let d = roundCone(X, y, Z, 0, rb * 0.5, 0, 0, hc, 0, rs * 1.25, rs * 0.95) * 0.9;
    d = smin(d, roundBox(x, y, z, 0, rb * 0.45, 0, rb * 0.95, rb * 0.5, rb * 0.85, rb * 0.35), 0.25);
    const head = smin(
      ellipsoid(x, y, z, 0, hc, 0.02, rh * 0.9, rh * 0.95, rh * 0.95),
      smin(sphere(x, y, z, rh * 0.42, hc - rh * 0.1, rh * 0.55, rh * 0.34), sphere(x, y, z, -rh * 0.42, hc - rh * 0.1, rh * 0.55, rh * 0.34), 0.1), 0.2);
    d = smin(d, head, 0.3);
    return d + rough(x, y, z, 0.007);
  };
  return surfaceNets(f, [-rb * 1.3, -0.1, -rb * 1.25], [rb * 1.3, L + 0.05, rb * 1.25], h);
}

// ---------------------------------------------------------------- carpals (wrist frame coordinates)
export function carpalGeometries() {
  const H = 0.055;
  const list = [];
  const add = (name, tag, desc, f, min, max) => list.push({ name, tag, desc, geo: surfaceNets(f, min, max, H) });
  add('Scaphoid', 'scaphoid', 'Boat-shaped bone below the thumb, with a narrow waist. Often fractured in falls; tender in the "snuffbox".', (x, y, z) => {
    let d = roundCone(x, y, z, 1.15, 0.55, 0.05, 1.55, 1.05, 0.12, 0.42, 0.3);
    d = smin(d, roundCone(x, y, z, 1.55, 1.05, 0.12, 1.95, 1.55, 0.32, 0.3, 0.38), 0.12);
    d = smin(d, sphere(x, y, z, 2.02, 1.5, 0.66, 0.22), 0.15);
    d = ssub(d, sphere(x, y, z, 0.62, 1.6, 0.05, 0.62), 0.08);
    return d + rough(x, y, z, 0.01);
  }, [0.6, 0.0, -0.5], [2.5, 2.1, 1.0]);
  add('Lunate', 'lunate', 'Moon-shaped central bone that cradles the capitate. Site of Kienböck\'s disease.', (x, y, z) => {
    let d = ellipsoid(x, y, z, 0.3, 0.78, 0.05, 0.52, 0.46, 0.62);
    d = ssub(d, sphere(x, y, z, 0.32, 1.62, 0.02, 0.62), 0.1);
    return d + rough(x, y, z, 0.01);
  }, [-0.3, 0.2, -0.7], [0.9, 1.35, 0.8]);
  add('Triquetrum', 'triquetrum', 'Pyramid-shaped bone on the little-finger side.', (x, y, z) => {
    const d = roundCone(x, y, z, -0.62, 0.98, 0.0, -1.32, 1.12, -0.12, 0.44, 0.26);
    return d + rough(x, y, z, 0.01);
  }, [-1.7, 0.4, -0.6], [-0.1, 1.6, 0.6]);
  add('Pisiform', 'pisiform', 'Pea-shaped bone you can feel at the base of the little-finger side of the palm.', (x, y, z) => ellipsoid(x, y, z, -1.2, 1.18, 0.74, 0.28, 0.34, 0.3), [-1.6, 0.7, 0.3], [-0.8, 1.7, 1.15]);
  add('Trapezium', 'trapezium', 'Saddle for the thumb metacarpal — the thumb basal (CMC) joint.', (x, y, z) => {
    let d = ellipsoid(x, y, z, 2.1, 2.25, 0.38, 0.52, 0.46, 0.46);
    d = smin(d, roundCone(x, y, z, 1.85, 2.0, 0.78, 2.05, 2.55, 0.85, 0.14, 0.1), 0.12);
    d = ssub(d, sphere(x, y, z, 2.72, 2.85, 0.62, 0.42), 0.1);
    return d + rough(x, y, z, 0.01);
  }, [1.5, 1.7, -0.2], [2.7, 2.8, 1.1]);
  add('Trapezoid', 'trapezoid', 'Small wedge under the index metacarpal.', (x, y, z) => smin(ellipsoid(x, y, z, 1.3, 2.45, 0.02, 0.4, 0.42, 0.44), roundBox(x, y, z, 1.3, 2.5, -0.1, 0.34, 0.34, 0.36, 0.28), 0.15) + rough(x, y, z, 0.01), [0.8, 1.9, -0.5], [1.8, 3.0, 0.55]);
  add('Capitate', 'capitate', 'Largest carpal bone, in the centre of the wrist; its round head sits in the lunate.', (x, y, z) => {
    let d = sphere(x, y, z, 0.32, 1.58, 0.02, 0.48);
    d = smin(d, roundCone(x, y, z, 0.32, 1.7, 0.02, 0.4, 2.6, 0.0, 0.42, 0.44), 0.3);
    d = smin(d, ellipsoid(x, y, z, 0.38, 2.45, 0.0, 0.5, 0.5, 0.5), 0.25);
    return d + rough(x, y, z, 0.01);
  }, [-0.3, 1.0, -0.6], [1.0, 3.1, 0.6]);
  add('Hamate', 'hamate', 'Wedge-shaped bone on the little-finger side. Its hook can break in golf or racquet sports.', (x, y, z) => {
    let d = ellipsoid(x, y, z, -0.95, 2.3, 0.0, 0.52, 0.6, 0.48);
    d = smin(d, roundCone(x, y, z, -0.95, 2.1, 0.0, -0.72, 1.55, 0.0, 0.42, 0.26), 0.2);
    return d + rough(x, y, z, 0.01);
  }, [-1.6, 1.1, -0.6], [-0.3, 2.95, 0.6]);
  add('Hook of hamate', 'hamate', 'Bony hook forming the outer wall of Guyon\'s canal.', (x, y, z) => roundCone(x, y, z, -0.82, 2.2, 0.3, -0.72, 2.32, 0.95, 0.22, 0.13), [-1.15, 1.8, 0.0], [-0.4, 2.7, 1.2]);
  return list;
}

// ---------------------------------------------------------------- forearm (fore frame coordinates)
export function radiusGeometry() {
  const f = (x, y, z) => {
    let d = roundCone(x, y, z, 0.78, -13.5, 0.0, 0.95, -3.4, 0.0, 0.6, 0.72);
    d = smin(d, ellipsoid(x, y, z, 1.08, -1.05, 0.02, 1.55, 0.95, 0.92), 1.4);
    // concave facets for the scaphoid and lunate, and the notch for the ulnar head
    d = ssub(d, sphere(x, y, z, 1.5, 0.42, 0.12, 0.66), 0.12);
    d = ssub(d, sphere(x, y, z, 0.32, 0.3, 0.05, 0.64), 0.12);
    d = ssub(d, sphere(x, y, z, -1.72, -1.0, -0.1, 0.66), 0.1);
    // radial styloid and Lister's tubercle
    d = smin(d, roundCone(x, y, z, 1.95, -1.1, 0.05, 2.4, -0.38, 0.05, 0.42, 0.14), 0.3);
    d = smin(d, roundCone(x, y, z, 1.0, -2.3, -0.82, 1.02, -0.85, -0.88, 0.12, 0.14), 0.18);
    return d + rough(x, y, z, 0.008);
  };
  return surfaceNets(f, [-0.9, -10.5, -1.2], [2.8, 0.2, 1.2], 0.095);
}
export function ulnaGeometry() {
  const f = (x, y, z) => {
    let d = roundCone(x, y, z, -1.72, -13.5, -0.1, -1.74, -2.1, -0.1, 0.52, 0.46);
    d = smin(d, sphere(x, y, z, -1.74, -1.18, -0.1, 0.6), 0.5);
    d = smin(d, roundCone(x, y, z, -2.0, -1.1, -0.35, -2.12, -0.5, -0.42, 0.2, 0.08), 0.2);
    return d + rough(x, y, z, 0.008);
  };
  return surfaceNets(f, [-2.6, -10.5, -0.9], [-0.9, -0.3, 0.7], 0.085);
}
