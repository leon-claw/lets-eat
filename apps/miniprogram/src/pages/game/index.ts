import { loadCatalogSelection, type CatalogDatasetType, type CatalogSelection } from '../../adapters/wx-catalog';
import { loadCustomCatalogSelection } from '../../adapters/wx-room';
import { getRoomIdentity } from '../../adapters/wx-room';
import { createWxDecisionOperationStore } from '../../adapters/wx-decision-queue';
import { createWxRealtimeTransport } from '../../adapters/wx-realtime';
import { API_BASE_URL } from '../../config/runtime';
import { DecisionQueue } from '@lets-eat/client-core';
import {
  completeRound,
  deleteRoundDecision,
  getRound,
  putRoundDecision,
  type RoundDecision,
  type RoundMemberSnapshot,
  type RoundSnapshot,
} from '../../adapters/wx-round';
import {
  advanceGameState,
  createGameState,
  getCurrentChoice,
  getNextChoice,
  getProgress,
  shuffleChoices,
  undoGameState,
  type GameChoice,
  type GameDecision,
  type GameDecisionRecord,
  type GameState,
} from './game-state';
import {
  calculateReleaseVelocity,
  resolveSwipeAction,
} from './swipe-gesture';
import {
  clearStoredSingleRound,
  readStoredSingleRound,
  saveStoredSingleRound,
  type StoredSingleRound,
} from './single-round-storage';
import { MULTIPLAYER_ROUND_STORAGE_KEY_PREFIX } from './multiplayer-round-storage';

type PageStatus = 'loading' | 'choosing' | 'syncing' | 'waiting' | 'empty' | 'error' | 'completed';
type GameMode = 'single' | 'multiplayer';

interface RoundMemberView extends RoundMemberSnapshot {
  statusLabel: string;
}

interface GamePageData {
  mode: GameMode;
  roundId: string;
  status: PageStatus;
  datasetLabel: string;
  currentChoice: GameChoice | null;
  nextChoice: GameChoice | null;
  progressCurrent: number;
  progressTotal: number;
  likedCount: number;
  canUndo: boolean;
  isSwiping: boolean;
  cardTransform: string;
  cardTransition: string;
  cardOpacity: number;
  likeOverlayOpacity: number;
  dislikeOverlayOpacity: number;
  errorMessage: string;
  completedCount: number;
  memberCount: number;
  memberStatuses: RoundMemberView[];
}

interface GamePageMethods {
  onLoad(options?: { dataset?: string; roundId?: string }): void;
  onShow(): void;
  onHide(): void;
  onUnload(): void;
  onTouchStart(event: TouchEventLike): void;
  onTouchMove(event: TouchEventLike): void;
  onTouchEnd(event: TouchEventLike): void;
  onUndoTap(): void;
  onLikeTap(): void;
  onDislikeTap(): void;
  onRetry(): void;
  onBackToDataset(): void;
  onBackToRoom(): void;
  onRestart(): void;
  loadRound(): void;
  loadMultiplayerRound(): void;
  refreshMultiplayerRound(): void;
  connectMultiplayerRealtime(): void;
  disconnectMultiplayerRealtime(): void;
  syncMultiplayerMembers(snapshot: RoundSnapshot): void;
  completeMultiplayerRound(): void;
  startDecision(decision: GameDecision): void;
  syncData(): void;
  resetCardPosition(): void;
}

interface TouchPoint {
  clientX: number;
}

interface TouchEventLike {
  touches: TouchPoint[];
  changedTouches: TouchPoint[];
}

