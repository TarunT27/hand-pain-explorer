// Exports the medical content as a readable Markdown "review pack" for clinicians
// and regenerates the source index in CONTENT_REVIEW.md.
//   node scripts/export-content.mjs          # write files
//   node scripts/export-content.mjs --check  # exit 1 if the committed files are stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { REGIONS, CONDITIONS, TESTS, SYMPTOMS, REFS, CONDITION_SOURCES, TEST_SOURCES, NERVES, GENERAL_RED_FLAGS, RED_FLAG_CHECKS, CONTENT_REVIEW } from '../js/content.js';

const check = process.argv.includes('--check');
const sym = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label]));
const link = (k) => `[${REFS[k].org}: ${REFS[k].title}](${REFS[k].url})`;
const nameOf = (id) => (CONDITIONS[id] && CONDITIONS[id].name) || Object.values(REGIONS).flatMap((r) => r.causes).find((c) => c.id === id).name;

// ---- review pack
let md = `# Content review pack\n\nGenerated from \`js/content.js\` (last checked ${CONTENT_REVIEW.date}). For each area: what the app says, which conditions it lists, their symptom tags, advice and sources. Edit the source file, not this one.\n\n`;
md += `## General red flags\n\n${GENERAL_RED_FLAGS.map((f) => `- ${f}`).join('\n')}\n\n### Pre-ranking checklist\n\n${RED_FLAG_CHECKS.map((f) => `- ${f.label}`).join('\n')}\n\n`;
md += `## Nerve areas\n\n${Object.values(NERVES).map((n) => `- **${n.label}:** ${n.area}`).join('\n')}\n\n`;
for (const [key, R] of Object.entries(REGIONS)) {
  md += `## ${R.title} (\`${key}\`)\n\n${R.blurb}\n\n`;
  md += `**Structures:** ${R.structures.map((s) => s.label).join(', ')}\n\n`;
  md += `| Condition | id | Tags | Common | Urgent | Finger limit | No exercise |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const c of R.causes) {
    const C = CONDITIONS[c.id] || {};
    md += `| ${c.name} | \`${c.id}\` | ${c.tags.map((t) => sym[t]).join(', ')} | ${c.common ? 'yes' : ''} | ${C.urgent || ''} | ${(c.fingers || C.fingers || []).join(', ')} | ${c.noExercise ? 'yes' : ''} |\n`;
  }
  md += '\n';
  for (const c of R.causes) md += `- **${c.name}** — ${c.desc}\n  - *What helps:* ${c.helps}\n  - *Sources:* ${(CONDITION_SOURCES[c.id] || []).map(link).join('; ') || '_none_'}\n`;
  md += `\n**Tips:** ${R.tips.join(' · ')}\n\n**Exercises:** ${R.exercises.join(', ')}\n\n**See a clinician soon if:** ${R.redFlags.join('; ')}\n\n`;
}
md += `## Self-checks\n\n`;
for (const [k, T] of Object.entries(TESTS)) {
  md += `### ${T.name} (\`${k}\`)\n\n- **For:** ${T.for}\n- **How:** ${T.how}\n- **Positive if:** ${T.positive}\n- **Reliability note:** ${T.accuracy || '_none_'}\n- **Weights:** yes +${T.weight.yes}, no −${T.weight.no}; conditions: ${Object.entries(T.conditions).map(([id, w]) => `${nameOf(id)} ×${w}`).join(', ')}\n- **Loads the area (withheld after injury):** ${T.loads ? 'yes' : 'no'}\n${T.caution ? `- **Caution:** ${T.caution}\n` : ''}- **Sources:** ${(TEST_SOURCES[k] || []).map(link).join('; ')}\n\n`;
}
md += `## Canonical conditions\n\n| id | Name | Urgent | Nerve | Advice |\n| --- | --- | --- | --- | --- |\n`;
for (const [id, c] of Object.entries(CONDITIONS)) md += `| \`${id}\` | ${c.name || nameOf(id)} | ${c.urgent || ''} | ${c.nerve || ''} | ${c.helps || ''} |\n`;

// ---- source index for CONTENT_REVIEW.md
let idx = '| Condition | Checked against |\n| --- | --- |\n';
for (const id of Object.keys(CONDITION_SOURCES).sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) idx += `| ${nameOf(id)} | ${CONDITION_SOURCES[id].map(link).join('<br>')} |\n`;
idx += '\n| Self-check | Checked against |\n| --- | --- |\n';
for (const [k, list] of Object.entries(TEST_SOURCES)) idx += `| ${TESTS[k].name} | ${list.map(link).join('<br>')} |\n`;

const packPath = 'docs/content-review-pack.md';
const reviewPath = 'CONTENT_REVIEW.md';
let review = readFileSync(reviewPath, 'utf8');
const marker = '## Source index';
const head = review.slice(0, review.indexOf(marker));
const intro = review.slice(review.indexOf(marker)).split('\n').slice(0, 4).join('\n'); // heading + blank + sentence + blank
const newReview = head + intro + '\n' + idx;

if (check) {
  const stale = [];
  if (!existsSync(packPath) || readFileSync(packPath, 'utf8') !== md) stale.push(packPath);
  if (review !== newReview) stale.push(reviewPath);
  if (stale.length) { console.error('Stale generated content: ' + stale.join(', ') + '. Run node scripts/export-content.mjs'); process.exit(1); }
  console.log('generated content is up to date');
} else {
  writeFileSync(packPath, md);
  writeFileSync(reviewPath, newReview);
  console.log(`wrote ${packPath} (${md.length} chars) and refreshed the source index in ${reviewPath}`);
}
