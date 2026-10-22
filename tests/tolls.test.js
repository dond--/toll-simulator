import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../js/core/events.js';
import { createTollSettings, subscriptionCovers } from '../js/tolls/policy.js';
import { createTollLedger } from '../js/tolls/ledger.js';

const HOUR = 3600000;
const subscription = (overrides = {}) => ({ mode: 'subscription', type: 'B', validFrom: 0, validUntil: 10 * HOUR, ...overrides });
const network = (segments) => ({ segments: new Map(segments.map((s) => [s.id, s])) });

test('předplatné typu X kryje třídu X a nižší', () => {
  const at = HOUR;
  assert.equal(subscriptionCovers(subscription({ type: 'C' }), 'A', at), true);
  assert.equal(subscriptionCovers(subscription({ type: 'C' }), 'C', at), true);
  assert.equal(subscriptionCovers(subscription({ type: 'B' }), 'C', at), false);
  assert.equal(subscriptionCovers(subscription({ type: 'A' }), 'B', at), false);
});

test('předplatné neplatí mimo časové okno', () => {
  const s = subscription({ type: 'C', validFrom: HOUR, validUntil: 2 * HOUR });
  assert.equal(subscriptionCovers(s, 'A', HOUR - 1), false);
  assert.equal(subscriptionCovers(s, 'A', HOUR), true);
  assert.equal(subscriptionCovers(s, 'A', 2 * HOUR), true);
  assert.equal(subscriptionCovers(s, 'A', 2 * HOUR + 1), false);
});

test('výchozí platnost začíná nyní', () => {
  const s = createTollSettings(1000);
  assert.equal(s.validFrom, 1000);
  assert.ok(s.validUntil > s.validFrom);
});

test('ledger počítá zpoplatněné úseky a km po třídách a hlásí porušení jen u nekrytých', () => {
  const net = network([
    { id: 's1', tollClass: 'C', lengthKm: 2 },
    { id: 's2', tollClass: 'A', lengthKm: 3 },
    { id: 's3', tollClass: 'B', lengthKm: 4 },
    { id: 's4', tollClass: null, lengthKm: 5 },
  ]);
  const events = createEventBus();
  const violations = [];
  events.on('toll:violation', ({ segmentId }) => violations.push(segmentId));
  const { state } = createTollLedger({ network: net, events, settings: subscription(), startedAt: 0 });

  events.emit('segment:enter', { segmentId: 's1', lengthKm: 2, simMs: 0 });
  events.emit('segment:enter', { segmentId: 's2', lengthKm: 3, simMs: HOUR });
  events.emit('segment:enter', { segmentId: 's3', lengthKm: 4, simMs: 11 * HOUR });
  events.emit('segment:enter', { segmentId: 's4', lengthKm: 5, simMs: 11 * HOUR });

  assert.deepEqual(violations, ['s1', 's3']);
  assert.equal(state.violations, 2);
  assert.equal(state.violatedKm, 6);
  assert.equal(state.tolledSegments, 3);
  assert.deepEqual(state.tolledKmByClass, { A: 3, B: 4, C: 2 });
});

test('post-factum účtuje km × sazba a porušení nevyvolává', () => {
  const net = network([
    { id: 's1', tollClass: 'C', lengthKm: 2 },
    { id: 's2', tollClass: 'A', lengthKm: 3 },
  ]);
  const events = createEventBus();
  const violations = [];
  events.on('toll:violation', () => violations.push(1));
  const { state } = createTollLedger({
    network: net,
    events,
    settings: { mode: 'postFactum', type: 'A', validFrom: 0, validUntil: 0 },
    startedAt: 0,
  });

  events.emit('segment:enter', { segmentId: 's1', lengthKm: 2, simMs: 0 });
  events.emit('segment:enter', { segmentId: 's2', lengthKm: 3, simMs: 0 });

  assert.equal(state.bill, 2 * 100 + 3 * 1);
  assert.equal(violations.length, 0);
});

test('průjezd zakázaným úsekem vyvolá prohibition:violation v obou režimech a toll:violation ne', () => {
  for (const mode of ['subscription', 'postFactum']) {
    const net = network([{ id: 's1', tollClass: null, blocked: true, lengthKm: 2 }]);
    const events = createEventBus();
    const tollViolations = [];
    const prohibitions = [];
    events.on('toll:violation', () => tollViolations.push(1));
    events.on('prohibition:violation', ({ segmentId }) => prohibitions.push(segmentId));
    const { state } = createTollLedger({
      network: net,
      events,
      settings: { ...subscription({ type: 'A' }), mode },
      startedAt: 0,
    });

    events.emit('segment:enter', { segmentId: 's1', lengthKm: 2, simMs: 0 });

    assert.deepEqual(prohibitions, ['s1']);
    assert.equal(tollViolations.length, 0);
    assert.equal(state.prohibitedEntries, 1);
    assert.equal(state.prohibitedKm, 2);
    assert.equal(state.tolledSegments, 0);
  }
});

test('odhlášený ledger už nepočítá', () => {
  const net = network([{ id: 's1', tollClass: 'A', lengthKm: 1 }]);
  const events = createEventBus();
  const { state, dispose } = createTollLedger({ network: net, events, settings: subscription(), startedAt: 0 });
  dispose();
  events.emit('segment:enter', { segmentId: 's1', lengthKm: 1, simMs: 0 });
  assert.equal(state.tolledSegments, 0);
});