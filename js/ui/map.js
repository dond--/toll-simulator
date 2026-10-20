import { formatDecimal } from '../format.js';
import { COLORS, DEFAULT_ROAD_STYLE, ROAD_STYLE } from '../config.js';

export function createMap(elementId) {
  const map = L.map(elementId);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

export function renderNetwork(map, { nodes, segments }) {
  const layer = L.layerGroup().addTo(map);
  const lines = new Map();
  for (const segment of segments.values()) {
    const line = L.polyline(segment.coords, segmentStyle(segment))
      .bindTooltip(describeSegment(segment))
      .addTo(layer);
    lines.set(segment.id, line);
  }

  const bounds = L.latLngBounds([...nodes.values()].map((node) => [node.lat, node.lng]));
  map.fitBounds(bounds, { padding: [20, 20] });
  return lines;
}

export function updateSegmentLine(line, segment) {
  line.setStyle(segmentStyle(segment));
  line.setTooltipContent(describeSegment(segment));
}

function segmentStyle(segment) {
  const { weight } = ROAD_STYLE[segment.roadClass] ?? DEFAULT_ROAD_STYLE;
  if (segment.blocked) return { color: COLORS.blocked, weight, dashArray: '8 6' };
  if (segment.tollClass) return { color: COLORS.toll[segment.tollClass], weight, dashArray: null };
  return { ...(ROAD_STYLE[segment.roadClass] ?? DEFAULT_ROAD_STYLE), dashArray: null };
}

function describeSegment(segment) {
  let state = 'bez zpoplatnění';
  if (segment.blocked) state = 'zakázáno';
  else if (segment.tollClass) state = `zpoplatněno, třída ${segment.tollClass}`;
  return `${segment.id} · ${formatDecimal(segment.lengthKm)} km · ${segment.speedKmh} km/h · ${state}`;
}