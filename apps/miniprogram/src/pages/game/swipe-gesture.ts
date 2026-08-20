import type { GameDecision } from './game-state';

export const SWIPE_OFFSET = 80;
export const SWIPE_VELOCITY = 250;

export function resolveSwipeAction(offset: number, velocity: number): GameDecision | null {
  if (offset > SWIPE_OFFSET || velocity > SWIPE_VELOCITY) return 'liked';
  if (offset < -SWIPE_OFFSET || velocity < -SWIPE_VELOCITY) return 'disliked';
  return null;
}

export function calculateReleaseVelocity(
  previousX: number,
  previousTime: number,
  releaseX: number,
  releaseTime: number,
): number {
  const elapsed = releaseTime - previousTime;
  if (elapsed <= 0) return 0;
  return ((releaseX - previousX) / elapsed) * 1000;
}
