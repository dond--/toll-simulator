import { COLORS } from '../config.js';

const DRAG_THRESHOLD_PX = 5;
const HALO_STYLE = { color: COLORS.selection, weight: 12, opacity: 0.8, interactive: false };
const RECT_STYLE = {
  color: COLORS.selection,
  weight: 2,
  dashArray: '6 4',
  fillColor: COLORS.selection,
  fillOpacity: 0.15,
  interactive: false,
};

export function isMacPlatform(platform) {
  return /mac/i.test(platform);
}

const IS_MAC = isMacPlatform(globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? '');

export function isSelectionModifier(event) {
  return IS_MAC ? event.metaKey : event.ctrlKey;
}

function orientation(p, q, r) {
  return Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
}

function onSegment(p, q, r) {
  return Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0])
    && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
}

function edgesIntersect(p1, p2, p3, p4) {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  return (d1 === 0 && onSegment(p3, p4, p1))
    || (d2 === 0 && onSegment(p3, p4, p2))
    || (d3 === 0 && onSegment(p1, p2, p3))
    || (d4 === 0 && onSegment(p1, p2, p4));
}

export function segmentsInBounds(segments, bounds) {
  const corners = [
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
    [bounds.north, bounds.east],
    [bounds.north, bounds.west],
  ];
  const inside = ([lat, lng]) => lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
  const ids = [];
  for (const segment of segments.values()) {
    const { coords } = segment;
    const touches = coords.some(inside) || coords.some((point, i) => {
      if (i === 0) return false;
      return corners.some((corner, j) => edgesIntersect(coords[i - 1], point, corner, corners[(j + 1) % 4]));
    });
    if (touches) ids.push(segment.id);
  }
  return ids;
}

export function segmentIdsByRoadClass(segments, roadClass) {
  return [...segments.values()].filter((segment) => segment.roadClass === roadClass).map((segment) => segment.id);
}

export function createSelection(map, lines, segments) {
  const selected = new Set();
  const halos = L.layerGroup().addTo(map);
  const container = map.getContainer();
  let drag = null;
  let rectangle = null;
  let suppressClick = false;

  function render() {
    halos.clearLayers();
    for (const id of selected) {
      L.polyline(segments.get(id).coords, HALO_STYLE).addTo(halos).bringToBack();
    }
  }

  function toggle(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    render();
  }

  function clear() {
    selected.clear();
    render();
  }

  function selectedIds() {
    return [...selected];
  }

  function containerPoint(event) {
    const rect = container.getBoundingClientRect();
    return L.point(event.clientX - rect.left, event.clientY - rect.top);
  }

  for (const [id, line] of lines) {
    line.on('click', (event) => {
      if (isSelectionModifier(event.originalEvent)) toggle(id);
    });
  }

  map.on('click', (event) => {
    if (!isSelectionModifier(event.originalEvent)) clear();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clear();
  }, true);

  container.addEventListener(
    'mousedown',
    (event) => {
      suppressClick = false;
      if (event.button !== 0 || !isSelectionModifier(event)) return;
      event.preventDefault();
      event.stopPropagation();
      drag = { x: event.clientX, y: event.clientY, start: containerPoint(event), moved: false };
    },
    true,
  );

  window.addEventListener('mousemove', (event) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const bounds = L.latLngBounds(
      map.containerPointToLatLng(drag.start),
      map.containerPointToLatLng(containerPoint(event)),
    );
    if (rectangle) rectangle.setBounds(bounds);
    else rectangle = L.rectangle(bounds, RECT_STYLE).addTo(map);
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const dragged = drag.moved;
    drag = null;
    if (!dragged) return;
    suppressClick = true;
    const bounds = rectangle.getBounds();
    rectangle.remove();
    rectangle = null;
    const inside = segmentsInBounds(segments, {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
    for (const id of inside) selected.add(id);
    render();
  });

  container.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
    },
    true,
  );

  function select(ids) {
    for (const id of ids) selected.add(id);
    render();
  }

  return { clear, select, selectedIds };
}
