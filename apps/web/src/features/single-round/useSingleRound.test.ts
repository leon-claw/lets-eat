import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { useSingleRound } from './useSingleRound';

const choices = [
  { id: 'a', name: 'A', description: '', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'b', name: 'B', description: '', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'c', name: 'C', description: '', coverImage: '', tags: [], representativeFoods: [] },
];

describe('useSingleRound', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('shuffles the loaded choices before a fresh game starts', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn(),
      loadSelection: vi.fn().mockResolvedValue({
        catalogVersion: 'v1', catalogHash: 'a'.repeat(64), datasetType: 'large', choices,
      }),
    };

    const { result } = renderHook(() => useSingleRound(repository, 'large'));

    await waitFor(() => expect(result.current.state.status).toBe('choosing'));
    expect(result.current.state.choices.map((choice) => choice.id)).toEqual(['b', 'c', 'a']);
    expect(choices.map((choice) => choice.id)).toEqual(['a', 'b', 'c']);
  });
});