const SWIPE_ACTION_DURATION = 220;
const CARD_ENTRY_DELAY = 16;
const CARD_TRANSITION = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out';
const CARD_CENTER_TRANSFORM = 'translate3d(0, 0, 0) rotate(0deg)';
const CARD_ENTRY_TRANSFORM = 'translate3d(0, 12px, 0) scale(0.97) rotate(0deg)';
let datasetType: CatalogDatasetType = 'large';
let gameMode: GameMode = 'single';
let roundId = '';
let multiplayerRound: RoundSnapshot | null = null;
let multiplayerSelection: CatalogSelection | null = null;
const multiplayerDecisionQueue = new DecisionQueue(
  createWxDecisionOperationStore(),
  {
    put: (currentRoundId, itemId, decision) => putRoundDecision(API_BASE_URL, currentRoundId, itemId, decision),
    delete: (currentRoundId, itemId) => deleteRoundDecision(API_BASE_URL, currentRoundId, itemId),
  },
);
let multiplayerRealtimeStop: (() => void) | null = null;
let multiplayerRealtimeConnectInFlight = false;
let pendingDecisionWrites: Promise<void>[] = [];
let multiplayerCompletionInFlight = false;
let multiplayerLoadToken = 0;
let navigatedResultRoundId = '';
let gameState: GameState | null = null;
let catalogSelection: CatalogSelection | null = null;
let touchStartX: number | null = null;
let touchCurrentX = 0;
let touchCurrentTime = 0;
let touchLastX = 0;
let touchLastTime = 0;
let decisionTimer: ReturnType<typeof setTimeout> | null = null;
let entryTimer: ReturnType<typeof setTimeout> | null = null;
let loadToken = 0;

