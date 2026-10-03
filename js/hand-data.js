// Static hand measurements shared by the 3D rig and the (Three.js-free)
// analysis code, so analysis.js can run in Node for tests.
// Units are centimetres. Base model is a RIGHT hand in its own frame:
//   +X = radial (thumb side), +Y = distal (toward fingertips), +Z = palmar.

export const FINGER_DATA = [
  { key: 'index', code: 'I', label: 'Index finger', mcp: [2.45, 9.3, 0.0], base: [1.55, 2.95, -0.05], len: [4.0, 2.4, 1.85], r: [0.5, 0.44, 0.38], skin: 1.0 },
  { key: 'middle', code: 'M', label: 'Middle finger', mcp: [0.65, 9.6, -0.05], base: [0.45, 3.05, -0.1], len: [4.45, 2.75, 1.95], r: [0.53, 0.46, 0.4], skin: 1.04 },
  { key: 'ring', code: 'R', label: 'Ring finger', mcp: [-1.15, 9.15, 0.1], base: [-0.75, 2.9, 0.0], len: [4.15, 2.65, 1.9], r: [0.49, 0.43, 0.37], skin: 0.97 },
  { key: 'pinky', code: 'P', label: 'Little finger', mcp: [-2.8, 8.25, 0.35], base: [-1.85, 2.65, 0.15], len: [3.3, 1.95, 1.65], r: [0.42, 0.37, 0.33], skin: 0.86 },
];

export const THUMB_DATA = {
  key: 'thumb', code: 'T', label: 'Thumb',
  cmc: [2.5, 2.7, 0.7],
  dir: [0.5, 0.8, 0.3],
  flexDir: [-0.9, 0.05, 0.45],
  len: [4.6, 3.2, 2.45],
  r: [0.52, 0.5, 0.44],
};

export const FINGER_LABEL = Object.fromEntries(FINGER_DATA.map((f) => [f.key, f.label]));
