import { describe, expect, it } from 'vitest';
import { TokenService } from './token-service.js';

describe('TokenService', () => {
  it('issues and verifies a signed anonymous token', async () => {
    const service = new TokenService('a'.repeat(32));
    const issued = await service.issue('00000000-0000-4000-8000-000000000001');

    expect(await service.verify(issued.token)).toEqual({ userId: '00000000-0000-4000-8000-000000000001' });
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now() + 179 * 24 * 60 * 60 * 1000);
  });

  it('rejects a token signed with another secret', async () => {
    const issued = await new TokenService('a'.repeat(32)).issue();
    await expect(new TokenService('b'.repeat(32)).verify(issued.token)).rejects.toThrow();
  });
});
