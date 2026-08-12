import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createCatalogFixture } from '../catalog/catalog-test-fixture.js';
import { CatalogService } from '../catalog/catalog-service.js';
import { TokenService } from './token-service.js';

describe('anonymous auth routes', () => {
  it('issues a stateless token without a database write', async () => {
    const root = await createCatalogFixture();
    const catalogService = await CatalogService.fromDirectory(root, 'v1');
    const tokenService = new TokenService('a'.repeat(32));
    const app = createApp({ catalogService, tokenService });

    const response = await request(app).post('/api/auth/anonymous').expect(201);
    expect(await tokenService.verify(response.body.token)).toEqual({ userId: response.body.userId });
    expect(response.body.expiresAt).toEqual(expect.any(String));
  });
});
