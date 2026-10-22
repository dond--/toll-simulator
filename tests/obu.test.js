import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnBoardUnit } from '../js/sim/obu.js';

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

test('nejkratší interval je 1 s a nejdelší 3 s', () => {
  const shortest = createOnBoardUnit(() => 0);
  assert.equal(shortest.advanceTo(999), 0);
  assert.equal(shortest.advanceTo(1000), 1);
  assert.equal(shortest.advanceTo(3500), 3);

  const longest = createOnBoardUnit(() => 0.999999);
  assert.equal(longest.advanceTo(2999), 0);
});

test('počet událostí nezávisí na tom, jak krokuje simulace', () => {
  const stepped = createOnBoardUnit(seeded(7));
  for (let t = 0; t <= 600000; t += 250) stepped.advanceTo(t);
  const single = createOnBoardUnit(seeded(7));
  assert.equal(stepped.advanceTo(600000), single.advanceTo(600000));
});

test('průměrný interval je zhruba 2 s', () => {
  const unit = createOnBoardUnit(seeded(42));
  const count = unit.advanceTo(2000000);
  assert.ok(count >= 950 && count <= 1050, `počet ${count}`);
});

test('každá událost je předána zpětnému volání ve svém čase', () => {
  const unit = createOnBoardUnit(() => 0);
  const times = [];
  const count = unit.advanceTo(3500, (t) => times.push(t));
  assert.equal(count, 3);
  assert.deepEqual(times, [1000, 2000, 3000]);
});
