import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetworkFromOsm } from '../js/network/osm.js';
import { validateNetwork } from '../js/network/validate.js';

const node = (id, lat, lon) => ({ type: 'node', id, lat, lon });
const way = (id, nodes, tags) => ({ type: 'way', id, nodes, tags });

const elements = [
  node(1, 50, 14),
  node(2, 50, 14.01),
  node(3, 50, 14.02),
  node(4, 50.01, 14.01),
  node(10, 51, 15),
  node(11, 51, 15.01),
  node(20, 50.02, 14.02),
  way(100, [1, 2, 3], { highway: 'primary' }),
  way(101, [2, 4], { highway: 'secondary', maxspeed: 'CZ:urban' }),
  way(102, [20, 3], { highway: 'footway' }),
  way(103, [10, 11], { highway: 'residential' }),
];

const { nodes, segments } = buildNetworkFromOsm({ elements });
const segmentBetween = (a, b) =>
  [...segments.values()].find((s) => (s.from === a && s.to === b) || (s.from === b && s.to === a));

test('cesty se rozdělí na úseky v křižovatkách', () => {
  assert.equal(segments.size, 3);
  assert.equal(segmentBetween('n1', 'n2').coords.length, 2);
  assert.equal(segmentBetween('n2', 'n3').coords.length, 2);
  assert.equal(segmentBetween('n2', 'n4').coords.length, 2);
});

test('rychlost z tagu maxspeed nebo z třídy silnice', () => {
  assert.equal(segmentBetween('n1', 'n2').speedKmh, 70);
  assert.equal(segmentBetween('n2', 'n4').speedKmh, 50);
});

test('nepojízdné cesty a odpojené části sítě se vynechají', () => {
  assert.equal(nodes.has('n20'), false);
  assert.equal(nodes.has('n10'), false);
  assert.equal(nodes.size, 4);
});

test('výsledná síť je validní', () => {
  assert.deepEqual(validateNetwork({ nodes, segments }).errors, []);
});
