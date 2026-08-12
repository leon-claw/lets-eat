import { describe, expect, it, vi } from 'vitest';
import { AnonymousAuthResponseSchema } from '@lets-eat/contracts';
import { AnonymousIdentity } from './anonymous-identity';

const identity = { userId: '11111111-1111-4111-8111-111111111111', token: 'token-1', expiresAt: new Date(Date.now() + 60_000).toISOString() };

describe('AnonymousIdentity', () => {
  it('creates once, persists, and reuses an unexpired anonymous identity', async () => {
    const storage = window.localStorage;
    const issue = vi.fn().mockResolvedValue(AnonymousAuthResponseSchema.parse(identity));
    const store = new AnonymousIdentity({ storage, issue });
    await expect(store.ensure()).resolves.toEqual(identity);
    await expect(store.ensure()).resolves.toEqual(identity);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('replaces an expired identity and clears it explicitly', async () => {
    const storage = window.localStorage;
    storage.setItem('lets-eat.anonymous-token.v1', JSON.stringify({ ...identity, expiresAt: new Date(Date.now() - 1).toISOString() }));
    const replacement = { ...identity, token: 'token-2' };
    const issue = vi.fn().mockResolvedValue(replacement);
    const store = new AnonymousIdentity({ storage, issue });
    await expect(store.ensure()).resolves.toEqual(replacement);
    store.clear();
    expect(storage.getItem('lets-eat.anonymous-token.v1')).toBeNull();
  });
});
