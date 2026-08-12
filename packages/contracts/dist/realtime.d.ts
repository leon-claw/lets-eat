import { z } from 'zod';
export declare const ClientAuthMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"auth">;
    token: z.ZodString;
    roomId: z.ZodString;
}, z.core.$strict>;
export declare const ServerAuthOkMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"auth.ok">;
    roomId: z.ZodString;
}, z.core.$strict>;
export declare const RoomUpdatedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.updated">;
}, z.core.$strict>;
export declare const RoundStartedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.started">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const MemberProgressedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"member.progressed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const RoundCompletedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.completed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const RoomClosedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.closed">;
}, z.core.$strict>;
export declare const ServerEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.updated">;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.started">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"member.progressed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.completed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.closed">;
}, z.core.$strict>], "type">;
export declare const ServerMessageSchema: z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"auth.ok">;
    roomId: z.ZodString;
}, z.core.$strict>, z.ZodDiscriminatedUnion<[z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.updated">;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.started">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"member.progressed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"round.completed">;
    roundId: z.ZodString;
    roundRevision: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    eventId: z.ZodString;
    roomId: z.ZodString;
    roomRevision: z.ZodNumber;
    roundId: z.ZodOptional<z.ZodString>;
    roundRevision: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodString;
    type: z.ZodLiteral<"room.closed">;
}, z.core.$strict>], "type">]>;
export type ClientAuthMessage = z.infer<typeof ClientAuthMessageSchema>;
export type ServerAuthOkMessage = z.infer<typeof ServerAuthOkMessageSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