Page<GamePageData, GamePageMethods>({
  data: {
    mode: 'single',
    roundId: '',
    status: 'loading',
    datasetLabel: '大类菜品',
    currentChoice: null,
    nextChoice: null,
    progressCurrent: 0,
    progressTotal: 0,
    likedCount: 0,
    canUndo: false,
    isSwiping: false,
    cardTransform: CARD_CENTER_TRANSFORM,
    cardTransition: CARD_TRANSITION,
    cardOpacity: 1,
    likeOverlayOpacity: 0,
    dislikeOverlayOpacity: 0,
    errorMessage: '',
    completedCount: 0,
    memberCount: 0,
    memberStatuses: [],
  },

  onLoad(options) {
    gameMode = options?.roundId ? 'multiplayer' : 'single';
    roundId = options?.roundId ?? '';
    multiplayerRound = null;
    multiplayerSelection = null;
    pendingDecisionWrites = [];
    multiplayerCompletionInFlight = false;
    navigatedResultRoundId = '';
    this.disconnectMultiplayerRealtime();
    gameState = null;
    this.setData({ mode: gameMode, roundId: options?.roundId ?? '' });
    if (gameMode === 'multiplayer' && options?.roundId) {
      this.loadMultiplayerRound();
      return;
    }
    datasetType = options?.dataset === 'small' ? 'small' : 'large';
    this.setData({ datasetLabel: datasetType === 'small' ? '小类菜品' : '大类菜品' });
    this.loadRound();
  },

  onShow() {
    if (gameMode === 'multiplayer') {
      this.connectMultiplayerRealtime();
      this.refreshMultiplayerRound();
    }
  },

  onHide() {
    this.disconnectMultiplayerRealtime();
  },

  onUnload() {
    this.disconnectMultiplayerRealtime();
    if (decisionTimer) clearTimeout(decisionTimer);
    if (entryTimer) clearTimeout(entryTimer);
    decisionTimer = null;
    entryTimer = null;
    touchStartX = null;
  },

  loadRound() {
    const currentLoadToken = ++loadToken;
    this.setData({ status: 'loading', errorMessage: '', isSwiping: false });
    void loadCatalogSelection(API_BASE_URL, datasetType)
      .then((selection) => {
        if (currentLoadToken !== loadToken) return;
        catalogSelection = selection;
        gameState = restoreStoredRound(selection) ?? createGameState(shuffleChoices(selection.items));
        persistRound(gameState, selection);
        this.syncData();
      })
      .catch((cause: unknown) => {
        if (currentLoadToken !== loadToken) return;
        console.error('加载游戏菜单失败', cause);
        catalogSelection = null;
        gameState = null;
        this.setData({
          status: 'error',
          errorMessage: cause instanceof Error ? cause.message : '菜单加载失败，请稍后重试',
          currentChoice: null,
          nextChoice: null,
          progressCurrent: 0,
          progressTotal: 0,
        });
      });
  },

  loadMultiplayerRound() {
    const currentLoadToken = ++multiplayerLoadToken;
    this.setData({
      status: 'loading',
      errorMessage: '',
      isSwiping: false,
      currentChoice: null,
      nextChoice: null,
    });
    void getRound(API_BASE_URL, roundId)
      .then(async (snapshot) => {
        if (currentLoadToken !== multiplayerLoadToken) return;
        const selection = snapshot.datasetType === 'custom'
          ? await loadCustomCatalogSelection(API_BASE_URL, snapshot.roomId)
          : await loadCatalogSelection(API_BASE_URL, snapshot.datasetType);
        if (currentLoadToken !== multiplayerLoadToken) return;
        const restored = restoreMultiplayerState(selection, snapshot, roundId);
        multiplayerRound = snapshot;
        multiplayerSelection = selection;
        this.connectMultiplayerRealtime();
        void multiplayerDecisionQueue.flush(roundId).catch((cause) => console.warn('恢复多人决定失败', cause));
        gameState = restored.state;
        catalogSelection = selection;
        persistMultiplayerRound(gameState, selection, roundId);
        this.setData({
          datasetLabel: snapshot.datasetType === 'small'
            ? '小类菜品'
            : snapshot.datasetType === 'custom'
              ? `自定义菜品（${snapshot.customCatalog?.itemCount ?? selection.items.length} 道）`
              : '大类菜品',
        });
        this.syncMultiplayerMembers(snapshot);
        const self = snapshot.members.find((member) => member.isSelf);
        if (restored.hasLocalState && snapshot.status === 'playing' && self?.status === 'choosing') {
          reconcileMultiplayerDecisions(snapshot, selection, gameState);
        }
        if (snapshot.status === 'completed') {
          this.disconnectMultiplayerRealtime();
          this.setData({ status: 'completed' });
          navigateToMultiplayerResult(roundId);
        } else if (self?.status === 'completed') {
          this.setData({ status: 'waiting' });
          void multiplayerDecisionQueue.flush(roundId).catch((cause) => console.warn('同步多人决定失败', cause));
        } else if (gameState.status === 'exhausted') {
          this.setData({ status: 'syncing' });
          void this.completeMultiplayerRound();
        } else {
          this.syncData();
        }
      })
      .catch((cause: unknown) => {
        if (currentLoadToken !== multiplayerLoadToken) return;
        console.error('加载多人轮次失败', cause);
        multiplayerRound = null;
        multiplayerSelection = null;
        gameState = null;
        this.disconnectMultiplayerRealtime();
        this.setData({
          status: 'error',
          errorMessage: cause instanceof Error ? cause.message : '多人轮次加载失败，请稍后重试',
          currentChoice: null,
          nextChoice: null,
          progressCurrent: 0,
          progressTotal: 0,
        });
      });
  },

  refreshMultiplayerRound() {
    if (gameMode !== 'multiplayer' || !roundId || !multiplayerRound) return;
    void getRound(API_BASE_URL, roundId)
      .then((snapshot) => {
        multiplayerRound = snapshot;
        this.syncMultiplayerMembers(snapshot);
        if (snapshot.status === 'completed') {
          this.disconnectMultiplayerRealtime();
          this.setData({ status: 'completed' });
          navigateToMultiplayerResult(roundId);
          return;
        }
        const self = snapshot.members.find((member) => member.isSelf);
        if (self?.status === 'completed') {
          this.setData({ status: 'waiting' });
          this.disconnectMultiplayerRealtime();
          this.connectMultiplayerRealtime();
          return;
        }
        this.disconnectMultiplayerRealtime();
        this.loadMultiplayerRound();
      })
      .catch((cause: unknown) => {
        console.warn('刷新多人轮次失败', cause);
      });
  },

  connectMultiplayerRealtime() {
    if (!multiplayerRound || multiplayerRealtimeStop || multiplayerRealtimeConnectInFlight) return;
    multiplayerRealtimeConnectInFlight = true;
    void getRoomIdentity(API_BASE_URL)
      .then((identity) => {
        if (!multiplayerRound) return;
        multiplayerRealtimeStop = createWxRealtimeTransport(API_BASE_URL).connect({
          token: identity.token,
          roomId: multiplayerRound.roomId,
          revisions: { roomRevision: 0, roundRevision: multiplayerRound.revision },
          onStale: (state) => {
            if (state.room || state.round || state.reconnected) this.refreshMultiplayerRound();
          },
        });
      })
      .catch((cause) => console.warn('多人游戏实时连接失败', cause))
      .finally(() => {
        multiplayerRealtimeConnectInFlight = false;
      });
  },

  disconnectMultiplayerRealtime() {
    multiplayerRealtimeStop?.();
    multiplayerRealtimeStop = null;
  },

  syncMultiplayerMembers(snapshot) {
    const activeMembers = snapshot.members.filter((member) => member.status !== 'removed');
    this.setData({
      completedCount: activeMembers.filter((member) => member.status === 'completed').length,
      memberCount: activeMembers.length,
      memberStatuses: snapshot.members.map((member) => ({
        ...member,
        statusLabel: member.status === 'completed' ? '已完成' : member.status === 'removed' ? '已移出本轮' : '选择中',
      })),
    });
  },

  completeMultiplayerRound() {
    if (!multiplayerRound || multiplayerCompletionInFlight) return;
    multiplayerCompletionInFlight = true;
    this.setData({ status: 'syncing', errorMessage: '' });
    const writes = pendingDecisionWrites;
    pendingDecisionWrites = [];
    void Promise.all(writes)
      .then(() => multiplayerDecisionQueue.flush(roundId))
      .then(() => completeRound(API_BASE_URL, multiplayerRound!))
      .then((snapshot) => {
        multiplayerRound = snapshot;
        this.syncMultiplayerMembers(snapshot);
        if (snapshot.status === 'completed') {
          this.disconnectMultiplayerRealtime();
          this.setData({ status: 'completed' });
          navigateToMultiplayerResult(roundId);
          return;
        }
        this.setData({ status: 'waiting' });
        this.connectMultiplayerRealtime();
      })
      .catch((cause: unknown) => {
        this.setData({
          status: 'error',
          errorMessage: cause instanceof Error ? cause.message : '完成本轮失败，请重试',
        });
      })
      .finally(() => {
        multiplayerCompletionInFlight = false;
      });
  },

  onTouchStart(event) {
    if (!gameState || gameState.status !== 'choosing' || this.data.isSwiping) return;
    const point = event.touches[0];
    if (!point) return;
    touchStartX = point.clientX;
    touchCurrentX = point.clientX;
    touchCurrentTime = Date.now();
    touchLastX = point.clientX;
    touchLastTime = touchCurrentTime;
    this.setData({ cardTransition: 'none' });
  },

  onTouchMove(event) {
    if (touchStartX === null || this.data.isSwiping) return;
    const point = event.touches[0];
    if (!point) return;
    const now = Date.now();
    touchLastX = touchCurrentX;
    touchLastTime = touchCurrentTime;
    touchCurrentX = point.clientX;
    touchCurrentTime = now;
    const offset = touchCurrentX - touchStartX;
    this.setData({
      cardTransition: 'none',
      cardTransform: cardTransform(offset),
      likeOverlayOpacity: Math.min(1, Math.max(0, offset / 120)),
      dislikeOverlayOpacity: Math.min(1, Math.max(0, -offset / 120)),
    });
  },

  onTouchEnd(event) {
    if (touchStartX === null || this.data.isSwiping) return;
    const point = event.changedTouches[0];
    const releaseX = point?.clientX ?? touchCurrentX;
    const releaseTime = Date.now();
    const offset = releaseX - touchStartX;
    const velocity = calculateReleaseVelocity(touchLastX, touchLastTime, releaseX, releaseTime);
    touchStartX = null;
    const action = resolveSwipeAction(offset, velocity);
    if (action) {
      this.startDecision(action);
      return;
    }
    this.resetCardPosition();
  },

  onUndoTap() {
    if (!gameState || this.data.isSwiping || gameState.history.length === 0) return;
    const undone = gameState.history[gameState.history.length - 1];
    gameState = undoGameState(gameState);
    if (gameMode === 'single' && catalogSelection) persistRound(gameState, catalogSelection);
    if (gameMode === 'multiplayer' && multiplayerSelection && undone) {
      persistMultiplayerRound(gameState, multiplayerSelection, roundId);
      queueDeleteDecision(roundId, undone.choiceId);
    }
    this.resetCardPosition();
    this.syncData();
  },

  onLikeTap() {
    this.startDecision('liked');
  },

  onDislikeTap() {
    this.startDecision('disliked');
  },

  startDecision(decision) {
    if (!gameState || gameState.status !== 'choosing' || this.data.isSwiping) return;
    const direction = decision === 'liked' ? 1 : -1;
    const exitDistance = getExitDistance();
    this.setData({
      isSwiping: true,
      cardTransition: CARD_TRANSITION,
      cardTransform: cardTransform(direction * exitDistance),
      cardOpacity: 0,
      likeOverlayOpacity: decision === 'liked' ? 1 : 0,
      dislikeOverlayOpacity: decision === 'disliked' ? 1 : 0,
    });

    if (decisionTimer) clearTimeout(decisionTimer);
    decisionTimer = setTimeout(() => {
      gameState = advanceGameState(gameState!, decision);
      if (gameMode === 'single' && catalogSelection) persistRound(gameState, catalogSelection);
      if (gameMode === 'multiplayer' && multiplayerSelection) {
        persistMultiplayerRound(gameState, multiplayerSelection, roundId);
        const record = gameState.history[gameState.history.length - 1];
        if (record) queuePutDecision(roundId, record.choiceId, record.decision);
      }
      decisionTimer = null;
      if (gameState.status === 'exhausted') {
        this.syncData();
        if (gameMode === 'multiplayer') this.completeMultiplayerRound();
        else navigateToSingleResult();
        return;
      }

      const progress = getProgress(gameState);
      this.setData({
        status: 'choosing',
        currentChoice: getCurrentChoice(gameState) ?? null,
        nextChoice: getNextChoice(gameState) ?? null,
        progressCurrent: progress.current,
        progressTotal: progress.total,
        likedCount: gameState.likedIds.length,
        canUndo: gameState.history.length > 0,
        isSwiping: true,
        cardTransition: 'none',
        cardTransform: CARD_ENTRY_TRANSFORM,
        cardOpacity: 0,
        likeOverlayOpacity: 0,
        dislikeOverlayOpacity: 0,
      });
      if (entryTimer) clearTimeout(entryTimer);
      entryTimer = setTimeout(() => {
        this.setData({
          cardTransition: CARD_TRANSITION,
          cardTransform: CARD_CENTER_TRANSFORM,
          cardOpacity: 1,
          isSwiping: false,
        });
        entryTimer = null;
      }, CARD_ENTRY_DELAY);
    }, SWIPE_ACTION_DURATION);
  },

  onRetry() {
    if (gameMode === 'multiplayer') this.loadMultiplayerRound();
    else this.loadRound();
  },

  onBackToDataset() {
    wx.navigateBack({ delta: 1 });
  },

  onBackToRoom() {
    this.disconnectMultiplayerRealtime();
    wx.navigateBack({ delta: 1 });
  },

  onRestart() {
    clearStoredSingleRound();
    this.loadRound();
  },

  syncData(interactionLocked = false) {
    if (!gameState) return;
    const progress = getProgress(gameState);
    const currentChoice = getCurrentChoice(gameState) ?? null;
    const nextChoice = getNextChoice(gameState) ?? null;
    this.setData({
      status: gameState.status === 'exhausted'
        ? gameMode === 'multiplayer' ? 'syncing' : 'completed'
        : gameState.status,
      currentChoice,
      nextChoice,
      progressCurrent: progress.current,
      progressTotal: progress.total,
      likedCount: gameState.likedIds.length,
      canUndo: gameState.history.length > 0,
      isSwiping: interactionLocked,
    });
  },

  resetCardPosition() {
    this.setData({
      cardTransition: CARD_TRANSITION,
      cardTransform: CARD_CENTER_TRANSFORM,
      cardOpacity: 1,
      likeOverlayOpacity: 0,
      dislikeOverlayOpacity: 0,
      isSwiping: false,
    });
  },
});

