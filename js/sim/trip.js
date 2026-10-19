import { pointAt } from '../network/geo.js';

const MS_PER_HOUR = 3600000;

export function createTrip({ route, network, events }) {
  const { pieces } = route;
  const state = { distanceKm: 0, totalKm: route.lengthKm, simMs: 0, finished: false };
  let index = 0;
  let offsetKm = 0;

  events.emit('segment:enter', { segmentId: pieces[0].segmentId, lengthKm: pieces[0].lengthKm, simMs: 0 });

  function advance(simDeltaMs) {
    let remainingMs = simDeltaMs;
    while (remainingMs > 0 && !state.finished) {
      const piece = pieces[index];
      const speedKmh = network.segments.get(piece.segmentId).speedKmh;
      const leftKm = piece.lengthKm - offsetKm;
      const msToEnd = (leftKm / speedKmh) * MS_PER_HOUR;
      if (msToEnd > remainingMs) {
        const movedKm = (remainingMs / MS_PER_HOUR) * speedKmh;
        offsetKm += movedKm;
        state.distanceKm += movedKm;
        state.simMs += remainingMs;
        remainingMs = 0;
      } else {
        state.distanceKm += leftKm;
        state.simMs += msToEnd;
        remainingMs -= msToEnd;
        offsetKm = 0;
        index++;
        if (index === pieces.length) {
          state.finished = true;
          events.emit('trip:finish', { simMs: state.simMs });
        } else {
          events.emit('segment:enter', { segmentId: pieces[index].segmentId, lengthKm: pieces[index].lengthKm, simMs: state.simMs });
        }
      }
    }
  }

  function carPosition() {
    if (state.finished) return pieces.at(-1).coords.at(-1);
    return pointAt(pieces[index].coords, offsetKm);
  }

  return { state, advance, carPosition };
}