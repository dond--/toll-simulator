import { formatDecimal } from '../format.js';
import { updateSegmentLine } from './map.js';

const TOLL_OPTIONS = [
  { value: null, label: 'Bez zpoplatnění' },
  { value: 'A', label: 'Třída A (1 Kč/km)' },
  { value: 'B', label: 'Třída B (10 Kč/km)' },
  { value: 'C', label: 'Třída C (100 Kč/km)' },
];

export function attachTollEditor(map, network, lines) {
  for (const [id, line] of lines) {
    const segment = network.segments.get(id);
    line.on('contextmenu', (event) => {
      L.DomEvent.preventDefault(event.originalEvent);
      openEditor(map, event.latlng, segment, line);
    });
  }
}

function openEditor(map, latlng, segment, line) {
  const box = document.createElement('div');
  box.className = 'toll-editor';

  const title = document.createElement('strong');
  title.textContent = `Úsek ${segment.id} · ${formatDecimal(segment.lengthKm)} km`;
  box.append(title);

  if (segment.blocked) {
    box.append('Zakázaný úsek nelze zpoplatnit.');
  } else {
    const options = document.createElement('div');
    for (const { value, label } of TOLL_OPTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = segment.tollClass === value;
      button.addEventListener('click', () => {
        segment.tollClass = value;
        updateSegmentLine(line, segment);
        map.closePopup();
      });
      options.append(button);
    }
    box.append(options);
  }

  L.popup().setLatLng(latlng).setContent(box).openOn(map);
}