interface StoredMultiplayerRound {
  roundId: string;
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
  history: GameDecisionRecord[];
}

function queuePutDecision(currentRoundId: string, itemId: string, decision: RoundDecision): void {
  const write = multiplayerDecisionQueue
    .enqueuePut(currentRoundId, itemId, decision)
    .then(() => undefined);
  pendingDecisionWrites.push(write);
  void write.catch((cause) => console.warn('保存待发送决定失败', cause));
  void write.then(() => multiplayerDecisionQueue.flush(currentRoundId)).catch((cause) => console.warn('发送决定失败', cause));
}

function queueDeleteDecision(currentRoundId: string, itemId: string): void {
  const write = multiplayerDecisionQueue
    .enqueueDelete(currentRoundId, itemId)
    .then(() => undefined);
  pendingDecisionWrites.push(write);
  void write.catch((cause) => console.warn('保存待发送撤销失败', cause));
  void write.then(() => multiplayerDecisionQueue.flush(currentRoundId)).catch((cause) => console.warn('发送撤销失败', cause));
}

function restoreMultiplayerState(
  selection: CatalogSelection,
  snapshot: RoundSnapshot,
  currentRoundId: string,
): { state: GameState; hasLocalState: boolean } {
  const stored = readStoredMultiplayerRound(currentRoundId);
  const hasLocalState = isUsableStoredMultiplayerRound(stored, selection, currentRoundId);
  const decisions = new Map<string, GameDecision>(
    hasLocalState
      ? stored!.history.map((record) => [record.choiceId, record.decision])
      : snapshot.ownDecisions.map((record) => [record.catalogItemId, record.decision]),
  );
  const items = hasLocalState
    ? stored!.itemIds.map((id) => selection.items.find((item) => item.id === id)!).filter(Boolean)
    : shuffleChoices(selection.items).sort((left, right) => {
      const leftDecided = decisions.has(left.id) ? 0 : 1;
      const rightDecided = decisions.has(right.id) ? 0 : 1;
      return leftDecided - rightDecided;
    });
  let state = createGameState(items);
  for (const item of items) {
    const decision = decisions.get(item.id);
    if (!decision || getCurrentChoice(state)?.id !== item.id) break;
    state = advanceGameState(state, decision);
  }
  return { state, hasLocalState };
}

