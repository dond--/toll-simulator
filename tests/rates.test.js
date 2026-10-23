import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRates, tollClassLabel } from '../js/tolls/rates.js';

test('výchozí ceny projdou validací', () => {
  assert.equal(validateRates({ A: 1, B: 10, C: 100 }), null);
});

test('ceny mimo rozsah 1 až 1000 jsou odmítnuty', () => {
  assert.match(validateRates({ A: 0, B: 10, C: 100 }), /Cena třídy A/);
  assert.match(validateRates({ A: 1, B: -5, C: 100 }), /Cena třídy B/);
  assert.match(validateRates({ A: 1, B: 10, C: 1001 }), /Cena třídy C/);
  assert.equal(validateRates({ A: 1, B: 10, C: 1000 }), null);
});

test('neceločíselné nebo chybějící ceny jsou odmítnuty', () => {
  assert.match(validateRates({ A: 1.5, B: 10, C: 100 }), /Cena třídy A/);
  assert.match(validateRates({ A: 1, B: NaN, C: 100 }), /Cena třídy B/);
});

test('pořadí A < B < C je vynuceno', () => {
  assert.match(validateRates({ A: 10, B: 10, C: 100 }), /Cena třídy A musí být nižší než cena třídy B/);
  assert.match(validateRates({ A: 1, B: 100, C: 100 }), /Cena třídy B musí být nižší než cena třídy C/);
  assert.equal(validateRates({ A: 2, B: 3, C: 4 }), null);
});

test('popisek třídy obsahuje cenu', () => {
  assert.equal(tollClassLabel('B', 25), 'Třída B (25 Kč/km)');
});
