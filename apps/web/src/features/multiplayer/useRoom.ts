import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomSnapshot } from '@lets-eat/contracts';
import { RoomClient } from '@/entities/room/room-client';
import { RealtimeClient } from './realtime-client';
import { classifyMultiplayerError } from './error-policy';
import { normalizeRoomState } from './state-normalizer';
import type { RoomState } from './state-types';

export function useRoom(roomClient: RoomClient, roomId: string, userId: string) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [roomState, setRoomState] = useState<RoomState>({ type: 'restoring', roomId });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const realtime = useMemo(() => new RealtimeClient(), []);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const revisionsRef = useRef({ roomRevision: 0 });

  const refresh = useCallback(async () => {
    if (!roomRef.current) setLoading(true);
    try {
      const nextRoom = await roomClient.getRoom(roomId);
      if (nextRoom.customCatalog) {
        await roomClient.getCustomCatalog(nextRoom.id, nextRoom.customCatalog.selectionHash);
      }
      roomRef.current = nextRoom;
      revisionsRef.current.roomRevision = nextRoom.revision;
      setRoom(nextRoom);
      setRoomState(normalizeRoomState(nextRoom, userId));
      setError('');
    } catch (cause) {
      const policy = classifyMultiplayerError(cause);
      if (policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired')) {
        roomRef.current = null;
        setRoom(null);
        setRoomState(policy.target === 'room-expired' ? { type: 'expired' } : { type: 'closed', reason: 'not-found' });
      } else {
        setRoomState({ type: 'unavailable', message: policy.message });
      }
      setError(policy.message);
    } finally {
      setLoading(false);
    }
  }, [roomClient, roomId, userId]);

  const updateRoom = useCallback((nextRoom: RoomSnapshot) => {
    roomRef.current = nextRoom;
    revisionsRef.current.roomRevision = nextRoom.revision;
    setRoom(nextRoom);
    setRoomState(normalizeRoomState(nextRoom, userId));
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!roomRef.current) return;
    let stopped = false;
    let stopRealtime: (() => void) | undefined;
    void roomClient.getIdentity().then((identity) => {
      if (stopped) return;
      stopRealtime = realtime.connect({
        token: identity.token,
        roomId,
        revisions: revisionsRef.current,
        onStale: () => { void refresh(); },
      });
    });
    return () => {
      stopped = true;
      stopRealtime?.();
    };
  }, [room !== null, roomClient, realtime, roomId, refresh]);

  return { room, roomState, setRoom: updateRoom, loading, error, refresh, userId };
}
