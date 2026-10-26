import { pointAt } from '../network/geo.js';
import { createOnBoardUnit } from './obu.js';

const MS_PER_HOUR = 3600000;

export function createTrip({ route, network, events, stops = new Set() }) {
  const { pieces } = route;
  const state = { distanceKm: 0, totalKm: route.lengthKm, simMs: 0, finished: false, recordedPositions: 0, speedKmh: network.segments.get(pieces[0].segmentId).speedKmh };
  const obu = createOnBoardUnit();
  let index = 0;
  let offsetKm = 0;

  events.emit('segment:enter', { segmentId: pieces[0].segmentId, lengthKm: pieces[0].lengthKm, simMs: 0 });

  function advance(simDeltaMs) {
    let remainingMs = simDeltaMs;
    let stopped = false;
    if (!state.finished) state.speedKmh = network.segments.get(pieces[index].segmentId).speedKmh;
    while (remainingMs > 0 && !state.finished) {
      const piece = pieces[index];
      const speedKmh = network.segments.get(piece.segmentId).speedKmh;
      const leftKm = piece.lengthKm - offsetKm;
      const msToEnd = (leftKm / speedKmh) * MS_PER_HOUR;
      const fromSim = state.simMs;
      const fromOffset = offsetKm;
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
        const leftPiece = index;
        index++;
        if (index === pieces.length) {
          state.finished = true;
          events.emit('trip:finish', { simMs: state.simMs });
        } else {
          state.speedKmh = network.segments.get(pieces[index].segmentId).speedKmh;
          events.emit('segment:enter', { segmentId: pieces[index].segmentId, lengthKm: pieces[index].lengthKm, simMs: state.simMs });
          if (stops.has(leftPiece)) {
            stopped = true;
            state.speedKmh = 0;
            remainingMs = 0;
          }
        }
      }
      const positionAt = (simMs) => pointAt(piece.coords, fromOffset + ((simMs - fromSim) / MS_PER_HOUR) * speedKmh);
      state.recordedPositions = obu.advanceTo(state.simMs, (simMs) => events.emit('obu:record', { position: positionAt(simMs), simMs, segmentId: piece.segmentId }));
    }
    return stopped;
  }

  function carPosition() {
    if (state.finished) return pieces.at(-1).coords.at(-1);
    return pointAt(pieces[index].coords, offsetKm);
  }

  function addWait(simDeltaMs) {
    state.simMs += simDeltaMs;
    const position = carPosition();
    const segmentId = (state.finished ? pieces.at(-1) : pieces[index]).segmentId;
    state.recordedPositions = obu.advanceTo(state.simMs, (simMs) => events.emit('obu:record', { position, simMs, segmentId }));
  }

  return { state, advance, addWait, carPosition };
}