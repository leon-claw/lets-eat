import { ClientApiError } from '../api-error.js';

export type ErrorPolicy =
  | { type: 'terminal'; target: 'room-closed' | 'room-expired' | 'round-unavailable'; message: string }
  | { type: 'refresh'; target: 'room' | 'round'; message: string }
  | { type: 'retry'; message: string }
  | { type: 'validation'; message: string }
  | { type: 'auth-retry'; message: string }
  | { type: 'forbidden'; message: string };

export function classifyMultiplayerError(error: unknown): ErrorPolicy {
  if (error instanceof ClientApiError) {
    if (error.status === 401) return { type: 'auth-retry', message: '身份已失效，正在恢复' };
    if (error.code === 'ROOM_NOT_FOUND' || error.code === 'ROOM_CLOSED') {
      return { type: 'terminal', target: 'room-closed', message: '房间已关闭' };
    }
    if (error.code === 'ROOM_EXPIRED') {
      return { type: 'terminal', target: 'room-expired', message: '房间已过期' };
    }
    if (error.code === 'ROUND_NOT_FOUND' || error.code === 'ROUND_NOT_PLAYING' || error.code === 'RESULT_NOT_FOUND') {
      return { type: 'terminal', target: 'round-unavailable', message: '本轮已经结束或不可用' };
    }
    if (error.code === 'ROOM_REVISION_CONFLICT') {
      return { type: 'refresh', target: 'room', message: '房间状态已更新，正在刷新' };
    }
    if (error.code === 'ROUND_REVISION_CONFLICT') {
      return { type: 'refresh', target: 'round', message: '本轮状态已更新，正在刷新' };
    }
    if (error.code === 'ROOM_NOT_JOINABLE') {
      return { type: 'validation', message: error.message };
    }
    if (error.code === 'HOST_ONLY' || error.status === 403) {
      return { type: 'forbidden', message: '只有房主可以执行此操作' };
    }
    if (error.status === 400 || error.status === 422 || error.status === 429) {
      return { type: 'validation', message: error.message };
    }
  }
  return { type: 'retry', message: '网络暂时不可用，请重试' };
}

export function isRoomTerminalPolicy(
  policy: ErrorPolicy,
): policy is Extract<ErrorPolicy, { type: 'terminal'; target: 'room-closed' | 'room-expired' }> {
  return policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired');
}
