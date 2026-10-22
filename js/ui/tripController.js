import { COLORS } from '../config.js';
import { formatDecimal, formatDuration } from '../format.js';
import { createTollLedger } from '../tolls/ledger.js';
import { createTrip } from '../sim/trip.js';
import { planJunctionStops } from '../sim/stops.js';
import { tollRows } from './dashboard.js';
import { createSummaryTip } from './summaryTip.js';

const MAX_FRAME_MS = 250;
const RECORD_FLASH_MS = 150;
const BLINK_MIN_MS = 250;
const BLINK_MAX_MS = 850;
const STOP_MIN_MS = 500;
const STOP_MAX_MS = 1500;
const DOT_REF_ZOOM = 16;
const DOT_REF_RADIUS = 4;
const DOT_MIN_RADIUS = 1;
const DOT_MAX_RADIUS = 5;
const DOT_OPACITY = 0.5;
const DOT_OUTLINE_MIN_ZOOM = 13.6;
const TRIP_PANES = [
  ['trip-dots', 430],
  ['trip-route', 440],
  ['trip-car', 450],
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function dotRadius(zoom) {
  const radius = DOT_REF_RADIUS * 2 ** ((zoom - DOT_REF_ZOOM) / 2);
  return Math.min(DOT_MAX_RADIUS, Math.max(DOT_MIN_RADIUS, radius));
}

export function createTripController({ map, network, events, statusEl, recordDot, restartButton, zoomButton, dashboard, tollPanel, settings, getTimeScale }) {
  for (const [name, zIndex] of TRIP_PANES) map.createPane(name).style.zIndex = zIndex;
  const dotRenderer = L.canvas({ pane: 'trip-dots', padding: 0.5 });
  let route = null;
  let trip = null;
  let ledger = null;
  let tripSettings = null;
  let routeLine = null;
  let pathDots = null;
  let recordedPoints = [];
  let unsubscribeRecords = null;
  let car = null;
  let dot = null;
  let flashUntil = 0;
  let nextBlinkAt = 0;
  let pauseUntil = 0;
  let flashShown = false;
  let frame = null;
  let lastTs = null;
  const summaryTip = createSummaryTip(statusEl);

  function start(newRoute) {
    route = newRoute;
    run();
  }

  function restart() {
    if (route) run();
  }

  function stop() {
    halt();
    route = null;
    restartButton.disabled = true;
    zoomButton.disabled = true;
    summaryTip.clear();
    dashboard.clear();
  }

  function run() {
    halt();
    summaryTip.clear();
    recordDot.hidden = false;
    statusEl.textContent = '';
    tripSettings = { ...settings };
    ledger = createTollLedger({ network, events, settings: tripSettings, startedAt: Date.now() });
    trip = createTrip({ route, network, events, stops: planJunctionStops(route, network, Math.random) });
    flashUntil = 0;
    nextBlinkAt = 0;
    pauseUntil = 0;
    flashShown = false;
    routeLine = L.polyline([], { color: COLORS.route, weight: 3, opacity: 0.9, interactive: false, pane: 'trip-route' }).addTo(map);
    pathDots = L.layerGroup().addTo(map);
    recordedPoints = [];
    unsubscribeRecords = events.on('obu:record', ({ position }) => {
      recordedPoints.push(position);
      leavePathDot(position);
    });
    map.on('zoomend', applyDotRadius);
    car = L.circleMarker(trip.carPosition(), {
      radius: 7,
      color: COLORS.route,
      weight: 3,
      fillColor: '#ffffff',
      fillOpacity: 1,
      interactive: false,
      pane: 'trip-car',
    }).addTo(map);
    dot = L.circleMarker(trip.carPosition(), {
      radius: 3,
      stroke: false,
      fillColor: COLORS.record,
      fillOpacity: 0,
      interactive: false,
      pane: 'trip-car',
    }).addTo(map);
    lastTs = null;
    frame = requestAnimationFrame(tick);
    restartButton.disabled = false;
    zoomButton.disabled = false;
    tollPanel.setLocked(true);
  }

  function halt() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    ledger?.dispose();
    ledger = null;
    car?.remove();
    car = null;
    unsubscribeRecords?.();
    unsubscribeRecords = null;
    map.off('zoomend', applyDotRadius);
    routeLine?.remove();
    routeLine = null;
    pathDots?.remove();
    pathDots = null;
    dot?.remove();
    dot = null;
    trip = null;
    recordDot.hidden = true;
    recordDot.classList.remove('on');
    tollPanel.setLocked(false);
  }

  function tick(now) {
    if (lastTs !== null) {
      const simDeltaMs = Math.min(now - lastTs, MAX_FRAME_MS) * getTimeScale();
      if (now < pauseUntil) {
        trip.addWait(simDeltaMs);
      } else if (trip.advance(simDeltaMs)) {
        pauseUntil = now + randomBetween(STOP_MIN_MS, STOP_MAX_MS);
      }
    }
    lastTs = now;
    if (now >= nextBlinkAt) {
      flashUntil = now + RECORD_FLASH_MS;
      nextBlinkAt = now + randomBetween(BLINK_MIN_MS, BLINK_MAX_MS);
    }
    const { state } = trip;
    const position = trip.carPosition();
    car.setLatLng(position);
    dot.setLatLng(position);
    const flashing = now < flashUntil;
    if (flashing !== flashShown) {
      flashShown = flashing;
      dot.setStyle({ fillOpacity: flashing ? 1 : 0 });
      recordDot.classList.toggle('on', flashing);
    }

    if (state.finished) {
      frame = null;
      routeLine.setLatLngs([...recordedPoints, trip.carPosition()]);
      recordDot.hidden = true;
      dashboard.clear();
      tollPanel.setLocked(false);
      showSummary(state);
      return;
    }
    dashboard.update({
      distanceKm: state.distanceKm,
      totalKm: state.totalKm,
      simMs: state.simMs,
      speedKmh: state.speedKmh,
      recordedPositions: state.recordedPositions,
      ledger: ledger.state,
      showBill: tripSettings.mode === 'postFactum',
      showViolations: tripSettings.mode === 'subscription',
    });
    frame = requestAnimationFrame(tick);
  }

  function leavePathDot(position) {
    const zoom = map.getZoom();
    L.circleMarker(position, {
      renderer: dotRenderer,
      radius: dotRadius(zoom),
      color: '#ffffff',
      weight: 1,
      stroke: zoom >= DOT_OUTLINE_MIN_ZOOM,
      fillColor: COLORS.trail,
      fillOpacity: DOT_OPACITY,
      interactive: false,
    }).addTo(pathDots);
  }

  function applyDotRadius() {
    const zoom = map.getZoom();
    const radius = dotRadius(zoom);
    const stroke = zoom >= DOT_OUTLINE_MIN_ZOOM;
    pathDots?.eachLayer((layer) => {
      layer.setRadius(radius);
      layer.setStyle({ stroke });
    });
  }

  function showSummary(state) {
    const postFactum = tripSettings.mode === 'postFactum';
    const km = ledger.state.tolledKmByClass;
    const tolledKm = km.A + km.B + km.C;
    const icon = document.createElement('span');
    icon.className = 'info-icon';
    icon.textContent = 'i';
    statusEl.replaceChildren(icon);
    const tollLabel = postFactum ? 'platba za km' : 'předplatné';
    summaryTip.set([
      { label: 'Ujetá vzdálenost', value: `${formatDecimal(state.distanceKm)} km` },
      { label: 'Celkový čas', value: formatDuration(state.simMs) },
      { label: 'Průměrná rychlost', value: `${formatDecimal(state.distanceKm / (state.simMs / 3600000))} km/h` },
      { label: 'Délka zpoplatněných úseků', value: `${formatDecimal(tolledKm)} km` },
      { label: 'Zaznamenané polohy', value: String(state.recordedPositions) },
      ...tollRows(ledger.state, postFactum, !postFactum),
    ], tollLabel);
  }

  function isArrived() {
    return trip?.state.finished === true;
  }

  function zoomToRoute() {
    if (route) map.fitBounds(L.latLngBounds(route.coords).pad(0.03));
  }

  return { start, stop, restart, zoomToRoute, isArrived };
}