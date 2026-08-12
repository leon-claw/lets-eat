import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { useChooseFood } from './useChooseFood';

const first: FoodChoice = {
  id: 'first',
  name: '粤菜',
  description: '清鲜细腻。',
  coverImage: 'https://example.com/first.jpg',
  tags: ['清鲜', '聚餐'],
  representativeFoods: ['白切鸡', '烧鹅'],
};

const second: FoodChoice = {
  id: 'second',
  name: '火锅',
  description: '热闹满足。',
  coverImage: 'https://example.com/second.jpg',
  tags: ['热闹', '多人'],
  representativeFoods: ['毛肚', '肥牛'],
};

const orderedRandom = () => 0.999;

describe('useChooseFood', () => {
  it('exposes candidates, the next card, and undo for a swipe round', async () => {
    const repository: FoodChoiceRepository = {
      list: async () => [first, second],
    };
    const { result } = renderHook(() => useChooseFood(repository, orderedRandom));

    await waitFor(() => expect(result.current.currentChoice).toEqual(first));
    expect(result.current.nextChoice).toEqual(second);

    act(() => result.current.like());

    expect(result.current.currentChoice).toEqual(second);
    expect(result.current.state.likedChoices).toEqual([first]);

    act(() => result.current.undo());

    expect(result.current.currentChoice).toEqual(first);
    expect(result.current.state.likedChoices).toEqual([]);
  });
});
