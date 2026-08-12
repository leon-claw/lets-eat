import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';

const ISSUER = 'lets-eat-api';
const AUDIENCE = 'lets-eat-client';
const LIFETIME_SECONDS = 180 * 24 * 60 * 60;

export interface VerifiedToken {
  userId: string;
}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId = randomUUID()): Promise<{ token: string; expiresAt: string; userId: string }> {
    const expiresAt = new Date(Date.now() + LIFETIME_SECONDS * 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt: expiresAt.toISOString(), userId };
  }

  async verify(token: string): Promise<VerifiedToken> {
    const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub) throw new Error('Token subject missing');
    return { userId: payload.sub };
  }
}
