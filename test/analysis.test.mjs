import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, fitLabel, dontMiss, evidenceSummary, summaryText, causeApplies, spotIsAcuteInjury } from '../js/analysis.js';
import { REGIONS, CONDITIONS } from '../js/content.js';
import { pin, CTS_PATTERN } from './fixtures.mjs';

const top = (res, n = 3) => res.slice(0, n).map((r) => r.id);

test('carpal tunnel pattern ranks cts first with strong evidence', () => {
  const res = analyze(CTS_PATTERN, {});
  assert.equal(res[0].id, 'cts');
  assert.equal(fitLabel(res[0]), 'Most consistent');
  assert.ok(res[0].reasons.some((r) => /median nerve area/.test(r)));
});

test('a lone pin with no symptoms is never a strong fit', () => {
  const res = analyze([pin('thumbBase', null, 5)], {});
  assert.ok(res.length > 0);
  for (const r of res) assert.notEqual(fitLabel(r), 'Most consistent');
  assert.equal(fitLabel(res[0]), 'Common here');
  assert.equal(evidenceSummary([pin('thumbBase', null, 5)], {}).thin, true);
});

test('positive Phalen raises cts; a negative barely lowers it', () => {
  const base = analyze(CTS_PATTERN, {}).find((r) => r.id === 'cts').score;
  const yes = analyze(CTS_PATTERN, { phalen: 'yes' }).find((r) => r.id === 'cts').score;
  const no = analyze(CTS_PATTERN, { phalen: 'no' }).find((r) => r.id === 'cts').score;
  assert.ok(yes - base > 1.5);
  assert.ok(base - no <= 0.6 + 1e-9);
});

test('palm numbness is penalised once (not twice) for cts', () => {
  const pins = [...CTS_PATTERN, pin('palmCenter', null, 4, ['numb'], 'median')];
  const before = analyze(CTS_PATTERN, {}).find((r) => r.id === 'cts').score;
  const after = analyze(pins, {}).find((r) => r.id === 'cts').score;
  // palm pin adds region weight for cts? palmCenter has no cts cause, so only the -0.6 palm rule applies
  assert.ok(Math.abs((before - after) - 0.6) < 1e-6, `expected a single 0.6 penalty, got ${before - after}`);
});

test('carpal tunnel is not offered for a numb little finger', () => {
  const res = analyze([pin('fingertip', 'pinky', 5, ['numb'], 'ulnar')], {});
  assert.ok(!res.some((r) => r.id === 'cts'));
  assert.ok(res.some((r) => r.id === 'cubital'));
  const cts = REGIONS.fingertip.causes.find((c) => c.id === 'cts');
  assert.equal(causeApplies(cts, { region: 'fingertip', finger: 'pinky' }), false);
  assert.equal(causeApplies(cts, { region: 'fingertip', finger: 'index' }), true);
});

test('dorsal ulnar numbness points to the elbow, palmar with weakness to the wrist', () => {
  const dorsal = analyze([pin('backOfHand', null, 4, ['numb'], 'ulnar'), pin('fingertip', 'pinky', 4, ['numb'], 'ulnar')], {});
  const cub = dorsal.find((r) => r.id === 'cubital'), guy = dorsal.find((r) => r.id === 'guyon');
  assert.ok(cub && (!guy || cub.score > guy.score));
  assert.ok(cub.reasons.some((r) => /back of the hand/.test(r)));
  const palmar = analyze([pin('hypothenar', null, 5, ['numb', 'weak'], 'ulnar')], {});
  assert.ok(palmar.find((r) => r.id === 'guyon').reasons.some((r) => /Guyon/.test(r)));
});

test('numbness in two nerve areas raises the referred/whole-body possibility', () => {
  const res = analyze([pin('fingertip', 'index', 5, ['numb'], 'median'), pin('fingertip', 'pinky', 5, ['numb'], 'ulnar')], {});
  assert.ok(res.some((r) => r.id === 'nerve-referred'));
});

