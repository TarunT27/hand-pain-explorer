# Improvement plan

Produced 2 October 2026 from an eight-angle review of the code (bugs, medical accuracy, usability, accessibility, performance, mobile, webcam tracking, product). 77 findings were raised; 23 were independently re-checked against the code and all 23 held. The most serious bug reports were reproduced in a browser before being listed here. Items are grouped by theme and ordered by value to someone with hand pain, then by effort.

Effort: **S** = under an hour, **M** = a few hours, **L** = a day or more.

## 1. Fix the crashes (do first)

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 1.1 | Guard point mode when no hands are visible | S | Reproduced: if both hands leave the frame while pointing, `handleTracking` throws (`main.js:861-889`, `target` is null), the render loop dies and the whole page freezes until reload. Don't keep `point` mode when `hands.length === 0`, make the branch `mode === 'point' && pointer && target`, and wrap the tracking call in try/catch so no tracking error can ever kill the frame loop. |
| 1.2 | Harden boot against bad URLs and bad saved data | S | Reproduced: `/?view=constructor` throws in `viewQuat` and leaves "Building the hand…" forever. Use `Object.hasOwn` for every lookup from the URL or localStorage (`VIEWS`, `REGIONS`, `PRESETS`, `rig.frames`); validate each stored pin (finite numbers, known symptom and test keys, 0–10 pain); wrap boot in try/catch that clears bad storage, dismisses the loading screen and shows a toast. Also add a global `error`/`unhandledrejection` handler and a timeout on the loading screen with a "Reload" button, so a failed CDN never shows a silent spinner. |
| 1.3 | Fix deep-link spot coordinates | S | `?region=` selects before `skin.update()` has ever run, so the hotspot is NaN and a saved pin would be corrupt. Call `this.update()` at the end of the `Skin` constructor and refuse to save non-finite pins. |
| 1.4 | Time the pointing dwell by the clock, not render frames | S | Dwell adds the render delta once per *camera* frame, so "hold ~1 s" takes ~2 s at 60 Hz and ~4 s on 120 Hz screens. Store a start time and compare `t - t0`. |
| 1.5 | Turn the camera off if tracking fails to start | S | If the MediaPipe download fails after `getUserMedia`, the camera light stays on. Call `tracker.stop()` in the catch, or load the model before requesting the camera. |
| 1.6 | Keep hotkeys and Escape out of the help dialog | S | Escape closes the dialog *and* discards the open spot; `[` `]` peel while the modal is up. Return early when `#helpDlg.open`. |

## 2. Make the ranking honest

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 2.1 | Base "fit" labels on evidence, not rank | M | Reproduced: one click with no symptoms shows two "Strong fit" results. Scores are relative, so the leader is always 100 %. Track evidence per condition (symptom matches, nerve pattern, positive tests, extra spots); with none, cap the label at "Common here", drop the bar, and prompt "Add what it feels like to sharpen this". Rename the tiers to "Most consistent / Consistent / Less consistent". |
| 2.2 | Never hide urgent conditions | M | Urgent single-region causes (felon, flexor sheath infection, hammer syndrome, EPL rupture) can fall out of the top six, and a symptom filter greys them out in the region panel. Never dim an urgent cause; add a "Don't miss" strip above the ranking for any urgent condition whose key tag matches a pinned spot; make urgency two-tier (`now` / `soon`). |
| 2.3 | Give each hand its own pins | M | `state.mirror` is only set by the webcam, so every spot says "Right hand" and the summary's hand line comes from the first pin. Add a Left / Right control in Pose & view, show the hand on every pin, carry it into the selection and the summary, and score each hand separately (with a small "both hands" boost for RA, OA, PsA and Raynaud's). |
| 2.4 | Ask "how long?" and "which hand(s)?" | M | Onset (hours–days / weeks / months), an optional injury date and "both hands?" are the first things a clinician asks and the strongest discriminators between acute injury, RA and OA. Express their weights as data in `content.js` like the test weights, and print them in the summary. |
| 2.5 | Stop merging different conditions under one id | S | Gout rides on the `oa` id (so a hot knuckle gets "heat and keep moving" advice) and "Mallet thumb / EPL injury" rides on `mallet` (so an EPL rupture gets 8-week-splint advice). Give gout its own entry (tagged red-hot, same-day review) and reuse the existing `epl-rupture` id at the thumb tip. |
| 2.6 | Separate elbow from wrist for ulnar numbness | S | One numb little finger yields three near-identical ulnar cards. Score numbness on the back of the hand toward cubital tunnel and against Guyon's canal; drop the generic `ulnar-nerve` from nerve scoring. |
| 2.7 | Interpret numbness across several nerve areas | S | Today it only penalises every nerve condition. Add a `nerve-referred` entry ("could be the neck or a general nerve problem") when numb spots span two or more territories. |
| 2.8 | Fix the CTS palm double penalty and filter per-finger causes | S | Palm numbness is penalised twice (−1.1 vs −0.5 for other territories). Carpal tunnel is listed as common on the little fingertip and ulnar compression on the thumb, contradicting the nerve map; add a `fingers:` field to those causes. |

