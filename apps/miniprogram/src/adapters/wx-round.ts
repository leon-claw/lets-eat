import { clearAnonymousIdentity, loadOrCreateAnonymousIdentity } from './wx-auth';
import { createRequestId, requestJson, WxApiError } from './wx-http';

export type RoundDatasetType = 'large' | 'small' | 'custom';
export type RoundStatus = 'playing' | 'completed';
export type RoundMemberStatus = 'choosing' | 'completed' | 'removed';
export type RoundDecision = 'liked' | 'disliked';

export interface RoundMemberSnapshot {
  memberId: string;
  displayName: string;
  status: RoundMemberStatus;
  isSelf: boolean;
  role: 'host' | 'guest';
}

export interface RoundDecisionSnapshot {
  catalogItemId: string;
  decision: RoundDecision;
  updatedAt: string;
}

export interface RoundSnapshot {
  id: string;
  roomId: string;
  sequence: number;
  catalogVersion: string;
  catalogHash: string;
  datasetType: RoundDatasetType;
  customCatalog: { itemCount: number } | null;
  status: RoundStatus;
  revision: number;
  members: RoundMemberSnapshot[];
  ownDecisions: RoundDecisionSnapshot[];
}

export interface RoundResultItem {
  catalogItemId: string;
  order: number;
}

export interface RoundResultPlayer {
  memberId: string;
  displayName: string;
  items: RoundResultItem[];
}

export interface RoundResult {
  roundId: string;
  catalogVersion: string;
  catalogHash: string;
  datasetType: RoundDatasetType;
  commonItems: RoundResultItem[];
  players: RoundResultPlayer[];
}

export async function getRound(baseUrl: string, roundId: string): Promise<RoundSnapshot> {
  return withIdentity(baseUrl, (identity) => requestJson<unknown>(baseUrl, `/api/rounds/${roundId}`, {
    token: identity.token,
  }).then(parseRoundSnapshot));
}

export async function putRoundDecision(
  baseUrl: string,
  roundId: string,
  catalogItemId: string,
  decision: RoundDecision,
): Promise<void> {
  await withIdentity(baseUrl, (identity) => requestJson(baseUrl, `/api/rounds/${roundId}/decisions/${catalogItemId}`, {
    method: 'PUT',
    token: identity.token,
    body: { decision },
  }));
}

export async function deleteRoundDecision(baseUrl: string, roundId: string, catalogItemId: string): Promise<void> {
  await withIdentity(baseUrl, (identity) => requestJson(baseUrl, `/api/rounds/${roundId}/decisions/${catalogItemId}`, {
    method: 'DELETE',
    token: identity.token,
  }));
}

export async function completeRound(baseUrl: string, round: RoundSnapshot): Promise<RoundSnapshot> {
  return withIdentity(baseUrl, (identity) => requestJson<unknown>(baseUrl, `/api/rounds/${round.id}/complete`, {
    method: 'POST',
    token: identity.token,
    body: { expectedRoundRevision: round.revision },
    idempotencyKey: createRequestId(),
  }).then(parseRoundSnapshot));
}

export async function getRoundResult(baseUrl: string, roundId: string): Promise<RoundResult> {
  return withIdentity(baseUrl, (identity) => requestJson<unknown>(baseUrl, `/api/rounds/${roundId}/result`, {
    token: identity.token,
  }).then(parseRoundResult));
}

async function withIdentity<T>(baseUrl: string, operation: (identity: Awaited<ReturnType<typeof loadOrCreateAnonymousIdentity>>) => Promise<T>): Promise<T> {
  let identity = await loadOrCreateAnonymousIdentity(baseUrl);
  try {
    return await operation(identity);
  } catch (cause) {
    if (!(cause instanceof WxApiError) || cause.status !== 401) throw cause;
    clearAnonymousIdentity();
    identity = await loadOrCreateAnonymousIdentity(baseUrl);
    return operation(identity);
  }
}

