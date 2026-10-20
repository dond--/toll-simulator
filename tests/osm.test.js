import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetworkFromOsm, buildOverpassQuery, DRIVABLE_HIGHWAY } from '../js/network/osm.js';
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

test('jednosměrka se uloží jako směr vůči pořadí uzlů cesty', () => {
  const { segments } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      way(200, [1, 2], { highway: 'primary', oneway: 'yes' }),
      way(201, [2, 3], { highway: 'primary', oneway: '-1' }),
      way(202, [3, 1], { highway: 'primary' }),
    ],
  });
  const fromNode = (id) => [...segments.values()].find((s) => s.from === id);
  assert.equal(fromNode('n1').oneway, 'from-to');
  assert.equal(fromNode('n2').oneway, 'to-from');
  assert.equal(fromNode('n3').oneway, null);
});

test('odpojené části se počítají do souhrnu vynechaných úseků', () => {
  const { dropped } = buildNetworkFromOsm({ elements });
  assert.equal(dropped.segments, 1);
  assert.ok(dropped.km > 0);
});

test('dotaz pro území používá relaci a stejný filtr silnic', () => {
  const query = buildOverpassQuery(20127151);
  assert.match(query, /relation\(20127151\);/);
  assert.match(query, /map_to_area->\.area;/);
  assert.ok(query.includes(DRIVABLE_HIGHWAY.source));
});
