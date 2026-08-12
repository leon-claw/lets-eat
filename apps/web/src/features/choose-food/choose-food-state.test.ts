import { describe, expect, it } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import {
  chooseFoodReducer,
  getCurrentChoice,
  getProgress,
  initialChooseFoodState,
} from './choose-food-state';

const choice = (id: string): FoodChoice => ({
  id,
  name: id,
  description: `${id} description`,
  coverImage: `https://example.com/${id}.jpg`,
  tags: ['标签一', '标签二'],
  representativeFoods: ['代表菜一', '代表菜二'],
});

describe('chooseFoodReducer', () => {
  it('enters empty when no choices are available', () => {
    expect(chooseFoodReducer(initialChooseFoodState, { type: 'load-success', choices: [] }).status).toBe('empty');
  });

  it('records liked and disliked decisions independently', () => {
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success', choices: [choice('first'), choice('second')],
    });
    const liked = chooseFoodReducer(choosing, { type: 'like' });
    const exhausted = chooseFoodReducer(liked, { type: 'dislike' });

    expect(liked.likedChoices.map((item) => item.id)).toEqual(['first']);
    expect(exhausted.status).toBe('exhausted');
    expect(exhausted.history.map((item) => item.decision)).toEqual(['liked', 'disliked']);
  });

  it('undoes the latest binary decision', () => {
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success', choices: [choice('first'), choice('second')],
    });
    const liked = chooseFoodReducer(choosing, { type: 'like' });
    const undone = chooseFoodReducer(liked, { type: 'undo' });

    expect(undone.index).toBe(0);
    expect(undone.likedChoices).toEqual([]);
    expect(getCurrentChoice(undone)?.id).toBe('first');
  });

  it('restores the first item without a decision after refresh', () => {
    const restored = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [choice('first'), choice('second')],
      decisions: { first: 'liked' },
      history: ['first'],
    });

    expect(restored.index).toBe(1);
    expect(getCurrentChoice(restored)?.id).toBe('second');
    expect(getProgress(restored)).toEqual({ current: 2, total: 2 });
  });

  it('ignores decisions while interaction is locked', () => {
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success', choices: [choice('first'), choice('second')],
    });
    const locked = chooseFoodReducer(choosing, { type: 'set-interaction-locked', locked: true });

    expect(chooseFoodReducer(locked, { type: 'like' })).toBe(locked);
  });
});
