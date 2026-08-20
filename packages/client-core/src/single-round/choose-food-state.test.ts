import { describe, expect, it } from 'vitest';
import {
  advanceGameState,
  createGameState,
  getCurrentChoice,
  getNextChoice,
  getProgress,
  undoGameState,
} from './choose-food-state.js';

const choices = [
  { id: 'noodles', name: '螺蛳粉' },
  { id: 'hotpot', name: '火锅' },
  { id: 'sushi', name: '寿司' },
];

describe('choose food state', () => {
  it('advances through choices and records liked items', () => {
    let state = createGameState(choices);

    expect(getCurrentChoice(state)?.id).toBe('noodles');
    expect(getNextChoice(state)?.id).toBe('hotpot');
    expect(getProgress(state)).toEqual({ current: 1, total: 3 });

    state = advanceGameState(state, 'liked');
    expect(state.index).toBe(1);
    expect(state.likedIds).toEqual(['noodles']);
    expect(state.history).toEqual([{ choiceId: 'noodles', decision: 'liked' }]);
  });

  it('can undo the last decision and re-open an exhausted round', () => {
    let state = createGameState(choices.slice(0, 1));
    state = advanceGameState(state, 'liked');

    expect(state.status).toBe('exhausted');
    state = undoGameState(state);
    expect(state.status).toBe('choosing');
    expect(state.index).toBe(0);
    expect(state.likedIds).toEqual([]);
    expect(getCurrentChoice(state)?.id).toBe('noodles');
  });
});
