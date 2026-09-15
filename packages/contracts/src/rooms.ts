import { z } from 'zod';
import {
  RoomDatasetTypeSchema,
  RevisionSchema,
  RoomStatusSchema,
  UuidSchema,
} from './common.js';

const CatalogVersionSchema = z.string().regex(/^v[1-9]\d*$/);
const CatalogHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const CatalogItemIdSchema = z.string().regex(/^[a-z0-9-]+$/);

const NearbyCatalogItemSchema = z.object({
  itemId: CatalogItemIdSchema,
  merchantNames: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
}).strict();

const UniqueStringArraySchema = z.array(CatalogItemIdSchema).min(1).max(24)
  .refine((values) => new Set(values).size === values.length, 'itemIds must be unique');

export const NearbyCatalogInputSchema = z.object({
  version: z.literal(1),
  catalogVersion: CatalogVersionSchema,
  catalogHash: CatalogHashSchema,
  classifierVersion: z.string().trim().min(1).max(64),
  itemIds: UniqueStringArraySchema,
  items: z.array(NearbyCatalogItemSchema).min(1).max(24)
    .refine((items) => new Set(items.map((item) => item.itemId)).size === items.length, 'items must be unique'),
  searchRadiusMeters: z.number().int().positive().max(50_000),
  candidateCount: z.number().int().nonnegative().max(200),
}).strict();

export const NearbyCatalogSnapshotSchema = NearbyCatalogInputSchema.extend({
  selectionHash: CatalogHashSchema,
  preparedAt: z.string().datetime(),
}).strict();

export const NearbyCatalogSummarySchema = z.object({
  selectionHash: CatalogHashSchema,
  catalogVersion: CatalogVersionSchema,
  categoryCount: z.number().int().nonnegative().max(24),
  merchantCount: z.number().int().nonnegative().max(200),
  preparedAt: z.string().datetime(),
}).strict();

export const SaveNearbyCatalogRequestSchema = z.object({
  expectedRevision: RevisionSchema,
  catalog: NearbyCatalogInputSchema,
}).strict();

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
  code: z.string().regex(/^\d{4}$/),
  hostUserId: UuidSchema,
  selectedDataset: RoomDatasetTypeSchema,
  customCatalog: CustomCatalogSummarySchema.nullable().default(null),
  nearbyCatalog: NearbyCatalogSummarySchema.nullable().default(null),
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
  datasetType: RoomDatasetTypeSchema,
  customCatalog: CustomCatalogInputSchema.optional(),
}).strict();

export const JoinRoomRequestSchema = z.object({
  code: z.string().regex(/^\d{4}$/),
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
  nearbyCatalog: NearbyCatalogSnapshotSchema.nullable().default(null),
}).strict();

export const CreateRoomResponseSchema = RoomEntryResponseSchema;
export const JoinRoomResponseSchema = RoomEntryResponseSchema;
export const SaveNearbyCatalogResponseSchema = RoomEntryResponseSchema;
export const GetRoomResponseSchema = RoomSnapshotSchema;
export const ChangeDatasetResponseSchema = RoomSnapshotSchema;
export const OpenNextRoundResponseSchema = RoomSnapshotSchema;

export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type CustomCatalogInput = z.infer<typeof CustomCatalogInputSchema>;
export type CustomCatalogSummary = z.infer<typeof CustomCatalogSummarySchema>;
export type CustomCatalogSnapshot = z.infer<typeof CustomCatalogSnapshotSchema>;
export type NearbyCatalogInput = z.infer<typeof NearbyCatalogInputSchema>;
export type NearbyCatalogSnapshot = z.infer<typeof NearbyCatalogSnapshotSchema>;
export type NearbyCatalogSummary = z.infer<typeof NearbyCatalogSummarySchema>;
export type SaveNearbyCatalogRequest = z.infer<typeof SaveNearbyCatalogRequestSchema>;
export type RoomEntryResponse = z.infer<typeof RoomEntryResponseSchema>;
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;
export type CurrentRoomResponse = z.infer<typeof CurrentRoomResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ChangeDatasetRequest = z.infer<typeof ChangeDatasetRequestSchema>;
export type OpenNextRoundRequest = z.infer<typeof OpenNextRoundRequestSchema>;
