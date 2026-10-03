// Combines pain-map spots, symptoms, nerve territories, onset, hand and
// self-test answers into a ranked list of conditions that might fit.
// Educational only. Pure JavaScript: no DOM, no Three.js, so it runs in Node tests.
import { REGIONS, CONDITIONS, TESTS, SYMPTOMS, NERVES, REFS, CONDITION_SOURCES, STRONG_SYMPTOMS, ONSET_WEIGHTS, BILATERAL, DORSAL_REGIONS, RED_FLAG_CHECKS, ONSETS } from './content.js';
import { FINGER_LABEL } from './hand-data.js';

const symLabel = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label.toLowerCase()]));
const onsetLabel = Object.fromEntries(ONSETS.map((o) => [o.key, o.label.toLowerCase()]));

export function spotTitle(spot) {
  const R = REGIONS[spot.region];
  const f = R.perFinger && spot.finger ? FINGER_LABEL[spot.finger] : null;
  return f ? `${f} · ${R.title}` : R.title;
}

// Thumb regions have no finger field; treat them as the thumb for finger filters.
const THUMB_REGIONS = ['thumbIP', 'thumbMCP', 'thumbBase', 'thenar'];
export function fingerOf(spot) {
  if (spot.finger) return spot.finger;
  return THUMB_REGIONS.includes(spot.region) ? 'thumb' : null;
}
// A cause can be limited to some fingers (e.g. carpal tunnel never affects the little finger).
export function causeApplies(cause, spot) {
  const limit = cause.fingers || (CONDITIONS[cause.id] && CONDITIONS[cause.id].fingers);
  if (!limit) return true;
  const f = fingerOf(spot);
  return !f || limit.includes(f);
}

export function conditionInfo(id) {
  const c = CONDITIONS[id] || {};
  let first = null;
  for (const R of Object.values(REGIONS)) {
    first = R.causes.find((k) => k.id === id);
    if (first) break;
  }
  const urgent = c.urgent === true ? 'soon' : c.urgent || null;
  return {
    id, name: c.name || (first && first.name) || id, helps: c.helps || (first && first.helps) || '', desc: (first && first.desc) || '',
    nerve: c.nerve || null, urgent, note: c.note || '', sources: (CONDITION_SOURCES[id] || []).map((k) => REFS[k]).filter(Boolean),
  };
}

export function testsFor(id) {
  return Object.keys(TESTS).filter((k) => TESTS[k].conditions[id]);
}

// True when loading self-checks and exercises should be withheld for this spot.
export function spotIsAcuteInjury(spot) {
  return spot.symptoms.includes('injury') || spot.symptoms.includes('cantmove') || spot.symptoms.includes('wound') || spot.pain >= 8;
}

/**
 * Rank conditions.
 * @param pins   [{ region, finger, pain, symptoms[], territory, hand, onset }]
 * @param tests  { testKey: 'yes'|'no'|'unsure' }
 * @param opts   { hand: 'Left'|'Right' (score only that hand), bothHands: boolean }
 */
