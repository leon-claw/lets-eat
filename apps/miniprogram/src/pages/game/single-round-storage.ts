import type { CatalogDatasetType } from '../../adapters/wx-catalog';
import type { GameDecisionRecord } from './game-state';

export const SINGLE_ROUND_STORAGE_KEY = 'lets-eat.miniprogram.single-round.v1';

export interface StoredSingleRound {
  datasetType: CatalogDatasetType;
  catalogVersion: string;
  catalogHash: string;
  itemIds: string[];
  history: GameDecisionRecord[];
}

export function readStoredSingleRound(): StoredSingleRound | null {
  try {
    const raw = wx.getStorageSync(SINGLE_ROUND_STORAGE_KEY);
    if (!raw) return null;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    const stored = value as Partial<StoredSingleRound>;
    if (
      (stored.datasetType !== 'large' && stored.datasetType !== 'small') ||
      typeof stored.catalogVersion !== 'string' ||
      typeof stored.catalogHash !== 'string' ||
      !Array.isArray(stored.itemIds) ||
      !stored.itemIds.every((id): id is string => typeof id === 'string') ||
      !Array.isArray(stored.history) ||
      !stored.history.every(isStoredDecision)
    ) return null;
    return stored as StoredSingleRound;
  } catch {
    return null;
  }
}

export function saveStoredSingleRound(stored: StoredSingleRound): void {
  wx.setStorageSync(SINGLE_ROUND_STORAGE_KEY, JSON.stringify(stored));
}

export function clearStoredSingleRound(): void {
  wx.removeStorageSync(SINGLE_ROUND_STORAGE_KEY);
}

function isStoredDecision(value: unknown): value is GameDecisionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<GameDecisionRecord>;
  return (
    typeof record.choiceId === 'string' &&
    (record.decision === 'liked' || record.decision === 'disliked')
  );
}
