const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG_LAT = 111.195;

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function polylineLengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return total;
}

export function pointAt(coords, s) {
  const loc = locate(coords, s);
  return loc && lerp(loc.a, loc.b, loc.t);
}

export function offsetPerpendicular(coords, s, offsetKm) {
  const loc = locate(coords, s);
  const [lat, lng] = lerp(loc.a, loc.b, loc.t);
  const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const dx = (loc.b[1] - loc.a[1]) * kmPerDegLng;
  const dy = (loc.b[0] - loc.a[0]) * KM_PER_DEG_LAT;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [lat, lng];
  return [lat + ((dx / len) * offsetKm) / KM_PER_DEG_LAT, lng - ((dy / len) * offsetKm) / kmPerDegLng];
}

function locate(coords, s) {
  let cum = 0;
  for (let i = 1; i < coords.length; i++) {
    const subLen = haversineKm(coords[i - 1], coords[i]);
    if (cum + subLen >= s || i === coords.length - 1) {
      const t = subLen > 0 ? clamp((s - cum) / subLen, 0, 1) : 0;
      return { a: coords[i - 1], b: coords[i], t };
    }
    cum += subLen;
  }
  return null;
}

export function sliceCoords(coords, fromS, toS) {
  const reversed = fromS > toS;
  const lo = Math.min(fromS, toS);
  const hi = Math.max(fromS, toS);
  const out = [pointAt(coords, lo)];
  let cum = 0;
  for (let i = 1; i < coords.length; i++) {
    cum += haversineKm(coords[i - 1], coords[i]);
    if (cum > lo && cum < hi) out.push(coords[i]);
  }
  out.push(pointAt(coords, hi));
  return reversed ? out.reverse() : out;
}

export function projectOntoPolyline(coords, point) {
  const [lat0, lng0] = point;
  const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  let best = null;
  let cum = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const subLen = haversineKm(a, b);
    const ax = (a[1] - lng0) * kmPerDegLng;
    const ay = (a[0] - lat0) * KM_PER_DEG_LAT;
    const dx = (b[1] - a[1]) * kmPerDegLng;
    const dy = (b[0] - a[0]) * KM_PER_DEG_LAT;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp(-(ax * dx + ay * dy) / len2, 0, 1);
    const q = lerp(a, b, t);
    const distanceKm = haversineKm(q, point);
    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, s: cum + t * subLen, point: q };
    }
    cum += subLen;
  }
  return best;
}

export function chaikinPath(points, iterations) {
  if (points.length < 3) return points;
  let current = points;
  for (let n = 0; n < iterations; n++) {
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    next.push(current.at(-1));
    current = next;
  }
  return current;
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}