import { mkdir, writeFile } from 'node:fs/promises';
import { buildNetworkFromOsm } from '../js/network/osm.js';

const ENDPOINT = 'https://lz4.overpass-api.de/api/interpreter';
const BEROUN_AREA = 3600442333;
const QUERY = `[out:json][timeout:180];
area(${BEROUN_AREA})->.town;
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$"](area.town);
(._;>;);
out body;`;

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain', 'User-Agent': 'toll-simulator/0.1 (dev)' },
  body: QUERY,
});
if (!response.ok) throw new Error(`Overpass vrátil ${response.status}`);
const osm = await response.json();

const { nodes, segments } = buildNetworkFromOsm(osm);
const totalKm = [...segments.values()].reduce((sum, s) => sum + s.lengthKm, 0);

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../data/beroun.json', import.meta.url),
  JSON.stringify({ nodes: [...nodes.values()], segments: [...segments.values()] }),
);
console.log(`uzlů: ${nodes.size}, úseků: ${segments.size}, délka: ${totalKm.toFixed(1)} km`);
