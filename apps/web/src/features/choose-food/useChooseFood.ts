import { useCallback, useEffect, useReducer, useState } from 'react';
import type { DatasetType, Decision } from '@lets-eat/contracts';
import { mockFoodChoiceRepository } from '@/entities/food-choice/mock-repository';
import type { FoodChoiceRepository, FoodChoiceVersion } from '@/entities/food-choice/repository';
import {
  chooseFoodReducer,
  getCurrentChoice,
  getProgress,
  initialChooseFoodState,
} from './choose-food-state';

export function useChooseFood(
  repository: FoodChoiceRepository = mockFoodChoiceRepository,
  random: () => number = Math.random,
  options: {
    datasetType?: DatasetType;
    version?: FoodChoiceVersion;
    decisions?: Record<string, Decision>;
    history?: string[];
  } = {},
) {
  const [state, dispatch] = useReducer(chooseFoodReducer, initialChooseFoodState);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isActive = true;
    dispatch({ type: 'load-start' });

    repository
      .list(options.datasetType ?? 'large', options.version)
      .then((choices) => {
        if (!isActive) return;
        dispatch({
          type: 'load-success',
          choices,
          decisions: options.decisions,
          history: options.history,
        });
      })
      .catch(() => {
        if (!isActive) return;
        dispatch({ type: 'load-failure', message: '加载失败，请重试' });
      });

    return () => {
      isActive = false;
    };
  }, [options.datasetType, options.decisions, options.history, options.version, random, repository, retryToken]);

  const dislike = useCallback(() => dispatch({ type: 'dislike' }), []);
  const like = useCallback(() => dispatch({ type: 'like' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const retry = useCallback(() => setRetryToken((token) => token + 1), []);
  const setInteractionLocked = useCallback(
    (locked: boolean) => dispatch({ type: 'set-interaction-locked', locked }),
    [],
  );
  const restart = useCallback(() => {
    dispatch({ type: 'restart', choices: state.choices });
  }, [state.choices]);

  return {
    state,
    currentChoice: getCurrentChoice(state),
    nextChoice: state.status === 'choosing' ? state.choices[state.index + 1] ?? null : null,
    progress: getProgress(state),
    dislike,
    like,
    undo,
    restart,
    retry,
    setInteractionLocked,
  };
}
