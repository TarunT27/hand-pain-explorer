// Combines pain-map spots, symptoms, nerve territories and self-test answers
// into a ranked list of conditions that might fit. Educational only.
import { REGIONS, CONDITIONS, TESTS, SYMPTOMS, NERVES, REFS, CONDITION_SOURCES } from './content.js';
import { FINGERS } from './rig.js';

const symLabel = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label.toLowerCase()]));

export function spotTitle(spot) {
  const R = REGIONS[spot.region];
  const f = R.perFinger && spot.finger ? FINGERS.find((x) => x.key === spot.finger) : null;
  return f ? `${f.label} · ${R.title}` : R.title;
}

export function conditionInfo(id) {
  const c = CONDITIONS[id] || {};
  let first = null;
  for (const R of Object.values(REGIONS)) {
    first = R.causes.find((k) => k.id === id);
    if (first) break;
  }
  return {
    id, name: c.name || (first && first.name) || id, helps: c.helps || (first && first.helps) || '', desc: (first && first.desc) || '',
    nerve: c.nerve || null, urgent: !!c.urgent, note: c.note || '', sources: (CONDITION_SOURCES[id] || []).map((k) => REFS[k]).filter(Boolean),
  };
}

export function testsFor(id) {
  return Object.keys(TESTS).filter((k) => TESTS[k].conditions[id]);
}

export function analyze(pins, tests) {
  const scores = new Map();
  const entry = (id) => {
    if (!scores.has(id)) scores.set(id, { id, score: 0, reasons: [], spots: new Set(), syms: new Set() });
    return scores.get(id);
  };
  // reasons carry a priority so the strongest evidence is listed first
  const why = (e, text, pr) => { if (!e.reasons.some((r) => r.text === text)) e.reasons.push({ text, pr }); };
  pins.forEach((pin, i) => {
    const R = REGIONS[pin.region];
    const w = 0.35 + 0.65 * (pin.pain / 10);
    for (const c of R.causes) {
      const e = entry(c.id);
      e.score += w * (c.common ? 1.4 : 1);
      e.spots.add(i);
      const m = c.tags.filter((t) => pin.symptoms.includes(t));
      if (m.length) {
        e.score += 0.9 * m.length * w;
        m.forEach((t) => e.syms.add(t));
      }
    }
  });
  // Numbness pattern: which nerve's skin area do the numb spots fall in?
  const numb = pins.filter((p) => p.symptoms.includes('numb') && p.territory);
  // The palm's own skin branch of the median nerve bypasses the carpal tunnel,
  // so numbness in the palm points away from carpal tunnel syndrome.
  const PALM = ['palmCenter', 'thenar'];
  const numbPalm = numb.filter((p) => PALM.includes(p.region) && p.territory === 'median');
  if (numb.length) {
    for (const [id, c] of Object.entries(CONDITIONS)) {
      if (!c.nerve) continue;
      const counts = id === 'cts' ? numb.filter((p) => !numbPalm.includes(p)) : numb;
      const inside = counts.filter((p) => p.territory === c.nerve).length;
      const outside = numb.length - inside;
      if (inside) {
        const e = entry(id);
        e.score += 1.4 * inside;
        why(e, `Numbness in the ${NERVES[c.nerve].label.toLowerCase()} area (${inside} spot${inside > 1 ? 's' : ''})`, 3);
      }
      if (outside && scores.has(id)) scores.get(id).score -= 0.5 * outside;
    }
    if (numbPalm.length && scores.has('cts')) {
      const e = scores.get('cts');
      e.score -= 0.6 * numbPalm.length;
      why(e, 'Numb palm skin is usually spared in carpal tunnel syndrome', 3.2);
    }
  }
  for (const [k, ans] of Object.entries(tests)) {
    const T = TESTS[k];
    if (!T) continue;
    // each self-check carries its own weight, reflecting how informative it is
    const tw = T.weight || { yes: 2.0, no: 0.8 };
    for (const [id, wt] of Object.entries(T.conditions)) {
      if (ans === 'yes') {
        const e = entry(id);
        e.score += tw.yes * wt;
        why(e, `${T.name} reproduced your symptoms`, 4);
      } else if (ans === 'no' && scores.has(id)) {
        const e = scores.get(id);
        e.score -= tw.no * wt;
        why(e, `${T.name} was negative`, 3.5);
      }
    }
  }
  for (const e of scores.values()) {
    const spots = [...e.spots].sort((a, b) => a - b);
    if (spots.length > 1) {
      e.score += 0.6 * (spots.length - 1);
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
  return list.map((e) => ({ ...conditionInfo(e.id), score: e.score, rel: e.score / top, reasons: e.reasons, tests: testsFor(e.id), spots: [...e.spots] }));
}

export function fitLabel(rel) {
  return rel >= 0.75 ? 'Strong fit' : rel >= 0.45 ? 'Possible' : 'Less likely';
}

export function summaryText(pins, tests, results, hand) {
  const d = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const lines = [`Hand pain summary — ${d}`, `Hand: ${hand}`, '', 'Where it hurts:'];
  pins.forEach((p, i) => {
    const sym = p.symptoms.map((t) => symLabel[t]).join(', ');
    const nerve = p.territory ? ` · ${NERVES[p.territory].label.toLowerCase()} area` : '';
    lines.push(`${i + 1}. ${spotTitle(p)} — ${p.pain}/10${sym ? ` — ${sym}` : ''}${nerve}`);
  });
  const answered = Object.entries(tests).filter(([, a]) => a);
  if (answered.length) {
    lines.push('', 'Self-checks:');
    answered.forEach(([k, a]) => lines.push(`- ${TESTS[k].name}: ${a === 'yes' ? 'reproduced symptoms' : a === 'no' ? 'negative' : 'unsure'}`));
  }
  if (results.length) {
    lines.push('', 'Conditions that may fit (educational, not a diagnosis):');
    results.slice(0, 5).forEach((r) => lines.push(`- ${r.name} (${fitLabel(r.rel).toLowerCase()})`));
  }
  lines.push('', 'Made with Hand Pain Explorer — for discussion with a clinician.');
  return lines.join('\n');
}
