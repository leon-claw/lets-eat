import { describe, expect, it } from 'vitest';
import type { FoodChoice } from './types';
import { createChoiceRound } from './model';

const choice = (id: string): FoodChoice => ({
  id,
  name: id,
  description: `${id} description`,
  coverImage: `https://example.com/${id}.jpg`,
  tags: ['聚餐'],
  representativeFoods: [`${id}代表菜`],
});

describe('createChoiceRound', () => {
  it('deduplicates by id without mutating the input', () => {
    const input = [choice('a'), choice('b'), choice('a')];
    const result = createChoiceRound(input, () => 0.99);

    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    expect(input).toHaveLength(3);
    expect(result).not.toBe(input);
  });

  it('uses the supplied random function to shuffle', () => {
    const result = createChoiceRound([choice('a'), choice('b'), choice('c')], () => 0);

    expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });
});
