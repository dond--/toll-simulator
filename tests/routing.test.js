import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../js/network/generate.js';
import { pointAt, polylineLengthKm } from '../js/network/geo.js';
import { NO_ROUTE_ERROR, planRoute, snapToNetwork } from '../js/routing/plan.js';

const freeSegments = (network) => [...network.segments.values()].filter((s) => !s.blocked);
const midpoint = (segment) => pointAt(segment.coords, segment.lengthKm / 2);

function assertNear([lat1, lng1], [lat2, lng2]) {
  assert.ok(Math.abs(lat1 - lat2) < 1e-9 && Math.abs(lng1 - lng2) < 1e-9, `${[lat1, lng1]} ≠ ${[lat2, lng2]}`);
}

function makeSegment(id, from, to, blocked, { speedKmh = 50, oneway = null } = {}) {
  const coords = [from.coords, to.coords];
  return { id, from: from.id, to: to.id, coords, lengthKm: polylineLengthKm(coords), speedKmh, oneway, blocked, tollClass: null };
}

function buildNetwork(points, specs) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const nodes = new Map(points.map((p) => [p.id, { id: p.id, lat: p.coords[0], lng: p.coords[1] }]));
  const segments = new Map(
    specs.map(([id, from, to, options]) => [id, makeSegment(id, byId.get(from), byId.get(to), false, options)]),
  );
  return { nodes, segments };
}

test('snap returns the segment under the point', () => {
  const network = generateNetwork({ seed: 1 });
  const segment = freeSegments(network)[0];
  const snap = snapToNetwork(network, midpoint(segment));
  assert.equal(snap.segment.id, segment.id);
  assert.ok(snap.distanceKm < 1e-6);
});

test('route runs between start and goal', () => {
  const network = generateNetwork({ seed: 1 });
  const free = freeSegments(network);
  const start = midpoint(free[0]);
  const goal = midpoint(free[free.length - 1]);
  const result = planRoute(network, start, goal);

  assert.equal(result.ok, true);
  const { route } = result;
  assertNear(route.coords[0], start);
  assertNear(route.coords.at(-1), goal);
  assert.ok(route.lengthKm > 0);
});

test('consecutive route pieces meet at a shared node', () => {
  const network = generateNetwork({ seed: 2 });
  const free = freeSegments(network);
  const result = planRoute(network, midpoint(free[1]), midpoint(free[10]));

  assert.equal(result.ok, true);
  const { pieces } = result.route;
  for (let i = 1; i < pieces.length; i++) {
    assertNear(pieces[i - 1].coords.at(-1), pieces[i].coords[0]);
  }
});

test('start and goal on the same segment give a direct route', () => {
  const network = generateNetwork({ seed: 1 });
  const segment = freeSegments(network)[0];
  const L = segment.lengthKm;
  const result = planRoute(network, pointAt(segment.coords, L * 0.25), pointAt(segment.coords, L * 0.75));

  assert.equal(result.ok, true);
  assert.equal(result.route.pieces.length, 1);
  assert.equal(result.route.pieces[0].segmentId, segment.id);
  assert.ok(Math.abs(result.route.lengthKm - L * 0.5) < 1e-6);
});

test('route passes through a blocked segment', () => {
  const a = { id: 'a', coords: [50, 14.0] };
  const b = { id: 'b', coords: [50, 14.01] };
  const c = { id: 'c', coords: [50, 14.02] };
  const d = { id: 'd', coords: [50, 14.03] };
  const nodes = new Map([a, b, c, d].map((n) => [n.id, { id: n.id, lat: n.coords[0], lng: n.coords[1] }]));
  const segments = new Map(
    [
      makeSegment('s1', a, b, false),
      makeSegment('s2', b, c, true),
      makeSegment('s3', c, d, false),
    ].map((s) => [s.id, s]),
  );
  const network = { nodes, segments };

  const result = planRoute(network, midpoint(segments.get('s1')), midpoint(segments.get('s3')));

  assert.equal(result.ok, true);
  assert.deepEqual(result.route.pieces.map((piece) => piece.segmentId), ['s1', 's2', 's3']);
});

