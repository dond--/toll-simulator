import { projectOntoPolyline, sliceCoords } from '../network/geo.js';
import { junctionNodes } from '../network/topology.js';

const START = '__start__';
const GOAL = '__goal__';
const JUNCTION_PENALTY_H = 15 / 3600;
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

export function planRoute(network, startPoint, goalPoint) {
  const startSnap = snapToNetwork(network, startPoint);
  const goalSnap = snapToNetwork(network, goalPoint);
  if (!startSnap || !goalSnap) return { ok: false, error: NO_ROUTE_ERROR };

  const junctions = junctionNodes(network);
  const graph = new Map();
  const connect = (tail, head, coords, lengthKm, segment) => {
    const weight = lengthKm / segment.speedKmh + (junctions.has(head) ? JUNCTION_PENALTY_H : 0);
    addEdge(graph, tail, { to: head, weight, piece: { segmentId: segment.id, coords, lengthKm } });
  };

  for (const segment of network.segments.values()) {
    if (segment.blocked) continue;
    if (segment.id === startSnap.segment.id || segment.id === goalSnap.segment.id) continue;
    if (allowsForward(segment)) connect(segment.from, segment.to, segment.coords, segment.lengthKm, segment);
    if (allowsBackward(segment)) connect(segment.to, segment.from, [...segment.coords].reverse(), segment.lengthKm, segment);
  }

  attachStart(startSnap, connect);
  attachGoal(goalSnap, connect);
  if (startSnap.segment.id === goalSnap.segment.id) {
    const { segment } = startSnap;
    const forward = goalSnap.s >= startSnap.s;
    if (forward ? allowsForward(segment) : allowsBackward(segment)) {
      connect(START, GOAL, sliceCoords(segment.coords, startSnap.s, goalSnap.s), Math.abs(goalSnap.s - startSnap.s), segment);
    }
  }

  const pieces = fastestPath(graph, START, GOAL);
  if (!pieces) return { ok: false, error: NO_ROUTE_ERROR };

  const coords = pieces.flatMap((piece, i) => (i === 0 ? piece.coords : piece.coords.slice(1)));
  const lengthKm = pieces.reduce((sum, piece) => sum + piece.lengthKm, 0);
  return { ok: true, route: { pieces, coords, lengthKm } };
}

function allowsForward({ oneway }) {
  return oneway !== 'to-from';
}

function allowsBackward({ oneway }) {
  return oneway !== 'from-to';
}

function attachStart({ segment, s }, connect) {
  if (allowsBackward(segment)) connect(START, segment.from, sliceCoords(segment.coords, s, 0), s, segment);
  if (allowsForward(segment)) connect(START, segment.to, sliceCoords(segment.coords, s, segment.lengthKm), segment.lengthKm - s, segment);
}

function attachGoal({ segment, s }, connect) {
  if (allowsForward(segment)) connect(segment.from, GOAL, sliceCoords(segment.coords, 0, s), s, segment);
  if (allowsBackward(segment)) connect(segment.to, GOAL, sliceCoords(segment.coords, segment.lengthKm, s), segment.lengthKm - s, segment);
}

function addEdge(graph, from, edge) {
  if (!graph.has(from)) graph.set(from, []);
  graph.get(from).push(edge);
}

function fastestPath(graph, source, target) {
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
