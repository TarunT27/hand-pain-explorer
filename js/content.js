// Educational content: pain regions, possible causes, recovery tips, red flags.
// Plain-language summaries of common hand conditions — not a diagnostic tool.

export const SYMPTOMS = [
  { key: 'aching', label: 'Dull ache' },
  { key: 'sharp', label: 'Sharp with movement' },
  { key: 'numb', label: 'Numb / tingling' },
  { key: 'swelling', label: 'Swelling' },
  { key: 'lump', label: 'Lump or bump' },
  { key: 'stiff', label: 'Stiff, worse mornings' },
  { key: 'clicking', label: 'Clicking / locking' },
  { key: 'weak', label: 'Weak grip / pinch' },
  { key: 'night', label: 'Worse at night' },
  { key: 'injury', label: 'Started after an injury' },
  { key: 'cold', label: 'Cold / colour change' },
  { key: 'redhot', label: 'Red, hot or fever' },
  { key: 'wound', label: 'Cut, bite or puncture' },
  { key: 'cantmove', label: 'Can\'t bend or straighten it / droops' },
];
// Tags that separate an emergency from a sprain carry more weight in the ranking.
export const STRONG_SYMPTOMS = ['redhot', 'wound', 'cantmove'];

// Onset: how long it has been going on. Weights nudge acute vs chronic conditions.
export const ONSETS = [
  { key: 'hours', label: 'Hours to days' },
  { key: 'weeks', label: '1–6 weeks' },
  { key: 'months', label: 'Months or longer' },
];
export const ONSET_WEIGHTS = {
  acute: ['fracture', 'wrist-fracture', 'scaphoid', 'sprain', 'mallet', 'jersey', 'boutonniere', 'skiers-thumb', 'sl-injury', 'hamate', 'felon', 'paronychia', 'sheath-infection', 'fight-bite', 'cellulitis', 'gout', 'septic', 'laceration', 'contusion', 'sagittal'],
  chronic: ['oa', 'cmc-oa', 'dupuytren', 'wrist-oa', 'kienbock', 'ulnar-impaction', 'carpal-boss', 'ra', 'psa', 'trigger', 'cts', 'cubital', 'raynaud', 'crps'],
};
// Conditions that often affect both hands at once.
export const BILATERAL = ['ra', 'psa', 'oa', 'raynaud', 'cts', 'dupuytren', 'cmc-oa'];

export const GENERAL_RED_FLAGS = [
  'A deformed, very swollen or unusable hand after an injury, or a wound over a broken bone',
  'A cut or puncture followed by a red, swollen finger held bent — or fever and spreading redness',
  'A tiny puncture from a paint, grease or pressure-washer gun — even if it barely hurts, go to emergency now',
  'One joint that is hot, red and swollen, especially with fever — infection can look like gout',
  'A cut after which you can\'t bend or straighten the finger, or the tip feels numb',
  'A cat, dog or human bite over a joint or tendon',
  'After an injury or in a cast: pain far worse than expected, worse when the fingers are pulled straight, with a tight, hard forearm or hand',
  'A cold, pale or blue finger or hand',
  'Sudden numbness or weakness with face droop, slurred speech or confusion — call emergency services',
];
// Questions asked before the ranking. `key` is stored with the user's answers.
export const RED_FLAG_CHECKS = [
  { key: 'deformed', label: 'Deformed, very swollen or unusable after an injury, or bone showing' },
  { key: 'hotjoint', label: 'One joint hot, red and swollen, or fever' },
  { key: 'woundmove', label: 'A cut, bite or puncture — especially if the finger won\'t move or the tip is numb' },
  { key: 'injection', label: 'A puncture from a paint, grease or pressure-washer gun' },
  { key: 'cold', label: 'A finger or hand that is cold, pale or blue' },
  { key: 'compartment', label: 'Pain far worse than expected after injury or in a cast, with a tight, hard forearm' },
  { key: 'neuro', label: 'Sudden weakness or numbness with face droop, slurred speech or confusion' },
];