function reconcileMultiplayerDecisions(snapshot: RoundSnapshot, selection: CatalogSelection, state: GameState): void {
  const serverDecisions = new Map(snapshot.ownDecisions.map((record) => [record.catalogItemId, record.decision]));
  const localDecisions = new Map(state.history.map((record) => [record.choiceId, record.decision]));
  for (const item of selection.items) {
    const localDecision = localDecisions.get(item.id);
    const serverDecision = serverDecisions.get(item.id);
    if (localDecision === serverDecision) continue;
    if (localDecision) {
      queuePutDecision(roundId, item.id, localDecision);
    } else if (serverDecision) {
      queueDeleteDecision(roundId, item.id);
    }
  }
}

function persistMultiplayerRound(state: GameState, selection: CatalogSelection, currentRoundId: string): void {
  const stored: StoredMultiplayerRound = {
    roundId: currentRoundId,
    catalogVersion: selection.catalogVersion,
    catalogHash: selection.catalogHash,
    itemIds: state.choices.map((choice) => choice.id),
    history: state.history,
  };
  try {
    wx.setStorageSync(`${MULTIPLAYER_ROUND_STORAGE_KEY_PREFIX}${currentRoundId}`, JSON.stringify(stored));
  } catch (cause) {
    console.warn('保存多人游戏进度失败', cause);
  }
}

