import { AnonymousAuthResponseSchema, type AnonymousAuthResponse } from '@lets-eat/contracts';

const STORAGE_KEY = 'lets-eat.anonymous-token.v1';

interface AnonymousIdentityOptions {
  storage: Storage;
  issue: () => Promise<AnonymousAuthResponse>;
}

export class AnonymousIdentity {
  constructor(private readonly options: AnonymousIdentityOptions) {}

  async ensure(): Promise<AnonymousAuthResponse> {
    const stored = this.read();
    if (stored && new Date(stored.expiresAt).getTime() > Date.now()) return stored;
    return this.refresh();
  }

  async refresh(): Promise<AnonymousAuthResponse> {
    const identity = AnonymousAuthResponseSchema.parse(await this.options.issue());
    this.options.storage.setItem(STORAGE_KEY, JSON.stringify(identity));
    return identity;
  }

  clear(): void {
    this.options.storage.removeItem(STORAGE_KEY);
  }

  private read(): AnonymousAuthResponse | null {
    const raw = this.options.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return AnonymousAuthResponseSchema.parse(JSON.parse(raw));
    } catch {
      this.clear();
      return null;
    }
  }
}

export function createAnonymousIdentity(api: { request<T>(schema: typeof AnonymousAuthResponseSchema, path: string, options?: { method?: 'POST' }): Promise<T> }): AnonymousIdentity {
  const storage = window.localStorage;
  return new AnonymousIdentity({
    storage,
    issue: () => api.request(AnonymousAuthResponseSchema, '/api/auth/anonymous', { method: 'POST' }),
  });
}
