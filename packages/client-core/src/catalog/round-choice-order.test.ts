import { describe, expect, it } from 'vitest';
import { hasExactChoiceOrder, shuffleChoices } from './round-choice-order.js';

describe('round choice order', () => {
  const choices = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('shuffles without losing or duplicating choices', () => {
    const shuffled = shuffleChoices(choices, () => 0);
    expect(shuffled).toHaveLength(choices.length);
    expect(new Set(shuffled.map((choice) => choice.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('accepts only a duplicate-free exact permutation as a restore order', () => {
    expect(hasExactChoiceOrder(choices, ['c', 'a', 'b'])).toBe(true);
    expect(hasExactChoiceOrder(choices, ['c', 'a', 'a'])).toBe(false);
    expect(hasExactChoiceOrder(choices, ['c', 'a'])).toBe(false);
  });
});
