import { z } from 'zod';
import { RevisionSchema, UuidSchema } from './common.js';

export const ClientAuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(1),
  roomId: UuidSchema,
}).strict();

export const ServerAuthOkMessageSchema = z.object({
  type: z.literal('auth.ok'),
  roomId: UuidSchema,
}).strict();

const EventBaseSchema = z.object({
  eventId: UuidSchema,
  roomId: UuidSchema,
  roomRevision: RevisionSchema,
  roundId: UuidSchema.optional(),
  roundRevision: RevisionSchema.optional(),
  occurredAt: z.string().datetime(),
});

export const RoomUpdatedEventSchema = EventBaseSchema.extend({
  type: z.literal('room.updated'),
}).strict();

export const RoundStartedEventSchema = EventBaseSchema.extend({
  type: z.literal('round.started'),
  roundId: UuidSchema,
  roundRevision: RevisionSchema,
}).strict();

export const MemberProgressedEventSchema = EventBaseSchema.extend({
  type: z.literal('member.progressed'),
  roundId: UuidSchema,
  roundRevision: RevisionSchema,
}).strict();

export const RoundCompletedEventSchema = EventBaseSchema.extend({
  type: z.literal('round.completed'),
  roundId: UuidSchema,
  roundRevision: RevisionSchema,
}).strict();

export const RoomClosedEventSchema = EventBaseSchema.extend({
  type: z.literal('room.closed'),
}).strict();

export const ServerEventSchema = z.discriminatedUnion('type', [
  RoomUpdatedEventSchema,
  RoundStartedEventSchema,
  MemberProgressedEventSchema,
  RoundCompletedEventSchema,
  RoomClosedEventSchema,
]);

export const ServerMessageSchema = z.union([
  ServerAuthOkMessageSchema,
  ServerEventSchema,
]);

export type ClientAuthMessage = z.infer<typeof ClientAuthMessageSchema>;
export type ServerAuthOkMessage = z.infer<typeof ServerAuthOkMessageSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
