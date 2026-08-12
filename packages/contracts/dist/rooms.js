import { z } from 'zod';
import { DatasetTypeSchema, RevisionSchema, RoomStatusSchema, UuidSchema, } from './common.js';
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
    selectedDataset: DatasetTypeSchema,
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
}).strict();
export const JoinRoomRequestSchema = z.object({
    code: z.string().regex(/^\d{8}$/),
    displayName: z.string().trim().min(1).max(24),
    replaceCurrentRoom: z.boolean().default(false),
}).strict();
export const ChangeDatasetRequestSchema = z.object({
    datasetType: DatasetTypeSchema,
    expectedRevision: RevisionSchema,
}).strict();
export const OpenNextRoundRequestSchema = z.object({
    expectedRoomRevision: RevisionSchema,
}).strict();
export const CreateRoomResponseSchema = RoomSnapshotSchema;
export const JoinRoomResponseSchema = RoomSnapshotSchema;
export const GetRoomResponseSchema = RoomSnapshotSchema;
export const ChangeDatasetResponseSchema = RoomSnapshotSchema;
export const OpenNextRoundResponseSchema = RoomSnapshotSchema;
