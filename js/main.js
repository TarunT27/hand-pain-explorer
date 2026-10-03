import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HandRig, FINGERS, THUMB, thumbBasisQuat, clonePose, lerpPose } from './rig.js';
import { buildSoftTissues } from './soft.js';
import { Skin } from './skin.js';
import { G, LAYERS, LAYER_INDEX, layerQ, dissolveValue } from './materials.js';
import { buildPoses, buildExercises, PRESETS } from './poses.js';
import { REGIONS, SYMPTOMS, GENERAL_RED_FLAGS, RED_FLAG_CHECKS, ONSETS, EXERCISE_INFO, regionAnchors, QUICK_GROUPS, NERVES, TESTS, REFS, CONDITION_SOURCES, TEST_SOURCES, NERVE_SOURCES, RED_FLAG_SOURCES, CONTENT_REVIEW } from './content.js';
import { analyze, fitLabel, fitTier, spotTitle, summaryText, dontMiss, evidenceSummary, causeApplies, spotIsAcuteInjury, conditionInfo } from './analysis.js';
import { Tracker, HandTracks, describeHand, retarget, modelRestQuat, palmFacesCamera, mapPointOnHand, drawOverlay } from './tracking.js';

const $ = (s) => document.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => t * t * (3 - 2 * t);
const isMobile = () => window.innerWidth < 860;
const nowS = () => performance.now() / 1000;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hasOwn = (o, k) => k != null && Object.prototype.hasOwnProperty.call(o, k);
const APP_VERSION = '0.3.0';

// ---------------------------------------------------------------- global error handling: never leave a silent spinner
function fatal(msg) {
  const l = $('#loading');
  l.classList.remove('done');
  l.innerHTML = `<p class="load-err"><b>Something went wrong.</b><br>${msg}</p><button class="btn primary" onclick="location.reload()">Reload</button>`;
}
window.addEventListener('error', (e) => { if (!window.__hand) fatal('The page could not start: ' + (e.message || 'unknown error')); });
window.addEventListener('unhandledrejection', (e) => { if (!window.__hand) fatal('A download failed. Check your connection and reload.'); });
const loadTimer = setTimeout(() => { if (!window.__hand) fatal('Loading is taking too long. The 3D library may be blocked — check your connection.'); }, 20000);

// ---------------------------------------------------------------- renderer
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let dprCap = coarse || isMobile() ? 1.25 : 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('Graphics context lost — reloading', 3000); setTimeout(() => location.reload(), 1200); });

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
camera.position.set(0, 6, 56);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 5.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 14;
controls.maxDistance = 110;
controls.rotateSpeed = 0.8;
controls.listenToKeyEvents(canvas);

const key = new THREE.DirectionalLight(0xfff0e0, 2.3); key.position.set(9, 12, 13);
const fill = new THREE.DirectionalLight(0xbcd4ff, 0.75); fill.position.set(-12, 3, -9);
const rim = new THREE.DirectionalLight(0xa8c8ff, 1.3); rim.position.set(-6, 9, -14);
const front = new THREE.DirectionalLight(0xffffff, 0.5); front.position.set(-4, -2, 16);
scene.add(key, fill, rim, front, new THREE.HemisphereLight(0xdfe9ff, 0x2a1f1a, 0.55));

// ---------------------------------------------------------------- anatomy
const rig = new HandRig();
scene.add(rig.pivot);
const P = buildPoses(rig);
const EX = buildExercises(P);
const tubes = buildSoftTissues(rig);
tubes.forEach((t) => scene.add(t.mesh));
const skin = new Skin(rig);
scene.add(skin.mesh);
skin.update();
const pickables = [...rig.meshes, ...tubes.map((t) => t.mesh)];
let visiblePickables = pickables;
const thumbBaseQ = thumbBasisQuat();
const restQ = modelRestQuat(rig.landmarksLocal());
const anchors = regionAnchors(FINGERS, THUMB).map((a) => ({ ...a, frameObj: rig.frames[a.frame], local: new THREE.Vector3(...a.p), world: new THREE.Vector3() }));
const frameKeyOf = new Map(Object.entries(rig.frames).map(([f, o]) => [o, f]));

// ---------------------------------------------------------------- state
const state = {
  peel: 0,
  hidden: LAYERS.map(() => false),
  ghost: true,
  nerveMap: false,
  reduceMotion: reduceMotion.matches,
  preset: 'relaxed',
  view: 'palm',
  mirror: false,          // true = showing the left hand
  handLocked: false,      // user chose a hand explicitly (webcam won't override the label)
  panel: 'home',          // home | spot | analysis
  prevPanel: 'home',
  selection: null,        // { region, finger, frameKey, local, deep, pain, painSet, symptoms, onset, territory, hand, pinId }
  pins: [],               // saved pain-map spots
  tests: {},              // self-check answers: key -> yes | no | unsure
  redFlags: {},           // red-flag checklist answers: key -> true/false
  bothHands: false,
  openTest: null,         // which self-check card is expanded in the spot panel
  demo: null,             // temporary hotspot while a self-check plays
  demoRestore: null,
  exercise: null,
  tracking: false,
  followRot: true,
  swap: false,
  mode: 'none',
  lastInteract: 0,
  focusKey: null,
};
const curPose = clonePose(P.relaxed);
const targetPose = clonePose(P.relaxed);
const pivotTarget = new THREE.Quaternion();
const VIEWS = { palm: [-0.1, -0.32, 0.02], back: [-0.1, Math.PI + 0.32, -0.02], thumb: [-0.12, -1.0, 0.05], pinky: [-0.1, 1.15, -0.05] };
const viewCache = new Map();
function viewQuat(view, mirror) {
  const k = (hasOwn(VIEWS, view) ? view : 'palm') + (mirror ? 'L' : 'R');
  if (!viewCache.has(k)) {
    const [x, y, z] = VIEWS[hasOwn(VIEWS, view) ? view : 'palm'];
    viewCache.set(k, new THREE.Quaternion().setFromEuler(new THREE.Euler(x, mirror ? -y : y, mirror ? -z : z)));
  }
  return viewCache.get(k);
}
pivotTarget.copy(viewQuat('palm', false));
rig.pivot.quaternion.copy(pivotTarget);
const handName = () => (state.mirror ? 'Left' : 'Right');

// ---------------------------------------------------------------- persistence (this browser only)
const STORE = 'hand-pain-explorer-v2';
const STORE_V1 = 'hand-pain-explorer-v1';
let nextPinId = 1;
const finite3 = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
const symKeys = new Set(SYMPTOMS.map((s) => s.key));
const onsetKeys = new Set(ONSETS.map((o) => o.key));
function sanitizePin(p) {
  if (!p || !hasOwn(REGIONS, p.region) || !hasOwn(rig.frames, p.frameKey)) return null;
  if (!finite3(p.local) || !finite3(p.deep)) return null;
  const pain = Number.isFinite(p.pain) ? clamp(Math.round(p.pain), 0, 10) : 5;
  const hist = Array.isArray(p.history) ? p.history.filter((h) => h && Number.isFinite(h.t) && Number.isFinite(h.pain)).slice(-60) : [];
  return {
    id: Number.isInteger(p.id) && p.id > 0 ? p.id : null,
    region: p.region, finger: FINGERS.some((f) => f.key === p.finger) ? p.finger : null, frameKey: p.frameKey,
    local: p.local, deep: p.deep, pain, symptoms: (Array.isArray(p.symptoms) ? p.symptoms : []).filter((t) => symKeys.has(t)),
    territory: hasOwn(NERVES, p.territory) ? p.territory : null, hand: p.hand === 'Left' ? 'Left' : 'Right',
    onset: onsetKeys.has(p.onset) ? p.onset : null, createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
    updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now(), history: hist,
  };
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 2, pins: state.pins, tests: state.tests, redFlags: state.redFlags, bothHands: state.bothHands, hand: handName(), handLocked: state.handLocked, savedAt: Date.now() }));
  } catch { /* storage unavailable */ }
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(STORE_V1) || 'null'); } catch { d = null; }
  if (!d) return;
  try {
    const pins = (Array.isArray(d.pins) ? d.pins : []).map(sanitizePin).filter(Boolean).slice(0, 8);
    pins.forEach((p, i) => { if (!p.id) p.id = i + 1; });
    state.pins = pins;
    state.tests = Object.fromEntries(Object.entries(d.tests || {}).filter(([k, v]) => hasOwn(TESTS, k) && ['yes', 'no', 'unsure'].includes(v)));
    state.redFlags = Object.fromEntries(Object.entries(d.redFlags || {}).filter(([k, v]) => RED_FLAG_CHECKS.some((f) => f.key === k) && typeof v === 'boolean'));
    state.bothHands = !!d.bothHands;
    if (d.handLocked && (d.hand === 'Left' || d.hand === 'Right')) { state.handLocked = true; state.mirror = d.hand === 'Left'; }
    nextPinId = state.pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  } catch (err) {
    console.warn('Saved pain map could not be read', err);
    state.pins = []; state.tests = {}; state.redFlags = {};
    setTimeout(() => toast('Your saved pain map could not be read and was reset'), 600);
  }
}
function exportJSON() {
  const blob = new Blob([JSON.stringify({ app: 'hand-pain-explorer', v: 2, exportedAt: new Date().toISOString(), pins: state.pins, tests: state.tests, redFlags: state.redFlags, bothHands: state.bothHands }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hand-pain-map-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      const pins = (Array.isArray(d.pins) ? d.pins : []).map(sanitizePin).filter(Boolean).slice(0, 8);
      if (!pins.length && !d.tests) throw new Error('no spots');
      pins.forEach((p, i) => { if (!p.id) p.id = i + 1; });
      state.pins = pins; state.tests = d.tests && typeof d.tests === 'object' ? d.tests : {}; state.redFlags = d.redFlags || {}; state.bothHands = !!d.bothHands;
      nextPinId = state.pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      save(); syncPinUI(); state.panel = 'analysis'; renderInfo();
      toast(`Imported ${pins.length} spot${pins.length === 1 ? '' : 's'}`);
    } catch { toast('That file is not a Hand Pain Explorer export'); }
  };
  r.readAsText(file);
}

// ---------------------------------------------------------------- layout: keep the hand centred in the free area
function freeArea() {
  const W = window.innerWidth, H = window.innerHeight;
  if (isMobile()) {
    const sheet = $('#info').classList.contains('open') ? $('#info').getBoundingClientRect().height : 0;
    const strip = $('#layerStrip').offsetHeight || 0;
    return { cx: W / 2, cy: (56 + H - sheet - strip) / 2, w: W, h: H - sheet - strip - 56 };
  }
  const l = $('#leftPanel').getBoundingClientRect();
  const r = $('#info').getBoundingClientRect();
  const left = l.right + 8, right = r.left - 8;
  return { cx: (left + right) / 2, cy: (64 + H) / 2, w: right - left, h: H - 64 };
}
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const fa = freeArea();
  camera.setViewOffset(W, H, W / 2 - fa.cx, H / 2 - fa.cy, W, H);
  camera.updateProjectionMatrix();
}
function fitCamera() {
  const fa = freeArea();
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dH = 33 / (2 * tanH) * (window.innerHeight / Math.max(300, fa.h));
  const dW = 22 / (2 * tanH * (fa.w / window.innerHeight));
  const d = clamp(Math.max(dH, dW), 30, isMobile() ? 120 : 95);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, d);
}
window.addEventListener('resize', () => { resize(); });

