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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function createTripController({ map, network, events, statusEl, recordDot, restartButton, zoomButton, dashboard, tollPanel, settings, getTimeScale }) {
  let route = null;
  let trip = null;
  let ledger = null;
  let tripSettings = null;
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
    car = L.circleMarker(trip.carPosition(), {
      radius: 7,
      color: COLORS.route,
      weight: 3,
      fillColor: '#ffffff',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    dot = L.circleMarker(trip.carPosition(), {
      radius: 3,
      stroke: false,
      fillColor: COLORS.record,
      fillOpacity: 0,
      interactive: false,
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

  function showSummary(state) {
    const postFactum = tripSettings.mode === 'postFactum';
    const km = ledger.state.tolledKmByClass;
    const tolledKm = km.A + km.B + km.C;
    const icon = document.createElement('span');
    icon.className = 'info-icon';
    icon.textContent = 'i';
    statusEl.replaceChildren(icon);
    summaryTip.set([
      { label: 'Ujetá vzdálenost', value: `${formatDecimal(state.distanceKm)} km` },
      { label: 'Celkový čas', value: formatDuration(state.simMs) },
      { label: 'Průměrná rychlost', value: `${formatDecimal(state.distanceKm / (state.simMs / 3600000))} km/h` },
      { label: 'Délka zpoplatněných úseků', value: `${formatDecimal(tolledKm)} km` },
      { label: 'Zaznamenané polohy', value: String(state.recordedPositions) },
      ...tollRows(ledger.state, postFactum, !postFactum),
    ]);
  }

  function isArrived() {
    return trip?.state.finished === true;
  }

  function isOnRoute(segmentId) {
    return route?.pieces.some((piece) => piece.segmentId === segmentId) ?? false;
  }

  function zoomToRoute() {
    if (route) map.fitBounds(L.latLngBounds(route.coords).pad(0.03));
  }

  return { start, stop, restart, zoomToRoute, isArrived, isOnRoute };
}