export const REGIONS = {
  fingertip: {
    title: 'Fingertip', perFinger: true, view: 'palm',
    blurb: 'The pulp and nail bed are packed with nerve endings, so infections, crush injuries and nerve problems are felt sharply here.',
    structures: [
      { label: 'Distal phalanx', tags: ['phalanx'], layer: 'bones' },
      { label: 'Digital nerves', tags: ['digital-median', 'digital-ulnar'], layer: 'nerves' },
      { label: 'Digital arteries', tags: ['digital-artery'], layer: 'nerves' },
      { label: 'Deep flexor tendon (FDP)', tags: ['fdp'], layer: 'tendons' },
    ],
    causes: [
      { id: 'paronychia', name: 'Paronychia (nail-fold infection)', common: true, tags: ['swelling', 'sharp', 'redhot'], desc: 'Red, swollen, tender skin beside the nail, sometimes with a pocket of pus. Often follows a hangnail or nail biting.', helps: 'Warm soaks 3–4× a day for early cases; see a clinician if pus forms — it may need draining.' },
      { id: 'fracture', name: 'Crush injury or tuft fracture', common: true, tags: ['injury', 'swelling', 'sharp'], noExercise: true, desc: 'Door slams and hammer blows can fracture the fingertip bone or bleed under the nail.', helps: 'Ice, elevate and protect with a padded splint. A large, painful blood blister under the nail can be released by a clinician.' },
      { id: 'cts', name: 'Carpal tunnel syndrome (median nerve)', common: true, fingers: ['thumb', 'index', 'middle', 'ring'], tags: ['numb', 'night', 'weak'], desc: 'Tingling or numb tips of the thumb, index, middle or thumb-side of the ring finger usually come from the median nerve squeezed at the wrist.', helps: 'Night wrist splint, nerve glides; see the wrist (palm side) region.' },
      { id: 'cubital', name: 'Ulnar nerve compression (elbow or wrist)', fingers: ['ring', 'pinky'], tags: ['numb', 'weak', 'night'], desc: 'Tingling in the little finger and the little-finger side of the ring finger points to the ulnar nerve — squeezed at the elbow (cubital tunnel) or wrist (Guyon\'s canal).', helps: 'Avoid leaning on elbows or handlebars; keep elbows straighter at night.' },
      { id: 'felon', name: 'Felon (fingertip pulp infection)', tags: ['swelling', 'sharp', 'night', 'redhot', 'wound'], desc: 'Tense, throbbing, very painful swelling of the fingertip pad, often after a small puncture.', helps: 'Needs prompt medical care — usually antibiotics and sometimes drainage.' },
      { id: 'raynaud', name: 'Raynaud\'s phenomenon', tags: ['cold', 'numb'], desc: 'Fingertips turn white or blue in the cold or with stress, then red and throbbing as they rewarm.', helps: 'Keep the whole body warm, wear gloves, avoid smoking; ask about it if it is new or one-sided.' },
      { id: 'glomus', name: 'Glomus tumour', tags: ['cold', 'sharp'], desc: 'Rare, benign growth under the nail causing pinpoint pain and cold sensitivity.', helps: 'Diagnosed by a hand specialist; treated by removal.' },
      { id: 'laceration', name: 'Cut with tendon or nerve injury', tags: ['wound', 'numb', 'cantmove', 'injury'], noExercise: true, desc: 'A cut on the finger after which the tip feels numb on one side, or the finger will not bend or straighten fully — the tendon or digital nerve may be cut even if the wound looks small.', helps: 'Same-day assessment: tendon and nerve repairs work best early.' },
      { id: 'injection', name: 'High-pressure injection injury', tags: ['wound', 'injury', 'swelling'], noExercise: true, desc: 'A pinhole wound from a paint, grease or pressure-washer gun, often on the non-dominant index finger. It looks trivial for hours, then the finger swells and the tissue dies.', helps: 'Emergency — go now, even if it barely hurts. Do not wait to see if it settles.' },
    ],
    tips: [
      'Keep cuts and hangnails clean; don\'t pick cuticles',
      'Warm salt-water soaks for early nail-fold infections',
      'Protect a sore tip with a padded finger cap or tape',
      'Warm gloves and hand warmers if cold triggers pain',
    ],
    exercises: ['tendonGlides'],
    redFlags: ['Tense, throbbing fingertip swelling or spreading redness', 'Fever with a painful finger', 'Numbness that is constant or getting worse', 'A puncture from a paint, grease or pressure gun — emergency', 'A cut after which the tip is numb or the finger won\'t move properly'],
  },

  dip: {
    title: 'End knuckle (DIP joint)', perFinger: true, view: 'back',
    blurb: 'The last joint of the finger. Arthritis, tendon injuries and small cysts are common here.',
    structures: [
      { label: 'DIP joint cartilage', tags: ['cartilage'], layer: 'bones' },
      { label: 'Extensor tendon (terminal)', tags: ['edc'], layer: 'tendons' },
      { label: 'Deep flexor tendon (FDP)', tags: ['fdp'], layer: 'tendons' },
      { label: 'Collateral ligaments', tags: ['collateral'], layer: 'tendons' },
    ],
    causes: [
      { id: 'oa', name: 'Osteoarthritis (Heberden\'s nodes)', common: true, tags: ['aching', 'stiff', 'lump'], desc: 'Bony bumps on the end knuckles with aching and stiffness, common after 50 and often runs in families.', helps: 'Warm water in the morning, gentle movement, larger-grip tools; topical anti-inflammatory gels can ease flares.' },
      { id: 'mallet', name: 'Mallet finger', common: true, tags: ['injury', 'cantmove'], noExercise: true, desc: 'The fingertip droops and cannot straighten on its own after being jammed (e.g. by a ball). The extensor tendon is torn or pulled off with a bone fleck.', helps: 'Needs a splint holding the tip straight at all times for up to 8 weeks — get it checked promptly, ideally the same day.' },
      { id: 'jersey', name: 'Jersey finger (FDP avulsion)', tags: ['injury', 'weak', 'cantmove'], noExercise: true, desc: 'After grabbing a jersey or being yanked, the fingertip cannot bend. About 3 in 4 cases involve the ring finger.', helps: 'Time-sensitive — repair within about 10 days gives the best results, so get seen promptly.' },
      { id: 'ganglion', name: 'Mucous (digital myxoid) cyst', tags: ['lump'], desc: 'A small, smooth bump between the end knuckle and the nail, linked to arthritis. It can groove the nail.', helps: 'Often left alone; don\'t pop it (infection risk). Can be removed if painful.' },
      { id: 'psa', name: 'Psoriatic arthritis', tags: ['swelling', 'stiff'], desc: 'Swollen end knuckles, a "sausage" finger or pitted nails, often with psoriasis.', helps: 'See a GP / rheumatologist — early treatment protects joints.' },
      { id: 'gout', name: 'Gout / pseudogout', tags: ['swelling', 'sharp', 'redhot', 'night'], desc: 'A sudden, exquisitely tender, hot red end knuckle, sometimes on top of existing arthritic nodes — more common in older adults on water tablets.', helps: 'Rest, ice and see a GP the same day if it is hot and red: infection can look identical.' },
    ],
    tips: [
      'Morning warm-up: soak hands in warm water, then gentle bends',
      'Use built-up grips, jar openers and lever taps',
      'After a jam: if the tip won\'t straighten, splint it straight and get checked',
    ],
    exercises: ['tendonGlides', 'fingerSpreads'],
    redFlags: ['Cannot straighten or bend the fingertip after an injury', 'Red, hot, very swollen joint'],
  },

  pip: {
    title: 'Middle knuckle (PIP joint)', perFinger: true, view: 'back',
    blurb: 'The workhorse joint of each finger. It stiffens easily after injury, so early gentle movement matters.',
    structures: [
      { label: 'PIP joint cartilage', tags: ['cartilage'], layer: 'bones' },
      { label: 'Collateral ligaments', tags: ['collateral'], layer: 'tendons' },
      { label: 'Volar plate', tags: ['volar-plate'], layer: 'tendons' },
      { label: 'Superficial flexor tendon (FDS)', tags: ['fds'], layer: 'tendons' },
      { label: 'Extensor mechanism', tags: ['edc'], layer: 'tendons' },
    ],
    causes: [
      { id: 'sprain', name: 'Jammed finger (sprain / volar plate injury)', common: true, tags: ['injury', 'swelling', 'stiff'], desc: 'Ball or fall to the fingertip sprains the side ligaments or the plate on the palm side. Swelling can linger for weeks.', helps: 'If the joint was dislocated, looks crooked, is very swollen, or you can\'t straighten the middle knuckle, get an X-ray first. Otherwise buddy-tape to the neighbour, ice, elevate and move it gently.' },
      { id: 'oa', name: 'Osteoarthritis (Bouchard\'s nodes)', common: true, tags: ['aching', 'stiff', 'lump'], desc: 'Bony enlargement with stiffness and aching, often alongside end-knuckle arthritis.', helps: 'Heat, gentle range-of-motion, joint protection; a hand therapist can fit splints.' },
      { id: 'ra', name: 'Rheumatoid arthritis', tags: ['swelling', 'stiff', 'aching'], desc: 'Soft, warm swelling in several finger joints on both hands with morning stiffness lasting over 30–60 minutes.', helps: 'See a GP promptly — early treatment prevents joint damage.' },
      { id: 'boutonniere', name: 'Boutonnière injury (central slip)', tags: ['injury', 'cantmove'], noExercise: true, desc: 'After a jam, the middle knuckle stays bent and cannot straighten while the tip bends back.', helps: 'Needs splinting of the PIP straight — see a clinician early.' },
      { id: 'fracture', name: 'Dislocation or fracture', tags: ['injury', 'swelling', 'cantmove'], noExercise: true, desc: 'Obvious deformity or severe pain after injury. A fracture-dislocation of this joint is often missed and is the commonest cause of a permanently stiff finger.', helps: 'Don\'t pull it back yourself — get an X-ray.' },
      { id: 'psa', name: 'Psoriatic arthritis (dactylitis)', tags: ['swelling', 'stiff'], desc: 'A whole finger swollen like a sausage, nail pitting, or psoriasis anywhere on the skin.', helps: 'See a GP / rheumatologist — early treatment protects the joints.' },
      { id: 'gout', name: 'Gout / pseudogout', tags: ['swelling', 'sharp', 'redhot', 'night'], desc: 'A sudden hot, red, exquisitely tender joint, often overnight.', helps: 'Rest, ice and same-day GP review if hot and red — infection can look the same.' },
    ],
    tips: [
      'Buddy-tape a sprained finger to its neighbour for 2–3 weeks',
      'Ice 10–15 minutes and keep the hand above heart level early on',
      'Once a clinician has ruled out a fracture or central slip injury: gently bend and straighten several times a day as pain allows',
      'Rings off early if the finger is swelling',
    ],
    exercises: ['tendonGlides', 'fingerSpreads'],
    redFlags: ['Deformity after injury', 'Still can\'t straighten the middle knuckle 1–2 days after a jam — central slip injuries need early splinting', 'Numbness after injury', 'A hot, red joint'],
  },

  fingerBase: {
    title: 'Base of finger (palm side)', perFinger: true, view: 'palm',
    blurb: 'Here the flexor tendons enter a tunnel of pulleys. Thickening of the first pulley (A1) is what makes a finger catch or lock.',
    structures: [
      { label: 'A1 pulley', tags: ['a1'], layer: 'tendons' },
      { label: 'Flexor tendons', tags: ['fds', 'fdp'], layer: 'tendons' },
      { label: 'Palmar fascia', tags: ['aponeurosis'], layer: 'tendons' },
      { label: 'Digital nerves', tags: ['digital-median', 'digital-ulnar'], layer: 'nerves' },
    ],
    causes: [
      { id: 'trigger', name: 'Trigger finger (stenosing tenosynovitis)', common: true, tags: ['clicking', 'lump', 'stiff', 'aching'], desc: 'The finger catches, clicks or locks when bending, with a tender nodule at the base in the palm. Worse in the morning; more common with diabetes.', helps: 'Rest from hard gripping, a night splint holding the finger straight, gentle tendon glides. A steroid injection often settles it.' },
      { id: 'overuse', name: 'Flexor tendinitis from gripping', common: true, tags: ['aching', 'sharp'], desc: 'Aching at the finger base after heavy gripping, climbing or tool use.', helps: 'Reduce grip load, use padded or wider handles, rebuild gradually.' },
      { id: 'dupuytren', name: 'Dupuytren\'s nodule', tags: ['lump'], desc: 'A firm, usually painless lump in the palm that may form a cord and slowly pull the finger bent (ring and little fingers most often).', helps: 'Monitor with the tabletop test (can you lay your hand flat?). Treatments exist if it contracts.' },
      { id: 'ganglion', name: 'Retinacular (pulley) ganglion', tags: ['lump'], desc: 'A small, firm, pea-sized cyst at the finger base, painful when gripping.', helps: 'Often settles on its own; can be aspirated if bothersome.' },
      { id: 'sheath-infection', name: 'Flexor sheath infection', tags: ['swelling', 'injury', 'sharp', 'redhot', 'wound'], noExercise: true, desc: 'After a cut or puncture: an evenly swollen finger, held slightly bent, very painful to straighten.', helps: 'Emergency — needs urgent antibiotics and often surgery.' },
      { id: 'psa', name: 'Psoriatic arthritis (dactylitis)', tags: ['swelling', 'stiff'], desc: 'The whole finger swollen like a sausage, with nail pitting or psoriasis.', helps: 'See a GP / rheumatologist.' },
      { id: 'laceration', name: 'Cut with tendon or nerve injury', tags: ['wound', 'numb', 'cantmove', 'injury'], noExercise: true, desc: 'A cut in the palm or finger base after which the finger won\'t bend fully or one side of it is numb.', helps: 'Same-day assessment — repairs work best early.' },
    ],
    tips: [
      'Avoid prolonged tight gripping; take micro-breaks',
      'Use padded gloves or thicker handles for tools',
      'A night splint keeping the finger straight can calm triggering',
      'Gentle massage over the nodule and tendon glides',
    ],
    exercises: ['tendonGlides'],
    redFlags: ['Finger locked bent and won\'t straighten', 'Swollen red finger after a puncture — emergency'],
  },

  knuckle: {
    title: 'Knuckle (MCP joint)', perFinger: true, view: 'back',
    blurb: 'The big knuckles take the force of punching, gripping and pushing. Several arthritis types start here.',
    structures: [
      { label: 'Metacarpal head', tags: ['metacarpal'], layer: 'bones' },
      { label: 'Knuckle cartilage', tags: ['cartilage'], layer: 'bones' },
      { label: 'Extensor tendon', tags: ['edc'], layer: 'tendons' },
      { label: 'Sagittal bands', tags: ['sagittal'], layer: 'tendons' },
      { label: 'Interosseous muscles', tags: ['interossei', 'di1'], layer: 'muscles' },
    ],
    causes: [
      { id: 'fracture', name: 'Boxer\'s fracture', common: true, tags: ['injury', 'swelling'], noExercise: true, desc: 'Break of the metacarpal neck (usually little or ring finger) after punching; the knuckle looks sunken.', helps: 'Ice and elevate; needs an X-ray. Check the finger doesn\'t rotate when you make a fist.' },
      { id: 'ra', name: 'Rheumatoid arthritis', common: true, tags: ['swelling', 'stiff', 'aching'], desc: 'Knuckles on both hands swollen and stiff, especially in the morning.', helps: 'See a GP — blood tests and early treatment make a big difference.' },
      { id: 'sagittal', name: 'Sagittal band injury ("boxer\'s knuckle")', tags: ['clicking', 'injury', 'cantmove'], desc: 'The extensor tendon slips off the top of the knuckle when making a fist, with painful snapping.', helps: 'Splinting in a specific position; see a hand therapist.' },
      { id: 'oa', name: 'Osteoarthritis', tags: ['aching', 'stiff'], desc: 'Aching, stiff knuckles — uncommon here without an old injury; if several knuckles are involved, ask about iron levels.', helps: 'Heat for stiffness, gentle movement, larger grips.' },
      { id: 'gout', name: 'Gout / pseudogout', tags: ['swelling', 'sharp', 'redhot', 'night'], desc: 'A single knuckle that becomes hot, red and exquisitely tender over hours.', helps: 'Rest and ice; same-day GP review if hot and red — infection can look identical.' },
      { id: 'fight-bite', name: 'Fight bite', tags: ['injury', 'swelling', 'wound', 'redhot'], noExercise: true, desc: 'A tooth cut over the knuckle from a punch — high infection risk even if small.', helps: 'Urgent medical care and antibiotics.' },
    ],
    tips: [
      'Ice and elevate after an impact',
      'Avoid heavy gripping or push-ups on the knuckles while sore',
      'Warm up stiff knuckles with gentle fist-and-open cycles',
    ],
    exercises: ['tendonGlides', 'fingerSpreads'],
    redFlags: ['A skin break over the knuckle from a punch', 'Finger crosses over its neighbour when you make a fist', 'Hot, red swelling'],
  },

  thumbIP: {
    title: 'Thumb tip & IP joint', view: 'palm',
    blurb: 'The thumb\'s end joint handles every pinch. Locking, arthritis and nail infections are the usual culprits.',
    structures: [
      { label: 'Flexor pollicis longus', tags: ['fpl'], layer: 'tendons' },
      { label: 'Extensor pollicis longus', tags: ['epl'], layer: 'tendons' },
      { label: 'Thumb A1 pulley', tags: ['a1'], layer: 'tendons' },
      { label: 'Thumb digital nerves', tags: ['digital-median'], layer: 'nerves' },
    ],
    causes: [
      { id: 'trigger', name: 'Trigger thumb', common: true, tags: ['clicking', 'lump', 'stiff'], desc: 'The thumb tip catches or locks when bending, with a tender lump at the thumb base on the palm side.', helps: 'Night splint, reduce pinching; injection often helps.' },
      { id: 'oa', name: 'Osteoarthritis of the IP joint', tags: ['aching', 'stiff', 'lump'], desc: 'Aching, bony thickening of the end thumb joint.', helps: 'Heat, gentle movement, wider grips.' },
      { id: 'mallet', name: 'Mallet thumb', tags: ['injury', 'cantmove'], noExercise: true, desc: 'The thumb tip droops and can\'t be lifted after a jam.', helps: 'Splint the tip straight and see a clinician promptly.' },
      { id: 'epl-rupture', name: 'EPL tendon rupture', tags: ['weak', 'cantmove'], noExercise: true, desc: 'Suddenly can\'t lift the thumb tip, often weeks after a wrist fracture or with rheumatoid arthritis — no jam needed.', helps: 'Not a splint problem — see a hand surgeon soon; the tendon ends retract.' },
      { id: 'raynaud', name: 'Raynaud\'s phenomenon', tags: ['cold', 'numb'], desc: 'Thumb turns white or blue in the cold. Thumb involvement is less common and more often suggests an underlying cause.', helps: 'Keep warm; mention thumb involvement to a clinician.' },
      { id: 'paronychia', name: 'Paronychia', tags: ['swelling', 'sharp'], desc: 'Infection beside the nail.', helps: 'Warm soaks; see a clinician if pus forms.' },
      { id: 'cts', name: 'Carpal tunnel syndrome', tags: ['numb', 'night'], desc: 'Tingling in the thumb tip (with index and middle) from the median nerve.', helps: 'Night wrist splint, nerve glides — see the wrist (palm side) region.' },
    ],
    tips: ['Use pens and tools with fatter grips', 'Split heavy pinching tasks into shorter bouts', 'Warm soaks for stiffness'],
    exercises: ['thumbOpposition', 'tendonGlides'],
    redFlags: ['Suddenly unable to lift the thumb', 'Spreading redness or fever'],
  },

  thumbMCP: {
    title: 'Thumb knuckle (MCP joint)', view: 'palm',
    blurb: 'Its side ligaments keep the thumb stable for pinch. The ulnar collateral ligament is a classic ski injury.',
    structures: [
      { label: 'Ulnar collateral ligament', tags: ['ucl'], layer: 'tendons' },
      { label: 'Thumb A1 pulley', tags: ['a1'], layer: 'tendons' },
      { label: 'Thenar muscles', tags: ['thenar'], layer: 'muscles' },
      { label: 'Adductor pollicis', tags: ['adductor'], layer: 'muscles' },
    ],
    causes: [
      { id: 'skiers-thumb', name: 'Skier\'s / gamekeeper\'s thumb (UCL sprain or tear)', common: true, tags: ['injury', 'weak', 'swelling'], noExercise: true, desc: 'Pain and weakness on the index-finger side of the thumb knuckle after the thumb is forced outward (fall with a ski pole, ball).', helps: 'Thumb spica splint and ice. A severe sprain or complete tear may need surgery — get it assessed promptly.' },
      { id: 'trigger', name: 'Trigger thumb', common: true, tags: ['clicking', 'lump'], desc: 'Tender nodule on the palm side of the thumb knuckle with catching.', helps: 'Splint, rest from pinching, injection.' },
      { id: 'sprain', name: 'Radial collateral ligament sprain', tags: ['injury'], desc: 'Pain on the outer side of the thumb knuckle after a sideways force.', helps: 'Splint and ice; get checked if it feels unstable.' },
      { id: 'oa', name: 'MCP arthritis', tags: ['aching', 'stiff'], desc: 'Aching and stiffness of the thumb knuckle, sometimes with hyperextension.', helps: 'Splinting and joint-protection techniques.' },
      { id: 'gout', name: 'Gout / pseudogout', tags: ['swelling', 'sharp', 'redhot', 'night'], desc: 'A sudden hot, red, very tender thumb knuckle.', helps: 'Rest and ice; same-day GP review if hot and red.' },
    ],
    tips: ['Avoid forceful pinch and wide grasp while healing', 'Tape or splint the thumb for sport', 'Ice after activity'],
    exercises: ['thumbOpposition'],
    redFlags: ['Thumb knuckle feels loose or unstable', 'A lump on the index side of the knuckle after injury (possible Stener lesion)'],
  },

  thumbBase: {
    title: 'Base of the thumb (CMC joint)', view: 'palm',
    blurb: 'A saddle joint that lets the thumb swivel. It carries huge loads during pinch, making it one of the most common arthritis sites.',
    structures: [
      { label: 'Trapezium', tags: ['trapezium'], layer: 'bones' },
      { label: 'CMC joint cartilage', tags: ['cmc-cartilage'], layer: 'bones' },
      { label: 'Thumb metacarpal', tags: ['thumb-metacarpal'], layer: 'bones' },
      { label: 'Abductor pollicis longus', tags: ['apl-epb'], layer: 'tendons' },
      { label: 'Thenar muscles', tags: ['thenar'], layer: 'muscles' },
    ],
    causes: [
      { id: 'cmc-oa', name: 'Basal thumb arthritis (CMC osteoarthritis)', common: true, tags: ['aching', 'weak', 'stiff', 'lump'], desc: 'Deep ache at the thumb base when pinching, turning keys or opening jars; later a bump and weakness. Very common in women over 50.', helps: 'A thumb CMC splint during tasks or at night, wider grips, jar openers, strengthening the muscles that stabilise the joint.' },
      { id: 'dequervain', name: 'De Quervain\'s tenosynovitis', common: true, tags: ['sharp', 'swelling'], desc: 'Pain on the thumb side of the wrist spreading into the thumb base, worse lifting or texting.', helps: 'Thumb spica splint and rest — see the wrist (thumb side) region.' },
      { id: 'scaphoid', name: 'Scaphoid or trapezium fracture', tags: ['injury'], noExercise: true, desc: 'Pain at the thumb base after a fall on an outstretched hand.', helps: 'Get an X-ray; a scaphoid fracture can be missed at first.' },
      { id: 'sprain', name: 'Thumb sprain', tags: ['injury', 'swelling'], desc: 'Ligament strain around the thumb base.', helps: 'Splint, ice and gradual return.' },
      { id: 'fracture', name: 'Bennett\'s / thumb metacarpal base fracture', tags: ['injury', 'swelling'], noExercise: true, desc: 'After a punch or a fall onto the thumb: swelling and pain at the very base of the thumb with weak pinch.', helps: 'Needs an X-ray — these often need surgery to stay in place.' },
      { id: 'trigger', name: 'Trigger thumb', tags: ['clicking', 'lump', 'stiff'], desc: 'Catching or locking of the thumb with a tender lump in the crease at the thumb knuckle — often described as "the base of my thumb".', helps: 'Rest from pinching, night splint; injection often settles it.' },
    ],
    tips: [
      'Use a splint for tasks that flare it (and at night if sore)',
      'Choose fat pens, lever taps, jar and key turners',
      'Pinch with the pads, not the tips; avoid a tight "key" pinch',
      'Heat before activity, ice after if it flares',
    ],
    exercises: ['thumbCircles', 'thumbOpposition'],
    redFlags: ['Pain after a fall with tenderness in the "snuffbox" at the thumb side of the wrist'],
  },

  thenar: {
    title: 'Thumb pad (thenar eminence)', view: 'palm',
    blurb: 'Three small muscles move the thumb. They are powered by a branch of the median nerve — so carpal tunnel can weaken or shrink them.',
    structures: [
      { label: 'Thenar muscles', tags: ['thenar'], layer: 'muscles' },
      { label: 'Recurrent branch of median nerve', tags: ['median'], layer: 'nerves' },
      { label: 'Flexor pollicis longus', tags: ['fpl'], layer: 'tendons' },
      { label: 'Transverse carpal ligament', tags: ['tcl'], layer: 'tendons' },
    ],
    causes: [
      { id: 'cts', name: 'Carpal tunnel syndrome', common: true, tags: ['weak', 'night'], desc: 'Weakness or clumsiness of the thumb and, in advanced cases, a hollowed pad. The tingling itself is felt in the fingers, not the pad — the pad\'s skin nerve bypasses the carpal tunnel.', helps: 'Neutral wrist splint at night, nerve glides, fewer sustained wrist bends.' },
      { id: 'overuse', name: 'Muscle overuse (texting, gaming, tools)', common: true, tags: ['aching'], desc: 'Aching thumb pad after long bouts of thumb work.', helps: 'Breaks, switch hands, self-massage and gentle stretching.' },
      { id: 'cmc-oa', name: 'Basal thumb arthritis (referred ache)', tags: ['aching', 'stiff'], desc: 'Arthritis at the thumb base often aches into the pad.', helps: 'See the thumb base region.' },
      { id: 'contusion', name: 'Bruise / contusion', tags: ['injury'], desc: 'Direct blow to the pad.', helps: 'Ice, protect, resolves in 1–2 weeks.' },
    ],
    tips: ['Wear a neutral wrist splint at night if tingling wakes you', 'Break up long phone or controller sessions', 'Gently massage the thumb pad in circles'],
    exercises: ['medianNerveGlide', 'thumbOpposition'],
    redFlags: ['Visible hollowing of the thumb pad', 'Constant numbness or clumsiness'],
  },

  palmCenter: {
    title: 'Centre of the palm', view: 'palm',
    blurb: 'Under a tough sheet of fascia run the flexor tendons, the palmar arteries and the nerves to the fingers.',
    structures: [
      { label: 'Palmar aponeurosis', tags: ['aponeurosis'], layer: 'tendons' },
      { label: 'Flexor tendons', tags: ['fds', 'fdp'], layer: 'tendons' },
      { label: 'Superficial palmar arch', tags: ['ulnar-artery'], layer: 'nerves' },
      { label: 'Lumbricals', tags: ['lumbrical'], layer: 'muscles' },
      { label: 'Metacarpals', tags: ['metacarpal'], layer: 'bones' },
    ],
    causes: [
      { id: 'dupuytren', name: 'Dupuytren\'s disease', common: true, tags: ['lump'], desc: 'Nodules or cords in the palm, usually painless, that can slowly pull fingers into a bend.', helps: 'Monitor with the tabletop test; treatment when the hand can\'t lie flat.' },
      { id: 'trigger', name: 'Trigger finger', common: true, tags: ['clicking', 'lump'], desc: 'Tender nodule near the palm crease at a finger base, with catching.', helps: 'See the base-of-finger region.' },
      { id: 'overuse', name: 'Palm overuse / bruising from tools', tags: ['aching'], desc: 'Aching from pressure of handles, weights or handlebars.', helps: 'Padded gloves and wider handles.' },
      { id: 'fracture', name: 'Metacarpal fracture', tags: ['injury', 'swelling'], desc: 'Pain and swelling after a fall or impact.', helps: 'X-ray; splint.' },
      { id: 'ganglion', name: 'Ganglion or tendon sheath swelling', tags: ['lump', 'swelling'], desc: 'Soft swelling along the tendons, sometimes with inflammatory arthritis.', helps: 'Get assessed if persistent.' },
      { id: 'laceration', name: 'Cut with tendon or nerve injury', tags: ['wound', 'numb', 'cantmove', 'injury'], noExercise: true, desc: 'A palm cut after which a finger won\'t bend fully or part of a finger is numb.', helps: 'Same-day assessment — the flexor tendons and nerves lie just under the skin here.' },
      { id: 'injection', name: 'High-pressure injection injury', tags: ['wound', 'injury', 'swelling'], noExercise: true, desc: 'A pinhole from a paint or grease gun that looks trivial and then swells hard over hours.', helps: 'Emergency — go now.' },
      { id: 'septic', name: 'Deep palm infection', tags: ['redhot', 'swelling', 'wound'], noExercise: true, desc: 'Hot, tense, spreading swelling of the palm, often with fever, after a wound or an untreated finger infection.', helps: 'Emergency — needs antibiotics and usually surgery.' },
    ],
    tips: ['Padded gloves for gym, cycling and tools', 'Stretch the palm: fingers back against a table', 'Tabletop test monthly if you have nodules'],
    exercises: ['tendonGlides', 'fingerSpreads'],
    redFlags: ['Palm infection with swelling and fever', 'Fingers can\'t be straightened'],
  },

  hypothenar: {
    title: 'Little-finger side of the palm (hypothenar)', view: 'palm',
    blurb: 'The ulnar nerve and artery pass through Guyon\'s canal here, beside the pisiform and the hook of the hamate.',
    structures: [
      { label: 'Hypothenar muscles', tags: ['hypothenar'], layer: 'muscles' },
      { label: 'Ulnar nerve', tags: ['ulnar-nerve'], layer: 'nerves' },
      { label: 'Ulnar artery', tags: ['ulnar-artery'], layer: 'nerves' },
      { label: 'Pisiform & hook of hamate', tags: ['pisiform', 'hamate'], layer: 'bones' },
    ],
    causes: [
      { id: 'guyon', name: 'Ulnar nerve compression at Guyon\'s canal ("cyclist\'s palsy")', common: true, tags: ['numb', 'weak'], desc: 'Numb or tingling little and half ring finger, clumsy fine movements; from leaning on handlebars or tools.', helps: 'Padded gloves, change hand positions, rest the pressure point.' },
      { id: 'hamate', name: 'Hook of hamate fracture', tags: ['injury', 'sharp'], noExercise: true, desc: 'Deep pain in this area from golf, baseball or racquet grips, worse gripping. Can also cause little-finger tingling and, if missed, a flexor tendon rupture.', helps: 'Often missed on plain X-ray — needs a specific view or CT.' },
      { id: 'hammer', name: 'Hypothenar hammer syndrome', tags: ['cold', 'numb'], desc: 'Using the palm as a hammer damages the ulnar artery: cold, pale, painful ring and little fingers.', helps: 'Stop palm-striking and get checked urgently.' },
      { id: 'pisiform', name: 'Pisiform / FCU irritation', tags: ['aching'], desc: 'Aching at the pisiform with wrist bending and gripping.', helps: 'Rest, padding, gradual strengthening.' },
      { id: 'cubital', name: 'Cubital tunnel syndrome (elbow)', tags: ['numb', 'night'], desc: 'Ulnar-nerve tingling that also affects the back of the hand; worse with elbows bent.', helps: 'Avoid leaning on elbows; keep elbows straighter at night.' },
    ],
    tips: ['Padded cycling gloves and varied grip positions', 'Never use your palm as a hammer', 'Avoid leaning on elbows for long periods'],
    exercises: ['fingerSpreads'],
    redFlags: ['Cold, pale or blue fingers', 'Weak spreading of fingers or muscle wasting'],
  },

  backOfHand: {
    title: 'Back of the hand', view: 'back',
    blurb: 'Thin skin covers the extensor tendons, the metacarpals and the interosseous muscles between them.',
    structures: [
      { label: 'Extensor tendons', tags: ['edc'], layer: 'tendons' },
      { label: 'Dorsal interossei', tags: ['interossei', 'di1'], layer: 'muscles' },
      { label: 'Metacarpals', tags: ['metacarpal'], layer: 'bones' },
      { label: 'Superficial radial nerve', tags: ['sup-radial'], layer: 'nerves' },
      { label: 'Dorsal veins', tags: ['veins'], layer: 'nerves' },
    ],
    causes: [
      { id: 'extensor', name: 'Extensor tendinitis', common: true, tags: ['aching', 'sharp', 'swelling'], desc: 'Aching along the tendons from typing, gaming or lifting with the wrist bent back.', helps: 'Relative rest, neutral wrist posture, ice after activity.' },
      { id: 'fracture', name: 'Metacarpal fracture or contusion', common: true, tags: ['injury', 'swelling'], noExercise: true, desc: 'After a blow or punch; swelling on the back of the hand is common.', helps: 'Ice, elevate, X-ray if you can\'t make a full fist.' },
      { id: 'ganglion', name: 'Dorsal ganglion cyst', tags: ['lump'], desc: 'A smooth, rubbery lump that can change size.', helps: 'Usually harmless; don\'t smash it. Can be aspirated or removed.' },
      { id: 'carpal-boss', name: 'Carpal boss', tags: ['lump', 'aching'], desc: 'A hard bony bump at the base of the index/middle metacarpals.', helps: 'Usually managed with rest; surgery rarely.' },
      { id: 'cellulitis', name: 'Cellulitis', tags: ['swelling', 'redhot', 'wound'], noExercise: true, desc: 'Warm, red, spreading swelling, sometimes with fever.', helps: 'Needs prompt medical care.' },
      { id: 'ra', name: 'Inflammatory tenosynovitis (e.g. rheumatoid)', tags: ['swelling', 'stiff', 'aching'], desc: 'Soft, puffy swelling over the back of the hand or wrist, often both sides, with morning stiffness.', helps: 'See a GP promptly — early treatment protects the tendons and joints.' },
    ],
    tips: ['Keep the wrist neutral while typing (no resting on the heel of the hand)', 'Ice 10–15 min after aggravating activity', 'Gradual return to lifting'],
    exercises: ['tendonGlides', 'wristFlexExtend'],
    redFlags: ['Red, hot, spreading swelling', 'Can\'t straighten a finger at the knuckle'],
  },

  wristPalmar: {
    title: 'Wrist, palm side', view: 'palm',
    blurb: 'The carpal tunnel: nine flexor tendons and the median nerve share a tight space under the transverse carpal ligament.',
    structures: [
      { label: 'Transverse carpal ligament', tags: ['tcl'], layer: 'tendons' },
      { label: 'Median nerve', tags: ['median'], layer: 'nerves' },
      { label: 'Flexor tendons', tags: ['fds', 'fdp', 'fpl'], layer: 'tendons' },
      { label: 'Flexor carpi radialis', tags: ['fcr'], layer: 'tendons' },
      { label: 'Radial artery', tags: ['radial-artery'], layer: 'nerves' },
    ],
    causes: [
      { id: 'cts', name: 'Carpal tunnel syndrome', common: true, tags: ['numb', 'night', 'weak', 'aching'], desc: 'Tingling or numbness in the thumb, index, middle and half of the ring finger; wakes you at night, eased by shaking the hand.', helps: 'Neutral wrist splint at night, nerve glides, reduce sustained wrist bending; injection or surgery if persistent.' },
      { id: 'ganglion', name: 'Volar ganglion cyst', common: true, tags: ['lump'], desc: 'A lump at the wrist crease on the thumb side, often near the pulse.', helps: 'Often harmless; avoid self-draining because the radial artery is close.' },
      { id: 'fcr', name: 'Flexor carpi radialis tendinitis', tags: ['sharp', 'aching'], desc: 'Pain at the base of the thumb on the palm side with wrist bending.', helps: 'Rest, splint, ice, then gradual loading.' },
      { id: 'wrist-fracture', name: 'Distal radius fracture or wrist sprain', tags: ['injury', 'swelling'], noExercise: true, desc: 'After a fall on an outstretched hand.', helps: 'X-ray; splint or cast.' },
      { id: 'ra', name: 'Flexor tenosynovitis (inflammatory)', tags: ['swelling', 'stiff'], desc: 'Puffy swelling at the front of the wrist, e.g. with rheumatoid arthritis.', helps: 'Medical assessment.' },
      { id: 'crps', name: 'Complex regional pain syndrome', tags: ['cold', 'swelling', 'sharp', 'injury'], desc: 'Weeks after a fracture, sprain or surgery: pain out of proportion, with the hand swollen, shiny, sweaty or changing colour and temperature, and painfully sensitive to light touch.', helps: 'Early diagnosis matters — see a clinician soon; keep the hand moving gently rather than guarding it.' },
    ],
    tips: [
      'Sleep with wrists straight (a splint helps)',
      'Keep keyboard and mouse at elbow height, wrists neutral',
      'Break up gripping, driving and phone use with micro-breaks',
      'Gentle median nerve glides, never forced into tingling',
    ],
    exercises: ['medianNerveGlide', 'wristFlexExtend', 'tendonGlides'],
    redFlags: ['Constant numbness or weakness', 'Wasting of the thumb pad', 'Deformity after a fall'],
  },

  wristRadial: {
    title: 'Wrist, thumb side', view: 'thumb',
    blurb: 'Two thumb tendons (APL and EPB) glide over the radial styloid here, next to the scaphoid bone and the "anatomical snuffbox".',
    structures: [
      { label: 'APL & EPB tendons (1st compartment)', tags: ['apl-epb'], layer: 'tendons' },
      { label: 'Scaphoid', tags: ['scaphoid'], layer: 'bones' },
      { label: 'Radial styloid', tags: ['radius'], layer: 'bones' },
      { label: 'Superficial radial nerve', tags: ['sup-radial'], layer: 'nerves' },
      { label: 'Radial artery', tags: ['radial-artery'], layer: 'nerves' },
    ],
    causes: [
      { id: 'dequervain', name: 'De Quervain\'s tenosynovitis', common: true, tags: ['sharp', 'swelling'], desc: 'Pain over the thumb side of the wrist, worse when lifting (e.g. a baby), gripping or texting. Tucking the thumb into a fist and tilting the wrist toward the little finger hurts (Eichhoff test, often called Finkelstein).', helps: 'Thumb spica splint, rest from the aggravating movement, ice; injection is very effective if it persists.' },
      { id: 'scaphoid', name: 'Scaphoid fracture', common: true, tags: ['injury'], noExercise: true, desc: 'Pain in the snuffbox after a fall on an outstretched hand. May not show on the first X-ray.', helps: 'Treat as a fracture until proven otherwise — they can fail to heal.' },
      { id: 'intersection', name: 'Intersection syndrome', tags: ['sharp', 'clicking', 'swelling'], desc: 'Pain and a squeaky feel 4–6 cm above the wrist on the back-thumb side; rowers, lifters, canoeists.', helps: 'Rest and splint; modify technique.' },
      { id: 'wartenberg', name: 'Wartenberg\'s syndrome', tags: ['numb'], desc: 'Burning or tingling over the back of the thumb from a tight watch, bracelet or cast.', helps: 'Loosen straps; avoid pressure.' },
      { id: 'wrist-oa', name: 'Wrist arthritis (radioscaphoid / STT)', tags: ['aching', 'stiff'], desc: 'Aching and stiffness, often years after an old injury.', helps: 'Splint, activity modification.' },
      { id: 'wrist-fracture', name: 'Distal radius fracture', common: true, tags: ['injury', 'swelling'], noExercise: true, desc: 'The commonest adult fracture: a fall on the outstretched hand with swelling and sometimes a "dinner-fork" bend at the wrist.', helps: 'X-ray; splint or cast.' },
    ],
    tips: ['Lift with palms up and elbows close ("scoop"), not pinching', 'A thumb spica splint rests the tendons', 'Loosen watch straps and bracelets', 'Ice 10–15 min after activity'],
    exercises: ['thumbCircles', 'wristFlexExtend'],
    redFlags: ['Snuffbox tenderness after a fall — get an X-ray'],
  },

  wristUlnar: {
    title: 'Wrist, little-finger side', view: 'pinky',
    blurb: 'The TFCC cushions the gap between the ulna and the wrist bones; the ECU tendon runs in a groove beside it.',
    structures: [
      { label: 'TFCC', tags: ['tfcc'], layer: 'tendons' },
      { label: 'Extensor carpi ulnaris', tags: ['ecu'], layer: 'tendons' },
      { label: 'Ulnar styloid', tags: ['ulna'], layer: 'bones' },
      { label: 'Triquetrum & pisiform', tags: ['triquetrum', 'pisiform'], layer: 'bones' },
      { label: 'Ulnar nerve', tags: ['ulnar-nerve'], layer: 'nerves' },
    ],
    causes: [
      { id: 'tfcc', name: 'TFCC tear', common: true, tags: ['clicking', 'sharp', 'injury'], noExercise: true, desc: 'Pain and clicking on the little-finger side with twisting (door handles, keys), pushing up from a chair or push-ups.', helps: 'Wrist wrap or splint, avoid forceful twisting and loaded wrist extension; physio for stability.' },
      { id: 'ecu', name: 'ECU tendinitis or subluxation', common: true, tags: ['sharp', 'clicking', 'swelling'], desc: 'Pain or snapping on the back-outer wrist with rotation — tennis, golf, rowing.', helps: 'Rest, splint; technique changes.' },
      { id: 'ulnar-impaction', name: 'Ulnar impaction syndrome', tags: ['aching'], desc: 'A slightly long ulna presses on the wrist bones; aching with grip and bending toward the little finger.', helps: 'Activity modification; surgery for persistent cases.' },
      { id: 'pisiform', name: 'Pisotriquetral arthritis / FCU tendinitis', tags: ['aching'], desc: 'Pain at the pisiform with gripping and wrist bending.', helps: 'Rest, padding.' },
      { id: 'guyon', name: 'Guyon\'s canal compression', tags: ['numb', 'weak'], desc: 'Ulnar-nerve tingling in the little finger.', helps: 'See the little-finger side of the palm region.' },
      { id: 'wrist-fracture', name: 'Ulnar styloid or triquetral fracture', tags: ['injury', 'swelling'], noExercise: true, desc: 'A fall on the hand with swelling and tenderness on the little-finger side; the triquetrum is the second most commonly broken wrist bone.', helps: 'X-ray; splint.' },
      { id: 'ra', name: 'Inflammatory synovitis (e.g. rheumatoid)', tags: ['swelling', 'stiff', 'aching'], desc: 'Puffy swelling around the ulnar head that can spring like a piano key, often both wrists, with morning stiffness.', helps: 'See a GP promptly — early treatment protects the joints.' },
    ],
    tips: ['Use an ulnar wrist wrap for sport', 'Keep wrist neutral when lifting', 'Avoid wringing and forceful twisting', 'Push-ups on fists or handles, not flat palms'],
    exercises: ['wristFlexExtend'],
    redFlags: ['Wrist suddenly clunks and gives way', 'Numbness with weakness'],
  },

  wristDorsal: {
    title: 'Back of the wrist', view: 'back',
    blurb: 'Six extensor compartments cross the back of the wrist under the extensor retinaculum; the scapholunate ligament lies beneath.',
    structures: [
      { label: 'Extensor retinaculum', tags: ['ext-retinaculum'], layer: 'tendons' },
      { label: 'Extensor tendons', tags: ['edc', 'epl', 'ecr'], layer: 'tendons' },
      { label: 'Scapholunate ligament', tags: ['sl'], layer: 'tendons' },
      { label: 'Lunate & scaphoid', tags: ['lunate', 'scaphoid'], layer: 'bones' },
    ],
    causes: [
      { id: 'ganglion', name: 'Dorsal ganglion cyst', common: true, tags: ['lump', 'aching'], desc: 'The most common hand lump: a smooth swelling that may ache with push-ups or yoga.', helps: 'Often harmless and may fade; aspiration or removal if painful.' },
      { id: 'extensor', name: 'Dorsal wrist impingement / extensor tendinitis', common: true, tags: ['sharp', 'aching'], desc: 'Pinching pain on the back of the wrist when it is bent back under load (push-ups, planks, gymnastics).', helps: 'Load on fists or handles, build up gradually, wrist mobility.' },
      { id: 'sl-injury', name: 'Scapholunate ligament injury', tags: ['injury', 'clicking', 'weak'], noExercise: true, desc: 'After a fall: pain, clunking and weak grip.', helps: 'Early assessment — missed injuries can lead to arthritis.' },
      { id: 'kienbock', name: 'Kienböck\'s disease', tags: ['aching', 'stiff'], desc: 'Loss of blood supply to the lunate; deep central aching and stiffness.', helps: 'Needs imaging and specialist care.' },
      { id: 'epl-rupture', name: 'EPL tendon rupture', tags: ['weak', 'cantmove'], noExercise: true, desc: 'Suddenly unable to lift the thumb, often weeks after a wrist fracture.', helps: 'See a hand surgeon.' },
      { id: 'wrist-fracture', name: 'Distal radius fracture', common: true, tags: ['injury', 'swelling'], noExercise: true, desc: 'A fall on the outstretched hand; swelling on the back of the wrist and sometimes a "dinner-fork" bend.', helps: 'X-ray; splint or cast.' },
      { id: 'ra', name: 'Inflammatory tenosynovitis (e.g. rheumatoid)', tags: ['swelling', 'stiff', 'aching'], desc: 'Soft, puffy swelling over the back of the wrist, often both wrists, with morning stiffness — a common first sign of rheumatoid arthritis.', helps: 'See a GP promptly — early treatment protects the tendons and joints.' },
      { id: 'gout', name: 'Gout / pseudogout', tags: ['swelling', 'sharp', 'redhot', 'night'], desc: 'A hot, red, very tender wrist that came on over hours — often mistaken for a sprain.', helps: 'Rest and ice; same-day GP review — infection can look identical.' },
      { id: 'crps', name: 'Complex regional pain syndrome', tags: ['cold', 'swelling', 'sharp', 'injury'], desc: 'Weeks after a fracture or sprain: pain out of proportion, swelling, shiny or sweaty skin and colour or temperature change.', helps: 'See a clinician soon; keep the hand gently moving.' },
    ],
    tips: ['Do push-ups on fists or handles', 'Warm up wrists before weight-bearing', 'Build loaded wrist extension gradually'],
    exercises: ['wristFlexExtend'],
    redFlags: ['Clunking or giving way after a fall', 'Sudden loss of thumb lift'],
  },

  forearm: {
    title: 'Lower forearm', view: 'palm',
    blurb: 'The muscle bellies that move the fingers and wrist live here; their tendons run down into the hand.',
    structures: [
      { label: 'Forearm flexors', tags: ['forearm-flexors', 'fcr', 'fcu'], layer: 'muscles' },
      { label: 'Forearm extensors', tags: ['forearm-extensors', 'ecr', 'ecu'], layer: 'muscles' },
      { label: 'Radius & ulna', tags: ['radius', 'ulna'], layer: 'bones' },
      { label: 'Median & ulnar nerves', tags: ['median', 'ulnar-nerve'], layer: 'nerves' },
    ],
    causes: [
      { id: 'overuse', name: 'Overuse / repetitive strain', common: true, tags: ['aching', 'sharp'], desc: 'Aching forearm muscles after typing, climbing, gaming or manual work.', helps: 'Pacing, micro-breaks, massage; gradual strengthening once calm.' },
      { id: 'intersection', name: 'Intersection syndrome', tags: ['sharp', 'clicking', 'swelling'], desc: 'Squeaky pain on the back-thumb side a few cm above the wrist.', helps: 'Rest and splint.' },
      { id: 'wrist-fracture', name: 'Distal radius fracture', tags: ['injury', 'swelling'], noExercise: true, desc: 'Fall on an outstretched hand with swelling and deformity.', helps: 'X-ray; cast or surgery.' },
      { id: 'nerve-referred', name: 'Nerve entrapment or referred nerve pain', tags: ['numb'], desc: 'Tingling running down the forearm into the hand may start at the elbow or neck.', helps: 'Check posture; see a clinician if it persists.' },
    ],
    tips: ['Micro-breaks every 30–45 min', 'Light eccentric strengthening once pain settles', 'Ergonomic setup: elbows at 90°, wrists neutral'],
    exercises: ['wristFlexExtend', 'tendonGlides'],
    redFlags: ['Deformity after a fall', 'After an injury or in a cast: pain far worse than expected, worse when the fingers are pulled straight, with a tight, hard forearm — emergency (compartment syndrome)'],
  },
};