test('strong symptoms (red/hot, wound, cannot move) weigh more than ordinary ones', () => {
  const hot = analyze([pin('knuckle', 'index', 6, ['redhot', 'swelling'])], {});
  assert.equal(hot[0].id, 'gout');
  assert.ok(hot.find((r) => r.id === 'gout').strongSymptom);
  const droop = analyze([pin('dip', 'ring', 6, ['injury', 'cantmove'])], {});
  assert.ok(['mallet', 'jersey'].includes(droop[0].id));
});

test('onset separates injury from wear and tear', () => {
  const acute = analyze([pin('pip', 'index', 6, ['swelling'], null, { onset: 'hours' })], {});
  const chronic = analyze([pin('pip', 'index', 6, ['swelling'], null, { onset: 'months' })], {});
  const rank = (res, id) => res.findIndex((r) => r.id === id);
  assert.ok(rank(acute, 'sprain') < rank(acute, 'oa'));
  assert.ok(rank(chronic, 'oa') < rank(chronic, 'sprain'));
});

test('both hands affected boosts systemic conditions', () => {
  const one = analyze([pin('knuckle', 'index', 5, ['swelling', 'stiff'])], {});
  const both = analyze([pin('knuckle', 'index', 5, ['swelling', 'stiff'], null, { hand: 'Right' }), pin('knuckle', 'index', 5, ['swelling', 'stiff'], null, { hand: 'Left' })], {}, { hand: 'Right' });
  assert.ok(both.find((r) => r.id === 'ra').score > one.find((r) => r.id === 'ra').score);
  assert.ok(both.find((r) => r.id === 'ra').reasons.some((r) => /Both hands/.test(r)));
});

test('hand filter scores only that hand', () => {
  const pins = [pin('thumbBase', null, 7, ['aching'], null, { hand: 'Right' }), pin('wristUlnar', null, 7, ['clicking'], null, { hand: 'Left' })];
  const right = analyze(pins, {}, { hand: 'Right' });
  assert.ok(right.some((r) => r.id === 'cmc-oa'));
  assert.ok(!right.some((r) => r.id === 'tfcc'));
});

test('urgent conditions surface in dontMiss when their key tag matches', () => {
  const dm = dontMiss([pin('fingerBase', 'index', 7, ['swelling', 'wound', 'redhot'])]);
  assert.equal(dm[0].id, 'sheath-infection');
  assert.equal(dm[0].urgent, 'now');
  assert.deepEqual(dontMiss([pin('fingerBase', 'index', 7, ['aching'])]), []);
});

test('split ids: gout is not osteoarthritis and EPL rupture is not mallet', () => {
  const knuckle = REGIONS.knuckle.causes.map((c) => c.id);
  assert.ok(knuckle.includes('gout') && knuckle.includes('oa'));
  const thumb = REGIONS.thumbIP.causes.map((c) => c.id);
  assert.ok(thumb.includes('epl-rupture') && thumb.includes('mallet'));
  assert.notEqual(CONDITIONS.gout.helps, CONDITIONS.oa.helps);
});

test('acute injury gating', () => {
  assert.equal(spotIsAcuteInjury(pin('pip', 'index', 4, ['injury'])), true);
  assert.equal(spotIsAcuteInjury(pin('pip', 'index', 9, [])), true);
  assert.equal(spotIsAcuteInjury(pin('pip', 'index', 4, ['aching'])), false);
});

test('summary text includes red flags, onset and hand', () => {
  const pins = [pin('wristPalmar', null, 7, ['numb', 'night'], 'median', { onset: 'weeks', hand: 'Left' })];
  const res = analyze(pins, { phalen: 'yes' });
  const txt = summaryText(pins, { phalen: 'yes' }, res, 'Left', { redFlags: { hotjoint: true }, dontMiss: dontMiss(pins) });
  assert.match(txt, /Hand: Left/);
  assert.match(txt, /Red flags reported: One joint hot/);
  assert.match(txt, /1–6 weeks/);
  assert.match(txt, /Phalen/);
  assert.doesNotMatch(txt, /strong fit/i);
});

test('every analysis result carries at least one verified source', () => {
  const res = analyze(CTS_PATTERN, {});
  for (const r of res) assert.ok(r.sources.length > 0, `${r.id} has no sources`);
});
