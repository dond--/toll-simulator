export const BLOCKED = 'blocked';

function canApply(key, segment, idle) {
  if (key === BLOCKED) return idle;
  return idle || !segment.blocked;
}

function isCurrent(key, segment) {
  if (key === BLOCKED) return segment.blocked;
  return !segment.blocked && segment.tollClass === key;
}

export function isChoiceDisabled(key, segments, idle) {
  const applicable = segments.filter((segment) => canApply(key, segment, idle));
  return applicable.length === 0 || applicable.every((segment) => isCurrent(key, segment));
}

export function applyChoice(segments, key, idle) {
  const applied = segments.filter((segment) => canApply(key, segment, idle));
  for (const segment of applied) {
    segment.blocked = key === BLOCKED;
    segment.tollClass = key === BLOCKED ? null : key;
  }
  return applied;
}
