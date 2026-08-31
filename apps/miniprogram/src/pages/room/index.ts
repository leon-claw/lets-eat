import {
  changeRoomDataset,
  createRoom,
  deleteRoom,
  getRoom,
  getRoomIdentity,
  joinRoom,
  leaveRoom,
  openNextRoomRound,
  startRoomRound,
} from '../../adapters/wx-room';
import { WxApiError } from '../../adapters/wx-http';
import {
  clearRoomReference,
  createWxDisplayNameStorage,
  readRoomReference,
  saveRoomReference,
} from '../../adapters/wx-storage';
import { createWxRealtimeTransport } from '../../adapters/wx-realtime';
import { clearRoomCustomCatalog } from '../../adapters/wx-custom-catalog';
import { API_BASE_URL } from '../../config/runtime';
import { loadOrCreateDisplayName } from '../home/home-model';
import {
  getDatasetLabel,
  getRoomRole,
  isTerminalRoomError,
  type RoomDatasetType,
  type RoomSnapshot,
} from './room-model';
import { createShareConfig } from '../../shared/share-config';
import { writeRealtimeLog } from '../../shared/realtime-logger';

type RoomPageStatus = 'loading' | 'waiting' | 'playing' | 'results' | 'error' | 'closed';
type BusyAction = 'create' | 'join' | 'dataset' | 'leave' | 'start' | 'next' | null;
type ConfirmAction = 'leave' | null;

interface RoomPageData {
  status: RoomPageStatus;
  room: RoomSnapshot | null;
  roomCode: string;
  datasetLabel: string;
  displayName: string;
  userId: string;
  isHost: boolean;
  busyAction: BusyAction;
  joinVisible: boolean;
  joinCode: string;
  joinError: string;
  confirmVisible: boolean;
  confirmTitle: string;
  confirmMessage: string;
  confirmAction: ConfirmAction;
  errorMessage: string;
  toastMessage: string;
  toastVisible: boolean;
  roundId: string;
}

interface RoomPageMethods {
  onLoad(): void;
  onShow(): void;
  onHide(): void;
  onUnload(): void;
  onBack(): void;
  onReturnToGame(): void;
  onCopyCode(): void;
  onJoinTap(): void;
  onJoinCodeInput(event: InputEventLike): void;
  onJoinSubmit(): void;
  onCloseJoin(): void;
  onDatasetTap(event: DatasetEventLike): void;
  onStartTap(): void;
  onNextRoundTap(): void;
  onLeaveConfirm(): void;
  onCancelConfirm(): void;
  onBackToMode(): void;
  noop(): void;
  showToast(message: string): void;
  restoreRoom(): void;
  refreshRoom(): void;
  connectRealtime(): void;
  disconnectRealtime(): void;
  requestLeave(): void;
  applyRoom(room: RoomSnapshot): void;
  handleError(cause: unknown): void;
  errorMessage(cause: unknown): string;
}

interface InputEventLike {
  detail: { value: string };
}

interface DatasetEventLike {
  currentTarget: { dataset: { dataset?: string } };
}

let identityUserId = '';
let currentRoom: RoomSnapshot | null = null;
let pollInFlight = false;
let realtimeStop: (() => void) | null = null;
let realtimeConnectInFlight = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let navigatedRoundId = '';

