# Clinician review

Hand Pain Explorer's medical content has been checked against published sources (NHS, AAOS OrthoInfo, StatPearls and PubMed Central reviews — see [CONTENT_REVIEW.md](CONTENT_REVIEW.md)) but **has not yet been reviewed by a licensed clinician**. If you are a hand surgeon, hand therapist, physiotherapist, occupational therapist or GP and can spare an hour or two, your review would make this tool materially safer.

## What to review

Everything a reviewer needs is in one generated file: [`docs/content-review-pack.md`](docs/content-review-pack.md). It lists, for each of the 17 areas, the conditions shown, their symptom tags, the advice given, the red flags, which self-checks and exercises are offered, and the sources. It also lists the self-check instructions with their quoted reliability figures and the weights used in the ranking.

You do not need to read any code. If you'd rather see it in context, the app runs at the GitHub Pages link in the README; open an area and compare.

## What matters most

1. **Safety first.** Is any advice unsafe at home? Is a red flag missing from an area? Would a time-critical injury (flexor sheath infection, high-pressure injection, scaphoid, mallet, jersey finger, central slip, UCL tear) be missed or under-stated?
2. **Common things first.** Are the "common" marks right for each area? Is anything common missing, or anything rare given undue prominence?
3. **Self-checks.** Are the instructions correct and safe for lay users? Are the reliability notes fair? Should any test be withheld in more situations than "injury or pain ≥ 8"?
4. **Nerve map.** Do the territories match standard dermatome charts, including the ring-finger split, the palmar cutaneous branch sparing in carpal tunnel syndrome, the dorsal ulnar branch, and the thumb nail bed?
5. **Ranking weights.** The table in [about.html](about.html) and the pack shows every weight. Do any produce misleading orderings?
6. **Wording.** Anything that implies a diagnosis, over-reassures, or alarms unnecessarily.

## How to send corrections

- Preferred: open a [clinical correction issue](https://github.com/TarunT27/hand-pain-explorer/issues/new?template=clinical-correction.yml), one per change, with a source where possible.
- Or email the maintainer via the address on the GitHub profile with the pack's section headings referenced.
- Bulk edits as a pull request to `js/content.js` are welcome; CI will check that every condition keeps a source.

## Credit and independence

Reviewers are credited below (name, role, date, scope) unless they prefer otherwise. Please state any conflicts of interest. The project is open source (MIT), has no sponsors and no analytics.

## Reviewers

_None yet._

| Name | Role | Date | Scope reviewed |
| --- | --- | --- | --- |