export function analyze(pins, tests = {}, opts = {}) {
  const allPins = pins;
  if (opts.hand) pins = pins.filter((p) => (p.hand || 'Right') === opts.hand);
  const scores = new Map();
  const entry = (id) => {
    if (!scores.has(id)) scores.set(id, { id, score: 0, reasons: [], spots: new Set(), syms: new Set(), evidence: 0, strong: false });
    return scores.get(id);
  };
  // reasons carry a priority so the strongest evidence is listed first
  const why = (e, text, pr) => { if (!e.reasons.some((r) => r.text === text)) e.reasons.push({ text, pr }); };

  pins.forEach((pin, i) => {
    const R = REGIONS[pin.region];
    if (!R) return;
    const w = 0.35 + 0.65 * (pin.pain / 10);
    for (const c of R.causes) {
      if (!causeApplies(c, pin)) continue;
      const e = entry(c.id);
      e.score += w * (c.common ? 1.4 : 1);
      e.spots.add(i);
      const m = c.tags.filter((t) => pin.symptoms.includes(t));
      for (const t of m) {
        const strong = STRONG_SYMPTOMS.includes(t);
        e.score += (strong ? 1.8 : 0.9) * w;
        e.syms.add(t);
        e.evidence += 1;
        if (strong) e.strong = true;
      }
      // onset nudges acute vs chronic conditions
      if (pin.onset) {
        const acute = ONSET_WEIGHTS.acute.includes(c.id), chronic = ONSET_WEIGHTS.chronic.includes(c.id);
        if (pin.onset === 'hours' && acute) { e.score += 0.6; why(e, 'Fits something that started in the last few days', 2.2); }
        if (pin.onset === 'hours' && chronic) e.score -= 0.5;
        if (pin.onset === 'months' && chronic) { e.score += 0.6; why(e, 'Fits a problem that has built up over months', 2.2); }
        if (pin.onset === 'months' && acute) e.score -= 0.6;
      }
    }
  });

  // --- Numbness pattern: which nerve's skin area do the numb spots fall in?
  const numb = pins.filter((p) => p.symptoms.includes('numb') && p.territory);
  // The palm's own skin branch of the median nerve bypasses the carpal tunnel,
  // so numbness in the palm points away from carpal tunnel syndrome.
  const PALM = ['palmCenter', 'thenar'];
  const numbPalm = numb.filter((p) => PALM.includes(p.region) && p.territory === 'median');
  const territories = new Set(numb.map((p) => p.territory));
  if (numb.length) {
    for (const [id, c] of Object.entries(CONDITIONS)) {
      if (!c.nerve) continue;
      const counts = id === 'cts' ? numb.filter((p) => !numbPalm.includes(p)) : numb;
      const inside = counts.filter((p) => p.territory === c.nerve).length;
      const outside = counts.length - inside;
      if (inside) {
        const e = entry(id);
        e.score += 1.4 * inside;
        e.evidence += 1;
        why(e, `Numbness in the ${NERVES[c.nerve].label.toLowerCase()} area (${inside} spot${inside > 1 ? 's' : ''})`, 3);
      }
      if (outside && scores.has(id)) scores.get(id).score -= 0.5 * outside;
    }
    if (numbPalm.length && scores.has('cts')) {
      const e = scores.get('cts');
      e.score -= 0.6 * numbPalm.length;
      why(e, 'Numb palm skin is usually spared in carpal tunnel syndrome', 3.2);
    }
    // Elbow vs wrist for ulnar numbness: the back of the hand is supplied by a branch
    // that leaves above Guyon's canal, so dorsal numbness points to the elbow.
    const isDorsal = (p) => DORSAL_REGIONS.includes(p.region) || ((p.region === 'dip' || p.region === 'pip') && (p.finger === 'pinky' || p.finger === 'ring'));
    const ulnarDorsal = numb.filter((p) => p.territory === 'ulnar' && isDorsal(p)).length;
    const ulnarPalmar = numb.filter((p) => p.territory === 'ulnar').length - ulnarDorsal;
    if (ulnarDorsal) {
      const e = entry('cubital');
      e.score += 1.0 * ulnarDorsal; e.evidence += 1;
      why(e, 'Numbness on the back of the hand points to the elbow, not the wrist', 3.1);
      if (scores.has('guyon')) scores.get('guyon').score -= 0.6 * ulnarDorsal;
    } else if (ulnarPalmar && pins.some((p) => p.symptoms.includes('weak'))) {
      const e = entry('guyon');
      e.score += 0.5; why(e, 'Palm-side numbness with weakness fits pressure at the wrist (Guyon\'s canal)', 2.8);
    }
    // Numbness across more than one nerve's area is less typical of a single trapped nerve.
    if (territories.size >= 2) {
      const e = entry('nerve-referred');
      e.score += 1.2 * territories.size; e.evidence += 1;
      why(e, 'Numbness across more than one nerve\'s area is less typical of a single trapped nerve at the wrist', 3);
    }
  }

  // --- Self-checks: each carries its own weight, reflecting how informative it is
  for (const [k, ans] of Object.entries(tests)) {
    const T = TESTS[k];
    if (!T) continue;
    const tw = T.weight || { yes: 2.0, no: 0.8 };
    for (const [id, wt] of Object.entries(T.conditions)) {
      if (ans === 'yes') {
        const e = entry(id);
        e.score += tw.yes * wt;
        e.evidence += 1;
        why(e, `${T.name} reproduced your symptoms`, 4);
      } else if (ans === 'no' && scores.has(id)) {
        const e = scores.get(id);
        e.score -= tw.no * wt;
        why(e, `${T.name} was negative`, 3.5);
      }
    }
  }

  // --- Both hands affected favours conditions that affect the body, not one joint
  const hands = new Set(allPins.map((p) => p.hand || 'Right'));
  if (hands.size > 1 || opts.bothHands) {
    for (const id of BILATERAL) {
      if (!scores.has(id)) continue;
      const e = scores.get(id);
      e.score += 0.7; e.evidence += 1;
      why(e, 'Both hands are affected, which fits a condition of the whole body rather than one joint', 2.6);
    }
  }

  for (const e of scores.values()) {
    const spots = [...e.spots].sort((a, b) => a - b);
    if (spots.length > 1) {
      e.score += 0.6 * (spots.length - 1);
      e.evidence += 1;
      why(e, `Fits ${spots.length} of your spots (${spots.map((i) => i + 1).join(', ')})`, 2);
    } else if (spots.length === 1) {
      const p = pins[spots[0]];
      why(e, `Where it hurts: ${spotTitle(p)} (${p.pain}/10)`, 1);
    }
    if (e.syms.size) why(e, `Matches: ${[...e.syms].map((t) => symLabel[t]).join(', ')}`, 2.5);
    e.reasons = e.reasons.sort((a, b) => b.pr - a.pr).map((r) => r.text);
  }
  const list = [...scores.values()].filter((e) => e.score > 0.3).sort((a, b) => b.score - a.score);
  const top = list.length ? list[0].score : 1;
  return list.map((e) => {
    const info = conditionInfo(e.id);
    return { ...info, score: e.score, rel: e.score / top, evidence: e.evidence, strongSymptom: e.strong, reasons: e.reasons, tests: testsFor(e.id), spots: [...e.spots] };
  });
}