// ---------------------------------------------------------------- UI: layers
const peelInput = $('#peel');
const layerList = $('#layerList');
LAYERS.forEach((L, i) => {
  const li = document.createElement('li');
  li.dataset.i = i;
  li.innerHTML = `<button class="layer-name" title="Show down to ${L.label.toLowerCase()}"><i style="--c:${L.color}"></i><span>${L.label}</span><em></em></button>
    <button class="eye" aria-pressed="false" aria-label="Hide ${L.label}" title="Show / hide"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
  li.querySelector('.layer-name').addEventListener('click', () => { state.hidden[i] = false; setPeel(i); });
  li.querySelector('.eye').addEventListener('click', () => { state.hidden[i] = !state.hidden[i]; syncLayerUI(); });
  layerList.appendChild(li);
});
// compact strip for phones: five dots + nerve map
const strip = $('#layerStrip');
strip.innerHTML = `<input type="range" id="peelM" min="0" max="4" step="0.01" value="0" aria-label="Peel depth: slide right to see inside"><div class="strip-dots">${LAYERS.map((L, i) => `<button class="strip-dot" data-l="${i}" style="--c:${L.color}" aria-label="Show ${L.label}" title="${L.label}"></button>`).join('')}</div><label class="toggle small"><input type="checkbox" id="nerveMapM"><span class="sw"></span><span class="visually-hidden">Nerve map</span></label>`;
strip.querySelectorAll('.strip-dot').forEach((b) => b.addEventListener('click', () => { state.hidden[+b.dataset.l] = false; setPeel(+b.dataset.l); }));
$('#peelM').addEventListener('input', (e) => { state.peel = parseFloat(e.target.value); syncLayerUI(); });
$('#nerveMapM').addEventListener('change', (e) => setNerveMap(e.target.checked));

function setPeel(v) {
  state.peel = clamp(v, 0, 4);
  syncLayerUI();
}
peelInput.addEventListener('input', () => { state.peel = parseFloat(peelInput.value); syncLayerUI(); });
function syncLayerUI() {
  const top = Math.min(4, Math.floor(state.peel + 0.001));
  peelInput.value = state.peel; $('#peelM').value = state.peel;
  const vt = `${LAYERS[top].label} showing`;
  peelInput.setAttribute('aria-valuetext', vt); $('#peelM').setAttribute('aria-valuetext', vt);
  [...layerList.children].forEach((li, i) => {
    const peeled = clamp(state.peel - i, 0, 1);
    li.classList.toggle('peeled', peeled >= 0.999 || state.hidden[i]);
    li.classList.toggle('partial', peeled > 0.001 && peeled < 0.999 && !state.hidden[i]);
    li.classList.toggle('top', i === top && !state.hidden[i]);
    li.classList.toggle('off', state.hidden[i]);
    li.querySelector('em').textContent = state.hidden[i] ? 'hidden' : peeled >= 0.999 ? 'removed' : peeled > 0.001 ? `${Math.round(peeled * 100)}% off` : i === top ? 'showing' : '';
    const eye = li.querySelector('.eye');
    eye.setAttribute('aria-pressed', String(state.hidden[i]));
    eye.setAttribute('aria-label', `${state.hidden[i] ? 'Show' : 'Hide'} ${LAYERS[i].label}`);
  });
  strip.querySelectorAll('.strip-dot').forEach((b, i) => b.classList.toggle('on', i === top));
  peelInput.style.setProperty('--p', (state.peel / 4) * 100 + '%');
  $('#ghostRow').hidden = state.peel < 0.05;
  updateSceneDescription();
}
$('#ghost').addEventListener('change', (e) => { state.ghost = e.target.checked; });
$('#motion').checked = state.reduceMotion;
$('#motion').addEventListener('change', (e) => { state.reduceMotion = e.target.checked; G.uReduceMotion.value = e.target.checked ? 1 : 0; });
G.uReduceMotion.value = state.reduceMotion ? 1 : 0;
function setNerveMap(on, quiet = false) {
  state.nerveMap = on;
  $('#nerveMap').checked = on; $('#nerveMapM').checked = on;
  $('#nerveLegend').hidden = !on;
  if (on && state.peel > 0.5) setPeel(0);
  if (on && !quiet) toast('Nerve map on — colours show which nerve supplies each patch of skin', 3200);
  updateSceneDescription();
}
$('#nerveMap').addEventListener('change', (e) => setNerveMap(e.target.checked));
$('#nerveLegend').innerHTML = Object.values(NERVES).map((n, i) => `<div class="nl-row"><i class="nl-sw nl-${i}" style="--c:${n.color}"></i><div><b>${n.label}</b><small>${n.area}</small></div></div>`).join('') + `<div class="nl-src">${srcHTML(NERVE_SOURCES, 'Source')}</div><button class="icon-btn small nl-close" aria-label="Hide nerve map">${ICON_X_SVG()}</button>`;
$('#nerveLegend .nl-close').addEventListener('click', () => setNerveMap(false, true));
const TONES = ['#f2cdb8', '#dca58c', '#c08466', '#8e5b43', '#5f3b2b'];
TONES.forEach((t, i) => {
  const b = document.createElement('button');
  b.className = 'tone' + (i === 1 ? ' active' : '');
  b.style.background = t;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(i === 1));
  b.setAttribute('aria-label', 'Skin tone ' + (i + 1));
  b.addEventListener('click', () => { skin.setTone(t); document.querySelectorAll('.tone').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', String(x === b)); }); });
  $('#tones').appendChild(b);
});

// ---------------------------------------------------------------- UI: hand, poses, views, exercises
function setHand(left, { lock = true, quiet = false } = {}) {
  state.mirror = left;
  if (lock) state.handLocked = true;
  document.querySelectorAll('[data-hand]').forEach((b) => { const on = (b.dataset.hand === 'Left') === left; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
  if (state.selection && !state.selection.pinId) state.selection.hand = handName();
  if (!quiet && state.panel === 'spot') renderInfo({ keepScroll: true });
  updateSceneDescription();
  save();
}
document.querySelectorAll('[data-hand]').forEach((b) => b.addEventListener('click', () => setHand(b.dataset.hand === 'Left')));
PRESETS.forEach(([k, label]) => {
  const b = document.createElement('button');
  b.className = 'chip' + (k === state.preset ? ' active' : '');
  b.textContent = label;
  b.dataset.k = k;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(k === state.preset));
  b.addEventListener('click', () => { stopExercise(); state.preset = k; markPreset(); if (state.tracking) toast('Pose presets apply when the webcam is off'); });
  $('#poses').appendChild(b);
});
function markPreset() { document.querySelectorAll('#poses .chip').forEach((b) => { const on = b.dataset.k === state.preset && !state.exercise; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); }); }
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  if (!hasOwn(VIEWS, v)) return;
  state.view = v;
  if (state.tracking && state.followRot && state.mode === 'mirror') toast('Turn off "Follow wrist rotation" to use fixed views');
  document.querySelectorAll('[data-view]').forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
  updateSceneDescription();
}
Object.entries(EXERCISE_INFO).forEach(([k, info]) => {
  const b = document.createElement('button');
  b.className = 'ex-item';
  b.innerHTML = `<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span><b>${info.label}</b><small>${info.desc}</small></span>`;
  b.addEventListener('click', () => startExercise(k));
  $('#exList').appendChild(b);
});
function updateSceneDescription() {
  const top = LAYERS[Math.min(4, Math.floor(state.peel + 0.001))].label.toLowerCase();
  const sel = state.panel === 'spot' && state.selection ? `, selected spot: ${spotTitle(state.selection)}` : '';
  $('#sceneDesc').textContent = `${handName()} hand, ${state.view} view, ${top} showing${state.nerveMap ? ', nerve map on' : ''}${sel}. Use the quick buttons in the side panel to choose an area; arrow keys rotate the model when it is focused.`;
}

// ---------------------------------------------------------------- exercises & self-check demos
function startExercise(k, { title, demoSpot = null, testKey = null } = {}) {
  const frames = EX[k];
  if (!frames) return;
  if (state.exercise) stopExercise({ silent: true });
  state.exercise = { key: k, frames, i: 0, t: 0, loop: 0, loops: frames.loops || 2, tr: frames.tr || 0.8, from: clonePose(curPose), testKey };
  state.demo = demoSpot;
  $('#exBar').hidden = false;
  $('#exTitle').textContent = title || (EXERCISE_INFO[k] && EXERCISE_INFO[k].label) || k;
  $('#exCaption').textContent = frames[0].caption;
  const ans = $('#exAnswer');
  ans.hidden = !testKey;
  if (testKey) {
    ans.innerHTML = `<span>Felt it?</span><div class="seg-group">${['yes', 'no', 'unsure'].map((v) => `<button class="seg-btn" data-exans="${v}">${v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not sure'}</button>`).join('')}</div>`;
    ans.querySelectorAll('[data-exans]').forEach((b) => b.addEventListener('click', () => { answerTest(testKey, b.dataset.exans); stopExercise(); }));
  }
  $('#exStop').textContent = testKey ? 'Done' : 'Stop';
  markPreset();
  if (state.tracking) toast('Movement playing — tracking paused');
}
function stopExercise({ silent = false } = {}) {
  if (!state.exercise) return;
  state.exercise = null;
  state.demo = null;
  $('#exBar').hidden = true;
  if (state.demoRestore) {
    const r = state.demoRestore; state.demoRestore = null;
    if (r.nerveMapOn !== undefined && !r.nerveMapWas) setNerveMap(false, true);
    if (r.view && !(state.tracking && state.followRot)) setView(r.view);
  }
  markPreset();
}
$('#exStop').addEventListener('click', () => stopExercise());
function updateExercise(dt) {
  const ex = state.exercise;
  ex.t += dt;
  let kf = ex.frames[ex.i];
  if (ex.t > ex.tr + kf.hold) {
    ex.t -= ex.tr + kf.hold;
    ex.from = clonePose(kf.pose);
    ex.i++;
    if (ex.i >= ex.frames.length) {
      ex.loop++;
      if (ex.loop >= ex.loops) { stopExercise(); return; }
      ex.i = 0;
    }
    kf = ex.frames[ex.i];
    $('#exCaption').textContent = kf.caption;
  }
  if (kf.hold >= 10) {
    const left = Math.max(0, Math.ceil(ex.tr + kf.hold - ex.t));
    $('#exCaption').textContent = kf.caption;
    $('#exCount').textContent = `${left} s`;
  } else $('#exCount').textContent = '';
  lerpPose(targetPose, ex.from, kf.pose, smooth(clamp(ex.t / ex.tr, 0, 1)));
  const total = ex.frames.length * ex.loops;
  $('#exProgress').style.width = (((ex.loop * ex.frames.length + ex.i + clamp(ex.t / (ex.tr + kf.hold), 0, 1)) / total) * 100).toFixed(1) + '%';
}
function showTest(k) {
  const T = TESTS[k];
  const region = T.regions[0];
  const R = REGIONS[region];
  const finger = R.perFinger ? (state.selection && state.selection.finger) || 'index' : undefined;
  const spot = spotForRegion(region, finger);
  state.demoRestore = { nerveMapWas: state.nerveMap, nerveMapOn: T.nerveMap, view: state.view };
  if (T.nerveMap) setNerveMap(true);
  if (!(state.tracking && state.followRot)) setView(T.view || R.view);
  startExercise(k, { title: T.name, demoSpot: spot, testKey: k });
  const card = info.querySelector(`#test-${k}`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function answerTest(k, v) {
  if (state.tests[k] === v) delete state.tests[k]; else state.tests[k] = v;
  save();
  announce(`${TESTS[k].name}: ${v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'not sure'}`);
  renderInfo({ keepScroll: true });
}

// ---------------------------------------------------------------- picking & regions
const raycaster = new THREE.Raycaster();
const rootInv = new THREE.Matrix4();
const _lp = new THREE.Vector3();
function localOf(p) { return _lp.copy(p).applyMatrix4(rootInv); }

function pick(clientX, clientY) {
  const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const ray = raycaster.ray;
  let best = null;
  if (layerQ[0].value < 0.999 && !state.hidden[0]) {
    const t = skin.raycast(ray.origin, ray.direction);
    if (t !== null) {
      const p = ray.at(t, new THREE.Vector3());
      const lp = localOf(p);
      if (dissolveValue(lp, layerQ[0].value) >= 0 && lp.y > -9.5) best = { point: p, distance: t, object: skin.mesh };
    }
  }
  const hits = raycaster.intersectObjects(visiblePickables, false);
  for (const h of hits) {
    if (best && h.distance >= best.distance) break;
    const lp = localOf(h.point);
    if (lp.y < -9.5) continue;
    if (dissolveValue(lp, layerQ[h.object.material.userData.layer].value) < 0) continue;
    best = h;
    break;
  }
  return best;
}

function classify(point) {
  let best = null, bs = Infinity;
  for (const a of anchors) {
    a.world.copy(a.local).applyMatrix4(a.frameObj.matrixWorld);
    const s = a.world.distanceTo(point) / a.r;
    if (s < bs) { bs = s; best = a; }
  }
  return best;
}
function nearestFrame(point) {
  // attach spots to the closest moving frame so they follow the hand
  let best = rig.wrist, bd = Infinity;
  const w = new THREE.Vector3();
  for (const [k, f] of Object.entries(rig.frames)) {
    if (k === 'fore' || k === 'wrist') continue;
    f.getWorldPosition(w);
    const d = w.distanceTo(point);
    if (d < bd) { bd = d; best = f; }
  }
  const anchor = classify(point);
  if (anchor && (anchor.frame === 'wrist' || anchor.frame === 'fore') && bd > 1.4) return anchor.frameObj;
  return bd < 3.2 ? best : (anchor ? anchor.frameObj : rig.wrist);
}
function regionTitle(a) { return spotTitle(a); }

// A skin spot stored in a joint frame: { frameKey, local, deep } (+ territory)
function spotAt(point, frame = nearestFrame(point)) {
  const surf = skin.project(point);
  const deep = surf.clone().addScaledVector(skin.normal(surf), -1.7);
  return { frameKey: frameKeyOf.get(frame), local: frame.worldToLocal(surf.clone()), deep: frame.worldToLocal(deep), territory: skin.territoryAt(surf) };
}
function spotForRegion(region, finger) {
  const R = REGIONS[region];
  const a = anchors.find((x) => x.region === region && (!R.perFinger || x.finger === finger));
  if (!a) return null;
  a.world.copy(a.local).applyMatrix4(a.frameObj.matrixWorld);
  return spotAt(a.world, a.frameObj);
}
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
const _sw = new THREE.Vector3();
function spotWorld(s, which = 'local', out = _sw) {
  const src = s[which];
  if (src.isVector3) out.copy(src); else out.set(src[0], src[1], src[2]);
  return out.applyMatrix4(rig.frames[s.frameKey].matrixWorld);
}

function findPin(region, finger, world, hand) {
  return state.pins.find((p) => p.region === region && (p.finger || null) === (finger || null) && (p.hand || 'Right') === hand && spotWorld(p, 'local', new THREE.Vector3()).distanceTo(world) < 1.6);
}
function setPanel(p) { if (state.panel !== p) state.prevPanel = state.panel; state.panel = p; }
function select(region, finger, spot) {
  const world = spotWorld(spot, 'local', new THREE.Vector3());
  const pin = findPin(region, finger, world, handName());
  state.selection = pin
    ? { region, finger, frameKey: pin.frameKey, local: v3(pin.local), deep: v3(pin.deep), pain: pin.pain, painSet: true, symptoms: [...pin.symptoms], onset: pin.onset, territory: pin.territory, hand: pin.hand, pinId: pin.id }
    : { region, finger, ...spot, pain: 5, painSet: false, symptoms: [], onset: null, hand: handName(), pinId: null };
  state.openTest = null;
  setPanel('spot');
  renderInfo({ focusTitle: true });
  announce(`Opened ${spotTitle(state.selection)}`);
}
function selectPoint(point, source = 'click') {
  const a = classify(point);
  if (!a) return;
  select(a.region, a.finger, spotAt(point));
  if (source === 'point') {
    if (!state.selection.pinId) {
      if (addPin()) toast(`Added to your pain map: ${regionTitle(a)} — set how much it hurts`, 2800);
    } else toast(`Selected: ${regionTitle(a)}`);
  }
}
function selectRegion(region, finger) {
  if (!hasOwn(REGIONS, region)) return;
  const R = REGIONS[region];
  const f = R.perFinger ? (FINGERS.some((x) => x.key === finger) ? finger : 'index') : undefined;
  const spot = spotForRegion(region, f);
  if (!spot) return;
  if (!(state.tracking && state.followRot)) setView(R.view);
  select(region, f, spot);
}
function selectPin(id) {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return;
  const R = REGIONS[pin.region];
  if ((pin.hand === 'Left') !== state.mirror) setHand(pin.hand === 'Left', { lock: false, quiet: true });
  if (!(state.tracking && state.followRot)) setView(R.view);
  select(pin.region, pin.finger, { frameKey: pin.frameKey, local: v3(pin.local), deep: v3(pin.deep), territory: pin.territory });
}
function selectionDirty() {
  const s = state.selection;
  return s && !s.pinId && (s.painSet || s.symptoms.length || s.onset);
}
function clearSelection({ confirmDiscard = true } = {}) {
  if (confirmDiscard && selectionDirty()) {
    state.discardPrompt = true;
    renderInfo({ keepScroll: true });
    return;
  }
  state.discardPrompt = false;
  state.selection = null;
  setPanel('home');
  renderInfo({ focusTitle: true });
}
function goBack() {
  if (state.panel === 'analysis' && state.prevPanel === 'spot' && state.selection) { setPanel('spot'); renderInfo({ focusTitle: true }); return; }
  clearSelection();
}

// ---------------------------------------------------------------- pain map
function addPin() {
  const s = state.selection;
  if (!s || s.pinId) return false;
  if (![s.local, s.deep].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))) { toast('That spot could not be placed — try tapping again'); return false; }
  if (state.pins.length >= 8) { toast('Your pain map holds 8 spots — remove one first'); return false; }
  const now = Date.now();
  const pin = {
    id: nextPinId++, region: s.region, finger: s.finger || null, frameKey: s.frameKey,
    local: s.local.toArray(), deep: s.deep.toArray(), pain: s.pain, symptoms: [...s.symptoms], onset: s.onset || null,
    territory: s.territory || null, hand: s.hand || handName(), createdAt: now, updatedAt: now, history: [{ t: now, pain: s.pain, symptoms: [...s.symptoms] }],
  };
  state.pins.push(pin);
  s.pinId = pin.id;
  save();
  syncPinUI();
  $('#btnMap').classList.remove('bump'); void $('#btnMap').offsetWidth; $('#btnMap').classList.add('bump');
  announce(`Added to pain map, ${state.pins.length} spot${state.pins.length === 1 ? '' : 's'}`);
  return true;
}
function removePin(id) {
  state.pins = state.pins.filter((p) => p.id !== id);
  if (state.selection && state.selection.pinId === id) state.selection.pinId = null;
  save();
  syncPinUI();
}
function updatePinFromSelection() {
  const s = state.selection;
  const pin = s && s.pinId && state.pins.find((p) => p.id === s.pinId);
  if (!pin) return;
  pin.pain = s.pain;
  pin.symptoms = [...s.symptoms];
  pin.onset = s.onset || null;
  pin.updatedAt = Date.now();
  // one history entry per day, so the trend reflects check-ins rather than slider wiggles
  const last = pin.history && pin.history[pin.history.length - 1];
  const sameDay = last && new Date(last.t).toDateString() === new Date().toDateString();
  if (!pin.history) pin.history = [];
  if (sameDay) { last.pain = s.pain; last.symptoms = [...s.symptoms]; last.t = Date.now(); } else pin.history.push({ t: Date.now(), pain: s.pain, symptoms: [...s.symptoms] });
  save();
  syncPinUI();
}
const painColor = (pain) => `hsl(${Math.round(48 - pain * 4.6)} 92% ${Math.round(62 - pain * 1.6)}%)`;
const painText = (pain) => (pain >= 8 ? '#fff' : '#1b0f0b');
const pinLayer = $('#pinLayer');
function syncPinUI() {
  const n = state.pins.length;
  $('#mapCount').textContent = n;
  $('#btnMap').classList.toggle('has', n > 0);
  $('#btnMap').setAttribute('aria-label', `My pain map, ${n} spot${n === 1 ? '' : 's'}`);
  $('#btnMap span').textContent = n ? 'What might fit' : 'My pain map';
  pinLayer.innerHTML = state.pins.map((p, i) => `<button class="pin-badge" data-pin="${p.id}" style="--c:${painColor(p.pain)};--t:${painText(p.pain)}" aria-label="Spot ${i + 1}: ${esc(spotTitle(p))}, ${p.pain} out of 10, ${p.hand || 'Right'} hand" title="${esc(spotTitle(p))} · ${p.pain}/10">${i + 1}</button>`).join('');
  pinLayer.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => selectPin(+b.dataset.pin)));
}
$('#btnMap').addEventListener('click', () => { setPanel('analysis'); renderInfo({ focusTitle: true }); });

