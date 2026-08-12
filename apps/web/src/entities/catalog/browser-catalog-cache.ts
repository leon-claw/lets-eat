import type { CatalogDocument, CatalogManifest } from '@lets-eat/contracts';
import type { CatalogCache } from './types';
import type { CatalogResponseStore } from './catalog-cache';

export type { CatalogResponseStore } from './catalog-cache';

const CACHE_NAME = 'lets-eat-catalog-v1';
const METADATA_KEY = 'lets-eat.catalog-meta.v1';
const MAX_VERSIONS = 5;
const UNUSED_VERSION_MS = 7 * 24 * 60 * 60 * 1000;

interface CatalogVersionMetadata {
  version: string;
  hash: string;
  usedAt: number;
}

interface CatalogMetadata {
  manifest: CatalogManifest | null;
  versions: CatalogVersionMetadata[];
}

export interface CatalogMetadataStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BrowserCatalogCacheOptions {
  responseStore: CatalogResponseStore;
  metadataStorage: CatalogMetadataStorage;
  now?: () => number;
  metadataKey?: string;
}

function emptyMetadata(): CatalogMetadata {
  return { manifest: null, versions: [] };
}

function readMetadata(storage: CatalogMetadataStorage, key: string): CatalogMetadata {
  const raw = storage.getItem(key);
  if (!raw) return emptyMetadata();

  try {
    const parsed = JSON.parse(raw) as Partial<CatalogMetadata>;
    return {
      manifest: parsed.manifest ?? null,
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
    };
  } catch {
    return emptyMetadata();
  }
}

export class BrowserCatalogCache implements CatalogCache {
  private readonly responseStore: CatalogResponseStore;
  private readonly metadataStorage: CatalogMetadataStorage;
  private readonly now: () => number;
  private readonly metadataKey: string;

  constructor(options: BrowserCatalogCacheOptions) {
    this.responseStore = options.responseStore;
    this.metadataStorage = options.metadataStorage;
    this.now = options.now ?? Date.now;
    this.metadataKey = options.metadataKey ?? METADATA_KEY;
  }

  async getManifest(): Promise<CatalogManifest | null> {
    return readMetadata(this.metadataStorage, this.metadataKey).manifest;
  }

  async putManifest(manifest: CatalogManifest): Promise<void> {
    const metadata = readMetadata(this.metadataStorage, this.metadataKey);
    this.persist({ ...metadata, manifest });
  }

  async get(version: string, hash: string): Promise<CatalogDocument | null> {
    return this.responseStore.get(this.key(version, hash));
  }

  async put(
    version: string,
    hash: string,
    document: CatalogDocument,
    usedAt = this.now(),
  ): Promise<void> {
    const metadata = readMetadata(this.metadataStorage, this.metadataKey);
    const versions = metadata.versions.filter(
      (entry) => entry.version !== version || entry.hash !== hash,
    );
    versions.push({ version, hash, usedAt });
    await this.responseStore.put(this.key(version, hash), document);
    this.persist({ ...metadata, versions });
  }

  async touch(version: string, usedAt = this.now()): Promise<void> {
    const metadata = readMetadata(this.metadataStorage, this.metadataKey);
    const versions = metadata.versions.map((entry) => (
      entry.version === version ? { ...entry, usedAt } : entry
    ));
    this.persist({ ...metadata, versions });
  }

  async prune(now = this.now()): Promise<void> {
    const metadata = readMetadata(this.metadataStorage, this.metadataKey);
    const recent = metadata.versions
      .filter((entry) => now - entry.usedAt <= UNUSED_VERSION_MS)
      .sort((left, right) => right.usedAt - left.usedAt);
    const retained = recent.slice(0, MAX_VERSIONS);
    const retainedKeys = new Set(retained.map((entry) => this.key(entry.version, entry.hash)));

    await Promise.all(
      metadata.versions
        .filter((entry) => !retainedKeys.has(this.key(entry.version, entry.hash)))
        .map((entry) => this.responseStore.delete(this.key(entry.version, entry.hash))),
    );
    this.persist({ ...metadata, versions: retained });
  }

  private key(version: string, hash: string): string {
    return `${version}:${hash}`;
  }

  private persist(metadata: CatalogMetadata): void {
    this.metadataStorage.setItem(this.metadataKey, JSON.stringify(metadata));
  }
}

class CacheStorageResponseStore implements CatalogResponseStore {
  private cachePromise: Promise<Cache> | null = null;

  async get(key: string): Promise<CatalogDocument | null> {
    const response = await (await this.getCache()).match(this.request(key));
    return response ? response.json() as Promise<CatalogDocument> : null;
  }

  async put(key: string, document: CatalogDocument): Promise<void> {
    const cache = await this.getCache();
    await cache.put(
      this.request(key),
      new Response(JSON.stringify(document), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await (await this.getCache()).delete(this.request(key));
  }

  private getCache(): Promise<Cache> {
    if (!globalThis.caches) {
      throw new Error('当前浏览器不支持 Cache Storage');
    }
    this.cachePromise ??= globalThis.caches.open(CACHE_NAME);
    return this.cachePromise;
  }

  private request(key: string): Request {
    return new Request(`/__lets-eat-catalog-cache/${encodeURIComponent(key)}`);
  }
}

class MemoryMetadataStorage implements CatalogMetadataStorage {
  private value: string | null = null;

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}

export function createBrowserCatalogCache(): BrowserCatalogCache {
  const metadataStorage = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : new MemoryMetadataStorage();

  return new BrowserCatalogCache({
    responseStore: new CacheStorageResponseStore(),
    metadataStorage,
  });
}
