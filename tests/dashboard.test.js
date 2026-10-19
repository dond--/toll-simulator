import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tollRows } from '../js/ui/dashboard.js';

const state = { tolledSegments: 3, tolledKmByClass: { A: 1.5, B: 2, C: 0 }, bill: 35 };

test('řádky mýtného obsahují třídy a celkovou délku', () => {
  const rows = tollRows(state, false);
  assert.deepEqual(rows.map(({ label }) => label), ['Úseky s mýtem', 'Třída A', 'Třída B', 'Třída C', 'Celkem']);
  assert.equal(rows.at(-1).value, '3,50 km');
});

test('v režimu platby za km přidá řádek s mýtným', () => {
  assert.deepEqual(tollRows(state, true).at(-1), { label: 'Mýtné k úhradě', value: '35,00 Kč', strong: true });
});
