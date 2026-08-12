import { z } from 'zod';
export const UuidSchema = z.string().uuid();
export const RevisionSchema = z.number().int().nonnegative();
export const DatasetTypeSchema = z.enum(['large', 'small']);
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
