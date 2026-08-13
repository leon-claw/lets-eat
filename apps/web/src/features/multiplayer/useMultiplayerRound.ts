import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Decision, RoundSnapshot } from '@lets-eat/contracts';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { ApiClientError } from '@/shared/http/api-client';
import { DecisionQueue, type DecisionOperationStore, type DecisionTransport } from './decision-queue';
import { createIndexedDbDecisionStore } from './indexeddb-decision-store';
import { RealtimeClient } from './realtime-client';

export interface MultiplayerRoundClient {
  getRound(roundId: string): Promise<RoundSnapshot>;
  putDecision(roundId: string, catalogItemId: string, decision: Decision): Promise<void>;
  deleteDecision(roundId: string, catalogItemId: string): Promise<void>;
  completeRound(round: RoundSnapshot, idempotencyKey?: string): Promise<RoundSnapshot>;
  getIdentity?: () => Promise<{ token: string }>;
}

export interface UseMultiplayerRoundOptions {
  queue?: DecisionQueue;
  operationStore?: DecisionOperationStore;
}

type MultiplayerRoundStatus = 'loading' | 'choosing' | 'syncing' | 'waiting' | 'completed' | 'error' | 'empty';

function toFoodChoices(selection: { choices: FoodChoice[] }): FoodChoice[] {
  return [...selection.choices];
}

function replayDecisions(
  snapshot: RoundSnapshot,
  operations: Awaited<ReturnType<DecisionQueue['pending']>>,
): Record<string, Decision> {
  const decisions = Object.fromEntries(snapshot.ownDecisions.map((item) => [item.catalogItemId, item.decision])) as Record<string, Decision>;
  for (const operation of operations) {
    if (operation.operation === 'put' && operation.decision) decisions[operation.catalogItemId] = operation.decision;
    if (operation.operation === 'delete') delete decisions[operation.catalogItemId];
  }
  return decisions;
}

