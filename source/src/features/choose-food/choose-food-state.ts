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
  errorMessage: string | null;
  interactionLocked: boolean;
}

export type ChooseFoodAction =
  | { type: 'load-start' }
  | { type: 'load-success'; choices: FoodChoice[] }
  | { type: 'load-failure'; message: string }
  | { type: 'skip' }
  | { type: 'select' }
  | { type: 'restart'; choices: FoodChoice[] }
  | { type: 'set-interaction-locked'; locked: boolean };

export const initialChooseFoodState: ChooseFoodState = {
  status: 'loading',
  choices: [],
  index: 0,
  selectedChoice: null,
  errorMessage: null,
  interactionLocked: false,
};

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

    case 'skip': {
      if (state.status !== 'choosing' || state.interactionLocked || state.choices.length === 0) {
        return state;
      }

      const isFinalChoice = state.index >= state.choices.length - 1;
      return isFinalChoice
        ? { ...state, status: 'exhausted', index: state.choices.length }
        : { ...state, index: state.index + 1 };
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
