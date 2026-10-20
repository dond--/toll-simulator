import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../js/network/generate.js';
import { createRandom } from '../js/network/random.js';
import { pointAt } from '../js/network/geo.js';
import { planRoute } from '../js/routing/plan.js';
import { createEventBus } from '../js/core/events.js';
import { createTrip } from '../js/sim/trip.js';
import { planJunctionStops } from '../js/sim/stops.js';

function buildRoute() {
  const network = generateNetwork({ seed: 1 });
  const free = [...network.segments.values()].filter((s) => !s.blocked);
  const from = pointAt(free[0].coords, free[0].lengthKm / 2);
  const to = pointAt(free[free.length - 1].coords, free[free.length - 1].lengthKm / 2);
  const result = planRoute(network, from, to, createRandom(11));
  assert.equal(result.ok, true);
  return { network, route: result.route };
}

test('bez náhody nejsou žádná zastavení', () => {
  const { network, route } = buildRoute();
  assert.equal(planJunctionStops(route, network, () => 0).size, 0);
});

test('nejvíc zastavení je omezeno délkou trasy a počtem křižovatek na trase', () => {
  const { network, route } = buildRoute();
  const stops = planJunctionStops(route, network, () => 0.999999);
  assert.ok(stops.size <= Math.floor(route.lengthKm / 2));
  for (const i of stops) assert.ok(i >= 0 && i < route.pieces.length - 1);
});

test('jízda se zastaví na prvním zastavení a pokračuje po dalším volání', () => {
  const { network, route } = buildRoute();
  const trip = createTrip({ route, network, events: createEventBus(), stops: new Set([0]) });

  assert.equal(trip.advance(1e12), true);
  assert.ok(Math.abs(trip.state.distanceKm - route.pieces[0].lengthKm) < 1e-6);
  assert.equal(trip.state.finished, false);

  trip.advance(1e12);
  assert.equal(trip.state.finished, true);
});