## 3. Fill the medical gaps (then get it reviewed)

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 3.1 | Don't offer loading self-checks or exercises after an injury | M | A fresh mallet finger is shown tendon glides; a fall-injured wrist is invited to press-ups. When `injury` is tagged or pain ≥ 8, hide loading tests (keep snuffbox with its caution) and replace exercises with "No exercises until a clinician has checked it — a drooping fingertip must stay splinted straight at all times." Add `noExercise` to mallet, jersey, boutonnière, fractures, scaphoid, SL injury, skier's thumb, EPL rupture. |
| 3.2 | Add the missing emergencies | S | High-pressure injection injury, open fracture, a single hot joint ± fever (septic arthritis vs gout), a cut after which the finger won't move or the tip is numb, bites over a joint, and compartment-syndrome wording for the forearm. |
| 3.3 | Add three symptom tags: "Red, hot or fever", "Cut, bite or puncture", "Can't bend or straighten it / droops" | M | These are what separate an emergency from a sprain and a tendon rupture from a bruise, and they cannot be entered today. Weight them higher than ordinary tags. |
| 3.4 | Ask about red flags first and record the answers | S | Red flags sit at the bottom of 3–8 screens of text and are never captured. Put a short "Any of these right now?" checklist above the ranking (and above causes when injury/swelling/cold is tagged), persist answers, banner the panel if any are ticked, and write "Red flags reported / none reported on <date>" into the summary. |
| 3.5 | Add missing conditions where they present | M | Distal radius fracture (all three wrist regions), Bennett's fracture (thumb base), gout (knuckle, thumb, wrist), RA tenosynovitis (back/ulnar wrist), PsA dactylitis (PIP, finger base), trigger thumb at the thumb base, CRPS after injury, lacerations with tendon or nerve injury, Raynaud's at the thumb. Fix the thenar CTS entry (weakness and wasting, not tingling) and qualify "keep it moving" for jammed fingers (X-ray first if crooked, dislocated or can't straighten). |
| 3.6 | Nerve-map detail | S | Give the dorsal thumb nail bed to the median nerve in both the shader and `territoryAt()`, and update the legend text. |
| 3.7 | Make clinician review actually happen | M | Add `REVIEWERS.md` (scope, credit, time needed), a `clinical-correction` issue template, a per-condition `reviewed` date, and a script that exports `content.js` to a readable Markdown review pack and regenerates the source index. |

## 4. Fix the first five minutes

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 4.1 | Show causes before the form | M | Measured: the spot panel opens on a pre-set "5/10" slider and 11 chips; "Possible causes" starts below the fold on desktop and is 6 screens down on a phone. Order: blurb → symptom chips ("sorts the list below") → causes → the rest; put the pain slider and Add button in a slim footer pinned under the scroll area (flex layout already allows it); label the button "Add at 5/10" until the slider is touched. |
| 4.2 | Cut the spot panel to about 1.5 screens | M | Measured 3.4 screens on desktop, 8.5 on a phone. Render self-checks as a chip row that opens one card at a time; collapse the general urgent list behind "Get urgent care for…" (keep region flags visible); move the disclaimer to one header line. Keep the "which card is open" state in `state`, or it collapses on every re-render. |
| 4.3 | Fix the "What might fit" dead end | S | Pressing it on an unsaved spot shows "your map is empty" and the only exit discards the entry. Save first ("Save & see what might fit →"), and add a "← Back to <spot>" link in the analysis header. |
| 4.4 | Say what to do after "Add to my pain map" | S | Replace the tick with "✓ Saved as spot 1 · [+ Add another sore spot] [See what might fit (1 spot)]" and pulse the Pain map pill. |
| 4.5 | Three numbered steps on the home panel; demote the webcam button | S | "1. Tap where it hurts. 2. Say how much and what it feels like. 3. Add other sore spots, then see what might fit." The webcam is the harder path and shouldn't carry the accent colour. Add a first-visit welcome card and align chip labels with panel titles. |
| 4.6 | Answer a self-check from the demo bar; shorten the 60 s hold | M | During Phalen's the only button says "Stop". Add Yes / No / Not sure to the bar, scroll the matching card into view, and animate an 8 s hold with "hold up to 60 s yourself — stop as soon as tingling starts". |
| 4.7 | Restore the view after a demo; explain the nerve map when it turns on | S | Demos switch the nerve map on and leave it on. Remember and restore `nerveMap`, `view` and `peel` in `stopExercise`, add a × to the legend, and toast what the colours mean. |
| 4.8 | Real back links; close shouldn't discard | M | "×" throws away unsaved pain and symptoms. Track `prevPanel`, render "← Where does it hurt?" / "← Back to <spot>", and offer "Not saved yet — [Add] [Discard]" when closing with changes. |
| 4.9 | Explain the peel slider | S | Rename the card "See inside — slide right to peel skin → muscles → bones"; use "showing / removed" instead of "on top / peeled"; hide "Skin outline" until something is peeled. |

## 5. Accessibility

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 5.1 | Restore focus after every panel re-render | M | `renderInfo` replaces `innerHTML`, so keyboard users land back at the top of the document after every click; the self-check flow is nearly unusable by keyboard. Record a stable key for the focused element, re-focus it after binding; focus the `h2` when the panel kind changes. |
| 5.2 | Contrast | S | Measured: `--faint` (#66768a) is 4.1:1 on the background and 3.8:1 on panels — below the 4.5:1 standard — and it is used for the disclaimer, reliability notes and sources. Raise it to about #8696aa, and switch pain-badge digits to white at 8+/10. |
| 5.3 | Targeted announcements instead of a panel-wide live region | S | `aria-live="polite"` on `#info` makes screen readers read the entire spot page after each click. Remove it; announce short status through `#toast`; make `#exCaption` live with the countdown hidden. |
| 5.4 | Names and states on custom controls | S | Mobile hides button text with `display:none`, so "Use webcam" is announced as "button" and the pain map as "0". Use a visually-hidden class or `aria-label`s; add `aria-pressed` / radiogroups to chips, views, poses, tones, eyes and Yes/No; `aria-valuetext` on both sliders; `aria-labelledby` on the dialog. |
| 5.5 | Keyboard control of the 3D scene and a non-hover route to names | M | A keyboard user cannot rotate, zoom or learn what a structure is. `tabindex="0"` + `role="img"` with a live description; `controls.listenToKeyEvents`; `+ - R` shortcuts; a long-press / tap tooltip on touch. |
| 5.6 | Honour `prefers-reduced-motion` and don't rely on colour alone | S–M | Idle sway, breathing and shader pulses ignore the setting; nerve territories and pain badges differ by colour only. Add a `uReduceMotion` uniform, a visible "Reduce motion" toggle, stripe/dot patterns per nerve, and `aria-label`s on badges. |
| 5.7 | Touch targets ≥ 36 px on coarse pointers | S | Tones, toggles, pin badges (22 px) and Yes/No buttons are below the 24 px minimum for an audience with painful hands. |

## 6. Phones

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 6.1 | Size the canvas with `100%`/`dvh`, not `100vh` | S | With the browser toolbar visible the render buffer is stretched into a taller box, so taps, pin badges and the dwell ring are off by up to the toolbar height. Use `inset: 0; width/height: 100%` and `dvh` for the sheet, legend, exercise bar and dialog. |
| 6.2 | A draggable bottom sheet (peek / half / full) | L | The hand never gets more than ~54 % of the screen, long panels are read through a 300 px window, and wrist regions sit under the sheet. Snap states with `transform`, refit the camera on snap. |
| 6.3 | A compact layer strip instead of the hidden Layers panel | M | On a phone the Layers panel plus the sheet cover the whole screen, so the peel — the signature feature — is invisible while you drag it. A 56 px strip above the sheet: slider, five layer dots, nerve-map switch. |
| 6.4 | Safe areas, pull-to-refresh, scroll chaining, double-tap zoom | S | Content hides under the home indicator; dragging at the top of the sheet reloads Chrome Android and wipes the selection; quick taps on Yes/No zoom iOS. `env(safe-area-inset-*)`, `overscroll-behavior: contain`, `touch-action: manipulation` on buttons, a 14 px tap slop on touch. |
| 6.5 | Phone webcam path | M–L | Portrait frames are cropped to the middle third of a 162 px thumbnail with the status text over them; one hand holds the phone so "point at your other hand" needs a propped phone, which nothing says. Match the preview's aspect ratio, enlarge the dock, add a one-time "prop your phone up an arm's length away" note, a rear-camera flip, and a one-hand "point at the screen" cursor mode (which also serves people with one hand in a splint). |
| 6.6 | Cheaper rendering on phones | M | Cap device pixel ratio at 1.25 on coarse pointers with an adaptive step-down, a mobile shader variant (64 steps, looser epsilon, 3-tap normal), and drop `backdrop-filter` over the live canvas. Measured costs on this Mac: 190 ms of bone meshing at boot (move it to a Worker or cache it), 2.5 ms per frame rebuilding 139 tubes even when the pose hasn't changed (skip when the pose is unchanged), ~100 Vector3 allocations per frame in `skin.update`. |

## 7. Ship it and make it trustworthy

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 7.1 | Deploy to GitHub Pages | S | Nobody can use it, and no clinician will run `python3 serve.py`. Enable Pages from `main` root (github.io is HTTPS, so the webcam works), add a favicon from the logo, Open Graph / Twitter meta with a downscaled hero image, `theme-color`, and put the live URL in the README and help dialog. |
| 7.2 | Tests and CI | M | No tests exist; `analysis.js` can't even be imported in Node because it pulls in Three.js through `rig.js`. Move the finger tables into a dependency-free `hand-data.js`; add `node --test` fixtures for `analyze()` (CTS pattern, palm sparing, test weights), `retarget()` round-trip, `mapPointOnHand`, the skin-protrusion check, a content lint (ids, refs, regions, exercises) and a weekly link checker over the 61 sources. |
| 7.3 | Printable clinician summary | S | Clipboard-only today, and the text drops the reasons, test reliability and sources. Add a print stylesheet / print view with date, hand, each spot (incl. duration and nerve area), red-flag answers, self-checks with their accuracy notes, top conditions with reasons and sources, and the disclaimer; offer JSON export/import. Also show a preview before copying and replace the `prompt()` fallback. |
| 7.4 | Pain diary | M | The app forgets yesterday's pain the moment the slider moves, so it can't answer "is it getting better?". Add `createdAt`/`history` per pin (storage v2 with migration), a "Check in" flow, a 14/30-day sparkline per spot, and the trend in the summary. |
| 7.5 | "About the evidence" page | S | A static, crawlable `about.html`: what it is and isn't, how the ranking works (render the actual weight table from `content.js`), review status and credits, sources grouped by publisher with licence lines, exactly which third-party requests happen (fonts, jsDelivr, Google model storage) and that there are no analytics. |
| 7.6 | Search, labels, glossary | M | 70+ named structures exist only as hover tooltips; there's no way to type "scaphoid" or "De Quervain's". A search box over regions, causes, tests and structures; a Labels toggle using the existing badge projection; a generated glossary. |
| 7.7 | Self-host the runtime and cache it | M | Three.js, MediaPipe and the 7.8 MB hand model all come from third parties with a one-hour cache, so most visits re-download the model and any CDN hiccup breaks the app. Vendor them under `/vendor/`, add a service worker (cache-first for same-origin assets) and a web manifest. |
| 7.8 | Feedback path and i18n groundwork | S | "Something wrong here?" on each card opening a pre-filled issue; move UI strings into one file but don't translate until the content has been clinically reviewed. |

## Suggested order

1. **Week 1 — crashes and honesty (sections 1 and 2.1–2.3):** nothing else matters if the page can freeze, and "Strong fit" from one click is the single biggest credibility problem.
2. **Week 2 — medical gaps (section 3) and the first-five-minutes fixes (4.1–4.5):** this is what a reviewing clinician will judge, and it's what decides whether a first-time visitor stays.
3. **Week 3 — deploy, tests, print summary (7.1–7.3) and accessibility basics (5.1–5.4):** gets a real link in front of real users and reviewers with a safety net under the content.
4. **Then:** the phone work (section 6), the diary, search and labels, and self-hosting.

## What was rejected

All 23 independently re-checked findings held up. Reviewers' corrections that are already folded in above: "below the fold" was slightly overstated at 1440×900 (the heading is just visible) and understated on smaller screens; "show only 3 tips" was dropped because every region has only 3–4; disabling the Add button until a pain level is chosen would break the webcam auto-save path, so the "Add at 5/10" label is used instead; the lead copy is two sentences, not one. Two review angles (performance and webcam tracking) did not complete; their ground was covered by direct measurement, recorded in 6.6 and 1.4–1.5.
