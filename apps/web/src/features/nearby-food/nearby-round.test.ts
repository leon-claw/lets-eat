import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NearbyRoundSession } from './types';
import { useNearbyRound, type NearbyRoundStore } from './nearby-round';

const restaurants = [1, 2, 3].map((index) => ({
  source: 'amap' as const,
  id: `poi-${index}`,
  name: `餐厅 ${index}`,
  type: '餐饮服务;中餐厅',
  fetchedAt: '2026-08-31T00:00:00.000Z',
}));

function createStore(initial: NearbyRoundSession | null): NearbyRoundStore & { saves: NearbyRoundSession[] } {
  let value = initial;
  const saves: NearbyRoundSession[] = [];
  return {
    saves,
    load: vi.fn(() => value),
    save: vi.fn((next) => { value = next; saves.push(next); }),
    clear: vi.fn(() => { value = null; }),
  };
}

describe('useNearbyRound', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('附近回合开始前随机打乱，刷新后恢复已保存顺序', async () => {
    const freshStore = createStore({
      restaurants,
      itemIds: [],
      decisions: {},
      history: [],
      completedAt: null,
    });
    const first = renderHook(() => useNearbyRound(freshStore));
    await waitFor(() => expect(first.result.current.state.status).toBe('choosing'));
    expect(first.result.current.state.choices.map((choice) => choice.id)).toEqual(['amap:poi-2', 'amap:poi-3', 'amap:poi-1']);
    first.unmount();

    const restoredStore = createStore({
      restaurants,
      itemIds: ['amap:poi-3', 'amap:poi-1', 'amap:poi-2'],
      decisions: { 'amap:poi-3': 'liked' },
      history: ['amap:poi-3'],
      completedAt: null,
    });
    const restored = renderHook(() => useNearbyRound(restoredStore));
    await waitFor(() => expect(restored.result.current.state.status).toBe('choosing'));

    expect(restored.result.current.state.choices.map((choice) => choice.id)).toEqual(['amap:poi-3', 'amap:poi-1', 'amap:poi-2']);
    expect(restored.result.current.currentChoice?.id).toBe('amap:poi-1');
  });

  it('附近回合保存 liked / disliked、history 和 completedAt', async () => {
    const store = createStore({ restaurants, itemIds: restaurants.map(({ id }) => `amap:${id}`), decisions: {}, history: [], completedAt: null });
    const { result } = renderHook(() => useNearbyRound(store));
    await waitFor(() => expect(result.current.state.status).toBe('choosing'));

    act(() => {
      result.current.like();
      result.current.dislike();
      result.current.like();
    });
    await waitFor(() => expect(result.current.state.status).toBe('exhausted'));

    expect(store.saves.at(-1)).toMatchObject({
      decisions: expect.objectContaining({ 'amap:poi-1': 'liked', 'amap:poi-2': 'disliked', 'amap:poi-3': 'liked' }),
      history: expect.arrayContaining(['amap:poi-1', 'amap:poi-2', 'amap:poi-3']),
    });
    expect(store.saves.at(-1)?.completedAt).toEqual(expect.any(String));
  });
});
