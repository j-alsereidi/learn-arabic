import { calibrationEntry } from './calibrationEntry';

test.each([
  ['sample', [], 0, 'fresh'],
  ['sweep', [], 0, 'fresh'],
  ['done', [1], 0, 'done'],
  ['done', [], 0, 'done'],
  ['done', [1, 2], 100, 'done'],
  ['sweep', [1], 0, 'partial'],
  ['sample', [1], 100, 'partial'],
  ['sample', [], 100, 'configured'],
])('%s / saved steps %j / known %i -> %s', (mode, steps, known, expected) => {
  expect(calibrationEntry({ mode, steps }, { known })).toBe(expected);
});

test.each([
  [null, { known: 0 }], [{ mode: 'done' }, { known: 0 }],
  [{ mode: 'sample', steps: [] }, null], [{ mode: 'sample', steps: [] }, { known: -1 }],
  [{ mode: 'sample', steps: [] }, { known: '0' }], [{ mode: 'error', steps: [] }, { known: 0 }],
])('Unavailable or malformed status cannot authorize entry', (status, count) => {
  expect(calibrationEntry(status, count)).toBeNull();
});
