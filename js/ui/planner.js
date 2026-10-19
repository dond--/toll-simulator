import { formatDecimal } from '../format.js';
import { COLORS } from '../config.js';
import { planRoute } from '../routing/plan.js';

const START_TEXT = 'Klikněte na start trasy.';

export function createPlanner(map, network, statusEl, { onRoute, onClear }) {
  let start = null;
  let goal = null;
  let startMarker = null;
  let goalMarker = null;
  let routeLayer = null;

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

  map.on('click', ({ latlng }) => {
    const point = [latlng.lat, latlng.lng];
    if (start && !goal) {
      selectGoal(point);
      return;
    }
    clearLayers();
    start = point;
    startMarker = pointMarker(point, COLORS.start).addTo(map);
    statusEl.textContent = 'Klikněte na cíl trasy.';
  });

  return { reset };
}

function pointMarker([lat, lng], color) {
  return L.circleMarker([lat, lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false });
}