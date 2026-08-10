import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { useChooseFood } from './useChooseFood';

const choice = (id: string): FoodChoice => ({
  id,
  name: id,
  description: `${id} description`,
  coverImage: `https://example.com/${id}.jpg`,
  tags: ['标签一', '标签二'],
  representativeFoods: ['代表菜一', '代表菜二'],
});

const deterministicRandom = () => 0.99;

describe('useChooseFood', () => {
  it('loads choices and exposes skip/select actions', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockResolvedValue([choice('first'), choice('second')]),
    };
    const { result } = renderHook(() => useChooseFood(repository, deterministicRandom));

    await waitFor(() => expect(result.current.state.status).toBe('choosing'));
    expect(result.current.currentChoice?.id).toBe('first');

    act(() => result.current.skip());
    expect(result.current.currentChoice?.id).toBe('second');

    act(() => result.current.select());
    expect(result.current.state.status).toBe('selected');
    expect(result.current.state.selectedChoice?.id).toBe('second');
  });

  it('exposes retry after repository failure', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn()
        .mockRejectedValueOnce(new Error('network failed'))
        .mockResolvedValueOnce([choice('recovered')]),
    };
    const { result } = renderHook(() => useChooseFood(repository, deterministicRandom));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('加载失败，请重试');

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('choosing'));
    expect(result.current.currentChoice?.id).toBe('recovered');
  });
});
