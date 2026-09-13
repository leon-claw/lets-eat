import type { CatalogItem } from './wx-catalog';
import type { GameDecisionRecord } from '../pages/game/game-state';
import type {
  MiniAmapConfig,
  MiniGeoPoint,
  MiniNearbyRestaurant,
  MiniNearbyResultLimit,
  MiniNearbySearchSession,
} from '../features/nearby-food/types';

export const AMAP_CONFIG_STORAGE_KEY = 'lets-eat.miniprogram.amap-config.v1';
export const LAST_NEARBY_LOCATION_STORAGE_KEY = 'lets-eat.miniprogram.nearby-location.v1';
export const NEARBY_SEARCH_SESSION_STORAGE_KEY = 'lets-eat.miniprogram.nearby-search-session.v1';
export const NEARBY_ROUND_STORAGE_KEY = 'lets-eat.miniprogram.nearby-round.v1';

export interface StoredNearbyRound {
  choices: CatalogItem[];
  itemIds: string[];
  history: GameDecisionRecord[];
  restaurants: MiniNearbyRestaurant[];
  completedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPoint(value: unknown): value is MiniGeoPoint {
  return isRecord(value)
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude)
    && typeof value.latitude === 'number' && Number.isFinite(value.latitude);
}

function isRestaurant(value: unknown): value is MiniNearbyRestaurant {
  return isRecord(value)
    && value.source === 'amap'
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && typeof value.type === 'string'
    && isNonEmptyString(value.fetchedAt)
    && (value.rating === undefined || (typeof value.rating === 'number' && value.rating > 0 && value.rating <= 5))
    && (value.imageUrl === undefined || (typeof value.imageUrl === 'string' && /^https?:\/\//i.test(value.imageUrl)));
}

function isResultLimit(value: unknown): value is MiniNearbyResultLimit {
  return value === 10 || value === 20 || value === 30;
}

function isCatalogItem(value: unknown): value is CatalogItem {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && typeof value.description === 'string'
    && typeof value.imageUrl === 'string'
    && value.datasetType === 'large'
    && typeof value.order === 'number'
    && Array.isArray(value.tags) && value.tags.every((item) => typeof item === 'string')
    && Array.isArray(value.representativeFoods) && value.representativeFoods.every((item) => typeof item === 'string');
}

function isDecision(value: unknown): value is GameDecisionRecord {
  return isRecord(value)
    && isNonEmptyString(value.choiceId)
    && (value.decision === 'liked' || value.decision === 'disliked');
}

function readValue<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const stored = wx.getStorageSync(key);
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeValue(key: string, value: unknown): void {
  wx.setStorageSync(key, JSON.stringify(value));
}

export function readAmapConfig(): MiniAmapConfig | null {
  return readValue(AMAP_CONFIG_STORAGE_KEY, (value): value is MiniAmapConfig =>
    isRecord(value) && isNonEmptyString(value.key) && isNonEmptyString(value.securityJsCode));
}

export function saveAmapConfig(config: MiniAmapConfig): void {
  if (!config.key.trim() || !config.securityJsCode.trim()) throw new Error('请填写高德 Key 和 securityJsCode');
  writeValue(AMAP_CONFIG_STORAGE_KEY, { key: config.key.trim(), securityJsCode: config.securityJsCode.trim() });
}

export function clearAmapConfig(): void {
  wx.removeStorageSync(AMAP_CONFIG_STORAGE_KEY);
}

export function readNearbyLocation(): MiniGeoPoint | null {
  return readValue(LAST_NEARBY_LOCATION_STORAGE_KEY, isPoint);
}

export function saveNearbyLocation(location: MiniGeoPoint): void {
  if (!isPoint(location)) throw new Error('附近位置无效');
  writeValue(LAST_NEARBY_LOCATION_STORAGE_KEY, location);
}

function isSearchSession(value: unknown): value is MiniNearbySearchSession {
  return isRecord(value)
    && isPoint(value.center)
    && typeof value.radiusMeters === 'number' && value.radiusMeters > 0
    && isResultLimit(value.resultLimit)
    && isNonEmptyString(value.searchedAt)
    && Array.isArray(value.restaurants) && value.restaurants.length <= 30 && value.restaurants.every(isRestaurant)
    && Array.isArray(value.candidateRestaurants) && value.candidateRestaurants.length <= 200 && value.candidateRestaurants.every(isRestaurant);
}

export function readNearbySearchSession(): MiniNearbySearchSession | null {
  return readValue(NEARBY_SEARCH_SESSION_STORAGE_KEY, isSearchSession);
}

export function saveNearbySearchSession(session: MiniNearbySearchSession): void {
  writeValue(NEARBY_SEARCH_SESSION_STORAGE_KEY, {
    ...session,
    restaurants: session.restaurants.slice(0, 30),
    candidateRestaurants: session.candidateRestaurants.slice(0, 200),
  });
}

export function clearNearbySearchSession(): void {
  wx.removeStorageSync(NEARBY_SEARCH_SESSION_STORAGE_KEY);
}

function isNearbyRound(value: unknown): value is StoredNearbyRound {
  return isRecord(value)
    && Array.isArray(value.choices) && value.choices.length >= 1 && value.choices.every(isCatalogItem)
    && Array.isArray(value.itemIds) && value.itemIds.length === value.choices.length && value.itemIds.every(isNonEmptyString)
    && Array.isArray(value.history) && value.history.every(isDecision)
    && Array.isArray(value.restaurants) && value.restaurants.length <= 30 && value.restaurants.every(isRestaurant)
    && (value.completedAt === null || isNonEmptyString(value.completedAt));
}

export function readStoredNearbyRound(): StoredNearbyRound | null {
  return readValue(NEARBY_ROUND_STORAGE_KEY, isNearbyRound);
}

export function saveStoredNearbyRound(round: StoredNearbyRound): void {
  writeValue(NEARBY_ROUND_STORAGE_KEY, {
    ...round,
    choices: round.choices.filter((choice) => choice.datasetType === 'large'),
    restaurants: round.restaurants.slice(0, 30),
  });
}

export function clearStoredNearbyRound(): void {
  wx.removeStorageSync(NEARBY_ROUND_STORAGE_KEY);
}