export const EXERCISE_INFO = {
  tendonGlides: { label: 'Tendon glides', desc: 'Five positions that slide the flexor tendons through their sheaths. Hold each 3 s, 10 rounds.' },
  thumbOpposition: { label: 'Thumb opposition', desc: 'Touch the thumb pad to each fingertip, making an "O". 10 rounds, slow and pain-free.' },
  fingerSpreads: { label: 'Finger spreads', desc: 'Spread the fingers wide, then bring them together. 10 times.' },
  wristFlexExtend: { label: 'Wrist bend & lift', desc: 'Gently bend the wrist down, back to neutral, then up. Hold 5 s at each end, no forcing.' },
  medianNerveGlide: { label: 'Median nerve glide', desc: 'Progress through the positions only as far as is comfortable — stop before tingling.' },
  thumbCircles: { label: 'Thumb circles', desc: 'Slow circles with the thumb to keep the base joint moving. 10 each way.' },
};

// Region anchors: [region, frame, x, y, z, radius]. Finger anchors are generated per finger.
export function regionAnchors(FINGERS, THUMB) {
  const A = [];
  for (const d of FINGERS) {
    const c = d.code, L = d.len, M = d.mcp;
    A.push({ region: 'fingertip', finger: d.key, frame: c + '3', p: [0, L[2] * 0.72, 0.15], r: 0.95 });
    A.push({ region: 'dip', finger: d.key, frame: c + '3', p: [0, 0.05, 0], r: 0.85 });
    A.push({ region: 'pip', finger: d.key, frame: c + '2', p: [0, 0.05, 0], r: 0.95 });
    A.push({ region: 'pip', finger: d.key, frame: c + '1', p: [0, L[0] * 0.55, -0.6], r: 1.4 });
    A.push({ region: 'fingerBase', finger: d.key, frame: 'wrist', p: [M.x, M.y - 0.35, 1.05], r: 1.05 });
    A.push({ region: 'fingerBase', finger: d.key, frame: c + '1', p: [0, L[0] * 0.5, 0.7], r: 1.1 });
    A.push({ region: 'knuckle', finger: d.key, frame: 'wrist', p: [M.x, M.y + 0.1, -0.6], r: 1.0 });
  }
  const T = THUMB.len;
  A.push({ region: 'thumbIP', frame: 'T3', p: [0, 0.05, 0], r: 0.9 });
  A.push({ region: 'thumbIP', frame: 'T3', p: [0, T[2] * 0.7, 0.2], r: 1.0 });
  A.push({ region: 'thumbMCP', frame: 'T2', p: [0, 0.05, 0], r: 1.15 });
  A.push({ region: 'thumbMCP', frame: 'T2', p: [0, 0.1, -0.55], r: 1.0 });
  A.push({ region: 'thumbMCP', frame: 'T2', p: [0, T[1] * 0.55, 0], r: 1.1 });
  A.push({ region: 'thumbBase', frame: 'T1', p: [0.1, 0.35, -0.2], r: 1.05 });
  A.push({ region: 'thenar', frame: 'T1', p: [0.2, 2.2, 0.9], r: 1.5 });
  A.push({ region: 'thenar', frame: 'wrist', p: [2.2, 3.4, 1.55], r: 1.4 });
  A.push({ region: 'backOfHand', frame: 'T1', p: [-0.5, 2.8, -0.5], r: 1.6 });
  A.push({ region: 'palmCenter', frame: 'wrist', p: [0.4, 5.6, 1.35], r: 1.9 });
  A.push({ region: 'palmCenter', frame: 'wrist', p: [0.1, 4.0, 1.35], r: 1.6 });
  A.push({ region: 'hypothenar', frame: 'wrist', p: [-2.35, 4.6, 1.0], r: 1.6 });
  A.push({ region: 'hypothenar', frame: 'wrist', p: [-2.0, 2.9, 1.1], r: 1.35 });
  A.push({ region: 'backOfHand', frame: 'wrist', p: [0.3, 5.6, -0.9], r: 2.2 });
  A.push({ region: 'backOfHand', frame: 'wrist', p: [-1.7, 5.4, -0.8], r: 1.9 });
  A.push({ region: 'backOfHand', frame: 'wrist', p: [2.1, 5.6, -0.8], r: 1.9 });
  A.push({ region: 'wristPalmar', frame: 'wrist', p: [0.4, 1.0, 1.45], r: 1.5 });
  A.push({ region: 'wristPalmar', frame: 'fore', p: [0.4, -1.6, 1.25], r: 1.4 });
  A.push({ region: 'wristRadial', frame: 'fore', p: [2.4, -0.9, 0.0], r: 1.25 });
  A.push({ region: 'wristRadial', frame: 'wrist', p: [2.45, 1.3, 0.1], r: 1.15 });
  A.push({ region: 'wristUlnar', frame: 'fore', p: [-2.2, -0.6, 0.0], r: 1.25 });
  A.push({ region: 'wristUlnar', frame: 'wrist', p: [-1.8, 1.0, 0.0], r: 1.1 });
  A.push({ region: 'wristDorsal', frame: 'wrist', p: [0.3, 1.0, -1.0], r: 1.5 });
  A.push({ region: 'wristDorsal', frame: 'fore', p: [0.4, -1.3, -1.15], r: 1.35 });
  A.push({ region: 'forearm', frame: 'fore', p: [0.2, -6.5, 0], r: 4.5 });
  return A;
}

