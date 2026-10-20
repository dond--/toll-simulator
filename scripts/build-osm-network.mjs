import { mkdir, writeFile } from 'node:fs/promises';
import { buildNetworkFromOsm, buildOverpassQuery } from '../js/network/osm.js';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const MAX_ATTEMPTS = 5;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const AREAS = {
  orp: { relationId: 20127151, file: 'beroun-orp.json' },
  mesto: { relationId: 442333, file: 'beroun.json' },
};

const name = process.argv[2] ?? 'orp';
const area = AREAS[name];
if (!area) {
  console.error(`Neznámé území „${name}“. Použijte: ${Object.keys(AREAS).join(', ')}.`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestOverpass(query) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': 'toll-simulator/0.1 (dev)' },
    body: query,
  });
  if (response.ok) return { data: await response.json() };
  return { retryable: RETRYABLE_STATUS.has(response.status), reason: `Overpass vrátil ${response.status}` };
}

async function fetchOsm(query) {
  for (let attempt = 1; ; attempt++) {
    let outcome;
    try {
      outcome = await requestOverpass(query);
    } catch (error) {
      outcome = { retryable: true, reason: error.message };
    }
    if (outcome.data) return outcome.data;
    if (!outcome.retryable || attempt === MAX_ATTEMPTS) throw new Error(outcome.reason);
    const waitMs = 2 ** attempt * 5000;
    console.warn(`${outcome.reason}, zkusím to znovu za ${waitMs / 1000} s`);
    await sleep(waitMs);
  }
}

const osm = await fetchOsm(buildOverpassQuery(area.relationId));

const { nodes, segments, dropped } = buildNetworkFromOsm(osm);
const totalKm = [...segments.values()].reduce((sum, s) => sum + s.lengthKm, 0);

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(
  new URL(`../data/${area.file}`, import.meta.url),
  JSON.stringify({ nodes: [...nodes.values()], segments: [...segments.values()] }),
);
console.log(`${name}: uzlů ${nodes.size}, úseků ${segments.size}, délka ${totalKm.toFixed(1)} km → data/${area.file}`);
console.log(`odpojené části vynechány: ${dropped.segments} úseků, ${dropped.km.toFixed(1)} km`);