// ---------------------------------------------------------------- info panel
const info = $('#info');
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function ICON_X_SVG() { return '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }
const ICON_X = ICON_X_SVG();
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
// Source links: accepts REFS keys or ref objects
function srcHTML(list, label = 'Sources') {
  const refs = (list || []).map((r) => (typeof r === 'string' ? REFS[r] : r)).filter(Boolean);
  if (!refs.length) return '';
  return `<p class="srcs"><span>${label}:</span> ${refs.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.org + ' — ' + r.title)}">${esc(r.org)}: ${esc(r.title)}</a>`).join('<i>·</i>')}</p>`;
}
const REVIEW_NOTE = `<button class="link review-link" data-review>Sources &amp; review</button>`;
const symLabel = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label]));
const onsetLabel = Object.fromEntries(ONSETS.map((o) => [o.key, o.label]));
function announce(msg) { const a = $('#announce'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30); }
function issueURL(title, body) {
  const base = CONTENT_REVIEW.issues + '/new?';
  return base + new URLSearchParams({ title, body: `${body}\n\nApp version: ${APP_VERSION}` }).toString();
}
function headHTML({ eyebrow, title, back }) {
  return `<div class="info-head">
      <div>
        ${back ? `<button class="back-link" id="backBtn">← ${esc(back)}</button>` : ''}
        <div class="eyebrow">${eyebrow}</div>
        <h2 class="title" id="infoTitle" tabindex="-1">${esc(title)}</h2>
      </div>
      <button class="icon-btn" id="closePanel" aria-label="Close panel">${ICON_X}</button>
    </div>`;
}
function sparkHTML(hist) {
  if (!hist || hist.length < 2) return '';
  const w = 64, h = 18, n = hist.length;
  const pts = hist.map((e, i) => `${(i / (n - 1)) * w},${h - (e.pain / 10) * h}`).join(' ');
  const first = hist[0].pain, last = hist[n - 1].pain;
  const trend = last < first ? 'better' : last > first ? 'worse' : 'same';
  return `<svg class="spark ${trend}" viewBox="0 0 ${w} ${h}" aria-label="Pain trend: ${first} to ${last} over ${n} check-ins"><polyline points="${pts}"/></svg>`;
}
function pinRowsHTML(hand) {
  const pins = state.pins.map((p, i) => ({ p, i })).filter(({ p }) => !hand || (p.hand || 'Right') === hand);
  if (!pins.length) return '';
  return pins.map(({ p, i }) => {
    const sym = p.symptoms.map((t) => symLabel[t].toLowerCase()).join(', ');
    const nerve = p.territory ? ` · ${NERVES[p.territory].label.toLowerCase()} area` : '';
    const onset = p.onset ? ` · ${onsetLabel[p.onset].toLowerCase()}` : '';
    return `<div class="pin-row"><button class="pin-open" data-pin="${p.id}"><span class="pin-dot" style="--c:${painColor(p.pain)};--t:${painText(p.pain)}">${i + 1}</span><span class="pin-text"><b>${esc(spotTitle(p))} <em class="hand-tag">${p.hand === 'Left' ? 'L' : 'R'}</em></b><small>${p.pain}/10${sym ? ' · ' + esc(sym) : ''}${onset}${nerve}</small></span>${sparkHTML(p.history)}</button><button class="icon-btn small" data-unpin="${p.id}" aria-label="Remove spot ${i + 1} from pain map">${ICON_X}</button></div>`;
  }).join('');
}
function testCardHTML(k, { compact = false, locked = false } = {}) {
  const T = TESTS[k];
  const a = state.tests[k];
  const ans = (v, l) => `<button class="seg-btn ${a === v ? 'on ' + v : ''}" role="radio" aria-checked="${a === v}" data-test="${k}" data-ans="${v}">${l}</button>`;
  return `<div class="test-card ${a ? 'answered' : ''}" id="test-${k}">
    <div class="test-top"><div><b>${esc(T.name)}</b><small>checks for ${esc(T.for)}</small></div>${locked ? '' : `<button class="ex-btn small" data-show="${k}">${ICON_PLAY}Show me</button>`}</div>
    ${locked ? `<p class="test-caution">Not advised right now: this test loads the area, and you've described an injury or severe pain. Get it checked first.</p>` : `
    ${compact ? '' : `<p>${esc(T.how)}</p>`}
    <p class="test-pos"><b>Positive if:</b> ${esc(T.positive)}</p>
    ${T.accuracy ? `<p class="test-acc"><b>How reliable:</b> ${esc(T.accuracy)}</p>` : ''}
    ${compact ? '' : srcHTML(TEST_SOURCES[k], 'Source')}
    ${T.caution ? `<p class="test-caution">${esc(T.caution)}</p>` : ''}
    <div class="seg-row"><span id="q-${k}">Did it reproduce your symptoms?</span><div class="seg-group" role="radiogroup" aria-labelledby="q-${k}">${ans('yes', 'Yes')}${ans('no', 'No')}${ans('unsure', 'Not sure')}</div></div>`}
  </div>`;
}
function redFlagChecklistHTML(regionFlags = []) {
  const any = RED_FLAG_CHECKS.some((f) => state.redFlags[f.key]);
  return `<details class="rf-check ${any ? 'alert' : ''}" ${any || !Object.keys(state.redFlags).length ? 'open' : ''}>
    <summary><b>${any ? 'You ticked a warning sign' : 'Any of these right now?'}</b><small>${any ? 'Please get seen today' : 'Quick safety check first'}</small></summary>
    <div class="rf-list">${RED_FLAG_CHECKS.map((f) => `<label class="rf-item"><input type="checkbox" data-rf="${f.key}" ${state.redFlags[f.key] ? 'checked' : ''}><span>${esc(f.label)}</span></label>`).join('')}</div>
    ${regionFlags.length ? `<p class="rf-region"><b>For this area, also see a clinician soon if:</b> ${regionFlags.map(esc).join('; ')}.</p>` : ''}
    ${any ? `<p class="rf-alert">One or more warning signs are ticked. These can be emergencies — contact urgent care or emergency services now rather than using this tool further.</p>` : `<button class="btn tiny ghost" data-rf-none>None of these</button>`}
    ${srcHTML(RED_FLAG_SOURCES, 'Sources')}
  </details>`;
}
function bindCommon() {
  info.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => selectPin(+b.dataset.pin)));
  info.querySelectorAll('[data-unpin]').forEach((b) => b.addEventListener('click', () => { removePin(+b.dataset.unpin); renderInfo({ keepScroll: true }); }));
  info.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => showTest(b.dataset.show)));
  info.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => answerTest(b.dataset.test, b.dataset.ans)));
  info.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => selectRegion(b.dataset.region)));
  info.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => startExercise(b.dataset.ex)));
  info.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', openReview));
  info.querySelectorAll('[data-rf]').forEach((c) => c.addEventListener('change', () => { state.redFlags[c.dataset.rf] = c.checked; save(); renderInfo({ keepScroll: true }); }));
  info.querySelectorAll('[data-rf-none]').forEach((b) => b.addEventListener('click', () => { RED_FLAG_CHECKS.forEach((f) => { state.redFlags[f.key] = false; }); save(); renderInfo({ keepScroll: true }); toast('Noted: no warning signs today'); }));
  info.querySelectorAll('[data-open-test]').forEach((b) => b.addEventListener('click', () => { state.openTest = state.openTest === b.dataset.openTest ? null : b.dataset.openTest; renderInfo({ keepScroll: true }); }));
  info.querySelectorAll('[data-feedback]').forEach((b) => b.addEventListener('click', () => window.open(issueURL(`[${b.dataset.feedback}] correction`, `Condition or test id: ${b.dataset.feedback}\n\nWhat is wrong:\n\nWhat it should say (with a source if possible):\n`), '_blank', 'noopener')));
  const back = info.querySelector('#backBtn');
  if (back) back.addEventListener('click', goBack);
  const close = info.querySelector('#closePanel');
  if (close) close.addEventListener('click', () => clearSelection());
}

// Record which control had focus so a re-render doesn't throw the user back to the top.
function focusKeyOf(el) {
  if (!el || !info.contains(el)) return null;
  for (const a of ['data-test', 'data-sym', 'data-finger', 'data-pin', 'data-unpin', 'data-rf', 'data-show', 'data-open-test', 'data-onset', 'data-hand-sel', 'data-jump']) {
    if (el.hasAttribute(a)) return `[${a}="${el.getAttribute(a)}"]` + (el.hasAttribute('data-ans') ? `[data-ans="${el.getAttribute('data-ans')}"]` : '');
  }
  if (el.id) return '#' + el.id;
  return null;
}
function renderInfo({ keepScroll = false, focusTitle = false } = {}) {
  const prevScroll = keepScroll && info.querySelector('.info-scroll') ? info.querySelector('.info-scroll').scrollTop : 0;
  const fk = focusKeyOf(document.activeElement);
  info.classList.add('open');
  info.classList.toggle('has-sel', state.panel !== 'home');
  if (state.panel === 'analysis') renderAnalysis();
  else if (state.panel === 'spot' && state.selection) renderSpot();
  else renderHome();
  bindCommon();
  if (keepScroll) info.querySelector('.info-scroll').scrollTop = prevScroll;
  if (focusTitle) { const t = info.querySelector('#infoTitle'); if (t) t.focus({ preventScroll: true }); }
  else if (fk) { let el = null; try { el = info.querySelector(fk); } catch { el = null; } if (el) el.focus({ preventScroll: true }); }
  updateSceneDescription();
  requestAnimationFrame(resize);
}

function renderHome() {
  state.panel = 'home';
  const hasPins = state.pins.length > 0;
  let seen = false;
  try { seen = !!localStorage.getItem('hpe-seen'); } catch { seen = true; }
  info.innerHTML = `
    <div class="info-scroll">
      ${hasPins ? `<div class="map-card"><div class="eyebrow">My pain map</div><div class="pin-list">${pinRowsHTML()}</div><button class="btn primary wide" id="goAnalysis">See what might fit →</button></div>` : ''}
      ${!seen && !hasPins ? `<div class="welcome"><button class="icon-btn small welcome-x" id="welcomeX" aria-label="Dismiss">${ICON_X}</button><b>Welcome.</b> This shows what's under the skin where your hand hurts, what commonly causes pain there, and what usually helps. It's education, not a diagnosis. <button class="link" id="fullGuide">Full guide</button></div>` : ''}
      <div class="eyebrow">${hasPins ? 'Add another spot' : 'Start here'}</div>
      <h2 class="title" id="infoTitle" tabindex="-1">Where does it hurt?</h2>
      <ol class="steps">
        <li><b>Tap where it hurts</b> — on the 3D hand, or pick an area below.</li>
        <li><b>Say how much it hurts</b> and what it feels like.</li>
        <li><b>Add any other sore spots</b>, then see what might fit.</li>
      </ol>
      <p class="micro">Have a webcam? You can <button class="link" id="camLink">point at the sore spot on your own hand</button> instead.</p>
      <div class="hand-row"><span>Which hand?</span><div class="seg-group" role="radiogroup" aria-label="Which hand"><button class="seg-btn ${!state.mirror ? 'on' : ''}" role="radio" aria-checked="${!state.mirror}" data-hand-sel="Right">Right</button><button class="seg-btn ${state.mirror ? 'on' : ''}" role="radio" aria-checked="${state.mirror}" data-hand-sel="Left">Left</button></div><label class="toggle small"><input type="checkbox" id="bothHands" ${state.bothHands ? 'checked' : ''}><span class="sw"></span>Both hands affected</label></div>
      ${QUICK_GROUPS.map((g) => `<div class="quick"><h4>${g.label}</h4><div class="chips">${g.items.map(([k, l]) => `<button class="chip" data-region="${k}">${l}</button>`).join('')}</div></div>`).join('')}
      <div class="tipbox"><b>Curious what's under the skin?</b> Slide <b>See inside</b> on the left — the hand peels down to the bones. <b>Tingling or numbness?</b> Turn on the <b>Nerve map</b> to see which nerve supplies each patch of skin.</div>
      <p class="disclaimer">For education only — not a diagnosis. If pain lasts more than 1–2 weeks, wakes you at night, or follows an injury, see a clinician (GP, physiotherapist or hand therapist). ${REVIEW_NOTE}</p>
    </div>`;
  const go = info.querySelector('#goAnalysis');
  if (go) go.addEventListener('click', () => { setPanel('analysis'); renderInfo({ focusTitle: true }); });
  const wx = info.querySelector('#welcomeX');
  if (wx) wx.addEventListener('click', () => { try { localStorage.setItem('hpe-seen', '1'); } catch { /* ignore */ } renderInfo(); });
  const fg = info.querySelector('#fullGuide');
  if (fg) fg.addEventListener('click', () => $('#helpDlg').showModal());
  info.querySelector('#camLink').addEventListener('click', () => { if (!state.tracking) toggleCamera(); });
  info.querySelectorAll('[data-hand-sel]').forEach((b) => b.addEventListener('click', () => { setHand(b.dataset.handSel === 'Left'); renderInfo({ keepScroll: true }); }));
  info.querySelector('#bothHands').addEventListener('change', (e) => { state.bothHands = e.target.checked; save(); });
}

function renderSpot() {
  const sel = state.selection;
  const R = REGIONS[sel.region];
  const finger = R.perFinger ? FINGERS.find((f) => f.key === sel.finger) : null;
  const acute = spotIsAcuteInjury(sel);
  const tests = Object.keys(TESTS).filter((k) => TESTS[k].regions.includes(sel.region));
  const nerve = sel.territory ? NERVES[sel.territory] : null;
  const palmSkin = ['palmCenter', 'thenar'].includes(sel.region) && sel.territory === 'median';
  const nerveNote = nerve ? (palmSkin
    ? `Skin here is supplied by a branch of the <b>median nerve</b> that bypasses the carpal tunnel — tingling here is <b>not</b> typical of carpal tunnel syndrome.`
    : `Skin here is supplied by the <b>${nerve.label.toLowerCase()}</b>. Tingling here points to that nerve.`) : '';
  const showRF = sel.symptoms.some((t) => ['injury', 'swelling', 'cold', 'redhot', 'wound', 'cantmove'].includes(t)) || sel.pain >= 8;
  const exBlocked = acute && R.causes.some((c) => c.noExercise);
  const n = state.pins.length;
  info.innerHTML = `
    ${headHTML({ eyebrow: `<span class="pulse"></span>${handName()} hand${finger ? ' · ' + finger.label : ''}`, title: R.title, back: 'Where does it hurt?' })}
    <div class="info-scroll">
      <p class="lead">${esc(R.blurb)}</p>
      ${R.perFinger ? `<div class="finger-switch" role="radiogroup" aria-label="Which finger">${FINGERS.map((f) => `<button class="chip small ${f.key === sel.finger ? 'active' : ''}" role="radio" aria-checked="${f.key === sel.finger}" data-finger="${f.key}">${f.label.replace(' finger', '')}</button>`).join('')}</div>` : ''}
      ${showRF ? redFlagChecklistHTML(R.redFlags) : ''}
      <h3 id="symHead">What does it feel like? <small>sorts the causes below</small></h3>
      <div class="chips symptoms" role="group" aria-labelledby="symHead">${SYMPTOMS.map((s) => `<button class="chip small ${sel.symptoms.includes(s.key) ? 'active' : ''}" aria-pressed="${sel.symptoms.includes(s.key)}" data-sym="${s.key}">${s.label}</button>`).join('')}</div>
      <div class="onset-row"><span id="onsetHead">How long?</span><div class="seg-group" role="radiogroup" aria-labelledby="onsetHead">${ONSETS.map((o) => `<button class="seg-btn ${sel.onset === o.key ? 'on' : ''}" role="radio" aria-checked="${sel.onset === o.key}" data-onset="${o.key}">${o.label}</button>`).join('')}</div></div>
      ${nerveNote ? `<div class="nerve-note"><i style="--c:${nerve.color}"></i>${nerveNote}</div>` : ''}
      <h3>Possible causes</h3>
      <div id="causes"></div>
      <h3>What's under here</h3>
      <div class="chips structs">${R.structures.map((s, i) => `<button class="chip struct" data-s="${i}"><i style="--c:${LAYERS[LAYER_INDEX[s.layer]].color}"></i>${esc(s.label)}</button>`).join('')}</div>
      <p class="micro">Tap a structure to peel down to it and make it glow.</p>
      ${tests.length ? `<h3>Quick self-checks</h3><div class="chips">${tests.map((k) => `<button class="chip small ${state.openTest === k ? 'active' : ''} ${state.tests[k] ? 'answered' : ''}" aria-expanded="${state.openTest === k}" data-open-test="${k}">${esc(TESTS[k].name)}${state.tests[k] ? ' ✓' : ''}</button>`).join('')}</div>${state.openTest && tests.includes(state.openTest) ? testCardHTML(state.openTest, { locked: acute && TESTS[state.openTest].loads }) : ''}` : ''}
      <h3>What usually helps</h3>
      <ul class="tips">${R.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3>Gentle movements</h3>
      ${exBlocked ? `<p class="test-caution">No exercises until a clinician has checked it. You've described an injury or severe pain here — a drooping fingertip or a joint that won't straighten must be kept splinted straight, not moved.</p>` : `
      <div class="ex-mini">${R.exercises.map((k) => `<button class="ex-btn" data-ex="${k}">${ICON_PLAY}${EXERCISE_INFO[k].label}</button>`).join('')}</div>
      <p class="micro">Watch it on the 3D hand. Move within comfort — mild stretch is fine, sharp pain is not.</p>`}
      <div class="redflags">
        <h4>See a clinician soon if…</h4>
        <ul>${R.redFlags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <details><summary>Get urgent care for…</summary><ul>${GENERAL_RED_FLAGS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>
      </div>
      <p class="disclaimer">Educational information, not a diagnosis or treatment plan. Only a clinician who examines you can tell what is causing your pain. ${REVIEW_NOTE}</p>
    </div>
    <div class="spot-footer">
      ${state.discardPrompt ? `<div class="discard"><span>Not saved yet.</span><button class="btn tiny primary" id="pinBtn2">Add to pain map</button><button class="btn tiny ghost" id="discardBtn">Discard</button></div>` : ''}
      <div class="pain-row"><label for="painRange">How much does it hurt here?</label><output id="painOut" style="--c:${painColor(sel.pain)}">${sel.painSet || sel.pinId ? sel.pain + '/10' : '—/10'}</output></div>
      <input type="range" id="painRange" min="0" max="10" step="1" value="${sel.pain}" aria-valuetext="${sel.pain} out of 10">
      <div class="spot-actions">
        ${sel.pinId
          ? `<span class="pinned">✓ Saved as spot ${state.pins.findIndex((p) => p.id === sel.pinId) + 1}</span><button class="btn tiny" id="addAnother">+ Add another sore spot</button><button class="btn tiny primary" id="toAnalysis">${isMobile() ? `Fit (${n})` : `What might fit (${n})`}</button><button class="btn tiny ghost" id="unpinBtn">Remove</button>`
          : `<button class="btn primary" id="pinBtn">＋ Add to my pain map${sel.painSet ? '' : ' at 5/10'}</button><button class="btn tiny ghost" id="toAnalysis">Save &amp; see what might fit →</button>`}
      </div>
    </div>`;
  info.querySelectorAll('[data-finger]').forEach((b) => b.addEventListener('click', () => selectRegion(sel.region, b.dataset.finger)));
  const range = info.querySelector('#painRange');
  range.addEventListener('input', () => {
    sel.pain = +range.value; sel.painSet = true;
    const out = info.querySelector('#painOut');
    out.textContent = `${sel.pain}/10`;
    out.style.setProperty('--c', painColor(sel.pain));
    range.setAttribute('aria-valuetext', `${sel.pain} out of 10`);
    const pb = info.querySelector('#pinBtn'); if (pb) pb.textContent = '＋ Add to my pain map';
    updatePinFromSelection();
  });
  info.querySelectorAll('[data-sym]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sym;
    sel.symptoms = sel.symptoms.includes(k) ? sel.symptoms.filter((x) => x !== k) : [...sel.symptoms, k];
    updatePinFromSelection();
    renderInfo({ keepScroll: true });
    const m = REGIONS[sel.region].causes.filter((c) => c.tags.some((t) => sel.symptoms.includes(t))).length;
    announce(sel.symptoms.length ? `Causes re-ordered: ${m} match` : 'Symptoms cleared');
  }));
  info.querySelectorAll('[data-onset]').forEach((b) => b.addEventListener('click', () => { sel.onset = sel.onset === b.dataset.onset ? null : b.dataset.onset; updatePinFromSelection(); renderInfo({ keepScroll: true }); }));
  const addAndToast = () => { if (addPin()) { toast(`Saved as spot ${state.pins.length} — add any other sore areas, then "What might fit"`, 3500); state.discardPrompt = false; renderInfo({ keepScroll: true }); } };
  info.querySelector('#pinBtn')?.addEventListener('click', addAndToast);
  info.querySelector('#pinBtn2')?.addEventListener('click', addAndToast);
  info.querySelector('#discardBtn')?.addEventListener('click', () => clearSelection({ confirmDiscard: false }));
  info.querySelector('#unpinBtn')?.addEventListener('click', () => { removePin(sel.pinId); renderInfo({ keepScroll: true }); });
  info.querySelector('#addAnother')?.addEventListener('click', () => clearSelection({ confirmDiscard: false }));
  info.querySelector('#toAnalysis').addEventListener('click', () => { if (!sel.pinId && !addPin()) return; setPanel('analysis'); renderInfo({ focusTitle: true }); });
  info.querySelectorAll('.struct').forEach((b) => b.addEventListener('click', () => revealStructure(R.structures[+b.dataset.s], sel.finger)));
  renderCauses();
}

function renderCauses() {
  const sel = state.selection;
  const R = REGIONS[sel.region];
  const sym = new Set(sel.symptoms);
  const scored = R.causes.filter((c) => causeApplies(c, sel)).map((c, i) => {
    const m = c.tags.filter((t) => sym.has(t)).length;
    const info = conditionInfo(c.id);
    return { c, i, m, urgent: info.urgent, score: m * 3 + (c.common ? 1 : 0) + (info.urgent === 'now' && m ? 2 : 0) - i * 0.01 };
  });
  if (sym.size) scored.sort((a, b) => b.score - a.score);
  info.querySelector('#causes').innerHTML = scored.map(({ c, m, urgent }, k) => `
    <details class="cause ${sym.size && m === 0 && !urgent ? 'dim' : ''} ${urgent ? 'urgent-' + urgent : ''}" ${k === 0 ? 'open' : ''}>
      <summary><span class="cname">${esc(c.name)}</span><span class="badges">${urgent ? `<span class="badge ${urgent === 'now' ? 'now' : 'soon'}">${urgent === 'now' ? 'Emergency if it fits' : 'Needs prompt care'}</span>` : ''}${m ? `<span class="badge match">${m} match${m > 1 ? 'es' : ''}</span>` : ''}${c.common ? '<span class="badge">Common</span>' : ''}</span></summary>
      <p>${esc(c.desc)}</p>
      <p class="helps"><b>What helps:</b> ${esc(c.helps)}</p>
      ${srcHTML(CONDITION_SOURCES[c.id])}
      <button class="link feedback" data-feedback="${c.id}">Something wrong here?</button>
    </details>`).join('');
}

function renderAnalysis() {
  const hand = handName();
  const handsPresent = [...new Set(state.pins.map((p) => p.hand || 'Right'))];
  const scope = handsPresent.length > 1 ? { hand } : {};
  const results = analyze(state.pins, state.tests, { ...scope, bothHands: state.bothHands });
  const dm = dontMiss(state.pins, scope);
  const ev = evidenceSummary(state.pins, state.tests, scope);
  const hasData = state.pins.length || Object.keys(state.tests).length;
  const anyRF = RED_FLAG_CHECKS.some((f) => state.redFlags[f.key]);
  const suggested = [];
  results.slice(0, 5).forEach((r) => r.tests.forEach((k) => { if (!suggested.includes(k)) suggested.push(k); }));
  state.pins.forEach((p) => Object.keys(TESTS).forEach((k) => { if (TESTS[k].regions.includes(p.region) && !suggested.includes(k)) suggested.push(k); }));
  Object.keys(state.tests).forEach((k) => { if (!suggested.includes(k)) suggested.push(k); });
  const acuteAny = state.pins.some(spotIsAcuteInjury);
  const numb = state.pins.filter((p) => p.symptoms.includes('numb'));
  const numbNerves = [...new Set(numb.map((p) => p.territory).filter(Boolean))];
  const unsaved = state.selection && !state.selection.pinId;
  const back = state.prevPanel === 'spot' && state.selection ? `Back to ${spotTitle(state.selection)}` : 'Where does it hurt?';
  info.innerHTML = `
    ${headHTML({ eyebrow: `My pain map · ${state.pins.length} spot${state.pins.length === 1 ? '' : 's'}${handsPresent.length > 1 ? ` · showing ${hand.toLowerCase()} hand` : ''}`, title: 'What might fit', back })}
    <div class="info-scroll">
      ${unsaved ? `<div class="map-card"><b>You picked ${esc(spotTitle(state.selection))}</b> but haven't saved it. <button class="btn tiny primary" id="saveUnsaved">Add it to my pain map</button></div>` : ''}
      ${!hasData && !unsaved ? `
        <p class="lead">Your pain map is empty. Pick a spot on the hand (or point at it with the webcam), set how much it hurts and what it feels like, then tap <b>Add to my pain map</b>. Add every sore area — patterns across spots are what make the picture clearer.</p>
        <div class="tipbox">Numbness? Mark each numb spot with <b>Numb / tingling</b> — the map checks which nerve those areas share.</div>` : ''}
      ${hasData ? `
        ${redFlagChecklistHTML()}
        ${handsPresent.length > 1 ? `<div class="hand-row"><span>Showing</span><div class="seg-group" role="radiogroup" aria-label="Which hand"><button class="seg-btn ${hand === 'Right' ? 'on' : ''}" role="radio" aria-checked="${hand === 'Right'}" data-hand-sel="Right">Right</button><button class="seg-btn ${hand === 'Left' ? 'on' : ''}" role="radio" aria-checked="${hand === 'Left'}" data-hand-sel="Left">Left</button></div></div>` : ''}
        <div class="pin-list">${pinRowsHTML(handsPresent.length > 1 ? hand : null)}</div>
        ${numbNerves.length ? `<div class="nerve-note wide">${numbNerves.map((nv) => `<i style="--c:${NERVES[nv].color}"></i>`).join('')}Your numb spots are in the <b>${numbNerves.map((nv) => NERVES[nv].label.toLowerCase()).join(' and ')}</b> area${numbNerves.length > 1 ? 's' : ''}.${numbNerves.length > 1 ? ' Numbness across more than one nerve\'s area can come from the neck or a whole-body cause — worth telling a clinician.' : ''} <button class="link" id="showNerves">Show nerve map</button></div>` : ''}
        ${dm.length ? `<div class="dont-miss"><h3>Don't miss</h3><p class="micro">Shown because of symptoms you ticked, regardless of rank.</p>${dm.map((u) => `<div class="dm-card ${u.urgent}"><b>${esc(u.name)}</b><span class="badge ${u.urgent}">${u.urgent === 'now' ? 'Same-day / emergency' : 'Needs prompt care'}</span><small>Matches: ${esc(u.matched.join(', '))}</small>${u.helps ? `<p>${esc(u.helps)}</p>` : ''}</div>`).join('')}</div>` : ''}
        <div class="evidence ${ev.thin ? 'thin' : ''}"><b>${esc(ev.text)}</b>${ev.hint ? ` ${esc(ev.hint)}` : ''}</div>
        <h3>Conditions that could fit</h3>
        ${results.length ? results.slice(0, 6).map((r) => {
          const tier = fitTier(r);
          return `
          <div class="fit-card ${r.urgent ? 'urgent-' + r.urgent : ''}">
            <div class="fit-top"><b>${esc(r.name)}</b><span class="badge ${tier === 'strong' ? 'match' : ''}">${fitLabel(r)}</span></div>
            ${tier === 'location' ? '' : `<div class="fit-bar"><i style="width:${Math.round(r.rel * 100)}%"></i></div>`}
            <ul class="fit-why">${r.reasons.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            ${r.note ? `<p class="fit-note">${esc(r.note)}</p>` : ''}
            ${r.helps ? `<p class="helps"><b>What helps:</b> ${esc(r.helps)}</p>` : ''}
            ${srcHTML(r.sources)}
            ${r.urgent ? `<p class="test-caution">${r.urgent === 'now' ? 'If this matches, it needs same-day or emergency care.' : 'If this matches, it needs prompt medical attention.'}</p>` : ''}
            ${r.tests.length ? `<div class="fit-tests">${r.tests.map((k) => `<button class="chip small" data-jump="${k}">Check: ${esc(TESTS[k].name)}</button>`).join('')}</div>` : ''}
            <button class="link feedback" data-feedback="${r.id}">Something wrong here?</button>
          </div>`;
        }).join('') : '<p class="lead">Nothing stands out yet — add a pain level and symptoms to your spots.</p>'}
        ${suggested.length ? `<h3 id="selfChecks">Self-checks to narrow it down</h3>${acuteAny ? '<p class="micro">Tests that load an injured area are hidden because you described an injury or severe pain.</p>' : ''}${suggested.slice(0, 6).map((k) => testCardHTML(k, { locked: acuteAny && TESTS[k].loads })).join('')}` : ''}
        <div class="row between actions">
          <button class="btn" id="printSummary">Print / save PDF</button>
          <button class="btn" id="copySummary">Copy summary</button>
          <button class="btn tiny ghost" id="exportBtn">Export</button>
          <label class="btn tiny ghost file-btn">Import<input type="file" id="importFile" accept="application/json" hidden></label>
          <button class="btn tiny ghost" id="clearMap">Clear</button>
        </div>
        <details class="summary-preview"><summary>Preview the summary</summary><textarea id="summaryBox" readonly rows="10"></textarea></details>
      ` : ''}
      <div class="redflags">
        <h4 class="urgent">Get urgent care for</h4>
        <ul>${GENERAL_RED_FLAGS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <p class="disclaimer">This ranks common conditions by how well they match what you entered. It is not a diagnosis — several conditions often overlap, and a clinician's examination matters more than any pattern. ${REVIEW_NOTE}</p>
    </div>`;
  const summaryFor = () => summaryText(state.pins, state.tests, results, hand, { redFlags: state.redFlags, dontMiss: dm, bothHands: state.bothHands });
  const box = info.querySelector('#summaryBox'); if (box) box.value = summaryFor();
  info.querySelector('#saveUnsaved')?.addEventListener('click', () => { if (addPin()) renderInfo({ keepScroll: true }); });
  info.querySelector('#showNerves')?.addEventListener('click', () => setNerveMap(true));
  info.querySelectorAll('[data-hand-sel]').forEach((b) => b.addEventListener('click', () => { setHand(b.dataset.handSel === 'Left', { lock: false, quiet: true }); renderInfo({ keepScroll: true }); }));
  info.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => { const el = info.querySelector('#test-' + b.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  info.querySelector('#copySummary')?.addEventListener('click', async () => {
    const text = summaryFor();
    try { await navigator.clipboard.writeText(text); toast('Summary copied — paste it into a note or message'); } catch { const d = info.querySelector('.summary-preview'); d.open = true; box.focus(); box.select(); toast('Select all and copy'); }
  });
  info.querySelector('#printSummary')?.addEventListener('click', () => printSummary(results, dm, hand));
  info.querySelector('#exportBtn')?.addEventListener('click', exportJSON);
  info.querySelector('#importFile')?.addEventListener('change', (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); });
  info.querySelector('#clearMap')?.addEventListener('click', () => {
    const b = info.querySelector('#clearMap');
    if (b.dataset.armed) { state.pins = []; state.tests = {}; state.redFlags = {}; if (state.selection) state.selection.pinId = null; save(); syncPinUI(); renderInfo({ focusTitle: true }); return; }
    b.dataset.armed = '1'; b.textContent = 'Clear everything? Tap again'; b.classList.add('danger');
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Clear'; b.classList.remove('danger'); } }, 4000);
  });
  if (anyRF) announce('Warning sign ticked. Please seek urgent care.');
}

// Printable summary (opens the browser print dialog; "save as PDF" is a printer option everywhere)
function printSummary(results, dm, hand) {
  const d = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const flags = RED_FLAG_CHECKS.filter((f) => state.redFlags[f.key]);
  const pins = state.pins;
  const html = `
    <h1>Hand pain summary</h1>
    <p class="meta">${esc(d)} · Hand: ${pins.length && [...new Set(pins.map((p) => p.hand))].length > 1 ? 'both (see each spot)' : (pins[0] && pins[0].hand) || hand}${state.bothHands ? ' · both hands affected' : ''} · Hand Pain Explorer v${APP_VERSION}</p>
    <h2>Warning signs</h2>
    <p>${Object.keys(state.redFlags).length ? (flags.length ? `<b>Reported:</b> ${flags.map((f) => esc(f.label)).join('; ')}` : 'None reported on this date') : 'Not asked / not answered'}</p>
    <h2>Where it hurts</h2>
    <ol>${pins.map((p) => `<li><b>${esc(spotTitle(p))}</b> (${p.hand}) — ${p.pain}/10${p.symptoms.length ? ' — ' + p.symptoms.map((t) => symLabel[t].toLowerCase()).join(', ') : ''}${p.onset ? ' — ' + onsetLabel[p.onset].toLowerCase() : ''}${p.territory ? ' — ' + NERVES[p.territory].label.toLowerCase() + ' skin area' : ''}${p.history && p.history.length > 1 ? ` — trend: ${p.history.map((h) => h.pain).join(' → ')} over ${p.history.length} check-ins since ${new Date(p.history[0].t).toLocaleDateString()}` : ''}</li>`).join('')}</ol>
    ${Object.keys(state.tests).length ? `<h2>Self-checks</h2><ul>${Object.entries(state.tests).map(([k, a]) => `<li><b>${esc(TESTS[k].name)}</b>: ${a === 'yes' ? 'reproduced symptoms' : a === 'no' ? 'negative' : 'not sure'}. <i>${esc(TESTS[k].accuracy || '')}</i></li>`).join('')}</ul>` : ''}
    ${dm.length ? `<h2>Possibilities not to miss</h2><ul>${dm.map((u) => `<li><b>${esc(u.name)}</b> — ${u.urgent === 'now' ? 'same-day / emergency' : 'prompt'} assessment advised (matched: ${esc(u.matched.join(', '))})</li>`).join('')}</ul>` : ''}
    <h2>Areas to discuss</h2>
    <p class="meta">An educational ranking of common conditions against the entered symptoms. Not a diagnosis.</p>
    <ol>${results.slice(0, 6).map((r) => `<li><b>${esc(r.name)}</b> — ${fitLabel(r).toLowerCase()}<ul>${r.reasons.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${r.sources.length ? `<small>Sources: ${r.sources.map((s) => `${esc(s.org)}: ${esc(s.title)} (${esc(s.url)})`).join('; ')}</small>` : ''}</li>`).join('')}</ol>
    <p class="meta">Made with Hand Pain Explorer (github.com/TarunT27/hand-pain-explorer). Content checked against NHS, AAOS OrthoInfo and StatPearls on ${esc(CONTENT_REVIEW.date)}; not yet reviewed by a licensed clinician. It cannot examine the hand.</p>`;
  const sheet = $('#printSheet');
  sheet.innerHTML = html;
  window.print();
}

// Structure highlight
let highlight = { meshes: [], until: 0 };
function revealStructure(s, finger) {
  const idx = LAYER_INDEX[s.layer];
  state.hidden[idx] = false;
  setPeel(idx);
  const meshes = pickables.filter((m) => s.tags.includes(m.userData.tag) && (!finger || !m.userData.finger || m.userData.finger === finger));
  highlight.meshes.forEach((m) => { m.material.userData.uHi.value = 0; });
  highlight = { meshes, until: nowS() + 3.8 };
  toast(`${s.label} — ${LAYERS[idx].label.toLowerCase()} layer`);
}

// ---------------------------------------------------------------- pointer interaction
const tooltip = $('#tooltip');
let mouse = null, mouseDirty = false, down = null, hovered = null, touchTipTimer = 0;
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; mouse = { x: e.clientX, y: e.clientY }; mouseDirty = true; state.lastInteract = performance.now(); });
canvas.addEventListener('pointerleave', () => { mouse = null; mouseDirty = true; });
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType === 'touch' }; state.lastInteract = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const slop = down.touch ? 14 : 6;
  if (moved < slop && performance.now() - down.t < 800) {
    const hit = pick(e.clientX, e.clientY);
    if (hit) {
      if (down.touch && hit.object !== skin.mesh) { showTooltip(hit, e.clientX, e.clientY); clearTimeout(touchTipTimer); touchTipTimer = setTimeout(() => { tooltip.hidden = true; }, 2500); }
      selectPoint(hit.point);
    }
  }
  down = null;
});
function showTooltip(hit, x, y) {
  const a = classify(hit.point);
  const ud = hit.object.userData;
  const layerIdx = LAYER_INDEX[ud.layer] ?? 0;
  const nerve = state.nerveMap && hit.object === skin.mesh ? skin.territoryAt(hit.point) : null;
  tooltip.innerHTML = `<div class="tt-name"><i style="--c:${LAYERS[layerIdx].color}"></i>${esc(ud.name)}</div>${ud.desc ? `<div class="tt-desc">${esc(ud.desc)}</div>` : ''}${nerve ? `<div class="tt-desc">Sensation: <b>${NERVES[nerve].label}</b></div>` : ''}${a ? `<div class="tt-area">Area: ${esc(regionTitle(a))} · click to explore</div>` : ''}`;
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let tx = x + 16, ty = y + 16;
  if (tx + tw > window.innerWidth - 8) tx = Math.max(8, x - tw - 16);
  if (ty + th > window.innerHeight - 8) ty = Math.max(8, y - th - 16);
  tooltip.style.transform = `translate(${tx}px, ${ty}px)`;
}
function updateHover() {
  if (!mouseDirty) return;
  mouseDirty = false;
  if (hovered && !highlight.meshes.includes(hovered)) hovered.material.userData.uHi.value = 0;
  hovered = null;
  if (!mouse || down) { tooltip.hidden = true; if (state.mode !== 'point') G.uHover.value.w = 0; canvas.style.cursor = ''; return; }
  const hit = pick(mouse.x, mouse.y);
  if (!hit) { tooltip.hidden = true; if (state.mode !== 'point') G.uHover.value.w = 0; canvas.style.cursor = ''; return; }
  canvas.style.cursor = 'pointer';
  showTooltip(hit, mouse.x, mouse.y);
  if (state.mode !== 'point') G.uHover.value.set(hit.point.x, hit.point.y, hit.point.z, 0.9);
  if (hit.object !== skin.mesh) {
    hovered = hit.object;
    if (!highlight.meshes.includes(hovered)) hovered.material.userData.uHi.value = 0.3;
  }
}

