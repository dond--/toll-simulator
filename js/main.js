import { generateNetwork } from './network/generate.js';
import { loadNetwork } from './network/load.js';
import { validateNetwork } from './network/validate.js';
import { createEventBus } from './core/events.js';
import { createMap, renderNetwork } from './ui/map.js';
import { attachTollEditor } from './ui/tollEditor.js';
import { createTripController } from './ui/tripController.js';
import { createPlanner } from './ui/planner.js';
import { createSelection, segmentIdsByRoadClass } from './ui/selection.js';
import { createTollSettings } from './tolls/policy.js';
import { createTollPanel } from './ui/tollPanel.js';
import { createToast } from './ui/toast.js';
import { createDashboard } from './ui/dashboard.js';

const statusEl = document.getElementById('status');
const { network, label } = await loadInitialNetwork(new URLSearchParams(location.search));
const { ok, errors } = validateNetwork(network);

if (ok) {
  statusEl.textContent = `Síť je v pořádku: ${label}, ${network.nodes.size} uzlů, ${network.segments.size} úseků.`;
} else {
  statusEl.textContent = `Chyby sítě: ${errors.join(' ')}`;
  console.error(errors);
}

const map = createMap('map');
const lines = renderNetwork(map, network);
const selection = createSelection(map, lines, network.segments);
const ROAD_CLASS_BY_KEY = {
  d: 'motorway',
  m: 'motorway_link',
  p: 'primary',
  s: 'secondary',
  t: 'tertiary',
  r: 'residential',
};
window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key === 'a') {
    selection.select(network.segments.keys());
    return;
  }
  if (key === 'z') {
    trips.zoomToRoute();
    return;
  }
  if (key === 'n') {
    resetPlanning();
    return;
  }
  const roadClass = ROAD_CLASS_BY_KEY[key];
  if (!roadClass) return;
  selection.select(segmentIdsByRoadClass(network.segments, roadClass));
});

const events = createEventBus();
const tollSettings = createTollSettings();
const tollPanel = createTollPanel(document.getElementById('toll-panel'), tollSettings);
const notify = createToast(document.getElementById('toast'));
events.on('toll:violation', ({ segmentId, tollClass }) => {
  notify(`Porušení: úsek ${segmentId} (třída ${tollClass}) není kryt platným předplatným.`);
});

const restartButton = document.getElementById('restart');
const dashboard = createDashboard(document.getElementById('dashboard'));
const zoomButton = document.getElementById('zoom-route');
const speedInput = document.getElementById('speed');
const speedOutput = document.getElementById('speed-value');
speedInput.addEventListener('input', () => {
  speedOutput.textContent = `${speedInput.value}×`;
});
const trips = createTripController({ map, network, events, statusEl, restartButton, zoomButton, dashboard, tollPanel, settings: tollSettings, getTimeScale: () => Number(speedInput.value) });
restartButton.addEventListener('click', trips.restart);
zoomButton.addEventListener('click', trips.zoomToRoute);
const planner = createPlanner(map, network, statusEl, { onRoute: trips.start, onClear: trips.stop });
function resetPlanning() {
  planner.reset();
  selection.clear();
}
document.getElementById('reset').addEventListener('click', resetPlanning);
attachTollEditor(map, network, lines, {
  canEdit: (segment) => planner.isIdle() || (trips.isArrived() && !trips.isOnRoute(segment.id)),
  editNote: (targets) => {
    if (planner.isIdle()) return null;
    if (!trips.isArrived()) return 'Během jízdy nelze měnit stav povolený / zakázaný.';
    return targets.some((segment) => trips.isOnRoute(segment.id)) ? 'Úseky na aktuální trase nelze zakázat.' : null;
  },
  selection,
});

async function loadInitialNetwork(params) {
  if (params.has('seed')) {
    const seed = Number(params.get('seed')) || 1;
    return { network: generateNetwork({ seed }), label: `záložní síť (seed ${seed})` };
  }
  const city = params.get('city') === 'true';
  const file = city ? 'data/beroun.json' : 'data/beroun-orp.json';
  const label = city ? 'město Beroun (OSM)' : 'ORP Beroun (OSM)';
  try {
    return { network: await loadNetwork(file), label };
  } catch (error) {
    console.error(error);
    return { network: generateNetwork({ seed: 1 }), label: 'záložní síť (seed 1), síť Berouna se nepodařilo načíst' };
  }
}