export const QUICK_GROUPS = [
  { label: 'Fingers', items: [['fingertip', 'Fingertip'], ['dip', 'End knuckle'], ['pip', 'Middle knuckle'], ['fingerBase', 'Finger base (palm)'], ['knuckle', 'Knuckle']] },
  { label: 'Thumb', items: [['thumbIP', 'Thumb tip'], ['thumbMCP', 'Thumb knuckle'], ['thumbBase', 'Thumb base'], ['thenar', 'Thumb pad']] },
  { label: 'Palm & back', items: [['palmCenter', 'Centre of palm'], ['hypothenar', 'Little-finger side'], ['backOfHand', 'Back of hand']] },
  { label: 'Wrist & forearm', items: [['wristPalmar', 'Wrist (palm side)'], ['wristRadial', 'Wrist (thumb side)'], ['wristUlnar', 'Wrist (little-finger side)'], ['wristDorsal', 'Wrist (back)'], ['forearm', 'Forearm']] },
];

// ---------------------------------------------------------------------------
// Cross-region knowledge used by the pain-map analysis.
export const NERVES = {
  median: { label: 'Median nerve', color: '#f5b83d', area: 'Palm side of the thumb, index, middle and thumb-side half of the ring finger (plus their fingertips on the back)' },
  ulnar: { label: 'Ulnar nerve', color: '#a78bfa', area: 'Little finger and the little-finger half of the ring finger, front and back, plus that edge of the hand' },
  radial: { label: 'Radial nerve', color: '#34d3c4', area: 'Back of the thumb (not the nail), the back of the index and middle fingers near the knuckles, and the back of the hand on the thumb side' },
};

