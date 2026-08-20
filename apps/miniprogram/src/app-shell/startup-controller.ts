import {
  getRoomStateTarget,
  normalizeRoomState,
  type NavigationTarget,
} from '@lets-eat/client-core';

export interface StartupResult {
  status: 'ready-without-room' | 'ready-with-room' | 'retryable';
  intent: NavigationTarget;
}

export interface StartupControllerDependencies {
  loadIdentity: () => Promise<{ userId: string }>;
  readRoomReference: () => string | null;
  loadRoom: (roomId: string) => Promise<StartupRoom>;
  clearRoomReference: () => void;
  isTerminalError?: (error: unknown) => boolean;
}

export interface StartupRoom {
  id: string;
  hostUserId: string;
  status: 'waiting' | 'playing' | 'results';
  currentRoundId: string | null;
  members: Array<{ userId: string }>;
}

export function createStartupController(dependencies: StartupControllerDependencies) {
  return {
    async restore(): Promise<StartupResult> {
      await dependencies.loadIdentity();
      const roomId = dependencies.readRoomReference();
      if (!roomId) return { status: 'ready-without-room', intent: { type: 'home' } };

      try {
        const identity = await dependencies.loadIdentity();
        const room = await dependencies.loadRoom(roomId);
        if (!room.members.some((member) => member.userId === identity.userId)) {
          dependencies.clearRoomReference();
          return { status: 'ready-without-room', intent: { type: 'home' } };
        }
        return { status: 'ready-with-room', intent: getRoomStateTargetForRoom(room, identity.userId) };
      } catch (error) {
        if (dependencies.isTerminalError?.(error)) {
          dependencies.clearRoomReference();
          return { status: 'ready-without-room', intent: { type: 'home' } };
        }
        return { status: 'retryable', intent: { type: 'home' } };
      }
    },
  };
}

function getRoomStateTargetForRoom(room: StartupRoom, userId: string): NavigationTarget {
  return getRoomStateTarget(normalizeRoomState(room as Parameters<typeof normalizeRoomState>[0], userId));
}
