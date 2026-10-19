import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMacPlatform, segmentsInBounds } from '../js/ui/selection.js';

const segment = (id, coords) => ({ id, coords });

test('úsek se vybere, když se obdélníku dotkne alespoň jeden jeho bod', () => {
  const segments = new Map([
    ['inside', segment('inside', [[50.0, 14.0], [50.0, 14.01]])],
    ['crossing', segment('crossing', [[49.0, 14.0], [50.005, 14.0], [51.0, 14.0]])],
    ['outside', segment('outside', [[51.0, 15.0], [51.1, 15.0]])],
  ]);
  const bounds = { south: 49.99, north: 50.01, west: 13.99, east: 14.02 };
  assert.deepEqual(segmentsInBounds(segments, bounds), ['inside', 'crossing']);
});

test('úsek, jehož body jsou všechny mimo obdélník, se nevybere', () => {
  const segments = new Map([['far', segment('far', [[49.0, 14.0], [49.1, 14.0]])]]);
  assert.deepEqual(segmentsInBounds(segments, { south: 50, north: 50.1, west: 14, east: 14.1 }), []);
});

test('detekce macOS podle platformy', () => {
  assert.equal(isMacPlatform('MacIntel'), true);
  assert.equal(isMacPlatform('macOS'), true);
  assert.equal(isMacPlatform('Win32'), false);
  assert.equal(isMacPlatform('Linux x86_64'), false);
});
