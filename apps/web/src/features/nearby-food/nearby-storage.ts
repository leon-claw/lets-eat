import type {
  AmapConfig,
  GeoPoint,
  NearbyRestaurant,
  NearbyRoundSession,
  NearbySearchSession,
} from './types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const AMAP_CONFIG_KEY = 'lets-eat.amap-config.v1';
export const LAST_LOCATION_KEY = 'lets-eat.nearby-location.v1';
export const SEARCH_SESSION_KEY = 'lets-eat.nearby-search-session.v1';
export const ROUND_SESSION_KEY = 'lets-eat.nearby-round.v1';

function defaultStorage(kind: 'local' | 'session'): StorageLike {
  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isGeoPoint(value: unknown): value is GeoPoint {
  return isRecord(value)
    && typeof value.longitude === 'number'
    && Number.isFinite(value.longitude)
    && typeof value.latitude === 'number'
    && Number.isFinite(value.latitude);
}

function isNearbyRestaurant(value: unknown): value is NearbyRestaurant {
  if (!isRecord(value) || value.source !== 'amap') return false;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isNonEmptyString(value.type)) return false;
  if (!isNonEmptyString(value.fetchedAt)) return false;
  if (value.typeCode !== undefined && typeof value.typeCode !== 'string') return false;
  if (value.categoryPath !== undefined && (!Array.isArray(value.categoryPath) || !value.categoryPath.every((item) => typeof item === 'string'))) return false;
  if (value.location !== undefined && !isGeoPoint(value.location)) return false;
  if (value.entranceLocation !== undefined && !isGeoPoint(value.entranceLocation)) return false;
  if (value.distanceMeters !== undefined && (typeof value.distanceMeters !== 'number' || !Number.isFinite(value.distanceMeters))) return false;

  for (const field of ['address', 'province', 'provinceCode', 'city', 'cityCode', 'district', 'districtCode', 'businessArea', 'telephone', 'website', 'email', 'businessHours', 'businessStatus']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') return false;
  }
  return true;
}

function isAmapConfig(value: unknown): value is AmapConfig {
  return isRecord(value) && isNonEmptyString(value.key) && isNonEmptyString(value.securityJsCode);
}

function isSearchSession(value: unknown): value is NearbySearchSession {
  return isRecord(value)
    && isGeoPoint(value.center)
    && typeof value.radiusMeters === 'number'
    && Number.isFinite(value.radiusMeters)
    && value.radiusMeters > 0
    && Array.isArray(value.restaurants)
    && value.restaurants.length <= 20
    && value.restaurants.every(isNearbyRestaurant)
    && isNonEmptyString(value.searchedAt);
}

function isDecision(value: unknown): value is 'liked' | 'disliked' {
  return value === 'liked' || value === 'disliked';
}

function isRoundSession(value: unknown): value is NearbyRoundSession {
  if (!isRecord(value) || !Array.isArray(value.restaurants) || value.restaurants.length > 20 || !value.restaurants.every(isNearbyRestaurant)) return false;
  if (!Array.isArray(value.itemIds) || !value.itemIds.every((item) => typeof item === 'string')) return false;
  if (!isRecord(value.decisions) || !Object.values(value.decisions).every(isDecision)) return false;
  if (!Array.isArray(value.history) || !value.history.every((item) => typeof item === 'string')) return false;
  return value.completedAt === null || isNonEmptyString(value.completedAt);
}

function createJsonStore<T>(storage: StorageLike, key: string, validate: (value: unknown) => value is T) {
  return {
    load(): T | null {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        return validate(value) ? value : null;
      } catch {
        return null;
      }
    },
    save(value: T): void {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '存储写入失败';
        throw new Error(`附近数据保存失败：${message}`);
      }
    },
    clear(): void {
      storage.removeItem(key);
    },
  };
}

export function createNearbyConfigStore(storage: StorageLike = defaultStorage('local')) {
  return createJsonStore(storage, AMAP_CONFIG_KEY, isAmapConfig);
}

export function createNearbyLocationStore(storage: StorageLike = defaultStorage('local')) {
  return createJsonStore(storage, LAST_LOCATION_KEY, isGeoPoint);
}

export function createNearbySearchSessionStore(storage: StorageLike = defaultStorage('session')) {
  const store = createJsonStore(storage, SEARCH_SESSION_KEY, isSearchSession);
  return {
    ...store,
    save(value: NearbySearchSession): void {
      store.save({ ...value, restaurants: value.restaurants.slice(0, 20) });
    },
  };
}

export function createNearbyRoundStore(storage: StorageLike = defaultStorage('session')) {
  const store = createJsonStore(storage, ROUND_SESSION_KEY, isRoundSession);
  return {
    ...store,
    save(value: NearbyRoundSession): void {
      store.save({ ...value, restaurants: value.restaurants.slice(0, 20) });
    },
  };
}
