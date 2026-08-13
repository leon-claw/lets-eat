import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/shared/http/api-client';
import { classifyMultiplayerError, isRoomTerminalPolicy } from './error-policy';

function apiError(status: number, code: string) {
  return new ApiClientError(status, code, '服务端提示', 'request-1');
}

describe('classifyMultiplayerError', () => {
  it('treats closed and missing rooms as an idempotent room terminal state', () => {
    expect(isRoomTerminalPolicy(classifyMultiplayerError(apiError(404, 'ROOM_NOT_FOUND')))).toBe(true);
    expect(isRoomTerminalPolicy(classifyMultiplayerError(apiError(409, 'ROOM_CLOSED')))).toBe(true);
  });

  it('distinguishes expired rooms from other terminal states', () => {
    expect(classifyMultiplayerError(apiError(410, 'ROOM_EXPIRED'))).toMatchObject({ type: 'terminal', target: 'room-expired' });
  });

  it('marks unavailable rounds for state recovery', () => {
    expect(classifyMultiplayerError(apiError(404, 'ROUND_NOT_FOUND'))).toMatchObject({ type: 'terminal', target: 'round-unavailable' });
    expect(classifyMultiplayerError(apiError(409, 'ROUND_NOT_PLAYING'))).toMatchObject({ type: 'terminal', target: 'round-unavailable' });
  });

  it('refreshes after room or round revision conflicts', () => {
    expect(classifyMultiplayerError(apiError(409, 'ROOM_REVISION_CONFLICT'))).toMatchObject({ type: 'refresh', target: 'room' });
    expect(classifyMultiplayerError(apiError(409, 'ROUND_REVISION_CONFLICT'))).toMatchObject({ type: 'refresh', target: 'round' });
  });

  it('keeps validation and permission errors local to the current page', () => {
    expect(classifyMultiplayerError(apiError(409, 'ROOM_NOT_JOINABLE'))).toMatchObject({ type: 'validation' });
    expect(classifyMultiplayerError(apiError(403, 'HOST_ONLY'))).toMatchObject({ type: 'forbidden' });
  });

  it('requests identity recovery for unauthorized responses', () => {
    expect(classifyMultiplayerError(apiError(401, 'AUTH_INVALID'))).toMatchObject({ type: 'auth-retry' });
  });

  it('keeps network and unknown errors retryable', () => {
    expect(classifyMultiplayerError(new TypeError('Failed to fetch'))).toMatchObject({ type: 'retry' });
    expect(classifyMultiplayerError(new Error('unknown'))).toMatchObject({ type: 'retry' });
  });
});
