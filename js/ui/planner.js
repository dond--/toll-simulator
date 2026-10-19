import { formatDecimal } from '../format.js';
import { COLORS } from '../config.js';
import { planRoute, snapToNetwork } from '../routing/plan.js';

const START_TEXT = 'Klikněte na start trasy.';
const SNAP_PX = 25;

export function createPlanner(map, network, statusEl, { onRoute, onClear }) {
  let start = null;
  let goal = null;
  let startMarker = null;
  let goalMarker = null;
  let routeLayer = null;
  let preview = null;

  function clearLayers() {
    start = null;
    goal = null;
    for (const layer of [startMarker, goalMarker, routeLayer]) layer?.remove();
    startMarker = null;
    goalMarker = null;
    routeLayer = null;
    onClear();
  }

  function reset() {
    clearLayers();
    statusEl.textContent = START_TEXT;
    updatePickMode();
  }

  function selectGoal(point) {
    goal = point;
    goalMarker = pointMarker(point, COLORS.goal).addTo(map);
    const result = planRoute(network, start, goal, Math.random);
    if (!result.ok) {
      clearLayers();
      statusEl.textContent = result.error;
      return;
    }
    const { route } = result;
    routeLayer = L.polyline(route.coords, { color: COLORS.route, weight: 3, opacity: 0.9, interactive: false }).addTo(map);
    statusEl.textContent = `Trasa: ${formatDecimal(route.lengthKm)} km, ${route.pieces.length} úseků`;
    onRoute(route);
  }

  function updatePickMode() {
    const container = map.getContainer();
    container.classList.toggle('pick-start', !start);
    container.classList.toggle('pick-goal', Boolean(start) && !goal);
  }

  function snapNear(event) {
    const hit = snapToNetwork(network, [event.latlng.lat, event.latlng.lng]);
    if (!hit) return null;
    const distancePx = event.containerPoint.distanceTo(map.latLngToContainerPoint(hit.point));
    return distancePx <= SNAP_PX ? hit : null;
  }

  function showPreview(hit) {
    if (!hit) {
      preview?.remove();
      preview = null;
    } else if (preview) {
      preview.setLatLng(hit.point);
    } else {
      preview = pointMarker(hit.point, COLORS.snapPreview).addTo(map);
    }
  }

  map.on('mousemove', (event) => showPreview(snapNear(event)));
  map.on('mouseout', () => showPreview(null));

  map.on('click', (event) => {
    const hit = snapNear(event);
    if (!hit) return;
    showPreview(null);
    const point = hit.point;
    if (start && !goal) {
      selectGoal(point);
    } else {
      clearLayers();
      start = point;
      startMarker = pointMarker(point, COLORS.start).addTo(map);
      statusEl.textContent = 'Klikněte na cíl trasy.';
    }
    updatePickMode();
  });

  updatePickMode();

  return { reset };
}

function pointMarker([lat, lng], color) {
  return L.circleMarker([lat, lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false });
}
