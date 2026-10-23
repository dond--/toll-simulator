import { subscriptionCovers } from './policy.js';

export function createTollLedger({ network, events, settings, rates, startedAt }) {
  const state = { tolledSegments: 0, tolledKmByClass: { A: 0, B: 0, C: 0 }, bill: 0, violations: 0, violatedKm: 0, prohibitedEntries: 0, prohibitedKm: 0 };

  const unsubscribe = events.on('segment:enter', ({ segmentId, lengthKm, simMs }) => {
    const { tollClass, blocked } = network.segments.get(segmentId);
    if (blocked) {
      state.prohibitedEntries++;
      state.prohibitedKm += lengthKm;
      events.emit('prohibition:violation', { segmentId });
      return;
    }
    if (!tollClass) return;
    state.tolledSegments++;
    state.tolledKmByClass[tollClass] += lengthKm;
    if (settings.mode === 'postFactum') {
      state.bill += lengthKm * rates[tollClass];
    } else if (!subscriptionCovers(settings, tollClass, startedAt + simMs)) {
      state.violations++;
      state.violatedKm += lengthKm;
      events.emit('toll:violation', { segmentId, tollClass });
    }
  });

  return { state, dispose: unsubscribe };
}