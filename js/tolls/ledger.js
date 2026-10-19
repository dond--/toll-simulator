import { TOLL_RATES } from '../config.js';
import { subscriptionCovers } from './policy.js';

export function createTollLedger({ network, events, settings, startedAt }) {
  const state = { tolledSegments: 0, tolledKmByClass: { A: 0, B: 0, C: 0 }, bill: 0 };

  const unsubscribe = events.on('segment:enter', ({ segmentId, lengthKm, simMs }) => {
    const { tollClass } = network.segments.get(segmentId);
    if (!tollClass) return;
    state.tolledSegments++;
    state.tolledKmByClass[tollClass] += lengthKm;
    if (settings.mode === 'postFactum') {
      state.bill += lengthKm * TOLL_RATES[tollClass];
    } else if (!subscriptionCovers(settings, tollClass, startedAt + simMs)) {
      events.emit('toll:violation', { segmentId, tollClass });
    }
  });

  return { state, dispose: unsubscribe };
}