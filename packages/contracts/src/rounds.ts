import { z } from 'zod';
import {
  RoomDatasetTypeSchema,
  DecisionSchema,
  RevisionSchema,
  RoundMemberStatusSchema,
  RoundStatusSchema,
  UuidSchema,
} from './common.js';
import { CustomCatalogSummarySchema } from './rooms.js';

export const StartRoundRequestSchema = z.object({
  expectedRoomRevision: RevisionSchema,
}).strict();

export const CompleteRoundRequestSchema = z.object({
  expectedRoundRevision: RevisionSchema,
}).strict();

export const RemoveRoundMemberRequestSchema = z.object({
  expectedRoundRevision: RevisionSchema,
}).strict();

export const PutDecisionRequestSchema = z.object({
  decision: DecisionSchema,
}).strict();

export const OwnDecisionSchema = z.object({
  catalogItemId: z.string().min(1),
  decision: DecisionSchema,
  updatedAt: z.string().datetime(),
}).strict();

export const RoundMemberSchema = z.object({
  memberId: UuidSchema,
  displayName: z.string().trim().min(1).max(24),
  status: RoundMemberStatusSchema,
  isSelf: z.boolean(),
  role: z.enum(['host', 'guest']),
}).strict();

export const RoundSnapshotSchema = z.object({
  id: UuidSchema,
  roomId: UuidSchema,
  sequence: z.number().int().positive(),
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  datasetType: RoomDatasetTypeSchema,
  customCatalog: CustomCatalogSummarySchema.nullable().optional(),
  status: RoundStatusSchema,
  revision: RevisionSchema,
  members: z.array(RoundMemberSchema).min(1).max(8),
  ownDecisions: z.array(OwnDecisionSchema),
}).strict();

export const ResultItemSchema = z.object({
  catalogItemId: z.string().min(1),
  order: z.number().int().positive(),
}).strict();

export const ResultPlayerSchema = z.object({
  memberId: UuidSchema,
  displayName: z.string().trim().min(1).max(24),
  items: z.array(ResultItemSchema),
}).strict();

export const RoundResultSchema = z.object({
  roundId: UuidSchema,
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  datasetType: RoomDatasetTypeSchema,
  customCatalog: CustomCatalogSummarySchema.nullable().optional(),
  commonItems: z.array(ResultItemSchema),
  players: z.array(ResultPlayerSchema).max(8),
}).strict();

export const StartRoundResponseSchema = RoundSnapshotSchema;
export const GetRoundResponseSchema = RoundSnapshotSchema;
export const CompleteRoundResponseSchema = RoundSnapshotSchema;
export const RemoveRoundMemberResponseSchema = RoundSnapshotSchema;
export const GetRoundResultResponseSchema = RoundResultSchema;

export type StartRoundRequest = z.infer<typeof StartRoundRequestSchema>;
export type CompleteRoundRequest = z.infer<typeof CompleteRoundRequestSchema>;
export type RemoveRoundMemberRequest = z.infer<typeof RemoveRoundMemberRequestSchema>;
export type PutDecisionRequest = z.infer<typeof PutDecisionRequestSchema>;
export type OwnDecision = z.infer<typeof OwnDecisionSchema>;
export type RoundMember = z.infer<typeof RoundMemberSchema>;
export type RoundSnapshot = z.infer<typeof RoundSnapshotSchema>;
export type ResultItem = z.infer<typeof ResultItemSchema>;
export type ResultPlayer = z.infer<typeof ResultPlayerSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
