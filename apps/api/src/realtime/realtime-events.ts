import { randomUUID } from 'node:crypto';
import type { ServerEvent } from '@lets-eat/contracts';

export type RealtimeEventInput = Omit<ServerEvent, 'eventId' | 'occurredAt'> & {
  occurredAt?: string;
};

export function createRealtimeEvent(input: RealtimeEventInput): ServerEvent {
  return {
    ...input,
    eventId: randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  } as ServerEvent;
}
