import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HandRig, FINGERS, THUMB, thumbBasisQuat, clonePose, lerpPose } from './rig.js';
import { buildSoftTissues } from './soft.js';
import { Skin } from './skin.js';
import { G, LAYERS, LAYER_INDEX, layerQ, dissolveValue } from './materials.js';
import { buildPoses, buildExercises, PRESETS } from './poses.js';
import { REGIONS, SYMPTOMS, GENERAL_RED_FLAGS, EXERCISE_INFO, regionAnchors, QUICK_GROUPS, NERVES, TESTS } from './content.js';
import { analyze, fitLabel, spotTitle, summaryText } from './analysis.js';
import { Tracker, HandTracks, describeHand, retarget, modelRestQuat, palmFacesCamera, mapPointOnHand, drawOverlay } from './tracking.js';

const $ = (s) => document.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => t * t * (3 - 2 * t);
const isMobile = () => window.innerWidth < 860;
const nowS = () => performance.now() / 1000;

// ---------------------------------------------------------------- renderer
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
camera.position.set(0, 6, 56);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 5.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 14;
controls.maxDistance = 110;
controls.rotateSpeed = 0.8;

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
const pickables = [...rig.meshes, ...tubes.map((t) => t.mesh)];
const thumbBaseQ = thumbBasisQuat();
const restQ = modelRestQuat(rig.landmarksLocal());
const anchors = regionAnchors(FINGERS, THUMB).map((a) => ({ ...a, frameObj: rig.frames[a.frame], local: new THREE.Vector3(...a.p), world: new THREE.Vector3() }));
const frameKeyOf = new Map(Object.entries(rig.frames).map(([k, f]) => [f, k]));

// ---------------------------------------------------------------- state
const state = {
  peel: 0,
  hidden: LAYERS.map(() => false),
  ghost: true,
  nerveMap: false,
  preset: 'relaxed',
  view: 'palm',
  mirror: false,
  panel: 'home',          // home | spot | analysis
  selection: null,        // { region, finger, frameKey, local, deep, pain, symptoms, territory, pinId }
  pins: [],               // saved pain-map spots
  tests: {},              // self-check answers: key -> yes | no | unsure
  demo: null,             // temporary hotspot while a self-check plays
  exercise: null,
  tracking: false,
  followRot: true,
  swap: false,
  mode: 'none',
  lastInteract: 0,
};
const curPose = clonePose(P.relaxed);
const targetPose = clonePose(P.relaxed);
const pivotTarget = new THREE.Quaternion();
const VIEWS = { palm: [-0.1, -0.32, 0.02], back: [-0.1, Math.PI + 0.32, -0.02], thumb: [-0.12, -1.0, 0.05], pinky: [-0.1, 1.15, -0.05] };
function viewQuat(view, mirror) {
  const [x, y, z] = VIEWS[view] || VIEWS.palm;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, mirror ? -y : y, mirror ? -z : z));
}
pivotTarget.copy(viewQuat('palm', false));
rig.pivot.quaternion.copy(pivotTarget);

// ---------------------------------------------------------------- persistence (this browser only)
const STORE = 'hand-pain-explorer-v1';
let nextPinId = 1;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ pins: state.pins, tests: state.tests })); } catch { /* storage unavailable */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!d) return;
    state.pins = (d.pins || []).filter((p) => REGIONS[p.region] && rig.frames[p.frameKey]).slice(0, 8);
    state.tests = d.tests || {};
    nextPinId = state.pins.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  } catch { /* ignore corrupt or blocked storage */ }
}

