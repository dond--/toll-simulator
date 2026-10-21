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
      way(203, [2, 1], { highway: 'primary' }),
    ],
  });
  const fromNode = (id) => [...segments.values()].find((s) => s.from === id);
  assert.equal(fromNode('n1').oneway, 'from-to');
  assert.equal(fromNode('n2').oneway, 'to-from');
  assert.equal(fromNode('n3').oneway, null);
});

test('třída silnice z tagu highway se uloží u úseku', () => {
  const { segments } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      way(400, [1, 2], { highway: 'motorway' }),
      way(401, [2, 3], { highway: 'primary_link' }),
      way(402, [3, 1], { highway: 'trunk' }),
    ],
  });
  assert.equal([...segments.values()].find((s) => s.from === 'n1').roadClass, 'motorway');
  assert.equal([...segments.values()].find((s) => s.from === 'n2').roadClass, 'primary_link');
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

test('nulová nebo záporná maxspeed se nahradí výchozí rychlostí podle třídy', () => {
  const { segments } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      way(300, [1, 2], { highway: 'residential', maxspeed: '0' }),
      way(301, [2, 3], { highway: 'primary', maxspeed: '-5' }),
    ],
  });
  assert.equal([...segments.values()].find((s) => s.from === 'n1').speedKmh, 30);
  assert.equal([...segments.values()].find((s) => s.from === 'n2').speedKmh, 70);
});

test('kruhový objezd a dálnice jsou jednosměrné, pokud nemají jiný tag', () => {
  const { segments } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      node(4, 50, 14.03),
      way(500, [1, 2], { highway: 'trunk', junction: 'roundabout' }),
      way(501, [2, 3], { highway: 'motorway' }),
      way(502, [3, 4], { highway: 'motorway', oneway: 'no' }),
      way(503, [4, 1], { highway: 'trunk' }),
    ],
  });
  const onewayFrom = (id) => [...segments.values()].find((s) => s.from === id).oneway;
  assert.equal(onewayFrom('n1'), 'from-to');
  assert.equal(onewayFrom('n2'), 'from-to');
  assert.equal(onewayFrom('n3'), null);
});

test('jednosměrka vedoucí do slepé uličky se vynechá', () => {
  const { segments, dropped } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      node(4, 50, 14.03),
      node(5, 50.01, 14),
      way(700, [1, 2], { highway: 'primary' }),
      way(701, [2, 3], { highway: 'primary' }),
      way(702, [3, 1], { highway: 'primary' }),
      way(703, [3, 4], { highway: 'primary', oneway: 'yes' }),
      way(704, [1, 5], { highway: 'residential' }),
    ],
  });
  assert.equal(segments.size, 4);
  assert.equal([...segments.values()].some((s) => s.from === 'n4' || s.to === 'n4'), false);
  assert.equal(dropped.segments, 1);
});

test('jednosměrný okruh zůstane zachován', () => {
  const { segments } = buildNetworkFromOsm({
    elements: [
      node(1, 50, 14),
      node(2, 50, 14.01),
      node(3, 50, 14.02),
      way(710, [1, 2], { highway: 'primary', oneway: 'yes' }),
      way(711, [2, 3], { highway: 'primary', oneway: 'yes' }),
      way(712, [3, 1], { highway: 'primary', oneway: 'yes' }),
    ],
  });
  assert.equal(segments.size, 3);
});
