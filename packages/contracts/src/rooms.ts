import { z } from 'zod';
import {
  RoomDatasetTypeSchema,
  RevisionSchema,
  RoomStatusSchema,
  UuidSchema,
} from './common.js';

export const CustomCatalogInputSchema = z.object({
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  itemIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(3),
}).strict();

export const CustomCatalogSummarySchema = z.object({
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  selectionHash: z.string().regex(/^[a-f0-9]{64}$/),
  itemCount: z.number().int().positive(),
}).strict();

export const CustomCatalogSnapshotSchema = CustomCatalogInputSchema.extend({
  selectionHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const RoomMemberSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  displayName: z.string().trim().min(1).max(24),
  role: z.enum(['host', 'guest']),
  joinedAt: z.string().datetime(),
}).strict();

export const RoomSnapshotSchema = z.object({
  id: UuidSchema,
  code: z.string().regex(/^\d{8}$/),
  hostUserId: UuidSchema,
  selectedDataset: RoomDatasetTypeSchema,
  customCatalog: CustomCatalogSummarySchema.nullable().default(null),
  status: RoomStatusSchema,
  currentRoundId: UuidSchema.nullable(),
  revision: RevisionSchema,
  members: z.array(RoomMemberSchema).min(1).max(8),
}).strict();

export const CurrentRoomResponseSchema = z.object({
  room: RoomSnapshotSchema.nullable(),
}).strict();

export const CreateRoomRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(24),
  customCatalog: CustomCatalogInputSchema.optional(),
}).strict();

export const JoinRoomRequestSchema = z.object({
  code: z.string().regex(/^\d{8}$/),
  displayName: z.string().trim().min(1).max(24),
}).strict();

export const ChangeDatasetRequestSchema = z.object({
  datasetType: RoomDatasetTypeSchema,
  expectedRevision: RevisionSchema,
}).strict();

export const OpenNextRoundRequestSchema = z.object({
  expectedRoomRevision: RevisionSchema,
}).strict();

export const RoomEntryResponseSchema = z.object({
  room: RoomSnapshotSchema,
  customCatalog: CustomCatalogSnapshotSchema.nullable(),
}).strict();

export const CreateRoomResponseSchema = RoomEntryResponseSchema;
export const JoinRoomResponseSchema = RoomEntryResponseSchema;
export const GetRoomResponseSchema = RoomSnapshotSchema;
export const ChangeDatasetResponseSchema = RoomSnapshotSchema;
export const OpenNextRoundResponseSchema = RoomSnapshotSchema;

export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type CustomCatalogInput = z.infer<typeof CustomCatalogInputSchema>;
export type CustomCatalogSummary = z.infer<typeof CustomCatalogSummarySchema>;
export type CustomCatalogSnapshot = z.infer<typeof CustomCatalogSnapshotSchema>;
export type RoomEntryResponse = z.infer<typeof RoomEntryResponseSchema>;
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;
export type CurrentRoomResponse = z.infer<typeof CurrentRoomResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ChangeDatasetRequest = z.infer<typeof ChangeDatasetRequestSchema>;
export type OpenNextRoundRequest = z.infer<typeof OpenNextRoundRequestSchema>;
