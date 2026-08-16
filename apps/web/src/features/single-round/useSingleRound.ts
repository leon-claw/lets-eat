import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { DatasetType, Decision } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import {
  chooseFoodReducer,
  getCurrentChoice,
  getProgress,
  initialChooseFoodState,
} from '@/features/choose-food/choose-food-state';
import { createSingleRoundStore, type SingleRoundSession } from './single-round-store';
import { prepareRoundChoices } from '@/features/choose-food/round-choice-order';

const EMPTY_SESSION: Omit<SingleRoundSession, 'catalogVersion' | 'catalogHash' | 'datasetType' | 'itemIds'> = {
  decisions: {}, history: [], completedAt: null,
};

export function useSingleRound(repository: FoodChoiceRepository, datasetType: DatasetType) {
  const store = useMemo(() => createSingleRoundStore(), []);
  const restoredSession = useRef(store.load());
  const [state, dispatch] = useReducer(chooseFoodReducer, initialChooseFoodState);
  const catalogRef = useRef({ catalogVersion: 'v1', catalogHash: '' });

  useEffect(() => {
    let active = true;
    dispatch({ type: 'load-start' });
    const saved = restoredSession.current;
    const canResumeSaved = saved?.completedAt === null;
    const version = canResumeSaved && saved.datasetType === datasetType && saved.catalogHash
      ? { catalogVersion: saved.catalogVersion, catalogHash: saved.catalogHash }
      : undefined;

    const load = repository.loadSelection
      ? repository.loadSelection(datasetType, version)
      : repository.list(datasetType, version).then((choices) => ({
          catalogVersion: version?.catalogVersion ?? 'v1',
          catalogHash: version?.catalogHash ?? '',
          datasetType,
          choices,
        }));

    load.then((selection) => {
      if (!active) return;
      catalogRef.current = {
        catalogVersion: selection.catalogVersion,
        catalogHash: selection.catalogHash,
      };
      const canRestore = canResumeSaved
        && saved.datasetType === datasetType
        && saved.catalogVersion === selection.catalogVersion
        && saved.catalogHash === selection.catalogHash;
      const choices = prepareRoundChoices(selection.choices, canRestore ? saved.itemIds : undefined);
      dispatch({
        type: 'load-success',
        choices,
        decisions: canRestore ? saved.decisions : undefined,
        history: canRestore ? saved.history : undefined,
      });
    }).catch(() => {
      if (active) dispatch({ type: 'load-failure', message: '加载失败，请重试' });
    });

    return () => { active = false; };
  }, [datasetType, repository]);

  useEffect(() => {
    if (state.status === 'loading' || state.choices.length === 0) return;
    const decisions = Object.fromEntries(
      state.history.map(({ choice, decision }) => [choice.id, decision]),
    ) as Record<string, Decision>;
    store.save({
      ...EMPTY_SESSION,
      ...catalogRef.current,
      datasetType,
      itemIds: state.choices.map((choice) => choice.id),
      decisions,
      history: state.history.map(({ choice }) => choice.id),
      completedAt: state.status === 'exhausted' ? new Date().toISOString() : null,
    });
  }, [datasetType, state, store]);

  const dislike = useCallback(() => dispatch({ type: 'dislike' }), []);
  const like = useCallback(() => dispatch({ type: 'like' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const setInteractionLocked = useCallback(
    (locked: boolean) => dispatch({ type: 'set-interaction-locked', locked }),
    [],
  );
  const restart = useCallback(() => {
    store.clear();
    dispatch({ type: 'restart', choices: state.choices });
  }, [state.choices, store]);

  return {
    state,
    currentChoice: getCurrentChoice(state),
    nextChoice: state.status === 'choosing' ? state.choices[state.index + 1] ?? null : null,
    progress: getProgress(state),
    dislike,
    like,
    undo,
    setInteractionLocked,
    restart,
    store,
  };
}
