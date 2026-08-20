import { describe, expect, it } from 'vitest';
import { navigateToTarget } from '../src/adapters/wx-navigation';

describe('wx navigation adapter', () => {
  it('maps a semantic choose target to a mini program route', () => {
    const calls: Record<string, unknown>[] = [];
    (globalThis as unknown as { wx: { navigateTo: (options: Record<string, unknown>) => void } }).wx = {
      navigateTo(options) { calls.push(options); },
    };
    navigateToTarget({ type: 'choose', roundId: 'round-1' });
    expect(calls).toEqual([{ url: '/pages/game/index?roundId=round-1' }]);
  });
});