test('no route when no segments connect start and goal', () => {
  const a = { id: 'a', coords: [50, 14.0] };
  const b = { id: 'b', coords: [50, 14.01] };
  const c = { id: 'c', coords: [50, 14.02] };
  const d = { id: 'd', coords: [50, 14.03] };
  const nodes = new Map([a, b, c, d].map((n) => [n.id, { id: n.id, lat: n.coords[0], lng: n.coords[1] }]));
  const segments = new Map([makeSegment('s1', a, b, false), makeSegment('s3', c, d, false)].map((s) => [s.id, s]));
  const network = { nodes, segments };

  const result = planRoute(network, midpoint(segments.get('s1')), midpoint(segments.get('s3')));

  assert.deepEqual(result, { ok: false, error: NO_ROUTE_ERROR });
});
test('nejrychlejší trasa může být delší než nejkratší', () => {
  const network = buildNetwork(
    [
      { id: 'a', coords: [50, 14.0] },
      { id: 'b', coords: [50.1, 14.05] },
      { id: 'c', coords: [50, 14.1] },
    ],
    [
      ['ac', 'a', 'c', { speedKmh: 30 }],
      ['ab', 'a', 'b', { speedKmh: 110 }],
      ['bc', 'b', 'c', { speedKmh: 110 }],
    ],
  );
  const start = pointAt(network.segments.get('ac').coords, 0.1);
  const goal = pointAt(network.segments.get('bc').coords, network.segments.get('bc').lengthKm / 2);

  const result = planRoute(network, start, goal);

  assert.equal(result.ok, true);
  assert.deepEqual(result.route.pieces.map((piece) => piece.segmentId), ['ac', 'ab', 'bc']);
});

test('křižovatka stojí čas, takže kratší trasa přes ni může prohrát', () => {
  const network = buildNetwork(
    [
      { id: 'S0', coords: [50, 13.99] },
      { id: 'a', coords: [50, 14.0] },
      { id: 'b', coords: [50.0054, 14.05] },
      { id: 'd', coords: [50, 14.05] },
      { id: 'c', coords: [50, 14.1] },
      { id: 'G0', coords: [50, 14.11] },
      { id: 'e', coords: [49.95, 14.05] },
    ],
    [
      ['sa', 'S0', 'a'],
      ['ab', 'a', 'b'],
      ['bc', 'b', 'c'],
      ['ad', 'a', 'd'],
      ['dc', 'd', 'c'],
      ['de', 'd', 'e'],
      ['cg', 'c', 'G0'],
    ],
  );
  const sa = network.segments.get('sa');
  const cg = network.segments.get('cg');

  const result = planRoute(network, pointAt(sa.coords, sa.lengthKm / 2), pointAt(cg.coords, cg.lengthKm / 2));

  assert.equal(result.ok, true);
  assert.deepEqual(result.route.pieces.map((piece) => piece.segmentId), ['sa', 'ab', 'bc', 'cg']);
});

test('jednosměrka se nedá projet proti směru jízdy', () => {
  const network = buildNetwork(
    [
      { id: 'a', coords: [50, 14.0] },
      { id: 'b', coords: [50, 14.05] },
      { id: 'c', coords: [50, 14.1] },
    ],
    [
      ['ab', 'a', 'b', { oneway: 'from-to' }],
      ['bc', 'b', 'c'],
    ],
  );
  const ab = network.segments.get('ab');
  const bc = network.segments.get('bc');

  const result = planRoute(network, pointAt(bc.coords, bc.lengthKm / 2), pointAt(ab.coords, ab.lengthKm / 2));

  assert.deepEqual(result, { ok: false, error: NO_ROUTE_ERROR });
});

test('cíl na jednosměrce se objede okolo, když je v ní přímý směr zakázán', () => {
  const network = buildNetwork(
    [
      { id: 'a', coords: [50, 14.0] },
      { id: 'b', coords: [50, 14.05] },
      { id: 'c', coords: [50.05, 14.05] },
      { id: 'd', coords: [50.05, 14.0] },
    ],
    [
      ['ab', 'a', 'b', { oneway: 'from-to' }],
      ['bc', 'b', 'c'],
      ['cd', 'c', 'd'],
      ['da', 'd', 'a'],
    ],
  );
  const ab = network.segments.get('ab');

  const result = planRoute(network, pointAt(ab.coords, ab.lengthKm * 0.8), pointAt(ab.coords, ab.lengthKm * 0.2));

  assert.equal(result.ok, true);
  assert.equal(result.route.pieces[0].segmentId, 'ab');
  assert.equal(result.route.pieces.at(-1).segmentId, 'ab');
  assert.ok(result.route.lengthKm > ab.lengthKm * 3);
});
