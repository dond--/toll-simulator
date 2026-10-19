import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDecimal, formatDuration } from '../js/format.js';

test('desetinné číslo používá českou čárku', () => {
  assert.equal(formatDecimal(3.14159), '3,14');
  assert.equal(formatDecimal(1234.5), '1\u00a0234,50');
  assert.equal(formatDecimal(0), '0,00');
});

test('čas se formátuje jako hh:mm:ss', () => {
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(3723000), '01:02:03');
});