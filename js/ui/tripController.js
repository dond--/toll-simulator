import { COLORS, SIM_TIME_SCALE } from '../config.js';
import { formatDecimal, formatDuration } from '../format.js';
import { createTollLedger } from '../tolls/ledger.js';
import { createTrip } from '../sim/trip.js';
import { tollRows } from './dashboard.js';
import { createSummaryTip } from './summaryTip.js';

const MAX_FRAME_MS = 250;

export function createTripController({ map, network, events, statusEl, restartButton, dashboard, tollPanel, settings }) {
  let route = null;
  let trip = null;
  let ledger = null;
  let tripSettings = null;
  let car = null;
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
    summaryTip.clear();
    dashboard.clear();
  }

  function run() {
    halt();
    summaryTip.clear();
    tripSettings = { ...settings };
    ledger = createTollLedger({ network, events, settings: tripSettings, startedAt: Date.now() });
    trip = createTrip({ route, network, events });
    car = L.circleMarker(trip.carPosition(), {
      radius: 7,
      color: COLORS.route,
      weight: 3,
      fillColor: '#ffffff',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    lastTs = null;
    frame = requestAnimationFrame(tick);
    restartButton.disabled = false;
    tollPanel.setLocked(true);
  }

  function halt() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    ledger?.dispose();
    ledger = null;
    car?.remove();
    car = null;
    trip = null;
    tollPanel.setLocked(false);
  }

  function tick(now) {
    if (lastTs !== null) {
      trip.advance(Math.min(now - lastTs, MAX_FRAME_MS) * SIM_TIME_SCALE);
    }
    lastTs = now;
    const { state } = trip;
    car.setLatLng(trip.carPosition());

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
    summaryTip.set(tollRows(ledger.state, postFactum, !postFactum));
  }

  return { start, stop, restart };
}