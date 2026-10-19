import { TOLL_CLASSES } from '../config.js';

const EPSILON = 1e-9;

const sameCoords = (coord, node) =>
  Math.abs(coord[0] - node.lat) < EPSILON && Math.abs(coord[1] - node.lng) < EPSILON;

export function validateNetwork({ nodes, segments }) {
  const errors = [];

  for (const segment of segments.values()) {
    const from = nodes.get(segment.from);
    const to = nodes.get(segment.to);

    if (!from || !to) {
      errors.push(`Úsek ${segment.id} odkazuje na neexistující uzel.`);
      continue;
    }
    if (segment.from === segment.to) {
      errors.push(`Úsek ${segment.id} začíná a končí ve stejném uzlu.`);
    }
    if (
      segment.coords.length < 2 ||
      !sameCoords(segment.coords[0], from) ||
      !sameCoords(segment.coords.at(-1), to)
    ) {
      errors.push(`Úsek ${segment.id} nenavazuje na své uzly.`);
    }
    if (segment.tollClass !== null && !TOLL_CLASSES.includes(segment.tollClass)) {
      errors.push(`Úsek ${segment.id} má neznámou třídu zpoplatnění.`);
    }
  }

  const unreachable = countUnreachableNodes(nodes, segments);
  if (unreachable > 0) {
    errors.push(`Síť není souvislá: ${unreachable} uzlů je mimo hlavní část.`);
  }

  return { ok: errors.length === 0, errors };
}

function countUnreachableNodes(nodes, segments) {
  const adjacency = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const segment of segments.values()) {
    if (adjacency.has(segment.from) && adjacency.has(segment.to)) {
      adjacency.get(segment.from).push(segment.to);
      adjacency.get(segment.to).push(segment.from);
    }
  }

  const start = nodes.keys().next().value;
  if (start === undefined) return 0;

  const visited = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency.get(queue[i])) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return nodes.size - visited.size;
}