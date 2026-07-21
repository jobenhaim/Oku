/** Standard Oku counter curve: calm acceleration followed by calm deceleration. */
export const easeInOut = (progress: number): number => {
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
};

/** Diamond counter curve: immediate momentum followed by a smooth settle. */
export const easeOut = (progress: number): number => {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - clamped, 3);
};
