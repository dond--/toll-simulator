import { polylineLengthKm } from './geo.js';

export const DRIVABLE_HIGHWAY = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$/;

const DEFAULT_SPEED_KMH = {
  motorway: 110,
  motorway_link: 60,
  trunk: 90,
  trunk_link: 50,
  primary: 70,
  primary_link: 50,
  secondary: 60,
  secondary_link: 40,
  tertiary: 50,
  tertiary_link: 40,
  unclassified: 50,
  residential: 30,
};

const ONEWAY_TAG_VALUES = new Map([
  ['yes', 'from-to'],
  ['1', 'from-to'],
  ['true', 'from-to'],
  ['-1', 'to-from'],
]);

const IMPLICIT_ONEWAY_HIGHWAYS = new Set(['motorway', 'motorway_link']);

const CZ_SPEED_KMH = { 'CZ:urban': 50, 'CZ:rural': 90, 'CZ:motorway': 130 };

const round6 = (value) => Math.round(value * 1e6) / 1e6;

export function buildOverpassQuery(relationId) {
  return `[out:json][timeout:180];
relation(${relationId});
map_to_area->.area;
way["highway"~"${DRIVABLE_HIGHWAY.source}"](area.area);
(._;>;);
out body;`;
}

export function buildNetworkFromOsm({ elements }) {
  const osmNodes = new Map();
  const ways = [];
  for (const element of elements) {
    if (element.type === 'node') osmNodes.set(element.id, element);
    else if (element.type === 'way' && DRIVABLE_HIGHWAY.test(element.tags?.highway ?? '')) ways.push(element);
  }
  const usableWays = ways.filter((way) => way.nodes.length >= 2 && way.nodes.every((id) => osmNodes.has(id)));

  const references = new Map();
  for (const way of usableWays) {
    for (const id of way.nodes) references.set(id, (references.get(id) ?? 0) + 1);
  }

  const pieces = [];
  for (const way of usableWays) {
    const cuts = [];
    for (let i = 0; i < way.nodes.length; i++) {
      const isEnd = i === 0 || i === way.nodes.length - 1;
      if (isEnd || references.get(way.nodes[i]) > 1) cuts.push(i);
    }
    for (let k = 1; k < cuts.length; k++) {
      const ids = way.nodes.slice(cuts[k - 1], cuts[k] + 1);
      const from = ids[0];
      const to = ids.at(-1);
      if (from === to) continue;
      const coords = ids.map((id) => [round6(osmNodes.get(id).lat), round6(osmNodes.get(id).lon)]);
      pieces.push({ from, to, coords, speedKmh: speedOf(way), oneway: onewayOf(way), roadClass: way.tags.highway });
    }
  }

  const kept = keepLargestStronglyConnected(pieces);
  const keptSet = new Set(kept);
  const droppedPieces = pieces.filter((piece) => !keptSet.has(piece));
  const nodes = new Map();
  const segments = new Map();
  for (const piece of kept) {
    for (const id of [piece.from, piece.to]) {
      if (!nodes.has(nodeId(id))) {
        const node = osmNodes.get(id);
        nodes.set(nodeId(id), { id: nodeId(id), lat: round6(node.lat), lng: round6(node.lon) });
      }
    }
    const id = `s${segments.size + 1}`;
    segments.set(id, {
      id,
      from: nodeId(piece.from),
      to: nodeId(piece.to),
      coords: piece.coords,
      lengthKm: polylineLengthKm(piece.coords),
      speedKmh: piece.speedKmh,
      oneway: piece.oneway,
      roadClass: piece.roadClass,
      blocked: false,
      tollClass: null,
    });
  }

  const dropped = {
    segments: droppedPieces.length,
    km: droppedPieces.reduce((sum, piece) => sum + polylineLengthKm(piece.coords), 0),
  };

  return { nodes, segments, dropped };
}

function nodeId(osmId) {
  return `n${osmId}`;
}

function onewayOf({ tags }) {
  if (tags.oneway !== undefined) return ONEWAY_TAG_VALUES.get(tags.oneway) ?? null;
  if (tags.junction === 'roundabout' || IMPLICIT_ONEWAY_HIGHWAYS.has(tags.highway)) return 'from-to';
  return null;
}

function speedOf(way) {
  const { maxspeed, highway } = way.tags;
  return parseMaxspeed(maxspeed) ?? DEFAULT_SPEED_KMH[highway] ?? 50;
}

function parseMaxspeed(value) {
  if (!value) return null;
  if (Object.hasOwn(CZ_SPEED_KMH, value)) return CZ_SPEED_KMH[value];
  const match = /^(\d+)(\s*km\/h)?$/.exec(value.trim());
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
}

function keepLargestStronglyConnected(pieces) {
  const arcs = new Map();
  const nodeIds = new Set();
  const addArc = (a, b) => {
    if (!arcs.has(a)) arcs.set(a, []);
    arcs.get(a).push(b);
  };
  for (const { from, to, oneway } of pieces) {
    nodeIds.add(from);
    nodeIds.add(to);
    if (oneway !== 'to-from') addArc(from, to);
    if (oneway !== 'from-to') addArc(to, from);
  }
  const largest = largestStronglyConnected(nodeIds, arcs);
  return pieces.filter((piece) => largest.has(piece.from) && largest.has(piece.to));
}

function largestStronglyConnected(nodeIds, arcs) {
  const order = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  let counter = 0;
  let largest = new Set();

  const visit = (node) => {
    order.set(node, counter);
    low.set(node, counter);
    counter++;
    stack.push(node);
    onStack.add(node);
    return { node, next: 0 };
  };

  for (const root of nodeIds) {
    if (order.has(root)) continue;
    const work = [visit(root)];
    while (work.length > 0) {
      const frame = work.at(-1);
      const out = arcs.get(frame.node) ?? [];
      if (frame.next < out.length) {
        const child = out[frame.next++];
        if (!order.has(child)) work.push(visit(child));
        else if (onStack.has(child)) low.set(frame.node, Math.min(low.get(frame.node), order.get(child)));
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work.at(-1).node;
        low.set(parent, Math.min(low.get(parent), low.get(frame.node)));
      }
      if (low.get(frame.node) === order.get(frame.node)) {
        const component = new Set();
        let member;
        do {
          member = stack.pop();
          onStack.delete(member);
          component.add(member);
        } while (member !== frame.node);
        if (component.size > largest.size) largest = component;
      }
    }
  }
  return largest;
}
