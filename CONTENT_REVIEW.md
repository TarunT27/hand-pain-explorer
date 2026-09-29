# Content review

This page records how the medical content in Hand Pain Explorer was checked, what changed as a result, and what still needs a clinician's review.

**Status:** checked against published patient and clinical references on **29 September 2026**. **Not yet reviewed by a licensed clinician.** Until it is, treat everything here as general education, not advice.

## How the content was checked

1. Every condition, self-check and nerve-map claim in [`js/content.js`](js/content.js) was matched to at least one source from:
   - **NHS** (nhs.uk) — patient information from the UK National Health Service
   - **OrthoInfo** (orthoinfo.aaos.org) — patient information from the American Academy of Orthopaedic Surgeons
   - **StatPearls** (NCBI Bookshelf) — peer-reviewed clinical summaries hosted by the US National Library of Medicine
   - **PubMed Central** review articles, where none of the above covers a condition
2. Each link was opened and its page title checked against the condition it is cited for. Links that returned "not found", or that only returned a generic page, were dropped.
3. The claims most likely to matter for someone's decisions — self-test instructions, test accuracy, time-sensitive injuries and nerve territories — were read against the source text.

## What changed

| Area | Before | After | Source |
| --- | --- | --- | --- |
| De Quervain's self-check | Called the "Finkelstein test" | Renamed **Eichhoff test (home Finkelstein)**. The self-done version, with the thumb tucked in a fist, is Eichhoff's; in Finkelstein's, an examiner moves the wrist. It also notes the test is often uncomfortable in healthy wrists. | StatPearls: De Quervain tenosynovitis |
| Phalen's and Tinel's tests | No accuracy information; a negative answer counted strongly against carpal tunnel | Shows reported accuracy (Phalen about 68% sensitive and 73% specific; Tinel about 50% and 77%). Negative answers now barely lower the ranking. | StatPearls: Carpal tunnel syndrome |
| Carpal tunnel and palm numbness | Numbness anywhere in the median-nerve area counted towards carpal tunnel | Numbness in the palm or thumb pad no longer counts towards carpal tunnel and slightly lowers it, because the palm's skin branch runs over the carpal tunnel, not through it. | StatPearls: Hand cutaneous innervation |
| Mallet finger | "Splint for 6–8 weeks, see a clinician within a few days" | "Splint at all times for up to 8 weeks; get it checked promptly, ideally the same day" | NHS: Mallet finger |
| Jersey finger | "Repair works best within 7–10 days" | "About 3 in 4 cases involve the ring finger; repair within about 10 days gives the best results" | StatPearls: Jersey finger |
| Skier's thumb | "Get assessed within 1–2 weeks" (unsourced timing) | "A severe sprain or complete tear may need surgery — get it assessed promptly" | OrthoInfo: Sprained thumb |
| All self-checks | Every test weighted the same in the ranking | Each test has its own weight for a "yes" and a "no", based on how informative it is, plus a "How reliable" note | See the table below |

Claims confirmed without changes include: the carpal tunnel symptom pattern (median-nerve fingers, worse at night, night splints first); De Quervain's being most common in new parents; the classic glomus tumour triad (pain, cold sensitivity, pinpoint tenderness); ulnar nerve compression at the elbow affecting the back of the hand while Guyon's canal spares it; and scaphoid fractures sometimes being missed on the first X-ray.

## Known limitations

- **No clinician sign-off yet.** The checklist below is ready for a hand surgeon, hand therapist or GP to work through.
- **The ranking is a heuristic.** It adds up matches between what you enter and each condition. It isn't a validated diagnostic model and hasn't been tested on real patients.
- **Some conditions rest on a single or indirect source.** These are pisotriquetral arthritis (cited to wrist arthritis), bruising (NHS hand pain) and ECU problems (a sports-medicine review).
- **The press-up test's accuracy isn't quoted,** so the app calls it a simple screening sign only.
- **ASSH HandCare pages weren't cited,** because the site loads its content with JavaScript and the links couldn't be verified automatically.
- **Some advice is UK or US specific.** Urgency advice follows NHS and AAOS wording, and local services differ.

## Clinician review checklist

If you're a clinician willing to review, please check the following and [open an issue](https://github.com/TarunT27/hand-pain-explorer/issues) with any corrections:

