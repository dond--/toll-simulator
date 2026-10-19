const RANK = { A: 1, B: 2, C: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function createTollSettings(now = Date.now()) {
  return { mode: 'subscription', type: 'A', validFrom: now, validUntil: now + 30 * DAY_MS };
}

export function subscriptionCovers(settings, tollClass, atMs) {
  return RANK[settings.type] >= RANK[tollClass] && atMs >= settings.validFrom && atMs <= settings.validUntil;
}