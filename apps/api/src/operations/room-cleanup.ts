import { lt } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { rooms } from '../db/schema.js';
import { createRealtimeEvent } from '../realtime/realtime-events.js';
import type { RealtimeHub } from '../realtime/realtime-hub.js';

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface DeletedRoom {
  id: string;
  revision: number;
}

interface RoomCleanupServiceOptions {
  db: Database;
  now?: () => Date;
}

export class RoomCleanupService {
  private readonly now: () => Date;

  constructor(private readonly options: RoomCleanupServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async deleteExpiredRooms(): Promise<DeletedRoom[]> {
    const cutoff = new Date(this.now().getTime() - ROOM_TTL_MS);
    return this.options.db
      .delete(rooms)
      .where(lt(rooms.lastActivityAt, cutoff))
      .returning({ id: rooms.id, revision: rooms.revision });
  }
}

interface RoomCleanupLogger {
  info(event: string, fields: Record<string, unknown>): void;
  error(event: string, fields: Record<string, unknown>): void;
}

interface RoomCleanupTaskOptions {
  cleanupService: Pick<RoomCleanupService, 'deleteExpiredRooms'>;
  realtimeHub?: Pick<RealtimeHub, 'publish'>;
  logger?: RoomCleanupLogger;
}

export class RoomCleanupTask {
  private readonly logger: RoomCleanupLogger;

  constructor(private readonly options: RoomCleanupTaskOptions) {
    this.logger = options.logger ?? consoleRoomCleanupLogger;
  }

  async runOnce(): Promise<number> {
    try {
      const deletedRooms = await this.options.cleanupService.deleteExpiredRooms();
      for (const room of deletedRooms) {
        this.options.realtimeHub?.publish(createRealtimeEvent({
          type: 'room.closed',
          roomId: room.id,
          roomRevision: room.revision,
        }));
      }
      this.logger.info('room.cleanup.completed', {
        deletedCount: deletedRooms.length,
        roomIds: deletedRooms.map((room) => room.id),
      });
      return deletedRooms.length;
    } catch (cause) {
      this.logger.error('room.cleanup.failed', {
        message: cause instanceof Error ? cause.message : 'unknown error',
      });
      return 0;
    }
  }
}

export interface RoomCleanupTaskHandle {
  stop(): void;
}

export function startRoomCleanupTask(
  task: Pick<RoomCleanupTask, 'runOnce'>,
  intervalMs = CLEANUP_INTERVAL_MS,
): RoomCleanupTaskHandle {
  let activeRun: Promise<number> | null = null;
  const trigger = (): void => {
    if (activeRun) return;
    activeRun = task.runOnce().finally(() => {
      activeRun = null;
    });
  };

  trigger();
  const timer = setInterval(trigger, intervalMs);
  timer.unref();

  return {
    stop: () => clearInterval(timer),
  };
}

const consoleRoomCleanupLogger: RoomCleanupLogger = {
  info(event, fields) {
    console.info(`[api-room-cleanup] ${event}（房间过期清理完成） ${JSON.stringify(fields)}`);
  },
  error(event, fields) {
    console.error(`[api-room-cleanup] ${event}（房间过期清理失败） ${JSON.stringify(fields)}`);
  },
};
