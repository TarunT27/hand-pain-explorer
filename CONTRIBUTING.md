# Contributing

Thanks for helping. Two kinds of contribution matter most: **clinical corrections** (see [REVIEWERS.md](REVIEWERS.md)) and **bug reports from real webcams and phones**.

## Running locally

```bash
python3 serve.py          # http://localhost:8743
node --test test/*.test.mjs
```

There is no build step. Three.js and MediaPipe load from CDNs.

## Where things live

- `js/content.js` — all medical content: regions, causes, tags, tips, red flags, self-checks, nerve areas, sources. Every cause needs a source in `CONDITION_SOURCES`; the tests enforce it.
- `js/analysis.js` — the ranking. Pure JavaScript, no DOM, so it can be tested in Node.
- `js/main.js` — the UI, pain map, webcam gestures and render loop.
- `scripts/export-content.mjs` — regenerates `docs/content-review-pack.md` and the source index in `CONTENT_REVIEW.md`. Run it after changing content; CI fails if the generated files are stale.
- `scripts/check-links.mjs` — checks every source URL (runs weekly in CI).

## Changing content

1. Edit `js/content.js`.
2. If you add a condition, add it to `CONDITION_SOURCES` with at least one verified source in `REFS`, and give it an `urgent` tier in `CONDITIONS` if it is time-critical.
3. Run `node --test test/*.test.mjs` and `node scripts/export-content.mjs`.
4. In the pull request, say what you changed and cite the source.

## Reporting tracking problems

Open the webcam panel's **Tracking details** while the problem happens and paste the readout into the issue, with your browser, device and lighting.

## Code style

Plain ES modules, no framework, two-space indent, single quotes. Keep comments for the *why*.
