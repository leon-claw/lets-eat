import { describe, expect, it } from 'vitest';
import { ClientApiError } from '../api-error.js';
import { classifyMultiplayerError } from './error-policy.js';

describe('multiplayer error policy', () => {
  it('treats a missing room as terminal', () => {
    const policy = classifyMultiplayerError(new ClientApiError(404, 'ROOM_NOT_FOUND', '房间不存在', 'req-1'));
    expect(policy).toEqual({ type: 'terminal', target: 'room-closed', message: '房间已关闭' });
  });

  it('keeps a non-joinable room in validation', () => {
    const policy = classifyMultiplayerError(new ClientApiError(409, 'ROOM_NOT_JOINABLE', '房间已经开始游戏', 'req-2'));
    expect(policy).toEqual({ type: 'validation', message: '房间已经开始游戏' });
  });
});
