// Shared fixtures for the Node tests.
export const pin = (region, finger, pain, symptoms = [], territory = null, extra = {}) => ({ region, finger, pain, symptoms, territory, hand: 'Right', ...extra });
export const CTS_PATTERN = [
  pin('fingertip', 'index', 6, ['numb', 'night'], 'median'),
  pin('fingertip', 'middle', 5, ['numb'], 'median'),
  pin('wristPalmar', null, 7, ['aching', 'night'], 'median'),
];
