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
  it('enters empty when the repository returns no choices', () => {
    const state = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [],
    });

    expect(state.status).toBe('empty');
  });

  it('moves to the next choice when skipping', () => {
    const first = choice('first');
    const second = choice('second');
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [first, second],
    });

    const next = chooseFoodReducer(choosing, { type: 'skip' });

    expect(next.index).toBe(1);
    expect(getCurrentChoice(next)).toEqual(second);
    expect(getProgress(next)).toEqual({ current: 2, total: 2 });
  });

  it('enters exhausted after skipping the final choice', () => {
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [choice('first'), choice('second')],
    });
    const second = chooseFoodReducer(choosing, { type: 'skip' });

    const exhausted = chooseFoodReducer(second, { type: 'skip' });

    expect(exhausted.status).toBe('exhausted');
    expect(getCurrentChoice(exhausted)).toBeNull();
  });

  it('stores the current choice when selecting', () => {
    const first = choice('first');
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [first],
    });

    const selected = chooseFoodReducer(choosing, { type: 'select' });

    expect(selected.status).toBe('selected');
    expect(selected.selectedChoice).toEqual(first);
  });

  it('ignores skip while interaction is locked', () => {
    const choosing = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-success',
      choices: [choice('first'), choice('second')],
    });
    const locked = chooseFoodReducer(choosing, {
      type: 'set-interaction-locked',
      locked: true,
    });

    expect(chooseFoodReducer(locked, { type: 'skip' })).toBe(locked);
  });

  it('restarts a new round and clears the selected result', () => {
    const selected = chooseFoodReducer(
      chooseFoodReducer(initialChooseFoodState, {
        type: 'load-success',
        choices: [choice('first')],
      }),
      { type: 'select' },
    );

    const restarted = chooseFoodReducer(selected, {
      type: 'restart',
      choices: [choice('second'), choice('first')],
    });

    expect(restarted).toMatchObject({
      status: 'choosing',
      index: 0,
      selectedChoice: null,
      errorMessage: null,
    });
  });

  it('enters error and keeps a user-facing failure message', () => {
    const state = chooseFoodReducer(initialChooseFoodState, {
      type: 'load-failure',
      message: '加载失败，请重试',
    });

    expect(state).toMatchObject({ status: 'error', errorMessage: '加载失败，请重试' });
  });
});
