import { junctionNodes } from '../network/topology.js';

const KM_PER_STOP = 2;

export function planJunctionStops(route, network, random) {
  const junctions = junctionNodes(network);

  const { pieces } = route;
  const candidates = [];
  for (let i = 0; i < pieces.length - 1; i++) {
    const a = network.segments.get(pieces[i].segmentId);
    const b = network.segments.get(pieces[i + 1].segmentId);
    const junction = [a.from, a.to].find((id) => id === b.from || id === b.to);
    if (junction !== undefined && junctions.has(junction)) candidates.push(i);
  }

  const maxStops = Math.min(Math.floor(route.lengthKm / KM_PER_STOP), candidates.length);
  const count = Math.floor(random() * (maxStops + 1));
  const chosen = new Set();
  for (let n = 0; n < count; n++) {
    const j = n + Math.floor(random() * (candidates.length - n));
    [candidates[n], candidates[j]] = [candidates[j], candidates[n]];
    chosen.add(candidates[n]);
  }
  return chosen;
}
