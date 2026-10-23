import { formatDecimal } from '../format.js';
import { updateSegmentLine } from './map.js';
import { BLOCKED, applyChoice, isChoiceDisabled } from '../tolls/batch.js';
import { tollClassLabel } from '../tolls/rates.js';
import { TOLL_CLASSES } from '../config.js';

function choicesFor(rates) {
  return [
    { key: BLOCKED, label: 'Zakázaný' },
    { key: null, label: 'Bez zpoplatnění' },
    ...TOLL_CLASSES.map((tollClass) => ({ key: tollClass, label: tollClassLabel(tollClass, rates[tollClass]) })),
  ];
}

export function attachTollEditor(map, network, lines, { canEdit, editNote, selection, getRates }) {
  for (const [id, line] of lines) {
    line.on('contextmenu', (event) => {
      L.DomEvent.preventDefault(event.originalEvent);
      if (selection.selectedIds().length === 0) {
        openEditor(map, event.latlng, [network.segments.get(id)], lines, { canEdit, editNote, getRates });
      }
    });
  }

  map.on('contextmenu', (event) => {
    const ids = selection.selectedIds();
    if (ids.length === 0) return;
    L.DomEvent.preventDefault(event.originalEvent);
    openEditor(map, event.latlng, ids.map((id) => network.segments.get(id)), lines, { canEdit, editNote, getRates });
  });
}

function openEditor(map, latlng, targets, lines, { canEdit, editNote, getRates }) {
  const box = document.createElement('div');
  box.className = 'toll-editor';
  box.append(titleFor(targets));

  const note = editNote(targets);
  if (note) box.append(noteFor(note));

  const options = document.createElement('div');
  for (const { key, label } of choicesFor(getRates())) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = isChoiceDisabled(key, targets, canEdit);
    button.addEventListener('click', () => {
      for (const segment of applyChoice(targets, key, canEdit)) {
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

function noteFor(text) {
  const hint = document.createElement('div');
  hint.textContent = text;
  return hint;
}
