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
      pieces.push({ from, to, coords, speedKmh: speedOf(way), oneway: onewayOf(way) });
    }
  }

  const kept = keepLargestComponent(pieces);
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
  if (tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true') return 'from-to';
  if (tags.oneway === '-1') return 'to-from';
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

function keepLargestComponent(pieces) {
  const adjacency = new Map();
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push(b);
  };
  for (const piece of pieces) {
    link(piece.from, piece.to);
    link(piece.to, piece.from);
  }

  const seen = new Set();
  let largest = new Set();
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    const component = new Set([start]);
    const queue = [start];
    seen.add(start);
    for (let i = 0; i < queue.length; i++) {
      for (const next of adjacency.get(queue[i])) {
        if (seen.has(next)) continue;
        seen.add(next);
        component.add(next);
        queue.push(next);
      }
    }
    if (component.size > largest.size) largest = component;
  }

  return pieces.filter((piece) => largest.has(piece.from));
}
