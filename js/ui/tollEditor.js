import { formatDecimal } from '../format.js';
import { updateSegmentLine } from './map.js';

const BLOCKED = 'blocked';
const CHOICES = [
  { key: BLOCKED, label: 'Zakázaný' },
  { key: null, label: 'Bez zpoplatnění' },
  { key: 'A', label: 'Třída A (1 Kč/km)' },
  { key: 'B', label: 'Třída B (10 Kč/km)' },
  { key: 'C', label: 'Třída C (100 Kč/km)' },
];

export function attachTollEditor(map, network, lines, { isIdle }) {
  for (const [id, line] of lines) {
    const segment = network.segments.get(id);
    line.on('contextmenu', (event) => {
      L.DomEvent.preventDefault(event.originalEvent);
      openEditor(map, event.latlng, segment, line, isIdle);
    });
  }
}

function openEditor(map, latlng, segment, line, isIdle) {
  const idle = isIdle();
  const box = document.createElement('div');
  box.className = 'toll-editor';

  const title = document.createElement('strong');
  title.textContent = `Úsek ${segment.id} · ${formatDecimal(segment.lengthKm)} km`;
  box.append(title);

  if (segment.blocked && !idle) {
    const hint = document.createElement('div');
    hint.textContent = 'Zakázané úseky lze měnit jen bez zadané trasy.';
    box.append(hint);
  }

  const options = document.createElement('div');
  for (const { key, label } of CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = isDisabled(key, segment, idle);
    button.addEventListener('click', () => {
      segment.blocked = key === BLOCKED;
      segment.tollClass = key === BLOCKED ? null : key;
      updateSegmentLine(line, segment);
      map.closePopup();
    });
    options.append(button);
  }
  box.append(options);

  L.popup().setLatLng(latlng).setContent(box).openOn(map);
}

function isDisabled(key, segment, idle) {
  if (key === BLOCKED) return !idle || segment.blocked;
  if (segment.blocked) return !idle;
  return segment.tollClass === key;
}
