export function junctionNodes(network) {
  const degree = new Map();
  for (const segment of network.segments.values()) {
    for (const id of [segment.from, segment.to]) degree.set(id, (degree.get(id) ?? 0) + 1);
  }
  return new Set([...degree].filter(([, count]) => count >= 3).map(([id]) => id));
}