// Canonical names for conditions that appear in several regions, plus nerve links
// and urgency. Anything not listed falls back to its first mention in REGIONS.
export const CONDITIONS = {
  cts: { name: 'Carpal tunnel syndrome', nerve: 'median', fingers: ['thumb', 'index', 'middle', 'ring'], note: 'The palm itself usually keeps normal feeling: its skin branch leaves the median nerve above the wrist and runs over, not through, the carpal tunnel.', helps: 'Neutral wrist splint at night, nerve glides, fewer sustained wrist bends; injection or surgery if it persists.' },
  'ulnar-nerve': { name: 'Ulnar nerve compression', helps: 'Avoid leaning on elbows or handlebars, keep elbows straighter at night; see a clinician if weakness develops.' },
  guyon: { name: 'Ulnar nerve compression at the wrist (Guyon\'s canal)', nerve: 'ulnar', fingers: ['ring', 'pinky'], helps: 'Padded gloves, change hand positions and rest the pressure point; see a clinician if weakness develops.' },
  cubital: { name: 'Cubital tunnel syndrome (ulnar nerve at the elbow)', nerve: 'ulnar', fingers: ['ring', 'pinky'], helps: 'Avoid leaning on the elbow and sleeping with it tightly bent; a towel wrapped loosely round the elbow at night helps. See a clinician if weakness or wasting develops.' },
  wartenberg: { name: 'Wartenberg\'s syndrome (superficial radial nerve)', nerve: 'radial' },
  gout: { name: 'Gout / pseudogout (crystal arthritis)', urgent: 'soon', helps: 'Rest and ice the joint and see a GP the same day if it is hot and red — infection can look identical. Recurrent attacks are preventable with medication.' },
  septic: { name: 'Deep hand infection', urgent: 'now' },
  laceration: { name: 'Cut with tendon or nerve injury', urgent: 'now', helps: 'Same-day assessment — tendon and nerve repairs work best within days.' },
  injection: { name: 'High-pressure injection injury', urgent: 'now', helps: 'Emergency surgery is usually needed — go now, even if it looks and feels minor.' },
  crps: { name: 'Complex regional pain syndrome', urgent: 'soon', helps: 'Early recognition matters: see a clinician soon, keep the hand gently moving, and avoid guarding it still.' },
  'nerve-referred': { name: 'Nerve irritation from the neck, or a general nerve problem', note: 'Numbness in several nerve areas can come from the neck, diabetes or other whole-body causes, or from two separate pinch points — worth telling a clinician.' },
  oa: { name: 'Osteoarthritis of the finger joints', helps: 'Heat, gentle daily movement, larger-grip tools; topical anti-inflammatory gels can ease flares.' },
  ra: { name: 'Inflammatory arthritis (e.g. rheumatoid)', helps: 'See a GP promptly — blood tests and early treatment protect the joints.' },
  trigger: { name: 'Trigger finger / trigger thumb', helps: 'Rest from hard gripping, night splint, tendon glides; a steroid injection often settles it.' },
  ganglion: { name: 'Ganglion or mucous cyst', helps: 'Usually harmless; don\'t pop it. It can be aspirated or removed if painful.' },
  fracture: { name: 'Fracture in the finger or hand', urgent: 'soon', helps: 'Ice, elevate, protect — and get an X-ray if there is deformity, marked swelling or you can\'t make a fist.' },
  sprain: { name: 'Ligament sprain', helps: 'Buddy-tape or splint, ice and elevation, then gentle movement to avoid stiffness.' },
  overuse: { name: 'Overuse / tendon strain', helps: 'Relative rest, micro-breaks, wider grips; gradual strengthening once it settles.' },
  dupuytren: { name: 'Dupuytren\'s disease', helps: 'Monitor with the tabletop test; treatment when the hand can no longer lie flat.' },
  'cmc-oa': { name: 'Basal thumb (CMC) arthritis', helps: 'Thumb splint for tasks or at night, wider grips, jar openers, stabilising exercises.' },
  mallet: { name: 'Mallet finger / thumb (extensor tendon injury)', urgent: 'soon', helps: 'Splint the tip straight at all times for up to 8 weeks — get it checked promptly.' },
  boutonniere: { name: 'Boutonnière injury (central slip)', urgent: 'soon', helps: 'The middle knuckle needs splinting straight for around 6 weeks — see a clinician early.' },
  'skiers-thumb': { name: 'Skier\'s thumb (thumb UCL injury)', urgent: 'soon' },
  'sl-injury': { name: 'Scapholunate ligament injury', urgent: 'soon' },
  hamate: { name: 'Hook of hamate fracture', urgent: 'soon' },
  paronychia: { name: 'Paronychia (nail-fold infection)' },
  scaphoid: { name: 'Scaphoid fracture', urgent: 'soon', helps: 'Treat as a fracture until an X-ray (or MRI) rules it out — these can fail to heal.' },
  extensor: { name: 'Extensor tendinitis / dorsal wrist impingement' },
  pisiform: { name: 'Pisiform / FCU irritation' },
  'wrist-fracture': { name: 'Wrist fracture or sprain', urgent: 'soon', helps: 'Splint, ice and elevate; X-ray after a fall with swelling or deformity.' },
  'sheath-infection': { urgent: 'now' },
  felon: { urgent: 'now' },
  'fight-bite': { urgent: 'now' },
  cellulitis: { urgent: 'now' },
  hammer: { urgent: 'now' },
  'epl-rupture': { name: 'EPL tendon rupture', urgent: 'soon', helps: 'Not a splint problem — see a hand surgeon soon; the tendon ends retract and usually need a transfer.' },
  jersey: { urgent: 'soon' },
};
// Regions on the back of the hand: ulnar numbness here points to the elbow, not the wrist,
// because the dorsal skin branch leaves the ulnar nerve above Guyon's canal.
export const DORSAL_REGIONS = ['backOfHand', 'knuckle', 'wristDorsal', 'wristUlnar'];