// The label depends on how much actual evidence there is, not just rank.
export function fitLabel(r) {
  const rel = typeof r === 'number' ? r : r.rel;
  const ev = typeof r === 'number' ? 1 : r.evidence;
  if (ev === 0) return 'Common here';
  if (rel >= 0.75 && ev >= 2) return 'Most consistent';
  if (rel >= 0.45) return 'Consistent';
  return 'Less consistent';
}
export function fitTier(r) {
  const l = fitLabel(r);
  return l === 'Most consistent' ? 'strong' : l === 'Consistent' ? 'mid' : l === 'Common here' ? 'location' : 'weak';
}

// Urgent conditions present in pinned regions whose key tag matches that pin, regardless of rank.
export function dontMiss(pins, opts = {}) {
  if (opts.hand) pins = pins.filter((p) => (p.hand || 'Right') === opts.hand);
  const out = new Map();
  const KEY = ['injury', 'swelling', 'redhot', 'wound', 'cantmove', 'cold'];
  pins.forEach((pin, i) => {
    const R = REGIONS[pin.region];
    if (!R) return;
    for (const c of R.causes) {
      const info = conditionInfo(c.id);
      if (!info.urgent || !causeApplies(c, pin)) continue;
      const hit = c.tags.filter((t) => KEY.includes(t) && pin.symptoms.includes(t));
      if (!hit.length) continue;
      if (!out.has(c.id)) out.set(c.id, { ...info, matched: new Set(), spots: [] });
      const o = out.get(c.id);
      hit.forEach((t) => o.matched.add(symLabel[t]));
      o.spots.push(i);
    }
  });
  return [...out.values()].map((o) => ({ ...o, matched: [...o.matched] })).sort((a, b) => (a.urgent === 'now' ? 0 : 1) - (b.urgent === 'now' ? 0 : 1) || b.matched.length - a.matched.length);
}

