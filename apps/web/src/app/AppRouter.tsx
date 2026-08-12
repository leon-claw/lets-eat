import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { createBrowserCatalogFoodChoiceRepository } from '@/entities/catalog/food-choice-repository';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { DatasetPage } from '@/pages/DatasetPage';
import { GamePage, MultiplayerGameRoute } from '@/pages/GamePage';
import { HomePage } from '@/pages/HomePage';
import { ModePage } from '@/pages/ModePage';
import { ResultPage } from '@/pages/ResultPage';
import { RoomPage } from '@/pages/RoomPage';
import { createBrowserRoomClient, type RoomClient } from '@/entities/room/room-client';
import { useEffect, useState } from 'react';
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
  const [currentRoom, setCurrentRoom] = useState<RoomSnapshot | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!roomClient || (location.pathname !== '/mode' && !location.pathname.startsWith('/room/'))) return;
    void roomClient.getIdentity().then((next) => setIdentity({ userId: next.userId })).catch(() => undefined);
    void roomClient.getCurrentRoom().then((response) => setCurrentRoom(response.room)).catch(() => undefined);
  }, [location.pathname, roomClient]);
  useEffect(() => {
    if (location.pathname !== '/mode' || !currentRoom) return;
    if (currentRoom.status === 'waiting') navigate(`/room/${currentRoom.id}`, { replace: true });
    if (currentRoom.status === 'playing' && currentRoom.currentRoundId) navigate(`/game/round/${currentRoom.currentRoundId}`, { replace: true });
    if (currentRoom.status === 'results' && currentRoom.currentRoundId) navigate(`/result/round/${currentRoom.currentRoundId}`, { replace: true });
  }, [currentRoom, location.pathname, navigate]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/mode" element={<ModePage roomClient={roomClient} />} />
      <Route path="/single/dataset" element={<DatasetPage repository={repository} />} />
      <Route path="/game/single" element={<GamePage repository={repository} />} />
      <Route path="/result/single" element={<ResultPage repository={repository} />} />
      <Route path="/room/:roomId" element={roomClient && identity ? <RoomRoute roomClient={roomClient} userId={identity.userId} /> : <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在恢复房间…</div>} />
      <Route path="/game/round/:roundId" element={<MultiplayerGameRoute repository={repository} roundClient={roomClient} />} />
      <Route path="/result/round/:roundId" element={<MultiplayerPlaceholder title="本轮结果" message="结果页将在多人选菜流程完成后开放。" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MultiplayerPlaceholder({ title, message }: { title: string; message: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-6 text-center"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg"><h1 className="text-2xl font-black">{title}</h1><p className="mt-3 text-sm text-slate-500">{message}</p></section></div>;
}

function RoomRoute({ roomClient, userId }: { roomClient: RoomClient; userId: string }) {
  const roomId = window.location.pathname.split('/').pop() ?? '';
  const state = useRoom(roomClient, roomId, userId);
  if (state.loading) return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在恢复房间…</div>;
  if (!state.room) return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-rose-500">{state.error || '房间已关闭或过期'}</div>;
  return <RoomPage roomClient={roomClient} userId={userId} room={state.room} onRoomChange={state.setRoom} />;
}

export function AppRouter({ repository = defaultRepository, initialPath, roomClient }: AppRouterProps) {
  const resolvedRoomClient = roomClient ?? (initialPath ? undefined : defaultRoomClient);
  const content: ReactNode = <RouteTree repository={repository} roomClient={resolvedRoomClient} />;
  return initialPath ? <MemoryRouter initialEntries={[initialPath]}>{content}</MemoryRouter> : <BrowserRouter>{content}</BrowserRouter>;
}