function readStoredMultiplayerRound(currentRoundId: string): StoredMultiplayerRound | null {
  try {
    const raw = wx.getStorageSync(`${MULTIPLAYER_ROUND_STORAGE_KEY_PREFIX}${currentRoundId}`);
    if (!raw) return null;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    const stored = value as Partial<StoredMultiplayerRound>;
    if (
      typeof stored.roundId !== 'string' ||
      typeof stored.catalogVersion !== 'string' ||
      typeof stored.catalogHash !== 'string' ||
      !Array.isArray(stored.itemIds) ||
      !stored.itemIds.every((id): id is string => typeof id === 'string') ||
      !Array.isArray(stored.history) ||
      !stored.history.every(isStoredDecision)
    ) return null;
    return stored as StoredMultiplayerRound;
  } catch (cause) {
    console.warn('读取多人游戏进度失败，将从服务端恢复', cause);
    return null;
  }
}

function isStoredDecision(value: unknown): value is GameDecisionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<GameDecisionRecord>;
  return (
    typeof record.choiceId === 'string' &&
    (record.decision === 'liked' || record.decision === 'disliked')
  );
}

function isUsableStoredMultiplayerRound(
  stored: StoredMultiplayerRound | null,
  selection: CatalogSelection,
  currentRoundId: string,
): stored is StoredMultiplayerRound {
  return Boolean(
    stored &&
    stored.roundId === currentRoundId &&
    stored.catalogVersion === selection.catalogVersion &&
    stored.catalogHash === selection.catalogHash &&
    stored.itemIds.length === selection.items.length &&
    new Set(stored.itemIds).size === selection.items.length &&
    stored.itemIds.every((id) => selection.items.some((item) => item.id === id)),
  );
}

