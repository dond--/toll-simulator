import { formatDecimal } from '../format.js';
import { COLORS } from '../config.js';

export function createMap(elementId) {
  return L.map(elementId);
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
  if (segment.blocked) return { color: COLORS.blocked, weight: 4, dashArray: '8 6' };
  if (segment.tollClass) return { color: COLORS.toll[segment.tollClass], weight: 6 };
  return { color: COLORS.free, weight: 4 };
}

function describeSegment(segment) {
  let state = 'bez zpoplatnění';
  if (segment.blocked) state = 'zakázáno';
  else if (segment.tollClass) state = `zpoplatněno, třída ${segment.tollClass}`;
  return `${segment.id} · ${formatDecimal(segment.lengthKm)} km · ${segment.speedKmh} km/h · ${state}`;
}