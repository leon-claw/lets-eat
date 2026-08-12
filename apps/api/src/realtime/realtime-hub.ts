import type { ServerEvent } from '@lets-eat/contracts';
import type { WebSocket } from 'ws';

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
    for (const connection of this.connections.get(event.roomId) ?? []) {
      if (connection.socket.readyState !== 1) continue;
      connection.socket.send(JSON.stringify(event));
    }
  }

  size(roomId?: string): number {
    if (roomId) return this.connections.get(roomId)?.size ?? 0;
    return [...this.connections.values()].reduce((total, members) => total + members.size, 0);
  }
}
