import {
  loadCatalog,
  type CatalogItem,
  type CatalogSelection,
} from './wx-catalog';

const IMAGE_CACHE_STORAGE_KEY = 'lets-eat.miniprogram.catalog-image-cache.v1';
const IMAGE_FILE_PREFIX = 'lets-eat-catalog-image-';
const IMAGE_FILE_SUFFIX = '.webp';
const PRELOAD_CONCURRENCY = 4;

interface ImageCacheRecord {
  catalogHash: string;
  files: Record<string, string>;
}

const inFlightDownloads = new Map<string, Promise<string | null>>();

/**
 * 在应用启动时后台准备完整的内置菜品图片缓存。
 * 预加载失败不会影响应用启动，进入游戏时仍会使用远程地址兜底。
 */
export async function preloadCatalogImages(baseUrl: string): Promise<void> {
  const catalog = await loadCatalog(baseUrl);
  await hydrateCatalogItems(baseUrl, catalog.items, catalog.catalogHash);
}

/**
 * 将一组菜单中的图片替换为本地文件路径；下载失败时保留原始远程地址。
 */
export async function hydrateCatalogSelectionImages(
  baseUrl: string,
  selection: CatalogSelection,
): Promise<CatalogSelection> {
  const items = await hydrateCatalogItems(baseUrl, selection.items, selection.catalogHash);
  return { ...selection, items };
}

async function hydrateCatalogItems(
  baseUrl: string,
  items: CatalogItem[],
  catalogHash: string,
): Promise<CatalogItem[]> {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '');
  if (!normalizedBaseUrl || !catalogHash || !getUserDataPath() || items.length === 0) return items;

  const hydrated = items.slice();
  await runWithConcurrency(hydrated, PRELOAD_CONCURRENCY, async (item, index) => {
    const localPath = await getOrDownloadImage(normalizedBaseUrl, item, catalogHash);
    if (localPath) hydrated[index] = { ...item, imageUrl: localPath };
  });
  return hydrated;
}

async function getOrDownloadImage(
  baseUrl: string,
  item: CatalogItem,
  catalogHash: string,
): Promise<string | null> {
  if (isLocalImagePath(item.imageUrl)) return item.imageUrl;

  const downloadKey = `${catalogHash}:${item.id}`;
  const existing = inFlightDownloads.get(downloadKey);
  if (existing) return existing;

  const operation = getCachedOrDownloadImage(baseUrl, item, catalogHash)
    .finally(() => {
      inFlightDownloads.delete(downloadKey);
    });
  inFlightDownloads.set(downloadKey, operation);
  return operation;
}

async function getCachedOrDownloadImage(
  baseUrl: string,
  item: CatalogItem,
  catalogHash: string,
): Promise<string | null> {
  const filePath = getImageFilePath(item.id);
  const cache = readImageCache(catalogHash);
  const cachedPath = cache.files[item.id];
  if (cachedPath && await fileExists(cachedPath)) return cachedPath;
  if (cachedPath) {
    delete cache.files[item.id];
    writeImageCache(cache);
  }

  return downloadImage(resolveImageUrl(baseUrl, item.imageUrl), filePath)
    .then((localPath) => {
      if (!localPath) return null;
      const latestCache = readImageCache(catalogHash);
      latestCache.files[item.id] = localPath;
      writeImageCache(latestCache);
      return localPath;
    })
    .catch(() => null);
}

function resolveImageUrl(baseUrl: string, imageUrl: string): string {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  return imageUrl.startsWith('/') ? `${baseUrl}${imageUrl}` : `${baseUrl}/${imageUrl}`;
}

function getImageFilePath(itemId: string): string {
  const safeItemId = encodeURIComponent(itemId);
  return `${getUserDataPath()}/${IMAGE_FILE_PREFIX}${safeItemId}${IMAGE_FILE_SUFFIX}`;
}

function isLocalImagePath(imageUrl: string): boolean {
  const userDataPath = getUserDataPath();
  return imageUrl.startsWith('wxfile://') || Boolean(userDataPath && imageUrl.startsWith(userDataPath));
}

function getUserDataPath(): string {
  try {
    return typeof wx.env?.USER_DATA_PATH === 'string' ? wx.env.USER_DATA_PATH : '';
  } catch {
    return '';
  }
}

function fileExists(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      wx.getFileSystemManager().access({
        path: filePath,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    } catch {
      resolve(false);
    }
  });
}

function downloadImage(url: string, filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      wx.downloadFile({
        url,
        filePath,
        timeout: 10000,
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.filePath || filePath);
            return;
          }
          resolve(null);
        },
        fail: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
}

function readImageCache(catalogHash: string): ImageCacheRecord {
  const empty: ImageCacheRecord = { catalogHash, files: {} };
  try {
    const stored = wx.getStorageSync(IMAGE_CACHE_STORAGE_KEY);
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    if (!parsed || typeof parsed !== 'object') return empty;
    const record = parsed as Partial<ImageCacheRecord>;
    if (record.catalogHash !== catalogHash || !record.files || typeof record.files !== 'object') {
      return empty;
    }
    return { catalogHash, files: { ...record.files } };
  } catch {
    return empty;
  }
}

function writeImageCache(cache: ImageCacheRecord): void {
  try {
    wx.setStorageSync(IMAGE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 本地存储空间不足时仍保留当前下载结果，下一次进入游戏会重新校验/下载。
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
}
