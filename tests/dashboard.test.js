import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tollRows } from '../js/ui/dashboard.js';

const state = { tolledSegments: 3, tolledKmByClass: { A: 1.5, B: 2, C: 0 }, bill: 35, prohibitedEntries: 1, prohibitedKm: 2.5 };

test('řádky mýtného obsahují třídy, celkovou délku a zakázané úseky s km', () => {
  const rows = tollRows(state, false);
  assert.deepEqual(rows.map(({ label }) => label), ['Úseky s mýtem', 'Třída A', 'Třída B', 'Třída C', 'Celkem', 'Zakázané úseky', 'Km v zakázaných úsecích']);
  assert.equal(rows[4].value, '3,50 km');
  assert.equal(rows[5].value, '1');
  assert.equal(rows[6].value, '2,50 km');
});

test('v režimu předplatné přidá řádky s úseky a km bez předplatného', () => {
  const withViolations = { ...state, violations: 2, violatedKm: 4.25 };
  const rows = tollRows(withViolations, false, true);
  assert.deepEqual(rows.slice(-2), [
    { label: 'Úseky s porušením', value: '2' },
    { label: 'Km s porušením', value: '4,25 km' },
  ]);
});

test('v režimu platby za km přidá řádek s mýtným', () => {
  assert.deepEqual(tollRows(state, true).at(-1), { label: 'Mýtné k úhradě', value: '35,00 Kč', strong: true });
});
