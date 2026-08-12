import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const datasetTypeEnum = pgEnum('dataset_type', ['large', 'small']);
export const roomStatusEnum = pgEnum('room_status', ['waiting', 'playing', 'results']);
export const memberRoleEnum = pgEnum('member_role', ['host', 'guest']);
export const roundStatusEnum = pgEnum('round_status', ['playing', 'completed']);
export const roundMemberStatusEnum = pgEnum('round_member_status', ['choosing', 'completed', 'removed']);
export const decisionEnum = pgEnum('decision', ['liked', 'disliked']);

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  hostUserId: uuid('host_user_id').notNull(),
  selectedDataset: datasetTypeEnum('selected_dataset').notNull().default('large'),
  status: roomStatusEnum('status').notNull().default('waiting'),
  currentRoundId: uuid('current_round_id'),
  revision: integer('revision').notNull().default(0),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomMembers = pgTable('room_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: memberRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('room_members_room_user_unique').on(table.roomId, table.userId)]);

export const rounds = pgTable('rounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  catalogVersion: text('catalog_version').notNull(),
  catalogHash: text('catalog_hash').notNull(),
  datasetType: datasetTypeEnum('dataset_type').notNull(),
  status: roundStatusEnum('status').notNull().default('playing'),
  resultSnapshot: jsonb('result_snapshot'),
  revision: integer('revision').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [unique('rounds_room_sequence_unique').on(table.roomId, table.sequence)]);

export const roundMembers = pgTable('round_members', {
  roundId: uuid('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  roomMemberId: uuid('room_member_id').notNull().references(() => roomMembers.id, { onDelete: 'cascade' }),
  status: roundMemberStatusEnum('status').notNull().default('choosing'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.roundId, table.roomMemberId] })]);

export const decisions = pgTable('decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roundId: uuid('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  roomMemberId: uuid('room_member_id').notNull(),
  catalogItemId: text('catalog_item_id').notNull(),
  decision: decisionEnum('decision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('decisions_round_member_item_unique').on(table.roundId, table.roomMemberId, table.catalogItemId)]);

export const idempotencyRecords = pgTable('idempotency_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').notNull(),
  scope: text('scope').notNull(),
  key: text('key').notNull(),
  requestHash: text('request_hash').notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: jsonb('response_body').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [unique('idempotency_actor_scope_key_unique').on(table.actorUserId, table.scope, table.key)]);

export const roomRelations = relations(rooms, ({ many }) => ({ members: many(roomMembers), rounds: many(rounds) }));
export const roomMemberRelations = relations(roomMembers, ({ one, many }) => ({ room: one(rooms, { fields: [roomMembers.roomId], references: [rooms.id] }), rounds: many(roundMembers) }));
export const roundRelations = relations(rounds, ({ one, many }) => ({ room: one(rooms, { fields: [rounds.roomId], references: [rooms.id] }), members: many(roundMembers), decisions: many(decisions) }));
export const roundMemberRelations = relations(roundMembers, ({ one }) => ({ round: one(rounds, { fields: [roundMembers.roundId], references: [rounds.id] }), roomMember: one(roomMembers, { fields: [roundMembers.roomMemberId], references: [roomMembers.id] }) }));
export const decisionRelations = relations(decisions, ({ one }) => ({ round: one(rounds, { fields: [decisions.roundId], references: [rounds.id] }) }));

export const schema = { rooms, roomMembers, rounds, roundMembers, decisions, idempotencyRecords };
