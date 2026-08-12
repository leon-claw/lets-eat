import { describe, expect, it } from 'vitest';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('returns a new array containing the same items', () => {
    const input = ['a', 'b', 'c'];

    const result = shuffle(input, () => 0.99);

    expect(result).toEqual(['a', 'b', 'c']);
    expect(result).not.toBe(input);
  });
});
