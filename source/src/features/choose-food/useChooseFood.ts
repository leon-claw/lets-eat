import { useCallback, useEffect, useReducer, useState } from 'react';
import { createChoiceRound } from '@/entities/food-choice/model';
import { mockFoodChoiceRepository } from '@/entities/food-choice/mock-repository';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import {
  chooseFoodReducer,
  getCurrentChoice,
  getProgress,
  initialChooseFoodState,
} from './choose-food-state';

export function useChooseFood(
  repository: FoodChoiceRepository = mockFoodChoiceRepository,
  random: () => number = Math.random,
) {
  const [state, dispatch] = useReducer(chooseFoodReducer, initialChooseFoodState);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isActive = true;
    dispatch({ type: 'load-start' });

    repository
      .list()
      .then((choices) => {
        if (!isActive) return;
        dispatch({ type: 'load-success', choices: createChoiceRound(choices, random) });
      })
      .catch(() => {
        if (!isActive) return;
        dispatch({ type: 'load-failure', message: '加载失败，请重试' });
      });

    return () => {
      isActive = false;
    };
  }, [random, repository, retryToken]);

  const skip = useCallback(() => dispatch({ type: 'skip' }), []);
  const select = useCallback(() => dispatch({ type: 'select' }), []);
  const retry = useCallback(() => setRetryToken((token) => token + 1), []);
  const setInteractionLocked = useCallback(
    (locked: boolean) => dispatch({ type: 'set-interaction-locked', locked }),
    [],
  );
  const restart = useCallback(() => {
    dispatch({ type: 'restart', choices: createChoiceRound(state.choices, random) });
  }, [random, state.choices]);

  return {
    state,
    currentChoice: getCurrentChoice(state),
    progress: getProgress(state),
    skip,
    select,
    restart,
    retry,
    setInteractionLocked,
  };
}