Page<RoomPageData, RoomPageMethods>({
  ...createShareConfig(),

  data: {
    status: 'loading',
    room: null,
    roomCode: '',
    datasetLabel: '',
    displayName: '',
    userId: '',
    isHost: false,
    busyAction: null,
    joinVisible: false,
    joinCode: '',
    joinError: '',
    confirmVisible: false,
    confirmTitle: '',
    confirmMessage: '',
    confirmAction: null,
    errorMessage: '',
    toastMessage: '',
    toastVisible: false,
    roundId: '',
  },

  onLoad() {
    navigatedRoundId = '';
    this.setData({ displayName: loadOrCreateDisplayName(createWxDisplayNameStorage()) });
    this.restoreRoom();
  },

  onShow() {
    if (currentRoom) {
      this.connectRealtime();
      this.refreshRoom();
    }
  },

  onHide() {
    this.disconnectRealtime();
  },

  onUnload() {
    this.disconnectRealtime();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
  },

  restoreRoom() {
    writeRealtimeLog('info', 'room.restore.start');
    this.setData({ status: 'loading', errorMessage: '' });
    void (async () => {
      try {
        const identity = await getRoomIdentity(API_BASE_URL);
        identityUserId = identity.userId;
        writeRealtimeLog('info', 'room.identity.loaded', { userId: identity.userId });
        this.setData({ userId: identity.userId });
        const storedRoomId = readRoomReference();
        if (storedRoomId) {
          try {
            const room = await getRoom(API_BASE_URL, storedRoomId);
            if (room.members.some((member) => member.userId === identityUserId)) {
              writeRealtimeLog('info', 'room.restore.found', { roomId: room.id, status: room.status, roomRevision: room.revision });
              this.applyRoom(room);
              this.connectRealtime();
              return;
            }
          } catch (cause) {
            if (!(cause instanceof WxApiError) || !isTerminalRoomError(cause.code)) throw cause;
            clearRoomReference();
          }
        }

        this.setData({ busyAction: 'create' });
        writeRealtimeLog('info', 'room.create.sending');
        const room = await createRoom(API_BASE_URL, this.data.displayName);
        writeRealtimeLog('info', 'room.create.succeeded', { roomId: room.id, roomRevision: room.revision });
        saveRoomReference(room.id);
        this.applyRoom(room);
        this.connectRealtime();
      } catch (cause) {
        writeRealtimeLog('error', 'room.restore.failed', { message: cause instanceof Error ? cause.message : 'unknown error' });
        this.handleError(cause);
      } finally {
        this.setData({ busyAction: null });
      }
    })();
  },

  refreshRoom() {
    if (!currentRoom) {
      writeRealtimeLog('warn', 'room.refresh.skipped', { reason: 'no-current-room' });
      return;
    }
    if (pollInFlight || this.data.busyAction) {
      writeRealtimeLog('warn', 'room.refresh.skipped', {
        roomId: currentRoom.id,
        reason: pollInFlight ? 'poll-in-flight' : 'busy-action',
        busyAction: this.data.busyAction,
      });
      return;
    }
    writeRealtimeLog('info', 'room.refresh.started', {
      roomId: currentRoom.id,
      roomRevision: currentRoom.revision,
      status: currentRoom.status,
    });
    pollInFlight = true;
    void getRoom(API_BASE_URL, currentRoom.id)
      .then((room) => {
        writeRealtimeLog('info', 'room.refresh.succeeded', {
          roomId: room.id,
          roomRevision: room.revision,
          status: room.status,
        });
        if (!currentRoom || room.revision !== currentRoom.revision || room.status !== currentRoom.status) {
          this.applyRoom(room);
        }
      })
      .catch((cause: unknown) => {
        writeRealtimeLog('error', 'room.refresh.failed', {
          roomId: currentRoom?.id,
          message: cause instanceof Error ? cause.message : 'unknown error',
        });
        this.handleError(cause);
      })
      .finally(() => {
        pollInFlight = false;
        writeRealtimeLog('info', 'room.refresh.finished', { roomId: currentRoom?.id });
      });
  },

  connectRealtime() {
    if (!currentRoom) {
      writeRealtimeLog('warn', 'realtime.connect.skipped', { reason: 'no-current-room' });
      return;
    }
    if (realtimeStop) {
      writeRealtimeLog('info', 'realtime.connect.skipped', { roomId: currentRoom.id, reason: 'already-connected' });
      return;
    }
    if (realtimeConnectInFlight) {
      writeRealtimeLog('info', 'realtime.connect.skipped', { roomId: currentRoom.id, reason: 'connect-in-flight' });
      return;
    }
    writeRealtimeLog('info', 'realtime.connect.started', { roomId: currentRoom.id, roomRevision: currentRoom.revision });
    realtimeConnectInFlight = true;
    void getRoomIdentity(API_BASE_URL)
      .then((identity) => {
        if (!currentRoom) {
          writeRealtimeLog('warn', 'realtime.connect.aborted', { reason: 'room-cleared-before-identity' });
          return;
        }
        writeRealtimeLog('info', 'realtime.identity.loaded', { roomId: currentRoom.id, userId: identity.userId });
        realtimeStop = createWxRealtimeTransport(API_BASE_URL).connect({
          token: identity.token,
          roomId: currentRoom.id,
          revisions: { roomRevision: currentRoom.revision },
          onStale: (state) => {
            writeRealtimeLog('info', 'realtime.stale', {
              roomId: currentRoom?.id,
              room: state.room,
              round: state.round,
              reconnected: state.reconnected,
            });
            if (state.room || state.round || state.reconnected) this.refreshRoom();
          },
        });
        writeRealtimeLog('info', 'realtime.connect.started-transport', { roomId: currentRoom.id });
      })
      .catch((cause) => {
        writeRealtimeLog('error', 'realtime.connect.failed', { roomId: currentRoom?.id, message: cause instanceof Error ? cause.message : 'unknown error' });
        console.warn('房间实时连接失败', cause);
      })
      .finally(() => {
        realtimeConnectInFlight = false;
        writeRealtimeLog('info', 'realtime.connect.finished', { roomId: currentRoom?.id, connected: realtimeStop !== null });
      });
  },

  disconnectRealtime() {
    if (realtimeStop) writeRealtimeLog('info', 'realtime.disconnect.started', { roomId: currentRoom?.id });
    realtimeStop?.();
    realtimeStop = null;
  },

  onBack() {
    this.requestLeave();
  },

  onReturnToGame() {
    const activeRoundId = currentRoom?.currentRoundId ?? this.data.roundId;
    if (activeRoundId) navigateToMultiplayerRound(activeRoundId, true);
  },

  onCopyCode() {
    if (!this.data.roomCode) return;
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => {
        wx.hideToast();
        this.showToast('房间号已复制');
      },
    });
  },

  onJoinTap() {
    if (this.data.busyAction) return;
    this.setData({ joinVisible: true, joinCode: '', joinError: '' });
  },

  onJoinCodeInput(event) {
    this.setData({ joinCode: event.detail.value.replace(/\D/g, '').slice(0, 8), joinError: '' });
  },

  onJoinSubmit() {
    const code = this.data.joinCode.trim();
    if (!/^\d{4}$/.test(code)) {
      this.setData({ joinError: '请输入 4 位数字房间号' });
      return;
    }
    this.setData({ busyAction: 'join', joinError: '' });
    void joinRoom(API_BASE_URL, code, this.data.displayName)
      .then((room) => {
        saveRoomReference(room.id);
        this.setData({ joinVisible: false });
        this.applyRoom(room);
        this.connectRealtime();
      })
      .catch((cause: unknown) => {
        const message = this.errorMessage(cause);
        this.setData({ joinError: message });
      })
      .finally(() => this.setData({ busyAction: null }));
  },

  onCloseJoin() {
    if (this.data.busyAction === 'join') return;
    this.setData({ joinVisible: false, joinError: '' });
  },

  onDatasetTap(event) {
    if (!this.data.isHost || this.data.busyAction || !currentRoom) return;
    const selected = event.currentTarget.dataset.dataset;
    if (selected !== 'large' && selected !== 'small' && selected !== 'custom') return;
    if (selected === 'custom' && !currentRoom.customCatalog) {
      this.showToast('请先在设置页保存至少 3 道自定义菜品');
      return;
    }
    this.setData({ busyAction: 'dataset' });
    void changeRoomDataset(API_BASE_URL, currentRoom, selected)
      .then((room) => this.applyRoom(room))
      .catch((cause: unknown) => this.handleError(cause))
      .finally(() => this.setData({ busyAction: null }));
  },

  onStartTap() {
    if (!currentRoom || !this.data.isHost || this.data.busyAction) return;
    writeRealtimeLog('info', 'room.start.sending', { roomId: currentRoom.id, roomRevision: currentRoom.revision });
    this.setData({ busyAction: 'start' });
    void startRoomRound(API_BASE_URL, currentRoom)
      .then((round) => {
        writeRealtimeLog('info', 'room.start.succeeded', { roomId: currentRoom?.id, roundId: round.id });
        this.setData({ status: 'playing', roundId: round.id });
        navigateToMultiplayerRound(round.id);
      })
      .catch((cause: unknown) => {
        writeRealtimeLog('error', 'room.start.failed', { roomId: currentRoom?.id, message: cause instanceof Error ? cause.message : 'unknown error' });
        this.handleError(cause);
      })
      .finally(() => this.setData({ busyAction: null }));
  },

  onNextRoundTap() {
    if (!currentRoom || !this.data.isHost || this.data.busyAction) return;
    this.setData({ busyAction: 'next' });
    void openNextRoomRound(API_BASE_URL, currentRoom)
      .then((room) => this.applyRoom(room))
      .catch((cause: unknown) => this.handleError(cause))
      .finally(() => this.setData({ busyAction: null }));
  },

  onLeaveConfirm() {
    const action = this.data.confirmAction;
    this.setData({ confirmVisible: false, confirmAction: null });
    if (action !== 'leave' || !currentRoom || this.data.busyAction) return;
    const roomId = currentRoom.id;
    this.setData({ busyAction: 'leave' });
    const operation = this.data.isHost
      ? deleteRoom(API_BASE_URL, currentRoom.id)
      : leaveRoom(API_BASE_URL, currentRoom.id);
    writeRealtimeLog('info', this.data.isHost ? 'room.close.sending' : 'room.leave.sending', { roomId: roomId });
    void operation
      .then(() => {
        writeRealtimeLog('info', this.data.isHost ? 'room.close.succeeded' : 'room.leave.succeeded', { roomId });
        clearRoomReference();
        currentRoom = null;
        this.disconnectRealtime();
        wx.navigateBack({ delta: 1 });
      })
      .catch((cause: unknown) => {
        writeRealtimeLog('error', this.data.isHost ? 'room.close.failed' : 'room.leave.failed', { roomId, message: cause instanceof Error ? cause.message : 'unknown error' });
        if (cause instanceof WxApiError && isTerminalRoomError(cause.code)) {
          clearRoomReference();
          clearRoomCustomCatalog(roomId);
          currentRoom = null;
          this.setData({ status: 'closed', busyAction: null });
          return;
        }
        this.handleError(cause);
      })
      .finally(() => this.setData({ busyAction: null }));
  },

  onCancelConfirm() {
    this.setData({ confirmVisible: false, confirmAction: null });
  },

  onBackToMode() {
    if (currentRoom) clearRoomCustomCatalog(currentRoom.id);
    clearRoomReference();
    navigatedRoundId = '';
    wx.navigateBack({ delta: 1 });
  },

  noop() {},

  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    this.setData({ toastMessage: message, toastVisible: true });
    toastTimer = setTimeout(() => {
      this.setData({ toastVisible: false });
      toastTimer = null;
    }, 2_000);
  },

  requestLeave() {
    if (!currentRoom || this.data.busyAction) return;
    const isHost = this.data.isHost;
    this.setData({
      confirmVisible: true,
      confirmAction: 'leave',
      confirmTitle: isHost ? '关闭房间？' : '退出房间？',
      confirmMessage: isHost ? '关闭后，其他成员也会离开当前房间。' : '退出后，需要重新输入房间号才能加入。',
    });
  },

  applyRoom(room: RoomSnapshot) {
    writeRealtimeLog('info', 'room.applied', {
      roomId: room.id,
      roomRevision: room.revision,
      status: room.status,
      memberCount: room.members.length,
    });
    currentRoom = room;
    saveRoomReference(room.id);
    const isHost = identityUserId !== '' && getRoomRole(room, identityUserId) === 'host';
    this.setData({
      status: room.status,
      room,
      roomCode: room.code,
      datasetLabel: getDatasetLabel(room),
      isHost,
      errorMessage: '',
      roundId: room.currentRoundId ?? '',
    });
    if (room.status === 'playing' && room.currentRoundId) {
      navigateToMultiplayerRound(room.currentRoundId);
    }
  },

  handleError(cause: unknown) {
    writeRealtimeLog('error', 'room.error', {
      roomId: currentRoom?.id,
      code: cause instanceof WxApiError ? cause.code : undefined,
      status: cause instanceof WxApiError ? cause.status : undefined,
      message: cause instanceof Error ? cause.message : 'unknown error',
    });
    if (cause instanceof WxApiError && isTerminalRoomError(cause.code)) {
      if (currentRoom) clearRoomCustomCatalog(currentRoom.id);
      clearRoomReference();
      currentRoom = null;
      this.disconnectRealtime();
      this.setData({ status: 'closed', room: null, errorMessage: cause.message, busyAction: null });
      return;
    }
    this.setData({ status: this.data.room ? this.data.status : 'error', errorMessage: this.errorMessage(cause), busyAction: null });
    this.showToast(this.errorMessage(cause));
  },

  errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : '房间操作失败，请稍后重试';
  },
});

function navigateToMultiplayerRound(roundId: string, force = false): void {
  if (!roundId || (!force && navigatedRoundId === roundId)) return;
  writeRealtimeLog('info', 'room.navigate-to-round', { roundId, force });
  navigatedRoundId = roundId;
  wx.navigateTo({ url: `/pages/game/index?roundId=${roundId}` });
}