// Simple self-checks people can do at home. `conditions` maps condition id -> weight.
export const TESTS = {
  finkelstein: {
    loads: true, view: 'palm', name: 'Eichhoff test (home Finkelstein)', for: 'De Quervain\'s tenosynovitis', regions: ['wristRadial', 'thumbBase', 'forearm'],
    how: 'Tuck your thumb into your palm, close your fingers over it, then gently tilt your wrist toward your little finger.',
    positive: 'Sharp pain on the thumb side of the wrist', conditions: { dequervain: 1, intersection: 0.3 },
    accuracy: 'Often uncomfortable even in healthy wrists, so compare with your other hand. The true Finkelstein test is done by a clinician who moves the wrist for you.',
    weight: { yes: 2.0, no: 1.0 },
    caution: 'Stop as soon as it hurts — no bouncing.',
  },
  phalen: {
    view: 'thumb', name: 'Phalen\'s test', for: 'Carpal tunnel syndrome', regions: ['wristPalmar', 'thenar', 'fingertip', 'thumbIP'],
    how: 'Let your wrists hang fully bent down, backs of the hands pressed together, for up to 60 seconds.',
    positive: 'Tingling or numbness in the thumb, index or middle finger', conditions: { cts: 1 }, nerveMap: true,
    accuracy: 'In studies it picks up about 68% of carpal tunnel cases and is correctly negative about 73% of the time — it supports the diagnosis but can\'t confirm or rule it out.',
    weight: { yes: 1.8, no: 0.6 },
  },
  tinel: {
    view: 'palm', name: 'Tinel\'s sign at the wrist', for: 'Carpal tunnel syndrome', regions: ['wristPalmar', 'thenar', 'fingertip'],
    how: 'Tap firmly 4–6 times with two fingertips over the middle of the palm-side wrist crease.',
    positive: 'An electric tingle shooting into the thumb, index or middle finger', conditions: { cts: 1 }, nerveMap: true,
    accuracy: 'Picks up only about half of carpal tunnel cases (specificity about 77%), so a negative result doesn\'t rule it out. Normally done by a clinician.',
    weight: { yes: 1.5, no: 0.4 },
  },
  grind: {
    loads: true, view: 'palm', name: 'Thumb base grind test', for: 'Basal thumb arthritis', regions: ['thumbBase', 'thenar'],
    how: 'Hold the thumb\'s knuckle with your other hand, gently push the thumb toward its base and rotate it in small circles.',
    positive: 'Deep aching or a grinding feeling at the base of the thumb', conditions: { 'cmc-oa': 1 },
    accuracy: 'A common clinical sign, but pain can also come from nearby tendons; X-rays confirm arthritis.',
    weight: { yes: 2.2, no: 0.8 },
  },
  tabletop: {
    view: 'back', name: 'Tabletop test', for: 'Dupuytren\'s disease', regions: ['palmCenter', 'fingerBase'],
    how: 'Place your hand palm-down on a table and try to lay the palm and all the fingers completely flat.',
    positive: 'You can\'t get the palm and fingers flat', conditions: { dupuytren: 1 },
    accuracy: 'Used to decide when a Dupuytren\'s contracture is worth treating; early nodules can be present with a normal test.',
    weight: { yes: 2.6, no: 0.8 },
  },
  fistOpen: {
    loads: true, view: 'thumb', name: 'Fist-and-release', for: 'Trigger finger', regions: ['fingerBase', 'palmCenter', 'thumbIP', 'thumbMCP', 'pip'],
    how: 'Make a firm fist, then open the hand quickly. Repeat five times.',
    positive: 'A finger catches, clicks or locks, with a tender spot at its base', conditions: { trigger: 1 },
    accuracy: 'Triggering is diagnosed mainly from this history and a tender nodule at the finger base; it may not happen every time.',
    weight: { yes: 2.6, no: 0.5 },
  },
  cross: {
    view: 'back', name: 'Finger-cross test', for: 'Ulnar nerve weakness', regions: ['hypothenar', 'fingertip', 'wristUlnar'],
    how: 'Cross your middle finger over your index finger, uncross, and repeat quickly. Compare with the other hand.',
    positive: 'Clumsy, weak or unable to cross compared with the other hand', conditions: { cubital: 1, guyon: 1 }, nerveMap: true,
    accuracy: 'Tests the small hand muscles powered by the ulnar nerve; weakness usually appears later than numbness.',
    weight: { yes: 1.6, no: 0.6 },
  },
  pressUp: {
    loads: true, view: 'thumb', name: 'Press-up test', for: 'TFCC tear / ulnar-side wrist pain', regions: ['wristUlnar', 'wristDorsal'],
    how: 'Sitting in a chair with armrests, push yourself up with your hands flat on the armrests.',
    positive: 'Pain on the little-finger side of the wrist', conditions: { tfcc: 1, 'ulnar-impaction': 0.6, extensor: 0.3 },
    accuracy: 'A simple screening sign for ulnar-sided wrist problems; it can\'t tell a TFCC tear from ulnar impaction — that needs examination and imaging.',
    weight: { yes: 1.8, no: 0.6 },
  },
  snuffbox: {
    view: 'thumb', name: 'Snuffbox press', for: 'Scaphoid fracture', regions: ['wristRadial', 'thumbBase'],
    how: 'Lift your thumb to show the hollow on the thumb side of the wrist, then press into that hollow with a fingertip.',
    positive: 'Sharp, pinpoint pain — especially after a fall', conditions: { scaphoid: 1 },
    accuracy: 'Very sensitive but not specific — many sprains are tender here too. That\'s why tenderness after a fall is treated as a possible fracture until imaging says otherwise.',
    weight: { yes: 2.4, no: 1.0 },
    caution: 'If this hurts after a fall, get an X-ray even if the injury seemed minor.',
  },
};

