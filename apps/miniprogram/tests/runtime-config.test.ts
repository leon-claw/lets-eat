import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../src/config/runtime';
import { getWebSocketUrl } from '../src/adapters/wx-realtime';

describe('mini program runtime API configuration', () => {
  it('uses the deployed API origin and lets adapters append /api routes', () => {
    expect(API_BASE_URL).toBe('https://lets-eat.jianghong.site');
    expect(API_BASE_URL).not.toMatch(/\/$/);
    expect(getWebSocketUrl(API_BASE_URL)).toBe('wss://lets-eat.jianghong.site/ws');
  });
});
