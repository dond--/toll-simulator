import { projectOntoPolyline, sliceCoords } from '../network/geo.js';

const START = '__start__';
const GOAL = '__goal__';
export const NO_ROUTE_ERROR = 'Mezi body neexistuje trasa, která by nevedla přes zakázané úseky.';

export function snapToNetwork(network, point) {
  let best = null;
  for (const segment of network.segments.values()) {
    if (segment.blocked) continue;
    const hit = projectOntoPolyline(segment.coords, point);
    if (!best || hit.distanceKm < best.distanceKm) {
      best = { segment, s: hit.s, point: hit.point, distanceKm: hit.distanceKm };
    }
  }
  return best;
}

export function planRoute(network, startPoint, goalPoint, random) {
  const startSnap = snapToNetwork(network, startPoint);
  const goalSnap = snapToNetwork(network, goalPoint);
  if (!startSnap || !goalSnap) return { ok: false, error: NO_ROUTE_ERROR };

  const graph = new Map();
  const link = (from, to, coords, lengthKm, segmentId) => {
    const weight = lengthKm * (0.8 + 0.7 * random());
    addEdge(graph, from, { to, weight, piece: { segmentId, coords, lengthKm } });
    addEdge(graph, to, { to: from, weight, piece: { segmentId, coords: [...coords].reverse(), lengthKm } });
  };

  for (const segment of network.segments.values()) {
    if (segment.blocked) continue;
    if (segment.id === startSnap.segment.id || segment.id === goalSnap.segment.id) continue;
    link(segment.from, segment.to, segment.coords, segment.lengthKm, segment.id);
  }

  attachPoint(START, startSnap, link);
  attachPoint(GOAL, goalSnap, link);
  if (startSnap.segment.id === goalSnap.segment.id) {
    const { segment } = startSnap;
    link(START, GOAL, sliceCoords(segment.coords, startSnap.s, goalSnap.s), Math.abs(goalSnap.s - startSnap.s), segment.id);
  }

  const pieces = shortestPath(graph, START, GOAL);
  if (!pieces) return { ok: false, error: NO_ROUTE_ERROR };

  const coords = pieces.flatMap((piece, i) => (i === 0 ? piece.coords : piece.coords.slice(1)));
  const lengthKm = pieces.reduce((sum, piece) => sum + piece.lengthKm, 0);
  return { ok: true, route: { pieces, coords, lengthKm } };
}

function attachPoint(virtualId, { segment, s }, link) {
  link(virtualId, segment.from, sliceCoords(segment.coords, s, 0), s, segment.id);
  link(virtualId, segment.to, sliceCoords(segment.coords, s, segment.lengthKm), segment.lengthKm - s, segment.id);
}

function addEdge(graph, from, edge) {
  if (!graph.has(from)) graph.set(from, []);
  graph.get(from).push(edge);
}

function shortestPath(graph, source, target) {
  const dist = new Map([[source, 0]]);
  const prev = new Map();
  const done = new Set();
  for (;;) {
    let current = null;
    for (const [node, d] of dist) {
      if (!done.has(node) && (current === null || d < dist.get(current))) current = node;
    }
    if (current === null) return null;
    if (current === target) break;
    done.add(current);
    for (const edge of graph.get(current) ?? []) {
      const candidate = dist.get(current) + edge.weight;
      if (!dist.has(edge.to) || candidate < dist.get(edge.to)) {
        dist.set(edge.to, candidate);
        prev.set(edge.to, { from: current, piece: edge.piece });
      }
    }
  }

  const pieces = [];
  for (let node = target; node !== source; node = prev.get(node).from) {
    pieces.unshift(prev.get(node).piece);
  }
  return pieces;
}