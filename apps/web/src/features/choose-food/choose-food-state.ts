import type { FoodChoice } from '@/entities/food-choice/types';

export type ChooseFoodStatus =
  | 'loading'
  | 'choosing'
  | 'selected'
  | 'exhausted'
  | 'empty'
  | 'error';

export interface ChooseFoodState {
  status: ChooseFoodStatus;
  choices: FoodChoice[];
  index: number;
  selectedChoice: FoodChoice | null;
  likedChoices: FoodChoice[];
  history: Array<{
    choice: FoodChoice;
    action: 'skip' | 'like' | 'superlike';
  }>;
  errorMessage: string | null;
  interactionLocked: boolean;
}

export type ChooseFoodAction =
  | { type: 'load-start' }
  | { type: 'load-success'; choices: FoodChoice[] }
  | { type: 'load-failure'; message: string }
  | { type: 'skip' }
  | { type: 'like' }
  | { type: 'superlike' }
  | { type: 'undo' }
  | { type: 'select' }
  | { type: 'restart'; choices: FoodChoice[] }
  | { type: 'set-interaction-locked'; locked: boolean };

export const initialChooseFoodState: ChooseFoodState = {
  status: 'loading',
  choices: [],
  index: 0,
  selectedChoice: null,
  likedChoices: [],
  history: [],
  errorMessage: null,
  interactionLocked: false,
};

function advanceRound(
  state: ChooseFoodState,
  action: 'skip' | 'like' | 'superlike',
): ChooseFoodState {
  if (state.status !== 'choosing' || state.interactionLocked || state.choices.length === 0) {
    return state;
  }

  const currentChoice = state.choices[state.index];
  if (!currentChoice) return state;

  const nextIndex = state.index + 1;
  const likedChoices = action === 'skip'
    ? state.likedChoices
    : [...state.likedChoices, currentChoice];
  const history = [...state.history, { choice: currentChoice, action }];

  return nextIndex >= state.choices.length
    ? {
        ...state,
        status: 'exhausted',
        index: nextIndex,
        likedChoices,
        history,
      }
    : {
        ...state,
        index: nextIndex,
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
      return action.choices.length === 0
        ? {
            ...initialChooseFoodState,
            status: 'empty',
          }
        : {
            ...initialChooseFoodState,
            status: 'choosing',
            choices: action.choices,
          };

    case 'load-failure':
      return {
        ...initialChooseFoodState,
        status: 'error',
        errorMessage: action.message,
      };

    case 'skip':
      return advanceRound(state, 'skip');

    case 'like':
      return advanceRound(state, 'like');

    case 'superlike':
      return advanceRound(state, 'superlike');

    case 'undo': {
      if (state.status !== 'choosing' || state.interactionLocked || state.history.length === 0) {
        return state;
      }

      const lastRecord = state.history[state.history.length - 1];
      const history = state.history.slice(0, -1);
      const likedChoices = lastRecord.action === 'skip'
        ? state.likedChoices
        : state.likedChoices.filter((choice) => choice.id !== lastRecord.choice.id);

      return {
        ...state,
        index: Math.max(0, state.index - 1),
        likedChoices,
        history,
      };
    }

    case 'select': {
      if (state.status !== 'choosing' || state.interactionLocked || state.choices.length === 0) {
        return state;
      }

      return {
        ...state,
        status: 'selected',
        selectedChoice: state.choices[state.index],
      };
    }

    case 'restart':
      return action.choices.length === 0
        ? { ...initialChooseFoodState, status: 'empty' }
        : {
            ...initialChooseFoodState,
            status: 'choosing',
            choices: action.choices,
          };

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
  return {
    current: total === 0 ? 0 : Math.min(state.index + 1, total),
    total,
  };
}
