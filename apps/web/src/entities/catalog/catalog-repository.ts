import {
  CatalogDocumentSchema,
  CatalogManifestSchema,
  type CatalogDocument,
  type CatalogManifest,
  type DatasetType,
} from '@lets-eat/contracts';
import type { CatalogCache } from './types';
import type { CatalogSelection } from './types';

export interface CatalogVersion {
  catalogVersion: string;
  catalogHash: string;
}

export interface CatalogRepositoryOptions {
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  cache: CatalogCache;
  hashDocument?: (document: CatalogDocument) => Promise<string>;
}

export class CatalogRepositoryError extends Error {
  constructor(
    readonly code: 'CATALOG_REQUEST_FAILED' | 'CATALOG_HASH_MISMATCH' | 'EMPTY_DATASET',
    message: string,
  ) {
    super(message);
    this.name = 'CatalogRepositoryError';
  }
}

export class CatalogRepository {
  private readonly fetcher: (input: string | URL, init?: RequestInit) => Promise<Response>;
  private readonly cache: CatalogCache;
  private readonly hashDocument: (document: CatalogDocument) => Promise<string>;

  constructor(options: CatalogRepositoryOptions) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.cache = options.cache;
    this.hashDocument = options.hashDocument ?? hashCatalogDocument;
  }

  async load(datasetType: DatasetType, version?: CatalogVersion): Promise<CatalogSelection> {
    const documentAndHash = version
      ? await this.loadExactVersion(version)
      : await this.loadCurrentVersion();
    const items = documentAndHash.document.items
      .filter((item) => item.datasetType === datasetType)
      .sort((left, right) => left.order - right.order);

    if (items.length === 0) {
      throw new CatalogRepositoryError('EMPTY_DATASET', `菜品数据集为空：${datasetType}`);
    }

    return {
      catalogVersion: documentAndHash.document.catalogVersion,
      catalogHash: documentAndHash.hash,
      datasetType,
      items,
    };
  }

  private async loadCurrentVersion(): Promise<{ document: CatalogDocument; hash: string }> {
    const cachedManifest = await this.cache.getManifest();
    const response = await this.fetcher('/api/catalog/manifest', cachedManifest
      ? { headers: { 'if-none-match': `"${cachedManifest.catalogHash}"` } }
      : undefined);
    let manifest: CatalogManifest;

    if (response.status === 304) {
      if (!cachedManifest) {
        throw new CatalogRepositoryError('CATALOG_REQUEST_FAILED', '菜单版本响应无效');
      }
      manifest = cachedManifest;
    } else {
      if (!response.ok) throw this.requestError(response, '菜单版本获取失败');
      manifest = CatalogManifestSchema.parse(await response.json());
    }

    const cachedDocument = await this.cache.get(manifest.catalogVersion, manifest.catalogHash);
    if (cachedDocument) {
      const cachedHash = await this.hashDocument(cachedDocument);
      this.assertVersionAndHash(
        cachedDocument,
        manifest.catalogVersion,
        manifest.catalogHash,
        cachedHash,
      );
      await this.cache.touch(manifest.catalogVersion, Date.now());
      await this.cache.putManifest(manifest);
      await this.cache.prune(Date.now());
      return { document: cachedDocument, hash: manifest.catalogHash };
    }

    const document = await this.fetchDocument(manifest.catalogUrl);
    const hash = await this.hashDocument(document);
    this.assertVersionAndHash(document, manifest.catalogVersion, manifest.catalogHash, hash);
    await this.cache.put(manifest.catalogVersion, manifest.catalogHash, document, Date.now());
    await this.cache.putManifest(manifest);
    await this.cache.prune(Date.now());
    return { document, hash: manifest.catalogHash };
  }

  private async loadExactVersion(version: CatalogVersion): Promise<{ document: CatalogDocument; hash: string }> {
    const cachedDocument = await this.cache.get(version.catalogVersion, version.catalogHash);
    if (cachedDocument) {
      const cachedHash = await this.hashDocument(cachedDocument);
      this.assertVersionAndHash(
        cachedDocument,
        version.catalogVersion,
        version.catalogHash,
        cachedHash,
      );
      await this.cache.touch(version.catalogVersion, Date.now());
      return { document: cachedDocument, hash: version.catalogHash };
    }

    const document = await this.fetchDocument(`/api/catalog/${version.catalogVersion}`);
    const hash = await this.hashDocument(document);
    this.assertVersionAndHash(document, version.catalogVersion, version.catalogHash, hash);
    await this.cache.put(version.catalogVersion, version.catalogHash, document, Date.now());
    await this.cache.prune(Date.now());
    return { document, hash: version.catalogHash };
  }

  private async fetchDocument(url: string): Promise<CatalogDocument> {
    const response = await this.fetcher(url);
    if (!response.ok) throw this.requestError(response, '菜单数据获取失败');
    return CatalogDocumentSchema.parse(await response.json());
  }

  private assertVersionAndHash(
    document: CatalogDocument,
    expectedVersion: string,
    expectedHash: string,
    actualHash: string,
  ): void {
    if (document.catalogVersion !== expectedVersion || actualHash !== expectedHash) {
      throw new CatalogRepositoryError('CATALOG_HASH_MISMATCH', '菜单版本校验失败');
    }
  }

  private requestError(response: Response, fallback: string): CatalogRepositoryError {
    return new CatalogRepositoryError('CATALOG_REQUEST_FAILED', `${fallback}（${response.status}）`);
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(',')}}`;
}

export async function hashCatalogDocument(document: CatalogDocument): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(document));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
