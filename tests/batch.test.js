import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED, applyChoice, isChoiceDisabled } from '../js/tolls/batch.js';

const free = (id) => ({ id, blocked: false, tollClass: null });
const tolled = (id, tollClass) => ({ id, blocked: false, tollClass });
const blocked = (id) => ({ id, blocked: true, tollClass: null });

test('v klidovém stavu hromadná volba třídy povolí i zakázané úseky', () => {
  const segments = [blocked('a'), free('b')];
  const applied = applyChoice(segments, 'B', () => true);
  assert.equal(applied.length, 2);
  assert.deepEqual(segments[0], { id: 'a', blocked: false, tollClass: 'B' });
  assert.deepEqual(segments[1], { id: 'b', blocked: false, tollClass: 'B' });
});

test('během jízdy se zakázané úseky přeskočí a ostatní se změní', () => {
  const segments = [blocked('a'), free('b')];
  const applied = applyChoice(segments, 'C', () => false);
  assert.deepEqual(applied.map((s) => s.id), ['b']);
  assert.deepEqual(segments[0], { id: 'a', blocked: true, tollClass: null });
  assert.equal(segments[1].tollClass, 'C');
});

test('volba Zakázaný je mimo klidový stav vypnutá', () => {
  assert.equal(isChoiceDisabled(BLOCKED, [free('a')], () => false), true);
  assert.equal(isChoiceDisabled(BLOCKED, [free('a')], () => true), false);
});

test('volba je vypnutá, pokud už všechny úseky mají stejný stav', () => {
  assert.equal(isChoiceDisabled('A', [tolled('a', 'A'), tolled('b', 'A')], () => true), true);
  assert.equal(isChoiceDisabled('A', [tolled('a', 'A'), free('b')], () => true), false);
  assert.equal(isChoiceDisabled(BLOCKED, [blocked('a'), blocked('b')], () => true), true);
});

test('během jízdy jsou třídy vypnuté jen pro samé zakázané úseky', () => {
  assert.equal(isChoiceDisabled('A', [blocked('a')], () => false), true);
  assert.equal(isChoiceDisabled('A', [blocked('a'), free('b')], () => false), false);
});

test('po dojetí do cíle lze měnit i úseky na trase, povolit lze všechny zakázané', () => {
  const canEdit = () => true;
  assert.equal(isChoiceDisabled(BLOCKED, [free('a')], canEdit), false);
  const segments = [free('a'), free('b'), blocked('c')];
  const applied = applyChoice(segments, BLOCKED, canEdit);
  assert.deepEqual(applied.map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(applyChoice([blocked('c')], null, canEdit).map((s) => s.id), ['c']);
});
