export interface CatalogCounts {
  large: number;
  small: number;
}

export type CatalogDatasetType = 'large' | 'small' | 'custom';

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  datasetType: CatalogDatasetType;
  order: number;
  tags: string[];
  representativeFoods: string[];
}

export interface CatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  datasetType: CatalogDatasetType;
  items: CatalogItem[];
}

export interface CatalogSnapshot {
  catalogVersion: string;
  catalogHash: string;
  items: CatalogItem[];
}

const CATALOG_MANIFEST_STORAGE_KEY = 'lets-eat.miniprogram.catalog-manifest.v1';
const CATALOG_STORAGE_KEY_PREFIX = 'lets-eat.miniprogram.catalog.v1:';

export function parseCatalogCounts(value: unknown): CatalogCounts {
  if (!value || typeof value !== 'object') throw new Error('菜单统计响应无效');
  const counts = (value as { counts?: unknown }).counts;
  if (!counts || typeof counts !== 'object') throw new Error('菜单统计响应无效');

  const { large, small } = counts as { large?: unknown; small?: unknown };
  if (!isCount(large) || !isCount(small)) throw new Error('菜单统计响应无效');
  return { large, small };
}

export function parseCatalogManifest(value: unknown): {
  catalogVersion: string;
  catalogHash: string;
  catalogUrl: string;
  counts: CatalogCounts;
} {
  if (!value || typeof value !== 'object') throw new Error('菜单版本响应无效');
  const manifest = value as Record<string, unknown>;
  const catalogVersion = manifest.catalogVersion;
  const catalogHash = manifest.catalogHash;
  const catalogUrl = manifest.catalogUrl;

  if (
    typeof catalogVersion !== 'string' ||
    typeof catalogHash !== 'string' ||
    typeof catalogUrl !== 'string'
  ) {
    throw new Error('菜单版本响应无效');
  }

  return {
    catalogVersion,
    catalogHash,
    catalogUrl,
    counts: parseCatalogCounts(value),
  };
}

export function parseCatalogSelection(
  value: unknown,
  manifest: { catalogVersion: string; catalogHash: string },
  datasetType: CatalogDatasetType,
  baseUrl: string,
): CatalogSelection {
  if (!value || typeof value !== 'object') throw new Error('菜单数据响应无效');
  const catalog = value as { catalogVersion?: unknown; items?: unknown };
  if (catalog.catalogVersion !== manifest.catalogVersion || !Array.isArray(catalog.items)) {
    throw new Error('菜单数据响应无效');
  }

  const items = catalog.items
    .filter(isCatalogItem)
    .filter((item) => item.datasetType === datasetType)
    .sort((left, right) => left.order - right.order)
    .map((item) => ({ ...item, imageUrl: resolveCatalogUrl(baseUrl, item.imageUrl) }));

  return { ...manifest, datasetType, items };
}

export function loadCatalogCounts(baseUrl: string): Promise<CatalogCounts> {
  return loadManifest(baseUrl).then((manifest) => manifest.counts);
}

export function loadCatalogSelection(
  baseUrl: string,
  datasetType: CatalogDatasetType,
): Promise<CatalogSelection> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return Promise.reject(new Error('未配置后端地址'));

  return loadManifest(normalizedBaseUrl).then((manifest) =>
    loadCatalogDocument(normalizedBaseUrl, manifest)
      .then((document) => parseCatalogSelection(document, manifest, datasetType, normalizedBaseUrl)));
}

export function resolveCatalogUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return path.startsWith('/') ? `${normalizedBaseUrl}${path}` : `${normalizedBaseUrl}/${path}`;
}

function requestJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('菜单数据加载失败'));
          return;
        }
        resolve(response.data);
      },
      fail(error) {
        reject(new Error(error.errMsg || '菜单数据加载失败'));
      },
    });
  });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}

function isCatalogItem(value: unknown): value is CatalogItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CatalogItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.description === 'string' &&
    typeof item.imageUrl === 'string' &&
    (item.datasetType === 'large' || item.datasetType === 'small') &&
    typeof item.order === 'number' &&
    Array.isArray(item.tags) &&
    Array.isArray(item.representativeFoods)
  );
}

export function loadCatalog(baseUrl: string): Promise<CatalogSnapshot> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return Promise.reject(new Error('未配置后端地址'));

  return loadManifest(normalizedBaseUrl).then((manifest) =>
    loadCatalogDocument(normalizedBaseUrl, manifest).then((document) => {
      const large = parseCatalogSelection(document, manifest, 'large', normalizedBaseUrl).items;
      const small = parseCatalogSelection(document, manifest, 'small', normalizedBaseUrl).items;
      return {
        catalogVersion: manifest.catalogVersion,
        catalogHash: manifest.catalogHash,
        items: [...large, ...small].sort((left, right) => left.order - right.order),
      };
    }));
}

async function loadManifest(baseUrl: string): Promise<ReturnType<typeof parseCatalogManifest>> {
  try {
    const manifest = parseCatalogManifest(await requestJson(`${baseUrl}/api/catalog/manifest`));
    writeStorage(CATALOG_MANIFEST_STORAGE_KEY, manifest);
    return manifest;
  } catch (cause) {
    const cached = readStorage(CATALOG_MANIFEST_STORAGE_KEY);
    if (cached) return parseCatalogManifest(cached);
    throw cause instanceof Error ? cause : new Error('菜单版本加载失败');
  }
}

async function loadCatalogDocument(
  baseUrl: string,
  manifest: ReturnType<typeof parseCatalogManifest>,
): Promise<{ catalogVersion: string; catalogHash: string; items: unknown[] }> {
  const cacheKey = `${CATALOG_STORAGE_KEY_PREFIX}${manifest.catalogHash}`;
  const cached = readStorage(cacheKey);
  if (cached) {
    const parsed = parseCachedCatalog(cached, manifest);
    if (parsed) return parsed;
  }

  const document = parseCatalogDocument(await requestJson(resolveCatalogUrl(baseUrl, manifest.catalogUrl)), manifest);
  writeStorage(cacheKey, document);
  return document;
}

function parseCatalogDocument(
  value: unknown,
  manifest: { catalogVersion: string; catalogHash: string },
): { catalogVersion: string; catalogHash: string; items: unknown[] } {
  if (!value || typeof value !== 'object') throw new Error('菜单数据响应无效');
  const document = value as { catalogVersion?: unknown; items?: unknown };
  if (document.catalogVersion !== manifest.catalogVersion || !Array.isArray(document.items)) {
    throw new Error('菜单数据响应无效');
  }
  return {
    catalogVersion: manifest.catalogVersion,
    catalogHash: manifest.catalogHash,
    items: document.items,
  };
}

function parseCachedCatalog(
  value: unknown,
  manifest: { catalogVersion: string; catalogHash: string },
): { catalogVersion: string; catalogHash: string; items: unknown[] } | null {
  try {
    return parseCatalogDocument(value, manifest);
  } catch {
    return null;
  }
}

function readStorage(key: string): unknown {
  try {
    const raw = wx.getStorageSync(key);
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  wx.setStorageSync(key, JSON.stringify(value));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
