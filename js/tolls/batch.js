export const BLOCKED = 'blocked';

function canApply(key, segment, canEdit) {
  if (key === BLOCKED) return canEdit(segment);
  return canEdit(segment) || !segment.blocked;
}

function isCurrent(key, segment) {
  if (key === BLOCKED) return segment.blocked;
  return !segment.blocked && segment.tollClass === key;
}

export function isChoiceDisabled(key, segments, canEdit) {
  const applicable = segments.filter((segment) => canApply(key, segment, canEdit));
  return applicable.length === 0 || applicable.every((segment) => isCurrent(key, segment));
}

export function applyChoice(segments, key, canEdit) {
  const applied = segments.filter((segment) => canApply(key, segment, canEdit));
  for (const segment of applied) {
    segment.blocked = key === BLOCKED;
    segment.tollClass = key === BLOCKED ? null : key;
  }
  return applied;
}
