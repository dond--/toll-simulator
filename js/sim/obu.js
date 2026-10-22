const MIN_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 3000;

function randomInterval(random) {
  return MIN_INTERVAL_MS + random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export function createOnBoardUnit(random = Math.random) {
  let count = 0;
  let nextAt = randomInterval(random);

  return {
    advanceTo(simMs, onRecord = () => {}) {
      while (nextAt <= simMs) {
        count++;
        onRecord(nextAt);
        nextAt += randomInterval(random);
      }
      return count;
    },
  };
}
