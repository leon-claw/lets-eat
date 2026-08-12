import type { Decision } from '@lets-eat/contracts';
import type { FoodChoice } from '@/entities/food-choice/types';

export type ChooseFoodStatus =
  | 'loading'
  | 'choosing'
  | 'exhausted'
  | 'empty'
  | 'error';

export interface ChoiceHistoryRecord {
  choice: FoodChoice;
  decision: Decision;
}

export interface ChooseFoodState {
  status: ChooseFoodStatus;
  choices: FoodChoice[];
  index: number;
  likedChoices: FoodChoice[];
  history: ChoiceHistoryRecord[];
  errorMessage: string | null;
  interactionLocked: boolean;
}

export type ChooseFoodAction =
  | { type: 'load-start' }
  | {
      type: 'load-success';
      choices: FoodChoice[];
      decisions?: Record<string, Decision>;
      history?: string[];
    }
  | { type: 'load-failure'; message: string }
  | { type: 'dislike' }
  | { type: 'like' }
  | { type: 'undo' }
  | { type: 'restart'; choices: FoodChoice[] }
  | { type: 'set-interaction-locked'; locked: boolean };

export const initialChooseFoodState: ChooseFoodState = {
  status: 'loading',
  choices: [],
  index: 0,
  likedChoices: [],
  history: [],
  errorMessage: null,
  interactionLocked: false,
};

function advanceRound(state: ChooseFoodState, decision: Decision): ChooseFoodState {
  if (state.status !== 'choosing' || state.interactionLocked || state.choices.length === 0) {
    return state;
  }

  const currentChoice = state.choices[state.index];
  if (!currentChoice) return state;

  const nextIndex = state.index + 1;
  const likedChoices = decision === 'disliked'
    ? state.likedChoices
    : [...state.likedChoices, currentChoice];
  const history = [...state.history, { choice: currentChoice, decision }];

  return nextIndex >= state.choices.length
    ? { ...state, status: 'exhausted', index: nextIndex, likedChoices, history }
    : { ...state, index: nextIndex, likedChoices, history };
}

function restoreRound(
  choices: FoodChoice[],
  decisions: Record<string, Decision>,
  historyIds: string[],
): ChooseFoodState {
  if (choices.length === 0) return { ...initialChooseFoodState, status: 'empty' };

  const history = historyIds.flatMap((id) => {
    const choice = choices.find((item) => item.id === id);
    const decision = decisions[id];
    return choice && decision ? [{ choice, decision }] : [];
  });
  const likedChoices = choices.filter((choice) => decisions[choice.id] === 'liked');
  const index = choices.findIndex((choice) => !decisions[choice.id]);

  return {
    ...initialChooseFoodState,
    status: index === -1 ? 'exhausted' : 'choosing',
    choices,
    index: index === -1 ? choices.length : index,
    likedChoices,
    history,
  };
}

export function chooseFoodReducer(
  state: ChooseFoodState,
  action: ChooseFoodAction,
): ChooseFoodState {
  switch (action.type) {
    case 'load-start':
      return { ...initialChooseFoodState };

    case 'load-success':
      return restoreRound(action.choices, action.decisions ?? {}, action.history ?? []);

    case 'load-failure':
      return { ...initialChooseFoodState, status: 'error', errorMessage: action.message };

    case 'dislike':
      return advanceRound(state, 'disliked');

    case 'like':
      return advanceRound(state, 'liked');

    case 'undo': {
      if (state.status !== 'choosing' || state.interactionLocked || state.history.length === 0) {
        return state;
      }

      const lastRecord = state.history[state.history.length - 1];
      const history = state.history.slice(0, -1);
      const likedChoices = lastRecord.decision === 'disliked'
        ? state.likedChoices
        : state.likedChoices.filter((choice) => choice.id !== lastRecord.choice.id);

      return {
        ...state,
        index: Math.max(0, state.index - 1),
        likedChoices,
        history,
      };
    }

    case 'restart':
      return restoreRound(action.choices, {}, []);

    case 'set-interaction-locked':
      return { ...state, interactionLocked: action.locked };
  }
}

export function getCurrentChoice(state: ChooseFoodState): FoodChoice | null {
  if (state.status !== 'choosing') return null;
  return state.choices[state.index] ?? null;
}

export function getProgress(state: ChooseFoodState): { current: number; total: number } {
  const total = state.choices.length;
  return { current: total === 0 ? 0 : Math.min(state.index + 1, total), total };
}
