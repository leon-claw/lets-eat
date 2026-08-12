import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RoomSnapshot } from '@lets-eat/contracts';
import { RoomClient } from '@/entities/room/room-client';
import { RealtimeClient } from './realtime-client';

export function useRoom(roomClient: RoomClient, roomId: string, userId: string) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const realtime = useMemo(() => new RealtimeClient(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRoom(await roomClient.getRoom(roomId));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '房间加载失败');
    } finally {
      setLoading(false);
    }
  }, [roomClient, roomId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!room) return;
    let stopped = false;
    let stopRealtime: (() => void) | undefined;
    void roomClient.getIdentity().then((identity) => {
      if (stopped) return;
      stopRealtime = realtime.connect({
        token: identity.token,
        roomId,
        revisions: { roomRevision: room.revision },
        onStale: () => { void refresh(); },
      });
    });
    return () => {
      stopped = true;
      stopRealtime?.();
    };
  }, [room, roomClient, realtime, roomId, refresh]);

  return { room, setRoom, loading, error, refresh, userId };
}
