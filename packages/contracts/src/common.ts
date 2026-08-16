import { z } from 'zod';

export const UuidSchema = z.string().uuid();
export const RevisionSchema = z.number().int().nonnegative();
export const DatasetTypeSchema = z.enum(['large', 'small']);
export const RoomDatasetTypeSchema = z.enum(['large', 'small', 'custom']);
export const DecisionSchema = z.enum(['liked', 'disliked']);
export const RoomStatusSchema = z.enum(['waiting', 'playing', 'results']);
export const RoundStatusSchema = z.enum(['playing', 'completed']);
export const RoundMemberStatusSchema = z.enum(['choosing', 'completed', 'removed']);

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  latest: z.unknown().optional(),
}).strict();

export type DatasetType = z.infer<typeof DatasetTypeSchema>;
export type RoomDatasetType = z.infer<typeof RoomDatasetTypeSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type RoomStatus = z.infer<typeof RoomStatusSchema>;
export type RoundStatus = z.infer<typeof RoundStatusSchema>;
export type RoundMemberStatus = z.infer<typeof RoundMemberStatusSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
