import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Decision } from '@lets-eat/contracts';
import {
  chooseFoodReducer,
  getCurrentChoice,
  getProgress,
  initialChooseFoodState,
} from '@/features/choose-food/choose-food-state';
import { prepareRoundChoices } from '@/features/choose-food/round-choice-order';
import { createNearbyRoundStore } from './nearby-storage';
import { nearbyRestaurantsToFoodChoices } from './nearby-food-adapter';
import type { NearbyRoundSession } from './types';

export interface NearbyRoundStore {
  load(): NearbyRoundSession | null;
  save(value: NearbyRoundSession): void;
  clear(): void;
}

const browserRoundStore = createNearbyRoundStore();

export function useNearbyRound(roundStore: NearbyRoundStore = browserRoundStore) {
  const store = useMemo(() => roundStore, [roundStore]);
  const restoredSession = useRef(store.load());
  const [state, dispatch] = useReducer(chooseFoodReducer, initialChooseFoodState);

  useEffect(() => {
    let active = true;
    dispatch({ type: 'load-start' });
    const saved = restoredSession.current;
    const choices = saved ? nearbyRestaurantsToFoodChoices(saved.restaurants) : [];
    const canRestoreSaved = saved?.completedAt === null;
    const orderedChoices = prepareRoundChoices(choices, canRestoreSaved ? saved.itemIds : undefined);

    if (active) {
      dispatch({
        type: 'load-success',
        choices: orderedChoices,
        decisions: canRestoreSaved ? saved.decisions : undefined,
        history: canRestoreSaved ? saved.history : undefined,
      });
    }
    return () => { active = false; };
  }, [store]);

  useEffect(() => {
    if (state.status === 'loading' || state.choices.length === 0) return;
    const session = restoredSession.current;
    if (!session) return;
    const decisions = Object.fromEntries(
      state.history.map(({ choice, decision }) => [choice.id, decision]),
    ) as Record<string, Decision>;
    store.save({
      ...session,
      restaurants: session.restaurants,
      itemIds: state.choices.map((choice) => choice.id),
      decisions,
      history: state.history.map(({ choice }) => choice.id),
      completedAt: state.status === 'exhausted' ? new Date().toISOString() : null,
    });
  }, [state, store]);

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
