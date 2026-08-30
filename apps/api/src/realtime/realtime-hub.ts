import type { ServerEvent } from '@lets-eat/contracts';
import type { WebSocket } from 'ws';
import { realtimeLogger } from './realtime-logger.js';

export interface RealtimeConnection {
  socket: WebSocket;
  userId: string;
  roomId: string;
}

export class RealtimeHub {
  private readonly connections = new Map<string, Set<RealtimeConnection>>();

  add(connection: RealtimeConnection): void {
    const members = this.connections.get(connection.roomId) ?? new Set<RealtimeConnection>();
    members.add(connection);
    this.connections.set(connection.roomId, members);
  }

  remove(connection: RealtimeConnection): void {
    const members = this.connections.get(connection.roomId);
    if (!members) return;
    members.delete(connection);
    if (members.size === 0) this.connections.delete(connection.roomId);
  }

  publish(event: ServerEvent): void {
    const connections = this.connections.get(event.roomId) ?? new Set<RealtimeConnection>();
    let sent = 0;
    let skipped = 0;
    for (const connection of connections) {
      if (connection.socket.readyState !== 1) {
        skipped += 1;
        continue;
      }
      connection.socket.send(JSON.stringify(event));
      sent += 1;
    }
    realtimeLogger.info('event.broadcast', {
      type: event.type,
      roomId: event.roomId,
      roomRevision: event.roomRevision,
      roundRevision: event.roundRevision,
      connected: connections.size,
      sent,
      skipped,
    });
  }

  size(roomId?: string): number {
    if (roomId) return this.connections.get(roomId)?.size ?? 0;
    return [...this.connections.values()].reduce((total, members) => total + members.size, 0);
  }
}