- [ ] Each region's causes are appropriate and their order roughly reflects how common they are
- [ ] Symptom tags on each cause (numb, stiff, clicking and so on) are right
- [ ] Red flags and "get urgent care" advice are complete and correctly worded
- [ ] Self-check instructions are safe to do at home, and the accuracy notes are fair
- [ ] Self-check weights in the ranking are reasonable
- [ ] The nerve-map territories match standard dermatome diagrams, including the ring-finger split
- [ ] Exercise instructions are safe, especially for acute injuries
- [ ] Wording avoids implying a diagnosis

Reviewed by: _(name, role, date)_

## Source index

Every source was opened and its title checked on 29 September 2026. The table is generated from `REFS` in `js/content.js`.

| Condition | Checked against |
| --- | --- |
| Basal thumb (CMC) arthritis | [OrthoInfo (AAOS): Arthritis of the thumb](https://orthoinfo.aaos.org/en/diseases--conditions/arthritis-of-the-thumb/) |
| Boutonnière injury (central slip) | [OrthoInfo (AAOS): Boutonnière deformity](https://orthoinfo.aaos.org/en/diseases--conditions/boutonniere-deformity/) |
| Bruise / contusion | [NHS: Hand pain](https://www.nhs.uk/symptoms/hand-pain/) |
| Carpal boss | [PubMed Central: Diagnosis and treatment of symptomatic carpal bossing](https://pmc.ncbi.nlm.nih.gov/articles/PMC4625297/) |
| Carpal tunnel syndrome | [NHS: Carpal tunnel syndrome](https://www.nhs.uk/conditions/carpal-tunnel-syndrome/)<br>[OrthoInfo (AAOS): Carpal tunnel syndrome](https://orthoinfo.aaos.org/en/diseases--conditions/carpal-tunnel-syndrome/)<br>[StatPearls: Carpal tunnel syndrome](https://www.ncbi.nlm.nih.gov/books/NBK448179/) |
| Cellulitis | [NHS: Cellulitis](https://www.nhs.uk/conditions/cellulitis/) |
| Cubital tunnel syndrome (ulnar nerve at the elbow) | [OrthoInfo (AAOS): Cubital tunnel syndrome](https://orthoinfo.aaos.org/en/diseases--conditions/ulnar-nerve-entrapment-at-the-elbow/)<br>[StatPearls: Ulnar nerve entrapment](https://www.ncbi.nlm.nih.gov/books/NBK555929/) |
| De Quervain's tenosynovitis | [OrthoInfo (AAOS): De Quervain's tendinosis](https://orthoinfo.aaos.org/en/diseases--conditions/de-quervains-tendinosis/)<br>[StatPearls: De Quervain tenosynovitis](https://www.ncbi.nlm.nih.gov/books/NBK442005/) |
| Dupuytren's disease | [NHS: Dupuytren's contracture](https://www.nhs.uk/conditions/dupuytrens-contracture/)<br>[StatPearls: Dupuytren contracture](https://www.ncbi.nlm.nih.gov/books/NBK526074/) |
| ECU tendinitis or subluxation | [PubMed Central: Sports-related extensor carpi ulnaris pathology](https://pmc.ncbi.nlm.nih.gov/articles/PMC3812850/) |
| EPL tendon rupture | [PubMed Central: Spontaneous atraumatic extensor pollicis longus rupture](https://pmc.ncbi.nlm.nih.gov/articles/PMC3587012/) |
| Extensor tendinitis / dorsal wrist impingement | [NHS: Tendonitis](https://www.nhs.uk/conditions/tendonitis/) |
| Felon (fingertip pulp infection) | [StatPearls: Felon](https://www.ncbi.nlm.nih.gov/books/NBK430933/) |
| Fight bite | [NHS: Animal and human bites](https://www.nhs.uk/conditions/animal-and-human-bites/) |
| Flexor carpi radialis tendinitis | [NHS: Tendonitis](https://www.nhs.uk/conditions/tendonitis/) |
| Flexor sheath infection | [StatPearls: Pyogenic flexor tenosynovitis](https://www.ncbi.nlm.nih.gov/books/NBK576414/) |
| Fracture in the finger or hand | [NHS: Broken finger or thumb](https://www.nhs.uk/conditions/broken-finger/)<br>[OrthoInfo (AAOS): Hand fractures](https://orthoinfo.aaos.org/en/diseases--conditions/hand-fractures/)<br>[StatPearls: Phalanx fractures of the hand](https://www.ncbi.nlm.nih.gov/books/NBK557625/) |
| Ganglion or mucous cyst | [NHS: Ganglion cyst](https://www.nhs.uk/conditions/ganglion-cyst/)<br>[OrthoInfo (AAOS): Ganglion cyst of the wrist and hand](https://orthoinfo.aaos.org/en/diseases--conditions/ganglion-cyst-of-the-wrist-and-hand/) |
| Glomus tumour | [PubMed Central: Glomus tumor: revitalizing concepts](https://pmc.ncbi.nlm.nih.gov/articles/PMC4567371/) |
| Hook of hamate fracture | [StatPearls: Hamate fractures](https://www.ncbi.nlm.nih.gov/books/NBK544314/) |
| Hypothenar hammer syndrome | [PubMed Central: Hypothenar hammer syndrome: case report and literature review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6565917/) |
| Inflammatory arthritis (e.g. rheumatoid) | [NHS: Rheumatoid arthritis](https://www.nhs.uk/conditions/rheumatoid-arthritis/) |
| Intersection syndrome | [StatPearls: Intersection syndrome](https://www.ncbi.nlm.nih.gov/books/NBK430899/) |
| Jersey finger (FDP avulsion) | [StatPearls: Jersey finger](https://www.ncbi.nlm.nih.gov/books/NBK545291/) |
| Kienböck's disease | [StatPearls: Kienbock disease](https://www.ncbi.nlm.nih.gov/books/NBK536991/) |
| Ligament sprain | [NHS: Sprains and strains](https://www.nhs.uk/conditions/sprains-and-strains/)<br>[StatPearls: Finger dislocation](https://www.ncbi.nlm.nih.gov/books/NBK551508/) |
| Mallet finger / thumb (extensor tendon injury) | [NHS: Mallet finger](https://www.nhs.uk/conditions/mallet-finger/)<br>[OrthoInfo (AAOS): Mallet finger](https://orthoinfo.aaos.org/en/diseases--conditions/mallet-finger-baseball-finger/) |
| Nerve entrapment or referred nerve pain | [StatPearls: Cervical radiculopathy](https://www.ncbi.nlm.nih.gov/books/NBK441828/) |
| Osteoarthritis of the finger joints | [NHS: Osteoarthritis](https://www.nhs.uk/conditions/osteoarthritis/)<br>[OrthoInfo (AAOS): Arthritis of the hand](https://orthoinfo.aaos.org/en/diseases--conditions/arthritis-of-the-hand/) |
| Overuse / tendon strain | [NHS: Repetitive strain injury](https://www.nhs.uk/conditions/repetitive-strain-injury-rsi/)<br>[NHS: Tendonitis](https://www.nhs.uk/conditions/tendonitis/) |
| Paronychia (nail-fold infection) | [StatPearls: Paronychia](https://www.ncbi.nlm.nih.gov/books/NBK544307/) |
| Pisiform / FCU irritation | [OrthoInfo (AAOS): Arthritis of the wrist](https://orthoinfo.aaos.org/en/diseases--conditions/arthritis-of-the-wrist/) |
| Psoriatic arthritis | [NHS: Psoriatic arthritis](https://www.nhs.uk/conditions/psoriatic-arthritis/) |
| Raynaud's phenomenon | [NHS: Raynaud's](https://www.nhs.uk/conditions/raynauds/)<br>[StatPearls: Raynaud disease](https://www.ncbi.nlm.nih.gov/books/NBK499833/) |
| Sagittal band injury ("boxer's knuckle") | [PubMed Central: Sagittal band, boutonniere, and pulley injuries in the athlete](https://pmc.ncbi.nlm.nih.gov/articles/PMC5344850/) |
| Scaphoid fracture | [OrthoInfo (AAOS): Scaphoid fracture of the wrist](https://orthoinfo.aaos.org/en/diseases--conditions/scaphoid-fracture-of-the-wrist/)<br>[StatPearls: Scaphoid wrist fracture](https://www.ncbi.nlm.nih.gov/books/NBK536907/) |
| Scapholunate ligament injury | [StatPearls: Carpal ligament instability](https://www.ncbi.nlm.nih.gov/books/NBK557729/) |
| Skier's / gamekeeper's thumb (UCL sprain or tear) | [OrthoInfo (AAOS): Sprained thumb (skier's thumb)](https://orthoinfo.aaos.org/en/diseases--conditions/sprained-thumb) |
| TFCC tear | [StatPearls: Triangular fibrocartilage complex](https://www.ncbi.nlm.nih.gov/books/NBK554564/) |
| Trigger finger / trigger thumb | [NHS: Trigger finger](https://www.nhs.uk/conditions/trigger-finger/)<br>[OrthoInfo (AAOS): Trigger finger](https://orthoinfo.aaos.org/en/diseases--conditions/trigger-finger/)<br>[StatPearls: Trigger finger](https://www.ncbi.nlm.nih.gov/books/NBK459310/) |
| Ulnar impaction syndrome | [PubMed Central: Ulnocarpal impaction syndrome](https://pmc.ncbi.nlm.nih.gov/articles/PMC11781849/) |
| Ulnar nerve compression | [OrthoInfo (AAOS): Cubital tunnel syndrome](https://orthoinfo.aaos.org/en/diseases--conditions/ulnar-nerve-entrapment-at-the-elbow/)<br>[StatPearls: Ulnar nerve entrapment](https://www.ncbi.nlm.nih.gov/books/NBK555929/) |
| Ulnar nerve compression at the wrist (Guyon's canal) | [OrthoInfo (AAOS): Ulnar tunnel syndrome of the wrist](https://orthoinfo.aaos.org/en/diseases--conditions/ulnar-tunnel-syndrome-of-the-wrist/)<br>[StatPearls: Guyon canal syndrome](https://www.ncbi.nlm.nih.gov/books/NBK431063/) |
| Wartenberg's syndrome (superficial radial nerve) | [StatPearls: Cheiralgia paresthetica (Wartenberg syndrome)](https://www.ncbi.nlm.nih.gov/books/NBK545200/) |
| Wrist arthritis (radioscaphoid / STT) | [OrthoInfo (AAOS): Arthritis of the wrist](https://orthoinfo.aaos.org/en/diseases--conditions/arthritis-of-the-wrist/) |
| Wrist fracture or sprain | [OrthoInfo (AAOS): Distal radius fractures (broken wrist)](https://orthoinfo.aaos.org/en/diseases--conditions/distal-radius-fractures-broken-wrist/)<br>[OrthoInfo (AAOS): Wrist sprains](https://orthoinfo.aaos.org/en/diseases--conditions/wrist-sprains/) |

| Self-check | Checked against |
| --- | --- |
| Eichhoff test (home Finkelstein) | [StatPearls: De Quervain tenosynovitis](https://www.ncbi.nlm.nih.gov/books/NBK442005/) |
| Phalen's test | [StatPearls: Carpal tunnel syndrome](https://www.ncbi.nlm.nih.gov/books/NBK448179/) |
| Tinel's sign at the wrist | [StatPearls: Carpal tunnel syndrome](https://www.ncbi.nlm.nih.gov/books/NBK448179/) |
| Thumb base grind test | [OrthoInfo (AAOS): Arthritis of the thumb](https://orthoinfo.aaos.org/en/diseases--conditions/arthritis-of-the-thumb/) |
| Tabletop test | [StatPearls: Dupuytren contracture](https://www.ncbi.nlm.nih.gov/books/NBK526074/) |
| Fist-and-release | [StatPearls: Trigger finger](https://www.ncbi.nlm.nih.gov/books/NBK459310/) |
| Finger-cross test | [StatPearls: Ulnar nerve entrapment](https://www.ncbi.nlm.nih.gov/books/NBK555929/) |
| Press-up test | [StatPearls: Triangular fibrocartilage complex](https://www.ncbi.nlm.nih.gov/books/NBK554564/) |
| Snuffbox press | [StatPearls: Scaphoid wrist fracture](https://www.ncbi.nlm.nih.gov/books/NBK536907/)<br>[OrthoInfo (AAOS): Scaphoid fracture of the wrist](https://orthoinfo.aaos.org/en/diseases--conditions/scaphoid-fracture-of-the-wrist/) |
