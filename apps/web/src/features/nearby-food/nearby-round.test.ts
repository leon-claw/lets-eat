import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { NearbyRoundSession } from './types';
import { useNearbyRound, type NearbyRoundStore } from './nearby-round';

const restaurants = [1, 2, 3].map((index) => ({
  source: 'amap' as const,
  id: `poi-${index}`,
  name: `餐厅 ${index}`,
  type: '餐饮服务;中餐厅',
  fetchedAt: '2026-08-31T00:00:00.000Z',
}));

const choices: FoodChoice[] = [
  { id: 'cantonese', name: '粤菜', description: '清鲜细腻。', coverImage: '/cantonese.webp', tags: ['清鲜'], representativeFoods: ['粤味轩'], datasetType: 'large' },
  { id: 'sichuan', name: '川菜', description: '麻辣鲜香。', coverImage: '/sichuan.webp', tags: ['麻辣'], representativeFoods: ['蜀香楼'], datasetType: 'large' },
  { id: 'other', name: '其他', description: '其他风味。', coverImage: '/api/catalog-assets/v2/images/home-style.webp', tags: ['其他风味'], representativeFoods: ['街角咖啡'], datasetType: 'large' },
];

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
      choices,
      itemIds: [],
      decisions: {},
      history: [],
      completedAt: null,
    });
    const first = renderHook(() => useNearbyRound(freshStore));
    await waitFor(() => expect(first.result.current.state.status).toBe('choosing'));
    expect(first.result.current.state.choices.map((choice) => choice.id)).toEqual(['sichuan', 'other', 'cantonese']);
    first.unmount();

    const restoredStore = createStore({
      restaurants,
      choices,
      itemIds: ['other', 'cantonese', 'sichuan'],
      decisions: { other: 'liked' },
      history: ['other'],
      completedAt: null,
    });
    const restored = renderHook(() => useNearbyRound(restoredStore));
    await waitFor(() => expect(restored.result.current.state.status).toBe('choosing'));

    expect(restored.result.current.state.choices.map((choice) => choice.id)).toEqual(['other', 'cantonese', 'sichuan']);
    expect(restored.result.current.currentChoice?.id).toBe('cantonese');
  });

  it('附近回合保存 liked / disliked、history 和 completedAt', async () => {
    const store = createStore({ restaurants, choices, itemIds: choices.map(({ id }) => id), decisions: {}, history: [], completedAt: null });
    const { result } = renderHook(() => useNearbyRound(store));
    await waitFor(() => expect(result.current.state.status).toBe('choosing'));

    act(() => {
      result.current.like();
      result.current.dislike();
      result.current.like();
    });
    await waitFor(() => expect(result.current.state.status).toBe('exhausted'));

    expect(store.saves.at(-1)).toMatchObject({
      decisions: { cantonese: 'liked', sichuan: 'disliked', other: 'liked' },
      history: ['cantonese', 'sichuan', 'other'],
    });
    expect(store.saves.at(-1)?.completedAt).toEqual(expect.any(String));
  });
});
