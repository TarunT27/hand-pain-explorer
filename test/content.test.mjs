import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, CONDITIONS, TESTS, SYMPTOMS, REFS, CONDITION_SOURCES, TEST_SOURCES, NERVE_SOURCES, RED_FLAG_SOURCES, EXERCISE_INFO, QUICK_GROUPS, ONSET_WEIGHTS, BILATERAL, NERVES } from '../js/content.js';

const causeIds = new Set();
for (const R of Object.values(REGIONS)) for (const c of R.causes) causeIds.add(c.id);
const symKeys = new Set(SYMPTOMS.map((s) => s.key));

test('every cause has at least one source and every source key exists', () => {
  for (const id of causeIds) assert.ok(CONDITION_SOURCES[id] && CONDITION_SOURCES[id].length, `no source for ${id}`);
  const all = [...Object.values(CONDITION_SOURCES).flat(), ...Object.values(TEST_SOURCES).flat(), ...NERVE_SOURCES, ...RED_FLAG_SOURCES];
  for (const k of all) assert.ok(REFS[k], `unknown ref ${k}`);
});

test('no unused sources', () => {
  const used = new Set([...Object.values(CONDITION_SOURCES).flat(), ...Object.values(TEST_SOURCES).flat(), ...NERVE_SOURCES, ...RED_FLAG_SOURCES]);
  const unused = Object.keys(REFS).filter((k) => !used.has(k));
  assert.deepEqual(unused, [], `unused refs: ${unused.join(', ')}`);
});

test('every symptom tag, exercise, test region and quick-group region is known', () => {
  for (const [rk, R] of Object.entries(REGIONS)) {
    for (const c of R.causes) for (const t of c.tags) assert.ok(symKeys.has(t), `${rk}:${c.id} unknown tag ${t}`);
    for (const e of R.exercises) assert.ok(EXERCISE_INFO[e], `${rk} unknown exercise ${e}`);
    assert.ok(R.redFlags.length >= 1, `${rk} has no red flags`);
    assert.ok(R.tips.length >= 3, `${rk} has fewer than 3 tips`);
  }
  for (const [k, T] of Object.entries(TESTS)) {
    for (const r of T.regions) assert.ok(REGIONS[r], `test ${k} unknown region ${r}`);
    for (const id of Object.keys(T.conditions)) assert.ok(causeIds.has(id), `test ${k} points at unknown condition ${id}`);
    assert.ok(T.weight && T.weight.yes > 0, `test ${k} has no weight`);
    assert.ok(T.accuracy, `test ${k} has no accuracy note`);
  }
  for (const g of QUICK_GROUPS) for (const [k] of g.items) assert.ok(REGIONS[k], `quick group unknown region ${k}`);
  for (const id of [...ONSET_WEIGHTS.acute, ...ONSET_WEIGHTS.chronic, ...BILATERAL]) assert.ok(causeIds.has(id) || CONDITIONS[id], `onset/bilateral unknown id ${id}`);
});

test('urgent conditions use the two-tier scheme and have a canonical name', () => {
  for (const [id, c] of Object.entries(CONDITIONS)) {
    if (c.urgent !== undefined) assert.ok(['now', 'soon'].includes(c.urgent), `${id} urgent=${c.urgent}`);
  }
  for (const id of ['sheath-infection', 'felon', 'fight-bite', 'injection', 'laceration', 'septic']) assert.equal(CONDITIONS[id].urgent, 'now', id);
});

test('nerve-limited conditions declare fingers', () => {
  assert.deepEqual(CONDITIONS.cts.fingers, ['thumb', 'index', 'middle', 'ring']);
  assert.deepEqual(CONDITIONS.cubital.fingers, ['ring', 'pinky']);
  assert.ok(NERVES.median && NERVES.ulnar && NERVES.radial);
});

test('ref URLs are well-formed', () => {
  for (const [k, r] of Object.entries(REFS)) {
    assert.match(r.url, /^https:\/\/(www\.)?(nhs\.uk|orthoinfo\.aaos\.org|ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov)\//, `${k}: ${r.url}`);
    assert.ok(r.org && r.title, k);
  }
});