export function parseRoundSnapshot(value: unknown): RoundSnapshot {
  if (!value || typeof value !== 'object') throw new Error('轮次数据响应无效');
  const record = value as Record<string, unknown>;
  const members = Array.isArray(record.members) ? record.members.filter(isRoundMember) : null;
  const ownDecisions = Array.isArray(record.ownDecisions) ? record.ownDecisions.filter(isRoundDecision) : null;
  const customCatalog = parseCustomCatalog(record.customCatalog);
  if (
    typeof record.id !== 'string' ||
    typeof record.roomId !== 'string' ||
    typeof record.sequence !== 'number' ||
    typeof record.catalogVersion !== 'string' ||
    typeof record.catalogHash !== 'string' ||
    (record.datasetType !== 'large' && record.datasetType !== 'small' && record.datasetType !== 'custom') ||
    (record.status !== 'playing' && record.status !== 'completed') ||
    typeof record.revision !== 'number' ||
    !members ||
    !ownDecisions
  ) {
    throw new Error('轮次数据响应无效');
  }
  return {
    id: record.id,
    roomId: record.roomId,
    sequence: record.sequence,
    catalogVersion: record.catalogVersion,
    catalogHash: record.catalogHash,
    datasetType: record.datasetType,
    customCatalog,
    status: record.status,
    revision: record.revision,
    members,
    ownDecisions,
  };
}

export function parseRoundResult(value: unknown): RoundResult {
  if (!value || typeof value !== 'object') throw new Error('结果数据响应无效');
  const record = value as Record<string, unknown>;
  const commonItems = Array.isArray(record.commonItems) ? record.commonItems.filter(isRoundResultItem) : null;
  const players = Array.isArray(record.players) ? record.players.filter(isRoundResultPlayer) : null;
  if (
    typeof record.roundId !== 'string' ||
    typeof record.catalogVersion !== 'string' ||
    typeof record.catalogHash !== 'string' ||
    (record.datasetType !== 'large' && record.datasetType !== 'small' && record.datasetType !== 'custom') ||
    !commonItems ||
    !players
  ) {
    throw new Error('结果数据响应无效');
  }
  return {
    roundId: record.roundId,
    catalogVersion: record.catalogVersion,
    catalogHash: record.catalogHash,
    datasetType: record.datasetType,
    commonItems,
    players,
  };
}

function isRoundMember(value: unknown): value is RoundMemberSnapshot {
  if (!value || typeof value !== 'object') return false;
  const member = value as Partial<RoundMemberSnapshot>;
  return (
    typeof member.memberId === 'string' &&
    typeof member.displayName === 'string' &&
    (member.status === 'choosing' || member.status === 'completed' || member.status === 'removed') &&
    typeof member.isSelf === 'boolean' &&
    (member.role === 'host' || member.role === 'guest')
  );
}

function isRoundDecision(value: unknown): value is RoundDecisionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const decision = value as Partial<RoundDecisionSnapshot>;
  return (
    typeof decision.catalogItemId === 'string' &&
    (decision.decision === 'liked' || decision.decision === 'disliked') &&
    typeof decision.updatedAt === 'string'
  );
}

function isRoundResultItem(value: unknown): value is RoundResultItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RoundResultItem>;
  return typeof item.catalogItemId === 'string' && typeof item.order === 'number';
}

function isRoundResultPlayer(value: unknown): value is RoundResultPlayer {
  if (!value || typeof value !== 'object') return false;
  const player = value as Partial<RoundResultPlayer>;
  return (
    typeof player.memberId === 'string' &&
    typeof player.displayName === 'string' &&
    Array.isArray(player.items) &&
    player.items.every(isRoundResultItem)
  );
}

function parseCustomCatalog(value: unknown): { itemCount: number } | null {
  if (!value || typeof value !== 'object') return null;
  const itemCount = (value as Record<string, unknown>).itemCount;
  return typeof itemCount === 'number' && Number.isInteger(itemCount) && itemCount > 0 ? { itemCount } : null;
}
