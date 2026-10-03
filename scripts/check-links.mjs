// Checks that every source URL in js/content.js still resolves.
// NCBI answers scripts with a bot check, so for those we only require a 2xx/3xx.
import { REFS } from '../js/content.js';

const UA = 'Mozilla/5.0 (compatible; hand-pain-explorer-linkcheck/1.0; +https://github.com/TarunT27/hand-pain-explorer)';
let failed = 0;
const entries = Object.entries(REFS);
for (const [key, r] of entries) {
  try {
    const res = await fetch(r.url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html' } });
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1].trim();
    const ok = res.ok && !/page not found|404/i.test(title);
    // ASSH-style soft 404s: the page title must not be a generic landing page
    const generic = /find a hand surgeon/i.test(title);
    if (!ok || generic) { failed++; console.log(`FAIL ${res.status} ${key} ${r.url} :: ${title}`); }
    else console.log(`ok   ${res.status} ${key} :: ${title.slice(0, 70)}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ERR ${key} ${r.url} :: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
console.log(`\n${entries.length - failed}/${entries.length} sources resolve`);
if (failed) process.exit(1);
