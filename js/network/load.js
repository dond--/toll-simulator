export async function loadNetwork(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Síť se nepodařilo načíst (${response.status}).`);
  const { nodes, segments } = await response.json();
  return {
    nodes: new Map(nodes.map((node) => [node.id, node])),
    segments: new Map(segments.map((segment) => [segment.id, segment])),
  };
}
