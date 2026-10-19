import { formatDecimal } from '../format.js';
import { updateSegmentLine } from './map.js';
import { BLOCKED, applyChoice, isChoiceDisabled } from '../tolls/batch.js';

const CHOICES = [
  { key: BLOCKED, label: 'Zakázaný' },
  { key: null, label: 'Bez zpoplatnění' },
  { key: 'A', label: 'Třída A (1 Kč/km)' },
  { key: 'B', label: 'Třída B (10 Kč/km)' },
  { key: 'C', label: 'Třída C (100 Kč/km)' },
];

export function attachTollEditor(map, network, lines, { isIdle, selection }) {
  for (const [id, line] of lines) {
    line.on('contextmenu', (event) => {
      L.DomEvent.preventDefault(event.originalEvent);
      const targets = selection.targetsFor(id).map((targetId) => network.segments.get(targetId));
      openEditor(map, event.latlng, targets, lines, isIdle);
    });
  }
}

function openEditor(map, latlng, targets, lines, isIdle) {
  const idle = isIdle();
  const box = document.createElement('div');
  box.className = 'toll-editor';
  box.append(titleFor(targets));

  const blocked = targets.filter((segment) => segment.blocked).length;
  if (!idle && blocked > 0) box.append(blockedHint(blocked, targets.length));

  const options = document.createElement('div');
  for (const { key, label } of CHOICES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = isChoiceDisabled(key, targets, idle);
    button.addEventListener('click', () => {
      for (const segment of applyChoice(targets, key, idle)) {
        updateSegmentLine(lines.get(segment.id), segment);
      }
      map.closePopup();
    });
    options.append(button);
  }
  box.append(options);

  L.popup().setLatLng(latlng).setContent(box).openOn(map);
}

function titleFor(targets) {
  const title = document.createElement('strong');
  const km = targets.reduce((sum, segment) => sum + segment.lengthKm, 0);
  title.textContent =
    targets.length === 1
      ? `Úsek ${targets[0].id} · ${formatDecimal(km)} km`
      : `Vybrané úseky: ${targets.length} · ${formatDecimal(km)} km`;
  return title;
}

function blockedHint(blocked, total) {
  const hint = document.createElement('div');
  hint.textContent =
    total === 1
      ? 'Zakázané úseky lze měnit jen bez zadané trasy.'
      : `Zakázané úseky lze měnit jen bez zadané trasy: ${blocked} z ${total} se přeskočí.`;
  return hint;
}
