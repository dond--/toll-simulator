import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../js/network/generate.js';
import { validateNetwork } from '../js/network/validate.js';

const segment = (id, from, to, coords) => ({
  id,
  from,
  to,
  coords,
  lengthKm: 1,
  speedKmh: 50,
  blocked: false,
  tollClass: null,
});

const network = (nodes, segments) => ({
  nodes: new Map(nodes.map((n) => [n.id, n])),
  segments: new Map(segments.map((s) => [s.id, s])),
});

const A = { id: 'a', lat: 50, lng: 14 };
const B = { id: 'b', lat: 50.01, lng: 14 };
const C = { id: 'c', lat: 50.02, lng: 14 };

for (const seed of [1, 2, 3, 42, 1000]) {
  test(`vygenerovaná síť (seed ${seed}) je validní`, () => {
    assert.deepEqual(validateNetwork(generateNetwork({ seed })).errors, []);
  });
}

test('generátor je deterministický pro stejný seed', () => {
  const first = generateNetwork({ seed: 7 });
  const second = generateNetwork({ seed: 7 });
  assert.deepEqual(Array.from(first.segments.values()), Array.from(second.segments.values()));
});

test('řetězec úseků A-B-C je validní', () => {
  const net = network(
    [A, B, C],
    [
      segment('s1', 'a', 'b', [[50, 14], [50.005, 14], [50.01, 14]]),
      segment('s2', 'b', 'c', [[50.01, 14], [50.015, 14], [50.02, 14]]),
    ],
  );
  assert.deepEqual(validateNetwork(net).errors, []);
});

test('úsek odkazující na neexistující uzel je chyba', () => {
  const net = network([A, B], [segment('s1', 'a', 'x', [[50, 14], [50.01, 14]])]);
  const { ok, errors } = validateNetwork(net);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('neexistující uzel')));
});

test('úsek, jehož souřadnice nesedí na uzly, je chyba', () => {
  const net = network([A, B], [segment('s1', 'a', 'b', [[50, 14], [50.02, 14]])]);
  const { ok, errors } = validateNetwork(net);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('nenavazuje')));
});

test('nesouvislá síť je chyba', () => {
  const net = network([A, B, C], [segment('s1', 'a', 'b', [[50, 14], [50.01, 14]])]);
  const { ok, errors } = validateNetwork(net);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('není souvislá')));
});