import type { FoodChoice } from '../catalog/types.js';

export type GameDecision = 'liked' | 'disliked';

export interface GameDecisionRecord {
  choiceId: string;
  decision: GameDecision;
}

export interface GameState {
  status: 'choosing' | 'exhausted' | 'empty';
  choices: FoodChoice[];
  index: number;
  likedIds: string[];
  history: GameDecisionRecord[];
}

export function createGameState(choices: FoodChoice[]): GameState {
  return {
    status: choices.length === 0 ? 'empty' : 'choosing',
    choices: [...choices],
    index: 0,
    likedIds: [],
    history: [],
  };
}

export function advanceGameState(state: GameState, decision: GameDecision): GameState {
  if (state.status !== 'choosing') return state;

  const choice = state.choices[state.index];
  if (!choice) return state;

  const nextIndex = state.index + 1;
  return {
    ...state,
    status: nextIndex >= state.choices.length ? 'exhausted' : 'choosing',
    index: nextIndex,
    likedIds: decision === 'liked' ? [...state.likedIds, choice.id] : state.likedIds,
    history: [...state.history, { choiceId: choice.id, decision }],
  };
}

export function undoGameState(state: GameState): GameState {
  const lastDecision = state.history[state.history.length - 1];
  if (!lastDecision || state.status === 'empty') return state;

  const likedIds = [...state.likedIds];
  if (lastDecision.decision === 'liked') {
    const likedIndex = likedIds.lastIndexOf(lastDecision.choiceId);
    if (likedIndex >= 0) likedIds.splice(likedIndex, 1);
  }

  return {
    ...state,
    status: 'choosing',
    index: Math.max(0, state.index - 1),
    likedIds,
    history: state.history.slice(0, -1),
  };
}

export function getCurrentChoice(state: GameState): FoodChoice | undefined {
  return state.choices[state.index];
}

export function getNextChoice(state: GameState): FoodChoice | undefined {
  return state.choices[state.index + 1];
}

export function getProgress(state: GameState): { current: number; total: number } {
  return {
    current: Math.min(state.index + 1, state.choices.length),
    total: state.choices.length,
  };
}