export function useMultiplayerRound(
  roundId: string,
  client: MultiplayerRoundClient,
  repository: FoodChoiceRepository,
  options: UseMultiplayerRoundOptions = {},
) {
  const queue = useMemo(() => {
    if (options.queue) return options.queue;
    const store = options.operationStore ?? createIndexedDbDecisionStore();
    const transport: DecisionTransport = {
      put: (operation) => client.putDecision(roundId, operation.catalogItemId, operation.decision!),
      delete: (operation) => client.deleteDecision(roundId, operation.catalogItemId),
    };
    return new DecisionQueue(store, transport);
  }, [client, options.operationStore, options.queue, roundId]);
  const [round, setRound] = useState<RoundSnapshot | null>(null);
  const [choices, setChoices] = useState<FoodChoice[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [status, setStatus] = useState<MultiplayerRoundStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [queueVersion, setQueueVersion] = useState(0);
  const [pendingEnqueues, setPendingEnqueues] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const completionInFlight = useRef(false);
  const completionKey = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (background = false) => {
    if (!background) setStatus('loading');
    setErrorMessage('');
    try {
      const snapshot = await client.getRound(roundId);
      const loadSelection = repository.loadSelection
        ? repository.loadSelection(snapshot.datasetType, { catalogVersion: snapshot.catalogVersion, catalogHash: snapshot.catalogHash })
        : repository.list(snapshot.datasetType, { catalogVersion: snapshot.catalogVersion, catalogHash: snapshot.catalogHash }).then((items) => ({
            catalogVersion: snapshot.catalogVersion,
            catalogHash: snapshot.catalogHash,
            datasetType: snapshot.datasetType,
            choices: items,
          }));
      const selection = await loadSelection;
      const pending = await queue.pending(roundId);
      const nextChoices = toFoodChoices(selection);
      const nextDecisions = replayDecisions(snapshot, pending);
      setRound(snapshot);
      setChoices(nextChoices);
      setDecisions(nextDecisions);
      completionInFlight.current = false;
      if (snapshot.status !== 'playing') completionKey.current = null;
      if (snapshot.status === 'completed') setStatus('completed');
      else if (snapshot.members.find((member) => member.isSelf)?.status === 'completed') setStatus('waiting');
      else if (nextChoices.length === 0) setStatus('empty');
      else setStatus('choosing');
      if (pending.length > 0) {
        void queue.flush(roundId).catch((cause) => {
          setErrorMessage(cause instanceof Error ? cause.message : '选择同步失败，请重试');
        });
      }
    } catch (cause) {
      if (!background) setStatus('error');
      setErrorMessage(cause instanceof Error ? cause.message : '多人回合加载失败');
    }
  }, [client, queue, repository, retryVersion, roundId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!round || round.status === 'completed' || !client.getIdentity || typeof globalThis.WebSocket === 'undefined') return;
    let active = true;
    let stop: (() => void) | undefined;
    void client.getIdentity().then((identity) => {
      if (!active) return;
      const realtime = new RealtimeClient();
      stop = realtime.connect({
        token: identity.token,
        roomId: round.roomId,
        revisions: { roomRevision: 0, roundRevision: round.revision },
        onStale: (state) => {
          if (state.round || state.reconnected) void load(true);
        },
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      stop?.();
    };
  }, [client, load, round]);

  useEffect(() => queue.subscribe(() => setQueueVersion((version) => version + 1)), [queue]);

  const currentIndex = choices.findIndex((choice) => decisions[choice.id] === undefined);
  const effectiveIndex = currentIndex === -1 ? choices.length : currentIndex;
  const currentChoice = status === 'choosing' ? choices[effectiveIndex] ?? null : null;
  const nextChoice = currentChoice ? choices[effectiveIndex + 1] ?? null : null;
  const allDecided = choices.length > 0 && choices.every((choice) => decisions[choice.id] !== undefined);

  const flush = useCallback(() => {
    void queue.flush(roundId).catch((cause) => {
      setErrorMessage(cause instanceof Error ? cause.message : '选择同步失败，请重试');
      setStatus('choosing');
    });
  }, [queue, roundId]);

  const decide = useCallback((decision: Decision) => {
    const choice = choices[effectiveIndex];
    if (!choice || status !== 'choosing') return;
    setDecisions((previous) => ({ ...previous, [choice.id]: decision }));
    setPendingEnqueues((count) => count + 1);
    void queue.enqueuePut(roundId, choice.id, decision)
      .then(flush)
      .catch((cause) => {
        setErrorMessage(cause instanceof Error ? cause.message : '选择暂存失败，请重试');
      })
      .finally(() => setPendingEnqueues((count) => Math.max(0, count - 1)));
  }, [choices, effectiveIndex, flush, queue, roundId, status]);

  const undo = useCallback(() => {
    const previousChoice = choices[effectiveIndex - 1];
    if (!previousChoice || status !== 'choosing') return;
    setDecisions((previous) => {
      const next = { ...previous };
      delete next[previousChoice.id];
      return next;
    });
    setPendingEnqueues((count) => count + 1);
    void queue.enqueueDelete(roundId, previousChoice.id)
      .then(flush)
      .catch((cause) => {
        setErrorMessage(cause instanceof Error ? cause.message : '撤销暂存失败，请重试');
      })
      .finally(() => setPendingEnqueues((count) => Math.max(0, count - 1)));
  }, [choices, effectiveIndex, flush, queue, roundId, status]);

  useEffect(() => {
    if (!round || !allDecided || pendingEnqueues > 0 || status === 'completed' || status === 'waiting' || completionInFlight.current) return;
    completionInFlight.current = true;
    setStatus('syncing');
    void queue.flush(roundId).then(async () => {
      if (!mountedRef.current) return;
      const pending = await queue.pending(roundId);
      if (!mountedRef.current || pending.length > 0) {
        completionInFlight.current = false;
        return;
      }
      completionKey.current ??= crypto.randomUUID();
      const completed = await client.completeRound(round, completionKey.current);
      if (!mountedRef.current) return;
      setRound(completed);
      if (completed.status === 'completed') setStatus('completed');
      else setStatus('waiting');
    }).catch((cause) => {
      if (!mountedRef.current) return;
      if (cause instanceof ApiClientError && cause.code === 'ROUND_REVISION_CONFLICT') {
        completionInFlight.current = false;
        setErrorMessage('');
        void load(true);
        return;
      }
      setStatus('choosing');
      setErrorMessage(cause instanceof Error ? cause.message : '完成回合同步失败，请重试');
      completionInFlight.current = false;
    });
  }, [allDecided, client, pendingEnqueues, queue, retryVersion, round, roundId]);

  useEffect(() => {
    const onOnline = () => {
      flush();
      setRetryVersion((version) => version + 1);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  const retry = useCallback(() => {
    setRetryVersion((version) => version + 1);
    flush();
  }, [flush]);

  return {
    round,
    choices,
    decisions,
    status,
    errorMessage,
    currentChoice,
    nextChoice,
    progress: { current: Math.min(effectiveIndex + 1, choices.length), total: choices.length },
    canUndo: effectiveIndex > 0 && status === 'choosing',
    pending: queueVersion,
    like: () => decide('liked'),
    dislike: () => decide('disliked'),
    undo,
    retry,
    refresh: () => load(true),
    setInteractionLocked: (_locked: boolean) => undefined,
    allDecided,
  };
}
