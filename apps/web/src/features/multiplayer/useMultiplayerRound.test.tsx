import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoundSnapshot } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { DecisionQueue, type DecisionOperationStore, type DecisionTransport, type QueuedDecisionOperation } from './decision-queue';
import { useMultiplayerRound, type MultiplayerRoundClient } from './useMultiplayerRound';

const ROUND_ID = 'round-1';
const choices = [
  { id: 'item-1', name: '粤菜', description: '', coverImage: '', tags: [], representativeFoods: [] },
  { id: 'item-2', name: '火锅', description: '', coverImage: '', tags: [], representativeFoods: [] },
];

const snapshot: RoundSnapshot = {
  id: ROUND_ID,
  roomId: 'room-1',
  sequence: 1,
  catalogVersion: 'v1',
  catalogHash: 'a'.repeat(64),
  datasetType: 'large',
  status: 'playing',
  revision: 0,
  members: [{ memberId: 'member-1', displayName: '我', status: 'choosing', isSelf: true, role: 'host' }],
  ownDecisions: [],
};

class MemoryStore implements DecisionOperationStore {
  private nextSequence = 1;
  operations: QueuedDecisionOperation[] = [];
  async add(operation: Omit<QueuedDecisionOperation, 'sequence'>) {
    const saved = { ...operation, sequence: this.nextSequence++ };
    this.operations.push(saved);
    return saved;
  }
  async list(roundId: string) { return this.operations.filter((operation) => operation.roundId === roundId); }
  async remove(sequence: number) { this.operations = this.operations.filter((operation) => operation.sequence !== sequence); }
}

function makeQueue(transport: DecisionTransport) {
  return new DecisionQueue(new MemoryStore(), transport);
}

function makeClient(overrides: Partial<MultiplayerRoundClient> = {}) {
  return {
    getRound: vi.fn().mockResolvedValue(snapshot),
    putDecision: vi.fn().mockResolvedValue(undefined),
    deleteDecision: vi.fn().mockResolvedValue(undefined),
    completeRound: vi.fn().mockImplementation(async (round: RoundSnapshot) => ({ ...round, revision: round.revision + 1, status: 'completed' })),
    ...overrides,
  } satisfies MultiplayerRoundClient;
}

const repository: FoodChoiceRepository = {
  loadSelection: vi.fn().mockResolvedValue({ catalogVersion: 'v1', catalogHash: 'a'.repeat(64), datasetType: 'large', choices }),
  list: vi.fn().mockResolvedValue(choices),
};

describe('useMultiplayerRound', () => {
  it('merges server decisions with pending operations and resumes first undecided item', async () => {
    const transport: DecisionTransport = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };
    const queue = makeQueue(transport);
    await queue.enqueuePut(ROUND_ID, 'item-1', 'liked');
    const client = makeClient();
    const { result } = renderHook(() => useMultiplayerRound(ROUND_ID, client, repository, { queue }));

    await waitFor(() => expect(result.current.status).toBe('choosing'));
    expect(result.current.currentChoice?.id).toBe('item-2');
    expect(result.current.decisions).toEqual({ 'item-1': 'liked' });
  });

  it('does not complete until the queue is empty and every catalog item is decided', async () => {
    const client = makeClient();
    const transport: DecisionTransport = {
      put: vi.fn().mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const queue = makeQueue(transport);
    const { result } = renderHook(() => useMultiplayerRound(ROUND_ID, client, repository, { queue }));
    await waitFor(() => expect(result.current.status).toBe('choosing'));

    act(() => { result.current.like(); });
    expect(client.completeRound).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.currentChoice?.id).toBe('item-2'));
    act(() => { result.current.dislike(); });

    await waitFor(() => expect(client.completeRound).toHaveBeenCalledOnce());
    expect(result.current.status).toBe('completed');
  });

  it('does not complete while the last decision is still being persisted locally', async () => {
    const client = makeClient();
    const releases: Array<() => void> = [];
    const queue = makeQueue({
      put: vi.fn(async () => { await new Promise<void>((resolve) => { releases.push(resolve); }); }),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const { result } = renderHook(() => useMultiplayerRound(ROUND_ID, client, repository, { queue }));
    await waitFor(() => expect(result.current.status).toBe('choosing'));
    act(() => { result.current.like(); });
    await waitFor(() => expect(result.current.currentChoice?.id).toBe('item-2'));
    act(() => { result.current.dislike(); });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(client.completeRound).not.toHaveBeenCalled();
    releases[0]?.();
    await waitFor(() => expect(releases).toHaveLength(2));
    expect(client.completeRound).not.toHaveBeenCalled();
    releases[1]?.();
    await waitFor(() => expect(client.completeRound).toHaveBeenCalledOnce());
  });
});