// ---------------------------------------------------------------- layout: keep the hand centred in the free area
function freeArea() {
  const W = window.innerWidth, H = window.innerHeight;
  if (isMobile()) {
    const sheet = $('#info').classList.contains('open') ? $('#info').getBoundingClientRect().height : 0;
    return { cx: W / 2, cy: (56 + H - sheet) / 2, w: W, h: H - sheet - 56 };
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
  li.innerHTML = `<button class="layer-name" title="Reveal down to ${L.label.toLowerCase()}"><i style="--c:${L.color}"></i><span>${L.label}</span><em></em></button>
    <button class="eye" aria-label="Show or hide ${L.label}" title="Show / hide"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
  li.querySelector('.layer-name').addEventListener('click', () => { state.hidden[i] = false; setPeel(i); });
  li.querySelector('.eye').addEventListener('click', () => { state.hidden[i] = !state.hidden[i]; syncLayerUI(); });
  layerList.appendChild(li);
});
function setPeel(v) {
  state.peel = clamp(v, 0, 4);
  peelInput.value = state.peel;
  syncLayerUI();
}
peelInput.addEventListener('input', () => { state.peel = parseFloat(peelInput.value); syncLayerUI(); });
function syncLayerUI() {
  const top = Math.min(4, Math.floor(state.peel + 0.001));
  [...layerList.children].forEach((li, i) => {
    const peeled = clamp(state.peel - i, 0, 1);
    li.classList.toggle('peeled', peeled >= 0.999 || state.hidden[i]);
    li.classList.toggle('partial', peeled > 0.001 && peeled < 0.999 && !state.hidden[i]);
    li.classList.toggle('top', i === top && !state.hidden[i]);
    li.classList.toggle('off', state.hidden[i]);
    li.querySelector('em').textContent = state.hidden[i] ? 'hidden' : peeled >= 0.999 ? 'peeled' : peeled > 0.001 ? `${Math.round(peeled * 100)}%` : i === top ? 'on top' : '';
  });
  peelInput.style.setProperty('--p', (state.peel / 4) * 100 + '%');
}
$('#ghost').addEventListener('change', (e) => { state.ghost = e.target.checked; });
function setNerveMap(on) {
  state.nerveMap = on;
  $('#nerveMap').checked = on;
  $('#nerveLegend').hidden = !on;
  if (on && state.peel > 0.5) setPeel(0);
}
$('#nerveMap').addEventListener('change', (e) => setNerveMap(e.target.checked));
$('#nerveLegend').innerHTML = Object.values(NERVES).map((n) => `<div class="nl-row"><i style="--c:${n.color}"></i><div><b>${n.label}</b><small>${n.area}</small></div></div>`).join('');
const TONES = ['#f2cdb8', '#dca58c', '#c08466', '#8e5b43', '#5f3b2b'];
TONES.forEach((t, i) => {
  const b = document.createElement('button');
  b.className = 'tone' + (i === 1 ? ' active' : '');
  b.style.background = t;
  b.setAttribute('aria-label', 'Skin tone ' + (i + 1));
  b.addEventListener('click', () => { skin.setTone(t); document.querySelectorAll('.tone').forEach((x) => x.classList.toggle('active', x === b)); });
  $('#tones').appendChild(b);
});

// ---------------------------------------------------------------- UI: poses, views, exercises
PRESETS.forEach(([k, label]) => {
  const b = document.createElement('button');
  b.className = 'chip' + (k === state.preset ? ' active' : '');
  b.textContent = label;
  b.dataset.k = k;
  b.addEventListener('click', () => { stopExercise(); state.preset = k; markPreset(); if (state.tracking) toast('Pose presets apply when the webcam is off'); });
  $('#poses').appendChild(b);
});
function markPreset() { document.querySelectorAll('#poses .chip').forEach((b) => b.classList.toggle('active', b.dataset.k === state.preset && !state.exercise)); }
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  state.view = v;
  if (state.tracking && state.followRot && state.mode === 'mirror') toast('Turn off "Follow wrist rotation" to use fixed views');
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
}
Object.entries(EXERCISE_INFO).forEach(([k, info]) => {
  const b = document.createElement('button');
  b.className = 'ex-item';
  b.innerHTML = `<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span><b>${info.label}</b><small>${info.desc}</small></span>`;
  b.addEventListener('click', () => startExercise(k));
  $('#exList').appendChild(b);
});

// ---------------------------------------------------------------- exercises & self-check demos
function startExercise(k, title) {
  const frames = EX[k];
  if (!frames) return;
  state.exercise = { key: k, frames, i: 0, t: 0, loop: 0, loops: frames.loops || 2, tr: frames.tr || 0.8, from: clonePose(curPose) };
  $('#exBar').hidden = false;
  $('#exTitle').textContent = title || (EXERCISE_INFO[k] && EXERCISE_INFO[k].label) || k;
  $('#exCaption').textContent = frames[0].caption;
  markPreset();
  if (state.tracking) toast('Demo playing — tracking paused');
}
function stopExercise() {
  if (!state.exercise) return;
  state.exercise = null;
  state.demo = null;
  $('#exBar').hidden = true;
  markPreset();
}
$('#exStop').addEventListener('click', stopExercise);
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
    $('#exCaption').textContent = `${kf.caption} · ${left} s`;
  }
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
  if (spot) state.demo = spot;
  if (T.nerveMap) setNerveMap(true);
  if (!(state.tracking && state.followRot)) setView(T.view || R.view);
  startExercise(k, T.name);
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
  const hits = raycaster.intersectObjects(pickables.filter((m) => m.visible), false);
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
function spotWorld(s, which = 'local') { return v3(s[which]).applyMatrix4(rig.frames[s.frameKey].matrixWorld); }

function findPin(region, finger, world) {
  return state.pins.find((p) => p.region === region && (p.finger || null) === (finger || null) && spotWorld(p).distanceTo(world) < 1.6);
}
function select(region, finger, spot) {
  const world = spotWorld(spot);
  const pin = findPin(region, finger, world);
  state.selection = pin
    ? { region, finger, frameKey: pin.frameKey, local: v3(pin.local), deep: v3(pin.deep), pain: pin.pain, symptoms: [...pin.symptoms], territory: pin.territory, pinId: pin.id }
    : { region, finger, ...spot, pain: 5, symptoms: [], pinId: null };
  state.panel = 'spot';
  renderInfo();
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
  const R = REGIONS[region];
  const f = R.perFinger ? (finger || 'index') : undefined;
  const spot = spotForRegion(region, f);
  if (!spot) return;
  if (!(state.tracking && state.followRot)) setView(R.view);
  select(region, f, spot);
}
function selectPin(id) {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return;
  const R = REGIONS[pin.region];
  if (!(state.tracking && state.followRot)) setView(R.view);
  select(pin.region, pin.finger, { frameKey: pin.frameKey, local: v3(pin.local), deep: v3(pin.deep), territory: pin.territory });
}
function clearSelection() {
  state.selection = null;
  state.panel = 'home';
  renderInfo();
}

// ---------------------------------------------------------------- pain map
function addPin() {
  const s = state.selection;
  if (!s || s.pinId) return false;
  if (state.pins.length >= 8) { toast('Your pain map holds 8 spots — remove one first'); return false; }
  const pin = {
    id: nextPinId++, region: s.region, finger: s.finger || null, frameKey: s.frameKey,
    local: s.local.toArray(), deep: s.deep.toArray(), pain: s.pain, symptoms: [...s.symptoms],
    territory: s.territory || null, hand: state.mirror ? 'Left' : 'Right',
  };
  state.pins.push(pin);
  s.pinId = pin.id;
  save();
  syncPinUI();
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
  save();
  syncPinUI();
}
const painColor = (pain) => `hsl(${Math.round(48 - pain * 4.6)} 92% ${Math.round(62 - pain * 1.6)}%)`;
const pinLayer = $('#pinLayer');
function syncPinUI() {
  $('#mapCount').textContent = state.pins.length;
  $('#btnMap').classList.toggle('has', state.pins.length > 0);
  pinLayer.innerHTML = state.pins.map((p, i) => `<button class="pin-badge" data-pin="${p.id}" style="--c:${painColor(p.pain)}" title="${spotTitle(p)} · ${p.pain}/10">${i + 1}</button>`).join('');
  pinLayer.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => selectPin(+b.dataset.pin)));
}
$('#btnMap').addEventListener('click', () => { state.panel = 'analysis'; renderInfo(); });

// ---------------------------------------------------------------- info panel
const info = $('#info');
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const symLabel = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label]));
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function pinRowsHTML() {
  return state.pins.map((p, i) => {
    const sym = p.symptoms.map((t) => symLabel[t].toLowerCase()).join(', ');
    const nerve = p.territory ? ` · ${NERVES[p.territory].label.toLowerCase()} area` : '';
    return `<div class="pin-row"><button class="pin-open" data-pin="${p.id}"><span class="pin-dot" style="--c:${painColor(p.pain)}">${i + 1}</span><span><b>${esc(spotTitle(p))}</b><small>${p.pain}/10${sym ? ' · ' + esc(sym) : ''}${nerve}</small></span></button><button class="icon-btn small" data-unpin="${p.id}" aria-label="Remove from pain map">${ICON_X}</button></div>`;
  }).join('');
}
function testCardHTML(k, compact = false) {
  const T = TESTS[k];
  const a = state.tests[k];
  const ans = (v, l) => `<button class="seg-btn ${a === v ? 'on ' + v : ''}" data-test="${k}" data-ans="${v}">${l}</button>`;
  return `<div class="test-card ${a ? 'answered' : ''}">
    <div class="test-top"><div><b>${esc(T.name)}</b><small>checks for ${esc(T.for)}</small></div><button class="ex-btn small" data-show="${k}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Show me</button></div>
    ${compact ? '' : `<p>${esc(T.how)}</p>`}
    <p class="test-pos"><b>Positive if:</b> ${esc(T.positive)}</p>
    ${T.caution ? `<p class="test-caution">${esc(T.caution)}</p>` : ''}
    <div class="seg-row"><span>Did it reproduce your symptoms?</span><div class="seg-group">${ans('yes', 'Yes')}${ans('no', 'No')}${ans('unsure', 'Not sure')}</div></div>
  </div>`;
}
function bindCommon() {
  info.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => selectPin(+b.dataset.pin)));
  info.querySelectorAll('[data-unpin]').forEach((b) => b.addEventListener('click', () => { removePin(+b.dataset.unpin); renderInfo({ keepScroll: true }); }));
  info.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => showTest(b.dataset.show)));
  info.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.test, v = b.dataset.ans;
    if (state.tests[k] === v) delete state.tests[k]; else state.tests[k] = v;
    save();
    renderInfo({ keepScroll: true });
  }));
  info.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => selectRegion(b.dataset.region)));
  info.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => startExercise(b.dataset.ex)));
  const close = info.querySelector('#closePanel');
  if (close) close.addEventListener('click', clearSelection);
}

function renderInfo({ keepScroll = false } = {}) {
  const prevScroll = keepScroll && info.querySelector('.info-scroll') ? info.querySelector('.info-scroll').scrollTop : 0;
  info.classList.add('open');
  info.classList.toggle('has-sel', state.panel !== 'home');
  if (state.panel === 'analysis') renderAnalysis();
  else if (state.panel === 'spot' && state.selection) renderSpot();
  else renderHome();
  bindCommon();
  if (keepScroll) info.querySelector('.info-scroll').scrollTop = prevScroll;
  requestAnimationFrame(resize);
}

function renderHome() {
  state.panel = 'home';
  const hasPins = state.pins.length > 0;
  info.innerHTML = `
    <div class="info-scroll">
      ${hasPins ? `<div class="map-card"><div class="eyebrow">Your pain map</div><div class="pin-list">${pinRowsHTML()}</div><button class="btn primary wide" id="goAnalysis">See what might fit →</button></div>` : ''}
      <div class="eyebrow">${hasPins ? 'Add another spot' : 'Start here'}</div>
      <h2 class="title">Where does it hurt?</h2>
      <p class="lead">Click a spot on the 3D hand, or turn on the webcam and <b>point at the sore spot on your own hand</b> with your other index finger. Save each spot to your pain map with how much it hurts — the more you add, the better the pattern.</p>
      ${QUICK_GROUPS.map((g) => `<div class="quick"><h4>${g.label}</h4><div class="chips">${g.items.map(([k, l]) => `<button class="chip" data-region="${k}">${l}</button>`).join('')}</div></div>`).join('')}
      <div class="tipbox"><b>Tingling or numbness?</b> Turn on <b>Nerve map</b> in the Layers panel to see which nerve supplies each patch of skin.</div>
      <p class="disclaimer">For education only — not a diagnosis. If pain lasts more than 1–2 weeks, wakes you at night, or follows an injury, see a clinician (GP, physiotherapist or hand therapist).</p>
    </div>`;
  const go = info.querySelector('#goAnalysis');
  if (go) go.addEventListener('click', () => { state.panel = 'analysis'; renderInfo(); });
}

function renderSpot() {
  const sel = state.selection;
  const R = REGIONS[sel.region];
  const finger = R.perFinger ? FINGERS.find((f) => f.key === sel.finger) : null;
  const hand = state.mirror ? 'Left hand' : 'Right hand';
  const tests = Object.keys(TESTS).filter((k) => TESTS[k].regions.includes(sel.region));
  const nerve = sel.territory ? NERVES[sel.territory] : null;
  info.innerHTML = `
    <div class="info-head">
      <div>
        <div class="eyebrow"><span class="pulse"></span>${hand}${finger ? ' · ' + finger.label : ''}</div>
        <h2 class="title">${esc(R.title)}</h2>
      </div>
      <button class="icon-btn" id="closePanel" aria-label="Close">${ICON_X}</button>
    </div>
    <div class="info-scroll">
      <p class="lead">${esc(R.blurb)}</p>
      ${R.perFinger ? `<div class="finger-switch">${FINGERS.map((f) => `<button class="chip small ${f.key === sel.finger ? 'active' : ''}" data-finger="${f.key}">${f.label.replace(' finger', '')}</button>`).join('')}</div>` : ''}
      <div class="spot-card">
        <div class="pain-row"><label for="painRange">How much does it hurt here?</label><output id="painOut" style="--c:${painColor(sel.pain)}">${sel.pain}/10</output></div>
        <input type="range" id="painRange" min="0" max="10" step="1" value="${sel.pain}">
        <div class="pain-scale"><span>No pain</span><span>Worst imaginable</span></div>
        <h4>What does it feel like here?</h4>
        <div class="chips symptoms">${SYMPTOMS.map((s) => `<button class="chip small ${sel.symptoms.includes(s.key) ? 'active' : ''}" data-sym="${s.key}">${s.label}</button>`).join('')}</div>
        <div class="spot-actions">
          ${sel.pinId ? `<span class="pinned">✓ In your pain map</span><button class="btn tiny" id="unpinBtn">Remove</button>` : `<button class="btn primary" id="pinBtn">＋ Add to my pain map</button>`}
          <button class="btn tiny ghost" id="toAnalysis">What might fit →</button>
        </div>
        ${nerve ? `<div class="nerve-note"><i style="--c:${nerve.color}"></i>Skin here is supplied by the <b>${nerve.label.toLowerCase()}</b>. Tingling here points to that nerve.</div>` : ''}
      </div>
      <h3>What's under here</h3>
      <div class="chips structs">${R.structures.map((s, i) => `<button class="chip struct" data-s="${i}"><i style="--c:${LAYERS[LAYER_INDEX[s.layer]].color}"></i>${esc(s.label)}</button>`).join('')}</div>
      <p class="micro">Tap a structure to peel down to it and make it glow.</p>
      <h3>Possible causes</h3>
      <div id="causes"></div>
      ${tests.length ? `<h3>Quick self-checks</h3>${tests.map((k) => testCardHTML(k, true)).join('')}` : ''}
      <h3>What usually helps</h3>
      <ul class="tips">${R.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3>Gentle movements</h3>
      <div class="ex-mini">${R.exercises.map((k) => `<button class="ex-btn" data-ex="${k}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>${EXERCISE_INFO[k].label}</button>`).join('')}</div>
      <p class="micro">Watch it on the 3D hand. Move within comfort — mild stretch is fine, sharp pain is not.</p>
      <div class="redflags">
        <h4>See a clinician soon if…</h4>
        <ul>${R.redFlags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <h4 class="urgent">Get urgent care for</h4>
        <ul>${GENERAL_RED_FLAGS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <p class="disclaimer">Educational information, not a diagnosis or treatment plan. Only a clinician who examines you can tell what is causing your pain.</p>
    </div>`;
  info.querySelectorAll('[data-finger]').forEach((b) => b.addEventListener('click', () => selectRegion(sel.region, b.dataset.finger)));
  const range = info.querySelector('#painRange');
  range.addEventListener('input', () => {
    sel.pain = +range.value;
    const out = info.querySelector('#painOut');
    out.textContent = `${sel.pain}/10`;
    out.style.setProperty('--c', painColor(sel.pain));
    updatePinFromSelection();
  });
  info.querySelectorAll('[data-sym]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sym;
    sel.symptoms = sel.symptoms.includes(k) ? sel.symptoms.filter((x) => x !== k) : [...sel.symptoms, k];
    b.classList.toggle('active');
    updatePinFromSelection();
    renderCauses();
  }));
  const pinBtn = info.querySelector('#pinBtn');
  if (pinBtn) pinBtn.addEventListener('click', () => { if (addPin()) { toast('Added to your pain map'); renderInfo({ keepScroll: true }); } });
  const unpinBtn = info.querySelector('#unpinBtn');
  if (unpinBtn) unpinBtn.addEventListener('click', () => { removePin(sel.pinId); renderInfo({ keepScroll: true }); });
  info.querySelector('#toAnalysis').addEventListener('click', () => { state.panel = 'analysis'; renderInfo(); });
  info.querySelectorAll('.struct').forEach((b) => b.addEventListener('click', () => revealStructure(R.structures[+b.dataset.s], sel.finger)));
  renderCauses();
}

function renderCauses() {
  const R = REGIONS[state.selection.region];
  const sym = new Set(state.selection.symptoms);
  const scored = R.causes.map((c, i) => {
    const m = c.tags.filter((t) => sym.has(t)).length;
    return { c, i, m, score: m * 3 + (c.common ? 1 : 0) - i * 0.01 };
  });
  if (sym.size) scored.sort((a, b) => b.score - a.score);
  info.querySelector('#causes').innerHTML = scored.map(({ c, m }, k) => `
    <details class="cause ${sym.size && m === 0 ? 'dim' : ''}" ${k === 0 ? 'open' : ''}>
      <summary><span class="cname">${esc(c.name)}</span><span class="badges">${m ? `<span class="badge match">${m} match${m > 1 ? 'es' : ''}</span>` : ''}${c.common ? '<span class="badge">Common</span>' : ''}</span></summary>
      <p>${esc(c.desc)}</p>
      <p class="helps"><b>What helps:</b> ${esc(c.helps)}</p>
    </details>`).join('');
}

function renderAnalysis() {
  const results = analyze(state.pins, state.tests);
  const hasData = state.pins.length || Object.keys(state.tests).length;
  // suggest self-checks: those linked to the top conditions, then those for the pinned areas
  const suggested = [];
  results.slice(0, 5).forEach((r) => r.tests.forEach((k) => { if (!suggested.includes(k)) suggested.push(k); }));
  state.pins.forEach((p) => Object.keys(TESTS).forEach((k) => { if (TESTS[k].regions.includes(p.region) && !suggested.includes(k)) suggested.push(k); }));
  Object.keys(state.tests).forEach((k) => { if (!suggested.includes(k)) suggested.push(k); });
  const numb = state.pins.filter((p) => p.symptoms.includes('numb'));
  const numbNerves = [...new Set(numb.map((p) => p.territory).filter(Boolean))];
  info.innerHTML = `
    <div class="info-head">
      <div>
        <div class="eyebrow">Your pain map · ${state.pins.length} spot${state.pins.length === 1 ? '' : 's'}</div>
        <h2 class="title">What might fit</h2>
      </div>
      <button class="icon-btn" id="closePanel" aria-label="Close">${ICON_X}</button>
    </div>
    <div class="info-scroll">
      ${!hasData ? `
        <p class="lead">Your pain map is empty. Pick a spot on the hand (or point at it with the webcam), set how much it hurts and what it feels like, then tap <b>Add to my pain map</b>. Add every sore area — patterns across spots are what make the picture clearer.</p>
        <div class="tipbox">Numbness? Mark each numb spot with <b>Numb / tingling</b> — the map checks which nerve those areas share.</div>` : `
        <div class="pin-list">${pinRowsHTML()}</div>
        ${numbNerves.length ? `<div class="nerve-note wide">${numbNerves.map((n) => `<i style="--c:${NERVES[n].color}"></i>`).join('')}Your numb spots are in the <b>${numbNerves.map((n) => NERVES[n].label.toLowerCase()).join(' and ')}</b> area${numbNerves.length > 1 ? 's' : ''}. <button class="link" id="showNerves">Show nerve map</button></div>` : ''}
        <h3>Conditions that could fit</h3>
        ${results.length ? results.slice(0, 6).map((r) => `
          <div class="fit-card ${r.urgent ? 'urgent' : ''}">
            <div class="fit-top"><b>${esc(r.name)}</b><span class="badge ${r.rel >= 0.75 ? 'match' : ''}">${fitLabel(r.rel)}</span></div>
            <div class="fit-bar"><i style="width:${Math.round(r.rel * 100)}%"></i></div>
            <ul class="fit-why">${r.reasons.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            ${r.helps ? `<p class="helps"><b>What helps:</b> ${esc(r.helps)}</p>` : ''}
            ${r.urgent ? '<p class="test-caution">This one needs prompt medical attention if it matches.</p>' : ''}
            ${r.tests.length ? `<div class="fit-tests">${r.tests.map((k) => `<button class="chip small" data-jump="${k}">Check: ${esc(TESTS[k].name)}</button>`).join('')}</div>` : ''}
          </div>`).join('') : '<p class="lead">Nothing stands out yet — add a pain level and symptoms to your spots.</p>'}
        `}
      ${suggested.length ? `<h3 id="selfChecks">Self-checks to narrow it down</h3>${suggested.slice(0, 6).map((k) => `<div id="test-${k}">${testCardHTML(k)}</div>`).join('')}` : ''}
      ${hasData ? `<div class="row between actions"><button class="btn" id="copySummary">Copy summary for a clinician</button><button class="btn tiny ghost" id="clearMap">Clear pain map</button></div>` : ''}
      <div class="redflags">
        <h4 class="urgent">Get urgent care for</h4>
        <ul>${GENERAL_RED_FLAGS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <p class="disclaimer">This ranks common conditions by how well they match what you entered. It is not a diagnosis — several conditions often overlap, and a clinician's examination matters more than any pattern.</p>
    </div>`;
  const sn = info.querySelector('#showNerves');
  if (sn) sn.addEventListener('click', () => setNerveMap(true));
  info.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    const el = info.querySelector('#test-' + b.dataset.jump);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  const cp = info.querySelector('#copySummary');
  if (cp) cp.addEventListener('click', async () => {
    const hand = state.pins.length ? state.pins[0].hand || 'Right' : 'Right';
    const text = summaryText(state.pins, state.tests, results, hand);
    try { await navigator.clipboard.writeText(text); toast('Summary copied — paste it into a note or message'); } catch { prompt('Copy this summary:', text); }
  });
  const cl = info.querySelector('#clearMap');
  if (cl) cl.addEventListener('click', () => {
    if (!confirm('Clear all spots and self-check answers?')) return;
    state.pins = []; state.tests = {};
    if (state.selection) state.selection.pinId = null;
    save(); syncPinUI(); renderInfo();
  });
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
let mouse = null, mouseDirty = false, down = null, hovered = null;
canvas.addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY }; mouseDirty = true; state.lastInteract = performance.now(); });
canvas.addEventListener('pointerleave', () => { mouse = null; mouseDirty = true; });
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; state.lastInteract = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 6 && performance.now() - down.t < 600) {
    const hit = pick(e.clientX, e.clientY);
    if (hit) selectPoint(hit.point);
  }
  down = null;
});

function updateHover() {
  if (!mouseDirty) return;
  mouseDirty = false;
  if (hovered && !highlight.meshes.includes(hovered)) hovered.material.userData.uHi.value = 0;
  hovered = null;
  if (!mouse || down) { tooltip.hidden = true; if (state.mode !== 'point') G.uHover.value.w = 0; canvas.style.cursor = ''; return; }
  const hit = pick(mouse.x, mouse.y);
  if (!hit) { tooltip.hidden = true; if (state.mode !== 'point') G.uHover.value.w = 0; canvas.style.cursor = ''; return; }
  canvas.style.cursor = 'pointer';
  const a = classify(hit.point);
  const ud = hit.object.userData;
  const layerIdx = LAYER_INDEX[ud.layer] ?? 0;
  const nerve = state.nerveMap && hit.object === skin.mesh ? skin.territoryAt(hit.point) : null;
  tooltip.innerHTML = `<div class="tt-name"><i style="--c:${LAYERS[layerIdx].color}"></i>${esc(ud.name)}</div>${ud.desc ? `<div class="tt-desc">${esc(ud.desc)}</div>` : ''}${nerve ? `<div class="tt-desc">Sensation: <b>${NERVES[nerve].label}</b></div>` : ''}${a ? `<div class="tt-area">Area: ${esc(regionTitle(a))} · click to explore</div>` : ''}`;
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = mouse.x + 16, y = mouse.y + 16;
  if (x + tw > window.innerWidth - 8) x = mouse.x - tw - 16;
  if (y + th > window.innerHeight - 8) y = mouse.y - th - 16;
  tooltip.style.transform = `translate(${x}px, ${y}px)`;
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
  dwell: { key: null, t: 0, point: new THREE.Vector3(), cooldownKey: null },
  fps: { n: 0, t0: 0, value: 0 }, debugT: 0,
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
    btn.classList.add('on');
    btn.querySelector('span').textContent = 'Stop webcam';
    stopExercise();
    $('#camStatus').textContent = 'Raise a hand into view';
  } catch (err) {
    console.error(err);
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
  $('#btnCam').classList.remove('on');
  $('#btnCam').querySelector('span').textContent = 'Use webcam';
  state.mirror = false;
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
    mode = track.lost > 20 || state.mode === 'peel' ? 'none' : state.mode;
  } else track.lost = 0;
  if (state.exercise) mode = hands.length ? 'paused' : 'none';

  // Short grace period so a flicker doesn't cancel pointing
  if (mode !== 'point' && state.mode === 'point' && t - track.lastPointT < 0.25 && !state.exercise) {
    drawOverlay(octx, overlay.width, overlay.height, hands, {});
    return;
  }

  if (mode !== 'peel') track.peel = null;
  if (mode !== 'point') { $('#dwell').hidden = true; if (!mouse) G.uHover.value.w = 0; track.dwell.key = null; }
  state.mode = mode;

  const status = $('#camStatus');
  if (mode === 'mirror' && main) {
    track.lastMainId = main.trackId;
    const r = retarget(main, restQ, thumbBaseQ);
    lerpPose(targetPose, targetPose, r.pose, 1);
    state.mirror = r.mirror;
    if (state.followRot) pivotTarget.copy(r.quat);
    else pivotTarget.copy(viewQuat(state.view, state.mirror));
    status.textContent = `Mirroring your ${main.isRight ? 'right' : 'left'} hand`;
    setGuide('mirror');
  } else if (mode === 'point') {
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
      if (d.key === keyStr && p.distanceTo(d.point) < 1.8) d.t += dt;
      else { d.key = keyStr; d.t = 0; d.point.copy(p); }
      if (d.cooldownKey && d.cooldownKey !== keyStr) d.cooldownKey = null;
      G.uHover.value.set(p.x, p.y, p.z, 1.25);
      const prog = d.cooldownKey === keyStr ? 1 : clamp(d.t / DWELL_SECONDS, 0, 1);
      info.dwell = prog;
      showDwell(p, prog, regionTitle(a));
      if (d.t >= DWELL_SECONDS && d.cooldownKey !== keyStr) { selectPoint(p, 'point'); d.cooldownKey = keyStr; }
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
    status.textContent = 'Demo playing — tracking paused';
    setGuide(null);
  } else if (mode === 'none') {
    status.textContent = 'Raise a hand into view';
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
  const lines = [`detection ${f.value.toFixed(0)} fps · ${hands.length} hand${hands.length === 1 ? '' : 's'} · mode ${state.mode}`];
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
$('#helpClose').addEventListener('click', () => $('#helpDlg').close());
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.key === 'Escape') { if (state.exercise) stopExercise(); else if (state.panel !== 'home') clearSelection(); }
  if (e.key === ']') setPeel(Math.floor(state.peel + 1.001));
  if (e.key === '[') setPeel(Math.ceil(state.peel - 1.001));
});
$('#resetView').addEventListener('click', () => {
  controls.target.set(0, 5.5, 0);
  camera.position.set(0, 6, 56);
  fitCamera();
  setView('palm');
});
$('#layersToggle')?.addEventListener('click', () => $('#leftPanel').classList.toggle('open'));

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Clock();
const breath = clonePose(P.relaxed);
const spotLabel = $('#spotLabel');
let lastW = 0, lastH = 0;
const _w = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = clock.elapsedTime;
  G.uTime.value = now;

  // --- inputs
  if (state.tracking) {
    const res = tracker.detect();
    if (res) {
      if (overlay.width !== video.videoWidth) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
      handleTracking(res, dt);
    }
  }
  const trackingDrives = state.tracking && (state.mode === 'mirror' || state.mode === 'point' || state.mode === 'peel');

  // --- target pose
  if (state.exercise) updateExercise(dt);
  else if (!trackingDrives) lerpPose(targetPose, targetPose, P[state.preset], 1 - Math.exp(-dt * 6));
  if (!trackingDrives || state.exercise) {
    pivotTarget.copy(viewQuat(state.view, state.mirror));
    if (!state.tracking && !state.exercise && now * 1000 - state.lastInteract > 2500) {
      pivotTarget.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(now * 0.4) * 0.04, Math.sin(now * 0.27) * 0.16, 0)));
    }
  }

  // --- smooth toward targets (landmarks are already filtered, so tracking can be snappy)
  const rate = state.exercise ? 18 : trackingDrives ? 22 : 8;
  lerpPose(curPose, curPose, targetPose, 1 - Math.exp(-dt * rate));
  let applied = curPose;
  if (!state.tracking && !state.exercise) {
    lerpPose(breath, curPose, curPose, 0);
    breath.fingers.forEach((f, i) => { const s = Math.sin(now * 1.1 + i * 0.6) * 0.035; f.mcp += s; f.pip += s * 1.2; f.dip += s * 0.8; });
    breath.thumb.ip += Math.sin(now * 1.1 + 2) * 0.03;
    applied = breath;
  }
  rig.applyPose(applied);
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
  for (const m of rig.meshes) m.visible = vis[4];
  for (const t of tubes) {
    const li = t.mesh.material.userData.layer;
    t.mesh.visible = vis[li];
    if (vis[li]) t.update();
  }
  skin.mesh.visible = vis[0] || state.ghost;
  skin.uniforms.uGhost.value = state.ghost ? 1 : 0;
  const nm = skin.uniforms.uNerveMap;
  nm.value += ((state.nerveMap ? 1 : 0) - nm.value) * Math.min(1, dt * 6);
  skin.update();

  // --- pain map pins
  G.uPinCount.value = state.pins.length;
  const badges = pinLayer.children;
  for (let i = state.pins.length; i < badges.length; i++) badges[i].hidden = true;
  state.pins.forEach((p, i) => {
    spotWorld(p).toArray().forEach((v, k) => { G.uPins.value[i].setComponent(k, v); });
    G.uPins.value[i].w = 0.25 + 0.75 * (p.pain / 10);
    const b = badges[i];
    if (b) {
      const s = screenOf(spotWorld(p));
      b.style.transform = `translate(${s.x - 11}px, ${s.y - 11}px)`;
      b.hidden = s.behind;
    }
  });

  // --- selected spot (or self-check demo) hotspot & highlight
  const demoActive = state.demo && state.exercise;
  const hot = demoActive ? state.demo : state.panel === 'spot' ? state.selection : null;
  if (hot) {
    const w = spotWorld(hot);
    G.uHot.value.set(w.x, w.y, w.z, 1.3);
    G.uHot2.value.copy(spotWorld(hot, 'deep'));
    G.uHotAmt.value += (1 - G.uHotAmt.value) * Math.min(1, dt * 4);
    if (!demoActive) {
      const s = screenOf(w);
      spotLabel.hidden = false;
      spotLabel.style.transform = `translate(${s.x}px, ${s.y}px)`;
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
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
load();
syncLayerUI();
syncPinUI();
renderInfo();
// Optional deep links, e.g. ?peel=2&nerves=1&view=back&region=thumbBase&pose=fist
{
  const q = new URLSearchParams(location.search);
  if (q.has('peel')) setPeel(parseFloat(q.get('peel')) || 0);
  if (q.get('nerves') === '1') setNerveMap(true);
  if (VIEWS[q.get('view')]) setView(q.get('view'));
  if (P[q.get('pose')] && PRESETS.some(([k]) => k === q.get('pose'))) { state.preset = q.get('pose'); markPreset(); }
  if (REGIONS[q.get('region')]) selectRegion(q.get('region'), q.get('finger') || undefined);
  if (q.get('still') === '1') state.lastInteract = Infinity;
}
resize();
fitCamera();
frame();
setTimeout(() => $('#loading').classList.add('done'), 250);

// handle for poking at the scene from the dev console
window.__hand = { rig, state, P, EX, skin, tubes, camera, controls, retarget, restQ, thumbBaseQ, selectRegion, selectPoint, selectPin, pick, classify, setPeel, setNerveMap, startExercise, showTest, mapPointOnHand, modelPointFromMap, handleTracking, handTracks, describeHand, analyze, renderInfo, THREE };
