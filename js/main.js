import { generateNetwork } from './network/generate.js';
import { validateNetwork } from './network/validate.js';
import { createEventBus } from './core/events.js';
import { createMap, renderNetwork } from './ui/map.js';
import { attachTollEditor } from './ui/tollEditor.js';
import { createTripController } from './ui/tripController.js';
import { createPlanner } from './ui/planner.js';
import { createTollSettings } from './tolls/policy.js';
import { createTollPanel } from './ui/tollPanel.js';
import { createToast } from './ui/toast.js';
import { createDashboard } from './ui/dashboard.js';

const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
const network = generateNetwork({ seed });
const { ok, errors } = validateNetwork(network);
const statusEl = document.getElementById('status');

if (ok) {
  statusEl.textContent = `Síť je v pořádku: ${network.nodes.size} uzlů, ${network.segments.size} úseků (seed ${seed}). Klikněte na „Nový výběr“ a zadejte trasu.`;
} else {
  statusEl.textContent = `Chyby sítě: ${errors.join(' ')}`;
  console.error(errors);
}

const map = createMap('map');
const lines = renderNetwork(map, network);

const events = createEventBus();
const tollSettings = createTollSettings();
const tollPanel = createTollPanel(document.getElementById('toll-panel'), tollSettings);
const notify = createToast(document.getElementById('toast'));
events.on('toll:violation', ({ segmentId, tollClass }) => {
  notify(`Porušení: úsek ${segmentId} (třída ${tollClass}) není kryt platným předplatným.`);
});

const restartButton = document.getElementById('restart');
const dashboard = createDashboard(document.getElementById('dashboard'));
const trips = createTripController({ map, network, events, statusEl, restartButton, dashboard, tollPanel, settings: tollSettings });
restartButton.addEventListener('click', trips.restart);
const planner = createPlanner(map, network, statusEl, { onRoute: trips.start, onClear: trips.stop });
document.getElementById('reset').addEventListener('click', planner.reset);
attachTollEditor(map, network, lines, { isIdle: planner.isIdle });