// ---------------------------------------------------------------------------
// Sources. Every link was opened and its title checked on 29 Sep 2026.
export const CONTENT_REVIEW = {
  date: '29 Sep 2026',
  summary: 'Checked against NHS, AAOS OrthoInfo and StatPearls (NCBI Bookshelf) pages. Not yet reviewed by a licensed clinician.',
  issues: 'https://github.com/TarunT27/hand-pain-explorer/issues',
};

const NHS = 'https://www.nhs.uk/conditions/';
const OI = 'https://orthoinfo.aaos.org/en/diseases--conditions/';
const SP = 'https://www.ncbi.nlm.nih.gov/books/';
const PMC = 'https://pmc.ncbi.nlm.nih.gov/articles/';
export const REFS = {
  'nhs-cts': { org: 'NHS', title: 'Carpal tunnel syndrome', url: NHS + 'carpal-tunnel-syndrome/' },
  'nhs-trigger': { org: 'NHS', title: 'Trigger finger', url: NHS + 'trigger-finger/' },
  'nhs-dupuytren': { org: 'NHS', title: 'Dupuytren\'s contracture', url: NHS + 'dupuytrens-contracture/' },
  'nhs-ganglion': { org: 'NHS', title: 'Ganglion cyst', url: NHS + 'ganglion-cyst/' },
  'nhs-raynauds': { org: 'NHS', title: 'Raynaud\'s', url: NHS + 'raynauds/' },
  'nhs-oa': { org: 'NHS', title: 'Osteoarthritis', url: NHS + 'osteoarthritis/' },
  'nhs-ra': { org: 'NHS', title: 'Rheumatoid arthritis', url: NHS + 'rheumatoid-arthritis/' },
  'nhs-psa': { org: 'NHS', title: 'Psoriatic arthritis', url: NHS + 'psoriatic-arthritis/' },
  'nhs-broken-finger': { org: 'NHS', title: 'Broken finger or thumb', url: NHS + 'broken-finger/' },
  'nhs-cellulitis': { org: 'NHS', title: 'Cellulitis', url: NHS + 'cellulitis/' },
  'nhs-bites': { org: 'NHS', title: 'Animal and human bites', url: NHS + 'animal-and-human-bites/' },
  'nhs-sprains': { org: 'NHS', title: 'Sprains and strains', url: NHS + 'sprains-and-strains/' },
  'nhs-rsi': { org: 'NHS', title: 'Repetitive strain injury', url: NHS + 'repetitive-strain-injury-rsi/' },
  'nhs-tendonitis': { org: 'NHS', title: 'Tendonitis', url: NHS + 'tendonitis/' },
  'nhs-mallet': { org: 'NHS', title: 'Mallet finger', url: NHS + 'mallet-finger/' },
  'nhs-hand-pain': { org: 'NHS', title: 'Hand pain', url: 'https://www.nhs.uk/symptoms/hand-pain/' },
  'oi-cts': { org: 'OrthoInfo (AAOS)', title: 'Carpal tunnel syndrome', url: OI + 'carpal-tunnel-syndrome/' },
  'oi-trigger': { org: 'OrthoInfo (AAOS)', title: 'Trigger finger', url: OI + 'trigger-finger/' },
  'oi-dequervain': { org: 'OrthoInfo (AAOS)', title: 'De Quervain\'s tendinosis', url: OI + 'de-quervains-tendinosis/' },
  'oi-ganglion': { org: 'OrthoInfo (AAOS)', title: 'Ganglion cyst of the wrist and hand', url: OI + 'ganglion-cyst-of-the-wrist-and-hand/' },
  'oi-mallet': { org: 'OrthoInfo (AAOS)', title: 'Mallet finger', url: OI + 'mallet-finger-baseball-finger/' },
  'oi-hand-oa': { org: 'OrthoInfo (AAOS)', title: 'Arthritis of the hand', url: OI + 'arthritis-of-the-hand/' },
  'oi-wrist-oa': { org: 'OrthoInfo (AAOS)', title: 'Arthritis of the wrist', url: OI + 'arthritis-of-the-wrist/' },
  'oi-thumb-oa': { org: 'OrthoInfo (AAOS)', title: 'Arthritis of the thumb', url: OI + 'arthritis-of-the-thumb/' },
  'oi-scaphoid': { org: 'OrthoInfo (AAOS)', title: 'Scaphoid fracture of the wrist', url: OI + 'scaphoid-fracture-of-the-wrist/' },
  'oi-hand-fx': { org: 'OrthoInfo (AAOS)', title: 'Hand fractures', url: OI + 'hand-fractures/' },
  'oi-boutonniere': { org: 'OrthoInfo (AAOS)', title: 'Boutonnière deformity', url: OI + 'boutonniere-deformity/' },
  'oi-ulnar-tunnel': { org: 'OrthoInfo (AAOS)', title: 'Ulnar tunnel syndrome of the wrist', url: OI + 'ulnar-tunnel-syndrome-of-the-wrist/' },
  'oi-wrist-sprain': { org: 'OrthoInfo (AAOS)', title: 'Wrist sprains', url: OI + 'wrist-sprains/' },
  'oi-cubital': { org: 'OrthoInfo (AAOS)', title: 'Cubital tunnel syndrome', url: OI + 'ulnar-nerve-entrapment-at-the-elbow/' },
  'oi-drf': { org: 'OrthoInfo (AAOS)', title: 'Distal radius fractures (broken wrist)', url: OI + 'distal-radius-fractures-broken-wrist/' },
  'oi-thumb-sprain': { org: 'OrthoInfo (AAOS)', title: 'Sprained thumb (skier\'s thumb)', url: OI + 'sprained-thumb' },
  'sp-paronychia': { org: 'StatPearls', title: 'Paronychia', url: SP + 'NBK544307/' },
  'sp-felon': { org: 'StatPearls', title: 'Felon', url: SP + 'NBK430933/' },
  'sp-jersey': { org: 'StatPearls', title: 'Jersey finger', url: SP + 'NBK545291/' },
  'sp-hamate': { org: 'StatPearls', title: 'Hamate fractures', url: SP + 'NBK544314/' },
  'sp-intersection': { org: 'StatPearls', title: 'Intersection syndrome', url: SP + 'NBK430899/' },
  'sp-tfcc': { org: 'StatPearls', title: 'Triangular fibrocartilage complex', url: SP + 'NBK554564/' },
  'sp-kienbock': { org: 'StatPearls', title: 'Kienbock disease', url: SP + 'NBK536991/' },
  'sp-carpal-instability': { org: 'StatPearls', title: 'Carpal ligament instability', url: SP + 'NBK557729/' },
  'sp-pft': { org: 'StatPearls', title: 'Pyogenic flexor tenosynovitis', url: SP + 'NBK576414/' },
  'sp-dequervain': { org: 'StatPearls', title: 'De Quervain tenosynovitis', url: SP + 'NBK442005/' },
  'sp-dupuytren': { org: 'StatPearls', title: 'Dupuytren contracture', url: SP + 'NBK526074/' },
  'sp-guyon': { org: 'StatPearls', title: 'Guyon canal syndrome', url: SP + 'NBK431063/' },
  'sp-ulnar': { org: 'StatPearls', title: 'Ulnar nerve entrapment', url: SP + 'NBK555929/' },
  'sp-wartenberg': { org: 'StatPearls', title: 'Cheiralgia paresthetica (Wartenberg syndrome)', url: SP + 'NBK545200/' },
  'sp-finger-disloc': { org: 'StatPearls', title: 'Finger dislocation', url: SP + 'NBK551508/' },
  'sp-phalanx': { org: 'StatPearls', title: 'Phalanx fractures of the hand', url: SP + 'NBK557625/' },
  'sp-cutaneous': { org: 'StatPearls', title: 'Hand cutaneous innervation', url: SP + 'NBK544247/' },
  'sp-scaphoid': { org: 'StatPearls', title: 'Scaphoid wrist fracture', url: SP + 'NBK536907/' },
  'sp-cts': { org: 'StatPearls', title: 'Carpal tunnel syndrome', url: SP + 'NBK448179/' },
  'sp-trigger': { org: 'StatPearls', title: 'Trigger finger', url: SP + 'NBK459310/' },
  'sp-raynaud': { org: 'StatPearls', title: 'Raynaud disease', url: SP + 'NBK499833/' },
  'sp-radiculopathy': { org: 'StatPearls', title: 'Cervical radiculopathy', url: SP + 'NBK441828/' },
  'nhs-gout': { org: 'NHS', title: 'Gout', url: NHS + 'gout/' },
  'nhs-crps': { org: 'NHS', title: 'Complex regional pain syndrome', url: NHS + 'complex-regional-pain-syndrome/' },
  'nhs-septic': { org: 'NHS', title: 'Septic arthritis', url: NHS + 'septic-arthritis/' },
  'nhs-cuts': { org: 'NHS', title: 'Cuts and grazes', url: NHS + 'cuts-and-grazes/' },
  'sp-injection': { org: 'StatPearls', title: 'Hand high pressure injury', url: SP + 'NBK542210/' },
  'sp-compartment': { org: 'StatPearls', title: 'Acute compartment syndrome', url: SP + 'NBK448124/' },
  'sp-flexor-lac': { org: 'StatPearls', title: 'Flexor tendon lacerations', url: SP + 'NBK493223/' },
  'sp-boutonniere': { org: 'StatPearls', title: 'Boutonniere deformity', url: SP + 'NBK470323/' },
  'sp-crps': { org: 'StatPearls', title: 'Complex regional pain syndrome', url: SP + 'NBK430719/' },
  'sp-gout': { org: 'StatPearls', title: 'Gout', url: SP + 'NBK546606/' },
  'sp-septic': { org: 'StatPearls', title: 'Septic arthritis', url: SP + 'NBK538176/' },
  'sp-bennett': { org: 'StatPearls', title: 'Bennett fracture', url: SP + 'NBK500035/' },
  'sp-drf': { org: 'StatPearls', title: 'Distal radius fractures', url: SP + 'NBK536916/' },
  'pmc-glomus': { org: 'PubMed Central', title: 'Glomus tumor: revitalizing concepts', url: PMC + 'PMC4567371/' },
  'pmc-carpal-boss': { org: 'PubMed Central', title: 'Diagnosis and treatment of symptomatic carpal bossing', url: PMC + 'PMC4625297/' },
  'pmc-ulnar-impaction': { org: 'PubMed Central', title: 'Ulnocarpal impaction syndrome', url: PMC + 'PMC11781849/' },
  'pmc-epl': { org: 'PubMed Central', title: 'Spontaneous atraumatic extensor pollicis longus rupture', url: PMC + 'PMC3587012/' },
  'pmc-ecu': { org: 'PubMed Central', title: 'Sports-related extensor carpi ulnaris pathology', url: PMC + 'PMC3812850/' },
  'pmc-sagittal': { org: 'PubMed Central', title: 'Sagittal band, boutonniere, and pulley injuries in the athlete', url: PMC + 'PMC5344850/' },
  'pmc-hammer': { org: 'PubMed Central', title: 'Hypothenar hammer syndrome: case report and literature review', url: PMC + 'PMC6565917/' },
};