// How much information the ranking is based on — shown as a banner.
export function evidenceSummary(pins, tests, opts = {}) {
  if (opts.hand) pins = pins.filter((p) => (p.hand || 'Right') === opts.hand);
  const syms = pins.reduce((n, p) => n + p.symptoms.length, 0);
  const answered = Object.values(tests).filter((a) => a === 'yes' || a === 'no').length;
  const onsets = pins.filter((p) => p.onset).length;
  const parts = [`${pins.length} spot${pins.length === 1 ? '' : 's'}`, syms ? `${syms} symptom${syms === 1 ? '' : 's'}` : 'no symptoms', answered ? `${answered} self-check${answered === 1 ? '' : 's'}` : 'no self-checks'];
  const thin = syms === 0 && answered === 0;
  return {
    text: `Based on ${parts.join(', ')}${onsets ? '' : ' and no duration'}.`,
    thin,
    hint: thin ? 'Tap what each spot feels like and try a self-check to sharpen this.' : (onsets ? '' : 'Adding how long each spot has hurt helps separate injuries from wear and tear.'),
  };
}

export function summaryText(pins, tests, results, hand, extra = {}) {
  const d = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const handsIn = [...new Set(pins.map((p) => p.hand || 'Right'))];
  const handLine = extra.bothHands ? 'Both hands' : handsIn.length > 1 ? 'Both (see each spot)' : (handsIn[0] || hand);
  const lines = [`Hand pain summary — ${d}`, `Hand: ${handLine}`];
  if (extra.redFlags && Object.keys(extra.redFlags).length) {
    const flags = RED_FLAG_CHECKS.filter((f) => extra.redFlags[f.key]);
    lines.push(flags.length ? `Red flags reported: ${flags.map((f) => f.label).join('; ')}` : `No red flags reported on ${d}`);
  }
  lines.push('', 'Where it hurts:');
  pins.forEach((p, i) => {
    const sym = p.symptoms.map((t) => symLabel[t]).join(', ');
    const nerve = p.territory ? ` · ${NERVES[p.territory].label.toLowerCase()} area` : '';
    const onset = p.onset ? ` · ${onsetLabel[p.onset]}` : '';
    const hd = handsIn.length > 1 ? ` (${p.hand || 'Right'})` : '';
    const trend = p.history && p.history.length > 1 ? ` · was ${p.history[0].pain}/10 on ${new Date(p.history[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
    lines.push(`${i + 1}. ${spotTitle(p)}${hd} — ${p.pain}/10${sym ? ` — ${sym}` : ''}${onset}${nerve}${trend}`);
  });
  const answered = Object.entries(tests).filter(([, a]) => a);
  if (answered.length) {
    lines.push('', 'Self-checks:');
    answered.forEach(([k, a]) => lines.push(`- ${TESTS[k].name}: ${a === 'yes' ? 'reproduced symptoms' : a === 'no' ? 'negative' : 'unsure'}`));
  }
  const urgent = extra.dontMiss || [];
  if (urgent.length) {
    lines.push('', 'Possibilities not to miss (from the symptoms entered):');
    urgent.forEach((u) => lines.push(`- ${u.name} — ${u.urgent === 'now' ? 'same-day / emergency' : 'prompt'} assessment advised`));
  }
  if (results.length) {
    lines.push('', 'Areas to discuss (educational ranking, not a diagnosis):');
    results.slice(0, 5).forEach((r) => lines.push(`- ${r.name} — ${fitLabel(r).toLowerCase()}${r.reasons[0] ? `: ${r.reasons[0]}` : ''}`));
  }
  lines.push('', 'Made with Hand Pain Explorer — for discussion with a clinician. The ranking matches entered symptoms to common conditions; it cannot examine the hand.');
  return lines.join('\n');
}
