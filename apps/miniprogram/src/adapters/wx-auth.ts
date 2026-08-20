import { requestJson } from './wx-http';

export const ANONYMOUS_IDENTITY_STORAGE_KEY = 'lets-eat.miniprogram.anonymous-identity.v1';

export interface AnonymousIdentity {
  userId: string;
  token: string;
  expiresAt: string;
}

export async function loadOrCreateAnonymousIdentity(baseUrl: string): Promise<AnonymousIdentity> {
  const stored = readIdentity();
  if (stored && new Date(stored.expiresAt).getTime() > Date.now()) return stored;

  const response = await requestJson<unknown>(baseUrl, '/api/auth/anonymous', { method: 'POST' });
  const identity = parseIdentity(response);
  wx.setStorageSync(ANONYMOUS_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function clearAnonymousIdentity(): void {
  wx.removeStorageSync(ANONYMOUS_IDENTITY_STORAGE_KEY);
}

function readIdentity(): AnonymousIdentity | null {
  try {
    const raw = wx.getStorageSync(ANONYMOUS_IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    return parseIdentity(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    clearAnonymousIdentity();
    return null;
  }
}

function parseIdentity(value: unknown): AnonymousIdentity {
  if (!value || typeof value !== 'object') throw new Error('匿名身份响应无效');
  const identity = value as Partial<AnonymousIdentity>;
  if (
    typeof identity.userId !== 'string' ||
    typeof identity.token !== 'string' ||
    typeof identity.expiresAt !== 'string'
  ) {
    throw new Error('匿名身份响应无效');
  }
  return {
    userId: identity.userId,
    token: identity.token,
    expiresAt: identity.expiresAt,
  };
}
