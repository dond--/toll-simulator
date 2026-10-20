import { COLORS } from '../config.js';
import { formatDecimal, formatDuration } from '../format.js';
import { createTollLedger } from '../tolls/ledger.js';
import { createTrip } from '../sim/trip.js';
import { tollRows } from './dashboard.js';
import { createSummaryTip } from './summaryTip.js';

const MAX_FRAME_MS = 250;
const RECORD_FLASH_MS = 150;
const BLINK_MIN_MS = 250;
const BLINK_MAX_MS = 850;

function nextBlinkDelay() {
  return BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
}

export function createTripController({ map, network, events, statusEl, restartButton, zoomButton, dashboard, tollPanel, settings, getTimeScale }) {
  let route = null;
  let trip = null;
  let ledger = null;
  let tripSettings = null;
  let car = null;
  let dot = null;
  let flashUntil = 0;
  let nextBlinkAt = 0;
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
    tripSettings = { ...settings };
    ledger = createTollLedger({ network, events, settings: tripSettings, startedAt: Date.now() });
    trip = createTrip({ route, network, events });
    flashUntil = 0;
    nextBlinkAt = 0;
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
    tollPanel.setLocked(false);
  }

  function tick(now) {
    if (lastTs !== null) {
      trip.advance(Math.min(now - lastTs, MAX_FRAME_MS) * getTimeScale());
    }
    lastTs = now;
    if (now >= nextBlinkAt) {
      flashUntil = now + RECORD_FLASH_MS;
      nextBlinkAt = now + nextBlinkDelay();
    }
    const { state } = trip;
    const position = trip.carPosition();
    car.setLatLng(position);
    dot.setLatLng(position);
    const flashing = now < flashUntil;
    if (flashing !== flashShown) {
      flashShown = flashing;
      dot.setStyle({ fillOpacity: flashing ? 1 : 0 });
    }

    if (state.finished) {
      frame = null;
      dashboard.clear();
      tollPanel.setLocked(false);
      showSummary(state);
      return;
    }
    dashboard.update({
      distanceKm: state.distanceKm,
      totalKm: state.totalKm,
      simMs: state.simMs,
      recordedPositions: state.recordedPositions,
      ledger: ledger.state,
      showBill: tripSettings.mode === 'postFactum',
      showViolations: tripSettings.mode === 'subscription',
    });
    statusEl.textContent = `Jízda: ${formatDecimal(state.distanceKm)} / ${formatDecimal(state.totalKm)} km · simulovaný čas ${formatDuration(state.simMs)}`;
    frame = requestAnimationFrame(tick);
  }

  function showSummary(state) {
    const postFactum = tripSettings.mode === 'postFactum';
    const km = ledger.state.tolledKmByClass;
    const bill = postFactum ? ` · celkové mýtné: ${formatDecimal(ledger.state.bill)} Kč` : '';
    statusEl.textContent = `Cíl dosažen: ${formatDecimal(state.distanceKm)} km za ${formatDuration(state.simMs)}\nDélka zpoplatněných úseků: ${formatDecimal(km.A + km.B + km.C)} km${bill}`;
    summaryTip.set([
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