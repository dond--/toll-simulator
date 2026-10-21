import { formatDecimal } from '../format.js';
import { COLORS, DEFAULT_ROAD_STYLE, ROAD_HALO, ROAD_STYLE } from '../config.js';

const BLOCKED_DASH = '8 6';
const halos = new WeakMap();

export function createMap(elementId) {
  const map = L.map(elementId);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'basemap-osm',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const orthophoto = L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '© <a href="https://www.cuzk.cz">ČÚZK</a>',
  });
  osm.addTo(map);
  L.control.layers({ Mapa: osm, Ortofoto: orthophoto }, null, { position: 'bottomright' }).addTo(map);
  return map;
}

export function renderNetwork(map, { nodes, segments }) {
  const haloLayer = L.layerGroup().addTo(map);
  const layer = L.layerGroup().addTo(map);
  const lines = new Map();
  for (const segment of segments.values()) {
    const halo = L.polyline(segment.coords, { ...haloStyle(segment), interactive: false }).addTo(haloLayer);
    const line = L.polyline(segment.coords, segmentStyle(segment))
      .bindTooltip(describeSegment(segment))
      .addTo(layer);
    halos.set(line, halo);
    lines.set(segment.id, line);
  }

  const bounds = L.latLngBounds([...nodes.values()].map((node) => [node.lat, node.lng]));
  map.fitBounds(bounds, { padding: [20, 20] });
  return lines;
}

export function updateSegmentLine(line, segment) {
  line.setStyle(segmentStyle(segment));
  halos.get(line).setStyle(haloStyle(segment));
  line.setTooltipContent(describeSegment(segment));
}

function roadWeight(segment) {
  return (ROAD_STYLE[segment.roadClass] ?? DEFAULT_ROAD_STYLE).weight;
}

function haloStyle(segment) {
  return {
    color: ROAD_HALO.color,
    weight: roadWeight(segment) + 2 * ROAD_HALO.width,
    dashArray: segment.blocked ? BLOCKED_DASH : null,
  };
}

function segmentStyle(segment) {
  const weight = roadWeight(segment);
  if (segment.blocked) return { color: COLORS.blocked, weight, dashArray: BLOCKED_DASH };
  if (segment.tollClass) return { color: COLORS.toll[segment.tollClass], weight, dashArray: null };
  return { ...(ROAD_STYLE[segment.roadClass] ?? DEFAULT_ROAD_STYLE), dashArray: null };
}

function describeSegment(segment) {
  let state = 'bez zpoplatnění';
  if (segment.blocked) state = 'zakázáno';
  else if (segment.tollClass) state = `zpoplatněno, třída ${segment.tollClass}`;
  return `${segment.id} · ${formatDecimal(segment.lengthKm)} km · ${segment.speedKmh} km/h · ${state}`;
}