// ---------------------------------------------------------------- webcam & gestures
const tracker = new Tracker();
const handTracks = new HandTracks();
const video = $('#video');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');
const track = {
  lost: 0, lastMainId: null, peel: null, peelArm: 0, lastPointT: -10,
  calib: { agree: 0, disagree: 0, done: false },
  dwell: { key: null, t0: 0, point: new THREE.Vector3(), cooldownKey: null },
  fps: { n: 0, t0: 0, value: 0 }, debugT: 0, guideT: 0,
};
const DWELL_SECONDS = 1.0;
const lmTmp = [];

async function toggleCamera() {
  if (state.tracking) { stopCamera(); return; }
  const btn = $('#btnCam');
  btn.disabled = true;
  $('#camDock').hidden = false;
  try {
    await tracker.start(video, (s) => { $('#camStatus').textContent = s; });
    state.tracking = true;
    handTracks.reset();
    btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Stop webcam');
    btn.querySelector('span').textContent = 'Stop webcam';
    stopExercise();
    $('#camStatus').textContent = 'Raise a hand into view';
    video.addEventListener('loadedmetadata', () => { $('.cam-view').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`; }, { once: true });
    if (coarse) toast('Prop your phone up about an arm\'s length away so both hands fit in view', 4500);
  } catch (err) {
    console.error(err);
    tracker.stop();
    $('#camDock').hidden = true;
    const msg = err && err.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar and try again.' : 'Could not start the webcam or hand tracking. ' + (err && err.message ? err.message : '');
    toast(msg, 5000);
  }
  btn.disabled = false;
  requestAnimationFrame(resize);
}
function stopCamera() {
  tracker.stop();
  state.tracking = false;
  state.mode = 'none';
  $('#camDock').hidden = true;
  const btn = $('#btnCam');
  btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Use webcam');
  btn.querySelector('span').textContent = 'Use webcam';
  if (!state.handLocked) state.mirror = false;
  G.uHover.value.w = 0;
  $('#dwell').hidden = true;
  setGuide(null);
}
$('#btnCam').addEventListener('click', toggleCamera);
$('#followRot').addEventListener('change', (e) => { state.followRot = e.target.checked; });
$('#btnSwap').addEventListener('click', () => { state.swap = !state.swap; track.calib.done = true; toast('Left/right swapped'); });

function setGuide(g) {
  document.querySelectorAll('.gesture-guide li').forEach((li) => li.classList.toggle('active', li.dataset.g === g));
}

function segFrame(a, b) {
  if (a === 21) return rig.fore;
  if (a >= 1 && a <= 3 && b === a + 1) return rig.frames['T' + a];
  if (a >= 5 && b === a + 1 && (a - 5) % 4 < 3) return rig.frames[FINGERS[Math.floor((a - 5) / 4)].code + (((a - 5) % 4) + 1)];
  return rig.wrist;
}

function modelPointFromMap(m, facing) {
  const lm = rig.landmarks(lmTmp);
  const base = lm[m.a].clone().lerp(lm[m.b], m.t);
  const frame = segFrame(m.a, m.b);
  const e = frame.matrixWorld;
  const radial = new THREE.Vector3().setFromMatrixColumn(e, 0).normalize();
  const palmar = new THREE.Vector3().setFromMatrixColumn(e, 2).normalize();
  const isFinger = frame !== rig.wrist && frame !== rig.fore;
  const lim = isFinger ? 0.75 : 2.4;
  const bias = m.a === 0 && m.b === 17 ? -0.8 : 0;
  base.addScaledVector(radial, clamp(m.lateralCm * (isFinger ? 0.8 : 1) + bias, -lim, lim));
  const side = facing ? palmar : palmar.negate();
  const origin = base.clone().addScaledVector(side, 8);
  const t = skin.raycast(origin, side.clone().negate());
  return t !== null ? origin.addScaledVector(side, -t) : base.addScaledVector(side, 1);
}

function handWidth(h, aspect) {
  return Math.hypot((h.lm[5].x - h.lm[17].x) * aspect, h.lm[5].y - h.lm[17].y) || 0.08;
}
// On-screen guidance about framing: too small, too close to an edge, low confidence
function framingHint(hands, aspect) {
  if (!hands.length) return null;
  const h = hands[0];
  const w = handWidth(h, aspect);
  if (w < 0.09) return 'Move closer — your hand is small in the frame';
  if (w > 0.5) return 'Move back a little — your hand fills the frame';
  const xs = h.lm.map((p) => p.x), ys = h.lm.map((p) => p.y);
  if (Math.min(...xs) < 0.02 || Math.max(...xs) > 0.98 || Math.min(...ys) < 0.02 || Math.max(...ys) > 0.98) return 'Keep your whole hand inside the picture';
  if (h.score < 0.7) return 'Tracking is unsure — try more light, or a plainer background';
  return null;
}

function handleTracking(res, dt, t = nowS()) {
  const smoothed = handTracks.update(res.hands, t);
  const describe = () => smoothed.map((h) => describeHand(h, state.swap, h.track.state));
  let hands = describe();

  // Self-calibrate left/right once: if MediaPipe's labels keep contradicting
  // the direction the fingers curl, flip the convention.
  const cal = track.calib;
  if (!cal.done) {
    for (const h of hands) {
      if (Math.abs(h.chirality) < 2.5) continue;
      if ((h.chirality > 0) === h.isRight) cal.agree++; else cal.disagree++;
    }
    if (cal.agree + cal.disagree >= 24) {
      cal.done = true;
      if (cal.disagree > cal.agree * 3) {
        state.swap = !state.swap;
        hands = describe();
        toast('Adjusted left/right detection for your camera');
      }
    }
  }

  const info = {};
  let mode = 'none';
  let main = null, pointer = null, target = null;
  const bothPinch = hands.length === 2 && hands[0].pinching && hands[1].pinching;
  if (bothPinch) {
    if (!track.peelArm) track.peelArm = t;
  } else track.peelArm = 0;

  if (bothPinch && t - track.peelArm > 0.15) {
    mode = 'peel';
  } else if (hands.length === 2) {
    const [a, b] = hands;
    if (a.pointing !== b.pointing) pointer = a.pointing ? a : b;
    else if (a.pointing && b.pointing) {
      const da = Math.hypot(a.lm[8].x - b.center.x, a.lm[8].y - b.center.y);
      const db = Math.hypot(b.lm[8].x - a.center.x, b.lm[8].y - a.center.y);
      pointer = da < db ? a : b;
    }
    if (pointer) { target = pointer === a ? b : a; mode = 'point'; }
    else {
      mode = 'mirror';
      main = hands.find((h) => h.trackId === track.lastMainId) || hands.reduce((p, h) => (spread(h) > spread(p) ? h : p));
    }
  } else if (hands.length === 1) {
    const h = hands[0];
    // The target hand is often hidden behind the pointing finger: keep using its last position briefly.
    const recent = h.pointing && handTracks.recent([h.trackId], 0.6, t);
    if (recent) {
      pointer = h;
      target = describeHand(recent.last, state.swap, recent.state);
      info.staleTarget = true;
      mode = 'point';
    } else {
      mode = 'mirror';
      main = h;
    }
  }
  if (hands.length === 0) {
    track.lost++;
    // never carry 'point' or 'peel' across an empty frame: there is no hand to point with
    mode = track.lost > 20 || state.mode === 'peel' || state.mode === 'point' ? 'none' : state.mode;
  } else track.lost = 0;
  if (state.exercise) mode = hands.length ? 'paused' : 'none';

  // Short grace period so a flicker doesn't cancel pointing
  if (mode !== 'point' && state.mode === 'point' && t - track.lastPointT < 0.25 && !state.exercise && hands.length) {
    drawOverlay(octx, overlay.width, overlay.height, hands, {});
    return;
  }

  if (mode !== 'peel') track.peel = null;
  if (mode !== 'point') { $('#dwell').hidden = true; if (!mouse) G.uHover.value.w = 0; track.dwell.key = null; }
  state.mode = mode;

  const status = $('#camStatus');
  const hint = framingHint(hands, res.aspect);
  if (mode === 'mirror' && main) {
    track.lastMainId = main.trackId;
    const r = retarget(main, restQ, thumbBaseQ);
    lerpPose(targetPose, targetPose, r.pose, 1);
    state.mirror = r.mirror;
    if (state.followRot) pivotTarget.copy(r.quat);
    else pivotTarget.copy(viewQuat(state.view, state.mirror));
    status.textContent = hint || `Mirroring your ${main.isRight ? 'right' : 'left'} hand`;
    setGuide('mirror');
  } else if (mode === 'point' && pointer && target) {
    track.lastPointT = t;
    const r = retarget(target, restQ, thumbBaseQ);
    lerpPose(targetPose, targetPose, r.pose, 1);
    state.mirror = r.mirror;
    const facing = palmFacesCamera(target);
    pivotTarget.copy(viewQuat(facing ? 'palm' : 'back', state.mirror));
    const m = mapPointOnHand(target, pointer.lm[8], res.aspect);
    info.pointer = pointer; info.target = target; info.onHand = !!m;
    if (m) {
      rig.pivot.updateMatrixWorld(true);
      const p = modelPointFromMap(m, facing);
      const a = classify(p);
      const keyStr = a.region + ':' + (a.finger || '');
      const d = track.dwell;
      // wall-clock dwell, independent of display refresh rate
      if (!(d.key === keyStr && p.distanceTo(d.point) < 1.8)) { d.key = keyStr; d.t0 = t; d.point.copy(p); }
      const held = t - d.t0;
      if (d.cooldownKey && d.cooldownKey !== keyStr) d.cooldownKey = null;
      G.uHover.value.set(p.x, p.y, p.z, 1.25);
      const prog = d.cooldownKey === keyStr ? 1 : clamp(held / DWELL_SECONDS, 0, 1);
      info.dwell = prog;
      showDwell(p, prog, regionTitle(a));
      if (held >= DWELL_SECONDS && d.cooldownKey !== keyStr) { selectPoint(p, 'point'); d.cooldownKey = keyStr; }
      status.textContent = `Pointing at: ${regionTitle(a)} (${facing ? 'palm side' : 'back'})`;
    } else {
      $('#dwell').hidden = true;
      G.uHover.value.w = 0;
      status.textContent = 'Touch your fingertip to the spot on your other hand';
    }
    setGuide('point');
  } else if (mode === 'peel') {
    const pts = hands.map((h) => ({ x: (h.lm[4].x + h.lm[8].x) / 2, y: (h.lm[4].y + h.lm[8].y) / 2 }));
    const dist = Math.hypot((pts[0].x - pts[1].x) * res.aspect, pts[0].y - pts[1].y);
    const hw = (handWidth(hands[0], res.aspect) + handWidth(hands[1], res.aspect)) / 2;
    if (!track.peel) track.peel = { dist, peel: state.peel };
    // measured in hand-widths, with a small dead zone so starting the pinch doesn't jump
    const dW = (dist - track.peel.dist) / hw;
    const eff = Math.sign(dW) * Math.max(0, Math.abs(dW) - 0.2);
    setPeel(track.peel.peel + eff * 1.0);
    info.pinchPts = pts;
    const top = LAYERS[Math.min(4, Math.floor(state.peel + 0.001))].label;
    status.textContent = `Peeling — showing ${top.toLowerCase()} (pull apart / push together)`;
    setGuide('peel');
  } else if (mode === 'paused') {
    status.textContent = 'Movement playing — tracking paused';
    setGuide(null);
  } else {
    status.textContent = 'Raise a hand into view — good light, plain background';
    setGuide(null);
  }
  drawOverlay(octx, overlay.width, overlay.height, hands, info);
  updateDebug(hands, t);
}
function spread(h) {
  let minx = 1, maxx = 0, miny = 1, maxy = 0;
  for (const p of h.lm) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
  return (maxx - minx) * (maxy - miny);
}

// Live readout to help tune gestures ("Tracking details" in the webcam panel)
function updateDebug(hands, t) {
  const f = track.fps;
  f.n++;
  if (t - f.t0 >= 1) { f.value = f.n / (t - f.t0); f.n = 0; f.t0 = t; }
  const box = $('#camDebugBox');
  if (!box.open || t - track.debugT < 0.2) return;
  track.debugT = t;
  const lines = [`detection ${f.value.toFixed(0)} fps · ${hands.length} hand${hands.length === 1 ? '' : 's'} · mode ${state.mode} · dwell ${DWELL_SECONDS}s`];
  hands.forEach((h) => {
    lines.push(`${h.isRight ? 'R' : 'L'}#${h.trackId} conf ${h.score.toFixed(2)} · point ${h.pointing ? 'YES' : 'no'} (idx ${h.ext[0].toFixed(2)}, others ${Math.max(h.ext[1], h.ext[2], h.ext[3]).toFixed(2)})`);
    lines.push(`    pinch ${(h.pinchD * 100).toFixed(1)} cm (${h.pinchR.toFixed(2)}×palm) ${h.pinching ? 'PINCH' : ''} · curl ${h.chirality >= 0 ? '+' : ''}${h.chirality.toFixed(1)}`);
  });
  lines.push(`left/right: ${state.swap ? 'swapped' : 'as labelled'}${track.calib.done ? '' : ` (calibrating ${track.calib.agree + track.calib.disagree}/24)`}`);
  $('#camDebug').textContent = lines.join('\n');
}

const dwellEl = $('#dwell');
const dwellCircle = dwellEl.querySelector('.ring');
const _proj = new THREE.Vector3();
function screenOf(p) {
  _proj.copy(p).project(camera);
  return { x: (_proj.x * 0.5 + 0.5) * window.innerWidth, y: (-_proj.y * 0.5 + 0.5) * window.innerHeight, behind: _proj.z > 1 };
}
function showDwell(p, prog, label) {
  const s = screenOf(p);
  dwellEl.hidden = false;
  dwellEl.style.transform = `translate(${s.x - 30}px, ${s.y - 30}px)`;
  dwellCircle.style.strokeDashoffset = String(163.4 * (1 - prog));
  dwellEl.querySelector('.dwell-label').textContent = label;
}

// ---------------------------------------------------------------- toast & help
let toastTimer = 0;
function toast(msg, ms = 1900) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
$('#btnHelp').addEventListener('click', () => $('#helpDlg').showModal());
$('#reviewInfo').innerHTML = `<p><b>Last checked:</b> ${esc(CONTENT_REVIEW.date)}. ${esc(CONTENT_REVIEW.summary)}</p>
  <p>Each condition and self-check links to the pages it was checked against (${Object.keys(REFS).length} sources). <a href="about.html">How the ranking works, sources and privacy</a> · <a href="https://github.com/TarunT27/hand-pain-explorer/blob/main/CONTENT_REVIEW.md" target="_blank" rel="noopener">Review log</a>.
  Spotted something wrong? <a href="${esc(CONTENT_REVIEW.issues)}" target="_blank" rel="noopener">Report it on GitHub</a>.</p>`;
function openReview() {
  $('#helpDlg').showModal();
  $('#reviewInfo').scrollIntoView({ block: 'start' });
}
$('#helpClose').addEventListener('click', () => $('#helpDlg').close());
window.addEventListener('keydown', (e) => {
  if ($('#helpDlg').open || e.defaultPrevented) return;
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') return;
  if (e.key === 'Escape') { if (state.exercise) stopExercise(); else if (state.panel !== 'home') clearSelection(); }
  if (e.key === ']') setPeel(Math.floor(state.peel + 1.001));
  if (e.key === '[') setPeel(Math.ceil(state.peel - 1.001));
  if (document.activeElement === canvas) {
    if (e.key === '+' || e.key === '=') { camera.position.lerp(controls.target, 0.12); }
    if (e.key === '-') { camera.position.sub(controls.target).multiplyScalar(1.14).add(controls.target); }
    if (e.key === 'r' || e.key === 'R') $('#resetView').click();
  }
});
$('#resetView').addEventListener('click', () => {
  controls.target.set(0, 5.5, 0);
  camera.position.set(0, 6, 56);
  fitCamera();
  setView('palm');
});
const lt = $('#layersToggle');
lt?.addEventListener('click', () => { const open = $('#leftPanel').classList.toggle('open'); lt.setAttribute('aria-expanded', String(open)); });
reduceMotion.addEventListener('change', (e) => { state.reduceMotion = e.matches; $('#motion').checked = e.matches; G.uReduceMotion.value = e.matches ? 1 : 0; });

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Clock();
const breath = clonePose(P.relaxed);
const spotLabel = $('#spotLabel');
let lastW = 0, lastH = 0;
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _pw = new THREE.Vector3();
let lastVis = '';
let frameAcc = 0, frameN = 0, lastAdapt = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = clock.elapsedTime;
  G.uTime.value = now;

  // --- inputs (an error in tracking must never stop the render loop)
  if (state.tracking) {
    try {
      const res = tracker.detect();
      if (res) {
        if (overlay.width !== video.videoWidth) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
        handleTracking(res, dt);
      }
    } catch (err) { console.error('tracking', err); state.mode = 'none'; }
  }
  const trackingDrives = state.tracking && (state.mode === 'mirror' || state.mode === 'point' || state.mode === 'peel');

  // --- target pose
  if (state.exercise) updateExercise(dt);
  else if (!trackingDrives) lerpPose(targetPose, targetPose, P[state.preset], 1 - Math.exp(-dt * 6));
  if (!trackingDrives || state.exercise) {
    pivotTarget.copy(viewQuat(state.view, state.mirror));
    if (!state.tracking && !state.exercise && !state.reduceMotion && now * 1000 - state.lastInteract > 2500) {
      pivotTarget.multiply(_q.setFromEuler(_e.set(Math.sin(now * 0.4) * 0.04, Math.sin(now * 0.27) * 0.16, 0)));
    }
  }

  // --- smooth toward targets (landmarks are already filtered, so tracking can be snappy)
  const rate = state.exercise ? 18 : trackingDrives ? 22 : 8;
  lerpPose(curPose, curPose, targetPose, 1 - Math.exp(-dt * rate));
  let applied = curPose;
  if (!state.tracking && !state.exercise && !state.reduceMotion) {
    lerpPose(breath, curPose, curPose, 0);
    breath.fingers.forEach((f, i) => { const s = Math.sin(now * 1.1 + i * 0.6) * 0.035; f.mcp += s; f.pip += s * 1.2; f.dip += s * 0.8; });
    breath.thumb.ip += Math.sin(now * 1.1 + 2) * 0.03;
    applied = breath;
  }
  const poseChanged = rig.applyPose(applied);
  rig.pivot.scale.x = state.mirror ? -1 : 1;
  rig.pivot.quaternion.slerp(pivotTarget, 1 - Math.exp(-dt * (trackingDrives ? 16 : 4)));
  rig.pivot.updateMatrixWorld(true);
  rootInv.copy(rig.root.matrixWorld).invert();
  G.uRootInv.value.copy(rootInv);

  // --- layers
  for (let i = 0; i < LAYERS.length; i++) {
    const target = state.hidden[i] ? 1 : clamp(state.peel - i, 0, 1);
    const q = layerQ[i];
    const diff = target - q.value;
    q.value += Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.4);
  }
  const vis = LAYERS.map((_, i) => layerQ[i].value < 0.999);
  const visKey = vis.join('');
  for (const m of rig.meshes) m.visible = vis[4];
  // Tubes only need rebuilding when the skeleton actually moved
  for (const t of tubes) {
    const li = t.mesh.material.userData.layer;
    t.mesh.visible = vis[li];
    if (vis[li] && (poseChanged || !t.built)) { t.update(); t.built = true; }
  }
  if (visKey !== lastVis) { lastVis = visKey; visiblePickables = pickables.filter((m) => m.visible); }
  skin.mesh.visible = vis[0] || state.ghost;
  skin.uniforms.uGhost.value = state.ghost ? 1 : 0;
  const nm = skin.uniforms.uNerveMap;
  nm.value += ((state.nerveMap ? 1 : 0) - nm.value) * Math.min(1, dt * 6);
  skin.update();

  // --- pain map pins (only the current hand's pins are drawn on the model)
  const badges = pinLayer.children;
  let shown = 0;
  state.pins.forEach((p, i) => {
    const b = badges[i];
    const onThisHand = (p.hand || 'Right') === handName();
    if (b) b.hidden = !onThisHand;
    if (!onThisHand) return;
    spotWorld(p, 'local', _pw);
    G.uPins.value[shown].set(_pw.x, _pw.y, _pw.z, 0.25 + 0.75 * (p.pain / 10));
    shown++;
    if (b) {
      const s = screenOf(_pw);
      const half = b.offsetWidth / 2 || 11;
      b.style.transform = `translate(${s.x - half}px, ${s.y - half}px)`;
      b.hidden = s.behind;
    }
  });
  G.uPinCount.value = shown;
  for (let i = state.pins.length; i < badges.length; i++) badges[i].hidden = true;

  // --- selected spot (or self-check demo) hotspot & highlight
  const demoActive = state.demo && state.exercise;
  const hot = demoActive ? state.demo : state.panel === 'spot' ? state.selection : null;
  if (hot) {
    const w = spotWorld(hot, 'local', _pw);
    G.uHot.value.set(w.x, w.y, w.z, 1.3);
    G.uHot2.value.copy(spotWorld(hot, 'deep', new THREE.Vector3()));
    G.uHotAmt.value += (1 - G.uHotAmt.value) * Math.min(1, dt * 4);
    if (!demoActive) {
      const s = screenOf(w);
      spotLabel.hidden = false;
      const lw = spotLabel.offsetWidth || 160;
      const lx = clamp(s.x, 8, window.innerWidth - lw - 22);
      const below = s.y - 46 < 64;
      spotLabel.classList.toggle('below', below);
      spotLabel.style.transform = `translate(${lx}px, ${s.y}px)`;
      spotLabel.querySelector('span').textContent = regionTitle(hot);
    } else spotLabel.hidden = true;
  } else {
    G.uHotAmt.value += (0 - G.uHotAmt.value) * Math.min(1, dt * 5);
    if (G.uHotAmt.value < 0.01) G.uHot.value.w = 0;
    spotLabel.hidden = true;
  }
  const hk = clamp((highlight.until - nowS()) / 0.8, 0, 1);
  highlight.meshes.forEach((m) => { m.material.userData.uHi.value = hk; });
  if (hk === 0 && highlight.meshes.length) highlight.meshes = [];

  updateHover();
  controls.update();
  if (window.innerWidth !== lastW || window.innerHeight !== lastH) { lastW = window.innerWidth; lastH = window.innerHeight; resize(); }
  camera.updateMatrixWorld();
  skin.uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  renderer.render(scene, camera);

  // --- adaptive quality: if frames are slow for 2 s, lower the pixel ratio a step
  frameAcc += dt; frameN++;
  if (frameAcc >= 2) {
    const avg = frameAcc / frameN; frameAcc = 0; frameN = 0;
    if (avg > 0.028 && dprCap > 1.0 && now - lastAdapt > 4) { dprCap = Math.max(1.0, dprCap - 0.25); renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap)); lastAdapt = now; }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
