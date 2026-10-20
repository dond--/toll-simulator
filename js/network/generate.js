import { TOLL_CLASSES } from '../config.js';
import { polylineLengthKm } from './geo.js';
import { createRandom } from './random.js';

const DEFAULT_OPTIONS = {
  seed: 1,
  cols: 8,
  rows: 6,
  centerLat: 50.08,
  centerLng: 14.42,
  stepLat: 0.012,
  stepLng: 0.018,
  jitter: 0.15,
  blockedRate: 0.05,
  tollRate: 0.25,
  mainRoadSpeedKmh: 90,
  localRoadSpeedKmh: 50,
};

export function generateNetwork(options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const random = createRandom(o.seed);
  const jitter = (step) => (random() * 2 - 1) * o.jitter * step;
  const nodeId = (row, col) => `n${row}-${col}`;

  const nodes = new Map();
  for (let row = 0; row < o.rows; row++) {
    for (let col = 0; col < o.cols; col++) {
      const id = nodeId(row, col);
      nodes.set(id, {
        id,
        lat: o.centerLat + (row - (o.rows - 1) / 2) * o.stepLat + jitter(o.stepLat),
        lng: o.centerLng + (col - (o.cols - 1) / 2) * o.stepLng + jitter(o.stepLng),
      });
    }
  }

  const segments = new Map();
  const addSegment = (fromId, toId, isMainRoad) => {
    const a = nodes.get(fromId);
    const b = nodes.get(toId);
    const middle = [
      (a.lat + b.lat) / 2 + jitter(o.stepLat) * 0.5,
      (a.lng + b.lng) / 2 + jitter(o.stepLng) * 0.5,
    ];
    const coords = [[a.lat, a.lng], middle, [b.lat, b.lng]];
    const blocked = random() < o.blockedRate;
    const tolled = random() < o.tollRate;
    const tollClass =
      tolled && !blocked ? TOLL_CLASSES[Math.floor(random() * TOLL_CLASSES.length)] : null;
    const id = `s${segments.size + 1}`;

    segments.set(id, {
      id,
      from: fromId,
      to: toId,
      coords,
      lengthKm: polylineLengthKm(coords),
      speedKmh: isMainRoad ? o.mainRoadSpeedKmh : o.localRoadSpeedKmh,
      oneway: null,
      roadClass: null,
      blocked,
      tollClass,
    });
  };

  for (let row = 0; row < o.rows; row++) {
    for (let col = 0; col < o.cols; col++) {
      if (col + 1 < o.cols) addSegment(nodeId(row, col), nodeId(row, col + 1), row % 3 === 0);
      if (row + 1 < o.rows) addSegment(nodeId(row, col), nodeId(row + 1, col), col % 3 === 0);
    }
  }

  return { nodes, segments };
}