function restoreStoredRound(selection: CatalogSelection): GameState | null {
  const stored = readStoredSingleRound();
  if (
    !stored ||
    stored.datasetType !== selection.datasetType ||
    stored.catalogVersion !== selection.catalogVersion ||
    stored.catalogHash !== selection.catalogHash
  ) {
    return null;
  }

  const itemsById = new Map(selection.items.map((item) => [item.id, item]));
  const orderedItems = stored.itemIds.map((id) => itemsById.get(id));
  if (
    orderedItems.length !== selection.items.length ||
    orderedItems.some((item): item is undefined => !item) ||
    new Set(stored.itemIds).size !== selection.items.length
  ) {
    return null;
  }

  let restored = createGameState(orderedItems as GameChoice[]);
  for (const record of stored.history) {
    if (getCurrentChoice(restored)?.id !== record.choiceId) return null;
    restored = advanceGameState(restored, record.decision);
  }
  return restored;
}

function persistRound(state: GameState, selection: CatalogSelection): void {
  const stored: StoredSingleRound = {
    datasetType: selection.datasetType,
    catalogVersion: selection.catalogVersion,
    catalogHash: selection.catalogHash,
    itemIds: state.choices.map((choice) => choice.id),
    history: state.history,
  };
  try {
    saveStoredSingleRound(stored);
  } catch (cause) {
    console.warn('保存游戏进度失败', cause);
  }
}

function cardTransform(offset: number): string {
  const rotation = Math.max(-22, Math.min(22, offset * 0.11));
  return `translate3d(${offset}px, 0, 0) rotate(${rotation}deg)`;
}

function getExitDistance(): number {
  try {
    return Math.max(420, wx.getSystemInfoSync().windowWidth + 80);
  } catch {
    return 460;
  }
}

function navigateToMultiplayerResult(currentRoundId: string): void {
  if (!currentRoundId || navigatedResultRoundId === currentRoundId) return;
  navigatedResultRoundId = currentRoundId;
  wx.navigateTo({ url: `/pages/result/index?roundId=${currentRoundId}` });
}

function navigateToSingleResult(): void {
  wx.redirectTo({ url: '/pages/single-result/index' });
}