export const CONDITION_SOURCES = {
  paronychia: ['sp-paronychia'], felon: ['sp-felon'], glomus: ['pmc-glomus'],
  fracture: ['nhs-broken-finger', 'oi-hand-fx', 'sp-phalanx', 'sp-bennett'],
  cts: ['nhs-cts', 'oi-cts', 'sp-cts'], 'ulnar-nerve': ['oi-cubital', 'sp-ulnar'],
  raynaud: ['nhs-raynauds', 'sp-raynaud'], oa: ['nhs-oa', 'oi-hand-oa'],
  mallet: ['nhs-mallet', 'oi-mallet'], jersey: ['sp-jersey'], ganglion: ['nhs-ganglion', 'oi-ganglion'],
  psa: ['nhs-psa'], sprain: ['nhs-sprains', 'sp-finger-disloc'], ra: ['nhs-ra'], boutonniere: ['oi-boutonniere', 'sp-boutonniere'],
  trigger: ['nhs-trigger', 'oi-trigger', 'sp-trigger'], overuse: ['nhs-rsi', 'nhs-tendonitis'],
  dupuytren: ['nhs-dupuytren', 'sp-dupuytren'], 'sheath-infection': ['sp-pft'], sagittal: ['pmc-sagittal'],
  'fight-bite': ['nhs-bites'], 'skiers-thumb': ['oi-thumb-sprain'], 'cmc-oa': ['oi-thumb-oa'],
  dequervain: ['oi-dequervain', 'sp-dequervain'], scaphoid: ['oi-scaphoid', 'sp-scaphoid'], contusion: ['nhs-hand-pain'],
  guyon: ['oi-ulnar-tunnel', 'sp-guyon'], hamate: ['sp-hamate'], hammer: ['pmc-hammer'], pisiform: ['oi-wrist-oa'],
  cubital: ['oi-cubital', 'sp-ulnar'], extensor: ['nhs-tendonitis'], 'carpal-boss': ['pmc-carpal-boss'],
  cellulitis: ['nhs-cellulitis'], fcr: ['nhs-tendonitis'], 'wrist-fracture': ['oi-drf', 'oi-wrist-sprain', 'sp-drf'],
  intersection: ['sp-intersection'], wartenberg: ['sp-wartenberg'], 'wrist-oa': ['oi-wrist-oa'], tfcc: ['sp-tfcc'],
  ecu: ['pmc-ecu'], 'ulnar-impaction': ['pmc-ulnar-impaction'], 'sl-injury': ['sp-carpal-instability'],
  kienbock: ['sp-kienbock'], 'epl-rupture': ['pmc-epl'], 'nerve-referred': ['sp-radiculopathy'],
  gout: ['nhs-gout', 'sp-gout'], crps: ['nhs-crps', 'sp-crps'], septic: ['nhs-septic', 'sp-septic'],
  laceration: ['sp-flexor-lac', 'nhs-cuts'], injection: ['sp-injection'],
};
export const RED_FLAG_SOURCES = ['sp-injection', 'sp-compartment', 'sp-pft', 'nhs-septic', 'oi-hand-fx'];
export const TEST_SOURCES = {
  finkelstein: ['sp-dequervain'], phalen: ['sp-cts'], tinel: ['sp-cts'], grind: ['oi-thumb-oa'], tabletop: ['sp-dupuytren'],
  fistOpen: ['sp-trigger'], cross: ['sp-ulnar'], pressUp: ['sp-tfcc'], snuffbox: ['sp-scaphoid', 'oi-scaphoid'],
};
export const NERVE_SOURCES = ['sp-cutaneous'];
