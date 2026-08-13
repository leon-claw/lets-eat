import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createBrowserCatalogFoodChoiceRepository } from '@/entities/catalog/food-choice-repository';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { DatasetPage } from '@/pages/DatasetPage';
import { GamePage, MultiplayerGameRoute } from '@/pages/GamePage';
import { HomePage } from '@/pages/HomePage';
import { ModePage } from '@/pages/ModePage';
import { MultiplayerResultPage, ResultPage } from '@/pages/ResultPage';
import { RoomPage } from '@/pages/RoomPage';
import { createBrowserRoomClient, type RoomClient } from '@/entities/room/room-client';
import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@lets-eat/contracts';
import { useRoom } from '@/features/multiplayer/useRoom';

interface AppRouterProps {
  repository?: FoodChoiceRepository;
  initialPath?: string;
  roomClient?: RoomClient;
}

const defaultRepository = createBrowserCatalogFoodChoiceRepository();
const defaultRoomClient = createBrowserRoomClient();

function RouteTree({ repository, roomClient }: { repository: FoodChoiceRepository; roomClient?: RoomClient }) {
  const [identity, setIdentity] = useState<{ userId: string } | null>(null);
  const [currentRoomLookup, setCurrentRoomLookup] = useState<{
    pathname: string;
    status: 'pending' | 'resolved';
    room: RoomSnapshot | null;
  }>({ pathname: '', status: 'pending', room: null });
  const lookupSequence = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!roomClient || (location.pathname !== '/mode' && !location.pathname.startsWith('/room/'))) return;
    const pathname = location.pathname;
    const sequence = ++lookupSequence.current;
    setCurrentRoomLookup({ pathname, status: 'pending', room: null });
    void roomClient.getIdentity().then((next) => setIdentity({ userId: next.userId })).catch(() => undefined);
    void roomClient.getCurrentRoom().then((response) => {
      if (lookupSequence.current !== sequence) return;
      setCurrentRoomLookup({ pathname, status: 'resolved', room: response.room });
    }).catch(() => {
      if (lookupSequence.current !== sequence) return;
      setCurrentRoomLookup({ pathname, status: 'resolved', room: null });
    });
  }, [location.pathname, roomClient]);
  useEffect(() => {
    if (location.pathname !== '/mode' || currentRoomLookup.pathname !== location.pathname || currentRoomLookup.status !== 'resolved') return;
    const currentRoom = currentRoomLookup.room;
    if (!currentRoom) return;
    if (currentRoom.status === 'waiting') navigate(`/room/${currentRoom.id}`, { replace: true });
    if (currentRoom.status === 'playing' && currentRoom.currentRoundId) navigate(`/game/round/${currentRoom.currentRoundId}`, { replace: true });
    if (currentRoom.status === 'results' && currentRoom.currentRoundId) navigate(`/result/round/${currentRoom.currentRoundId}`, { replace: true });
  }, [currentRoomLookup, location.pathname, navigate]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/mode" element={<ModePage roomClient={roomClient} />} />
      <Route path="/single/dataset" element={<DatasetPage repository={repository} />} />
      <Route path="/game/single" element={<GamePage repository={repository} />} />
      <Route path="/result/single" element={<ResultPage repository={repository} />} />
      <Route path="/room/:roomId" element={roomClient && identity ? <RoomRoute roomClient={roomClient} userId={identity.userId} /> : <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在恢复房间…</div>} />
      <Route path="/game/round/:roundId" element={<MultiplayerGameRoute repository={repository} roundClient={roomClient} />} />
      <Route path="/result/round/:roundId" element={<MultiplayerResultRoute repository={repository} roundClient={roomClient} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MultiplayerPlaceholder({ title, message }: { title: string; message: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-6 text-center"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg"><h1 className="text-2xl font-black">{title}</h1><p className="mt-3 text-sm text-slate-500">{message}</p></section></div>;
}

function MultiplayerResultRoute({ repository, roundClient }: { repository: FoodChoiceRepository; roundClient?: RoomClient }) {
  const { roundId } = useParams();
  if (!roundId || !roundClient) return <MultiplayerPlaceholder title="本轮结果" message="正在恢复结果…" />;
  return <MultiplayerResultPage repository={repository} roundId={roundId} roundClient={roundClient} />;
}

function RoomRoute({ roomClient, userId }: { roomClient: RoomClient; userId: string }) {
  const { roomId = '' } = useParams();
  const state = useRoom(roomClient, roomId, userId);
  const navigate = useNavigate();

  useEffect(() => {
    if (state.roomState.type === 'closed' || state.roomState.type === 'expired') {
      navigate('/mode', { replace: true, state: { notice: state.error || '房间已关闭或过期' } });
      return;
    }
    if (state.roomState.type === 'playing') {
      navigate(`/game/round/${state.roomState.roundId}`, { replace: true });
    }
  }, [navigate, state.error, state.roomState]);

  if (state.loading || state.roomState.type === 'restoring') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在恢复房间…</div>;
  if (state.roomState.type === 'closed' || state.roomState.type === 'expired') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在返回模式选择…</div>;
  if (!state.room) return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-rose-500">{state.error || '房间已关闭或过期'}</div>;
  if (state.roomState.type === 'playing') {
    return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在进入游戏…</div>;
  }
  return <RoomPage roomClient={roomClient} userId={userId} room={state.room} onRoomChange={state.setRoom} onRefresh={state.refresh} />;
}

export function AppRouter({ repository = defaultRepository, initialPath, roomClient }: AppRouterProps) {
  const resolvedRoomClient = roomClient ?? (initialPath ? undefined : defaultRoomClient);
  const content: ReactNode = <RouteTree repository={repository} roomClient={resolvedRoomClient} />;
  return initialPath ? <MemoryRouter initialEntries={[initialPath]}>{content}</MemoryRouter> : <BrowserRouter>{content}</BrowserRouter>;
}