try {
  load();
  syncLayerUI();
  syncPinUI();
  if (state.handLocked) setHand(state.mirror, { quiet: true });
  renderInfo();
  // Optional deep links, e.g. ?peel=2&nerves=1&view=back&region=thumbBase&pose=fist&hand=left
  const q = new URLSearchParams(location.search);
  if (q.has('peel')) setPeel(parseFloat(q.get('peel')) || 0);
  if (q.get('nerves') === '1') setNerveMap(true, true);
  if (hasOwn(VIEWS, q.get('view'))) setView(q.get('view'));
  if (q.get('hand') === 'left' || q.get('hand') === 'right') setHand(q.get('hand') === 'left', { quiet: true });
  if (PRESETS.some(([k]) => k === q.get('pose'))) { state.preset = q.get('pose'); markPreset(); }
  if (hasOwn(REGIONS, q.get('region'))) selectRegion(q.get('region'), q.get('finger') || undefined);
  if (q.get('still') === '1') state.lastInteract = Infinity;
  resize();
  fitCamera();
  frame();
  clearTimeout(loadTimer);
  setTimeout(() => $('#loading').classList.add('done'), 250);
} catch (err) {
  console.error(err);
  fatal(err && err.message ? err.message : String(err));
}

// handle for poking at the scene from the dev console
window.__hand = { rig, state, P, EX, skin, tubes, camera, controls, retarget, restQ, thumbBaseQ, selectRegion, selectPoint, selectPin, pick, classify, setPeel, setNerveMap, setHand, startExercise, showTest, mapPointOnHand, modelPointFromMap, handleTracking, handTracks, describeHand, analyze, renderInfo, addPin, THREE, version: APP_VERSION };
