import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../js/network/generate.js';
import { createRandom } from '../js/network/random.js';
import { pointAt, polylineLengthKm } from '../js/network/geo.js';
import { NO_ROUTE_ERROR, planRoute, snapToNetwork } from '../js/routing/plan.js';

const freeSegments = (network) => [...network.segments.values()].filter((s) => !s.blocked);
const midpoint = (segment) => pointAt(segment.coords, segment.lengthKm / 2);

function assertNear([lat1, lng1], [lat2, lng2]) {
  assert.ok(Math.abs(lat1 - lat2) < 1e-9 && Math.abs(lng1 - lng2) < 1e-9, `${[lat1, lng1]} ≠ ${[lat2, lng2]}`);
}

function makeSegment(id, from, to, blocked) {
  const coords = [from.coords, to.coords];
  return { id, from: from.id, to: to.id, coords, lengthKm: polylineLengthKm(coords), speedKmh: 50, blocked, tollClass: null };
}

test('snap returns the segment under the point', () => {
  const network = generateNetwork({ seed: 1 });
  const segment = freeSegments(network)[0];
  const snap = snapToNetwork(network, midpoint(segment));
  assert.equal(snap.segment.id, segment.id);
  assert.ok(snap.distanceKm < 1e-6);
});

test('route runs between start and goal over free segments only', () => {
  const network = generateNetwork({ seed: 1 });
  const free = freeSegments(network);
  const start = midpoint(free[0]);
  const goal = midpoint(free[free.length - 1]);
  const result = planRoute(network, start, goal, createRandom(7));

  assert.equal(result.ok, true);
  const { route } = result;
  assertNear(route.coords[0], start);
  assertNear(route.coords.at(-1), goal);
  assert.ok(route.lengthKm > 0);
  for (const piece of route.pieces) {
    assert.equal(network.segments.get(piece.segmentId).blocked, false);
  }
});

test('consecutive route pieces meet at a shared node', () => {
  const network = generateNetwork({ seed: 2 });
  const free = freeSegments(network);
  const result = planRoute(network, midpoint(free[1]), midpoint(free[10]), createRandom(3));

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
  const result = planRoute(network, pointAt(segment.coords, L * 0.25), pointAt(segment.coords, L * 0.75), createRandom(5));

  assert.equal(result.ok, true);
  assert.equal(result.route.pieces.length, 1);
  assert.equal(result.route.pieces[0].segmentId, segment.id);
  assert.ok(Math.abs(result.route.lengthKm - L * 0.5) < 1e-6);
});

test('no route when blocked segments separate start and goal', () => {
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

  const start = midpoint(segments.get('s1'));
  const goal = midpoint(segments.get('s3'));
  const result = planRoute(network, start, goal, createRandom(1));

  assert.deepEqual(result, { ok: false, error: NO_ROUTE_ERROR });
});