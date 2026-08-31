import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../src/config/runtime';
import { getWebSocketUrl } from '../src/adapters/wx-realtime';

describe('mini program runtime API configuration', () => {
  it('uses the local API origin and lets adapters append /api routes', () => {
    expect(API_BASE_URL).toBe('http://192.168.0.115:3001');
    expect(API_BASE_URL).not.toMatch(/\/$/);
    expect(getWebSocketUrl(API_BASE_URL)).toBe('ws://192.168.0.115:3001/ws');
  });
});
