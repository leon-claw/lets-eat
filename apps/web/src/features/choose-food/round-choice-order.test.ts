import { describe, expect, it } from 'vitest';
import { prepareRoundChoices } from './round-choice-order';

const choices = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('prepareRoundChoices', () => {
  it('shuffles a fresh round without mutating the repository result', () => {
    const result = prepareRoundChoices(choices, undefined, () => 0);

    expect(result).toEqual([{ id: 'b' }, { id: 'c' }, { id: 'a' }]);
    expect(choices).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('restores an existing round order when saved item IDs are complete', () => {
    const result = prepareRoundChoices(choices, ['c', 'a', 'b'], () => 0);

    expect(result).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });
});
