import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../js/network/generate.js';
import { pointAt } from '../js/network/geo.js';
import { planRoute } from '../js/routing/plan.js';
import { createEventBus } from '../js/core/events.js';
import { createTrip } from '../js/sim/trip.js';

function buildRoute() {
  const network = generateNetwork({ seed: 1 });
  const free = [...network.segments.values()].filter((s) => !s.blocked);
  const from = pointAt(free[0].coords, free[0].lengthKm / 2);
  const to = pointAt(free[free.length - 1].coords, free[free.length - 1].lengthKm / 2);
  const result = planRoute(network, from, to);
  assert.equal(result.ok, true);
  return { network, route: result.route };
}

test('jízda po trase dojede do cíle s celou délkou trasy', () => {
  const { network, route } = buildRoute();
  const events = createEventBus();
  const trip = createTrip({ route, network, events });
  const totalHours = route.pieces.reduce((sum, p) => sum + p.lengthKm / network.segments.get(p.segmentId).speedKmh, 0);

  trip.advance(totalHours * 3600000 + 1000);

  assert.equal(trip.state.finished, true);
  assert.ok(Math.abs(trip.state.distanceKm - route.lengthKm) < 1e-6);
});

test('krokování po malých úsecích dává stejný výsledek jako jeden krok', () => {
  const { network, route } = buildRoute();
  const bigStep = createTrip({ route, network, events: createEventBus() });
  const smallSteps = createTrip({ route, network, events: createEventBus() });

  bigStep.advance(600000);
  for (let i = 0; i < 6000; i++) smallSteps.advance(100);

  assert.ok(Math.abs(bigStep.state.distanceKm - smallSteps.state.distanceKm) < 1e-6);
  assert.ok(Math.abs(bigStep.state.simMs - smallSteps.state.simMs) < 1e-6);
});

test('vjezd do každého úseku trasy je ohlášen událostí', () => {
  const { network, route } = buildRoute();
  const events = createEventBus();
  const entered = [];
  events.on('segment:enter', ({ segmentId }) => entered.push(segmentId));
  const trip = createTrip({ route, network, events });

  trip.advance(1e12);

  assert.deepEqual(entered, route.pieces.map((p) => p.segmentId));
});

test('každá událost OBU je ohlášena polohou', () => {
  const { network, route } = buildRoute();
  const events = createEventBus();
  const positions = [];
  events.on('obu:record', ({ position }) => positions.push(position));
  const trip = createTrip({ route, network, events });

  trip.advance(600000);

  assert.ok(positions.length > 0);
  assert.equal(positions.length, trip.state.recordedPositions);
  for (const [lat, lng] of positions) assert.ok(Number.isFinite(lat) && Number.isFinite(lng));
});

test('události OBU nesou čas v simulaci, i během čekání', () => {
  const { network, route } = buildRoute();
  const events = createEventBus();
  const times = [];
  events.on('obu:record', ({ simMs }) => times.push(simMs));
  const trip = createTrip({ route, network, events });

  trip.advance(60000);
  const beforeWait = trip.state.simMs;
  trip.addWait(60000);

  assert.equal(times.length, trip.state.recordedPositions);
  assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]));
  assert.ok(times.some((t) => t > beforeWait));
  assert.ok(times.every((t) => t <= trip.state.simMs));
});

test('každá událost OBU nese úsek, na kterém se nachází', () => {
  const { network, route } = buildRoute();
  const events = createEventBus();
  const segmentIds = new Set(route.pieces.map((p) => p.segmentId));
  const seen = [];
  events.on('obu:record', ({ segmentId }) => seen.push(segmentId));
  const trip = createTrip({ route, network, events });

  trip.advance(1e12);
  trip.addWait(60000);

  assert.equal(seen.length, trip.state.recordedPositions);
  assert.ok(seen.every((id) => segmentIds.has(id)));
});
