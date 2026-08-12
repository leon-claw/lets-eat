import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('provides safe local defaults', () => {
    expect(parseEnv({}).API_PORT).toBe(3001);
  });

  it('rejects sample credentials in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
    expect(() => parseEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
    })).toThrow('DATABASE_URL password');
  });
});
