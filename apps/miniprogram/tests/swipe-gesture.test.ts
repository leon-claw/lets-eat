import { describe, expect, it } from 'vitest';
import { resolveSwipeAction, calculateReleaseVelocity } from '../src/pages/game/swipe-gesture';

describe('swipe gesture', () => {
  it('accepts a quick flick even when the final distance is short', () => {
    expect(resolveSwipeAction(28, 320)).toBe('liked');
    expect(resolveSwipeAction(-28, -320)).toBe('disliked');
  });

  it('keeps a slow short drag in place', () => {
    expect(resolveSwipeAction(52, 180)).toBeNull();
  });

  it('calculates release speed in pixels per second', () => {
    expect(calculateReleaseVelocity(100, 120, 120, 170)).toBe(400);
    expect(calculateReleaseVelocity(100, 120, 120, 120)).toBe(0);
  });
});
