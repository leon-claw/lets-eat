import { Users, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/shared/components/PageShell';
import type { RoomClient } from '@/entities/room/room-client';
import { createDisplayNameStore } from '@/features/identity/display-name-store';

interface ModePageProps { roomClient?: RoomClient; }

export function ModePage({ roomClient }: ModePageProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  return (
    <PageShell title="选择游戏模式">
      <section className="space-y-4">
        <p className="mb-7 text-center text-sm text-slate-500">一个人也可以认真吃饭，和朋友一起更有趣</p>
        <button type="button" aria-label="单人游戏" onClick={() => navigate('/single/dataset')} className="flex w-full items-center gap-4 rounded-3xl bg-[#FFD100] p-5 text-left shadow-lg transition hover:bg-[#ffc800]">
          <UserRound className="h-8 w-8" /><span><strong className="block text-xl">单人游戏</strong><small className="text-sm opacity-70">按自己的口味做决定</small></span>
        </button>
        <button type="button" aria-label="组队游戏" onClick={() => {
          if (!roomClient) { setMessage('组队功能正在连接中'); return; }
          const displayName = createDisplayNameStore().loadOrCreate();
          void roomClient.createRoom({ displayName }).then((room) => navigate(`/room/${room.id}`)).catch((cause) => setMessage(cause instanceof Error ? cause.message : '创建房间失败'));
        }} className="flex w-full items-center gap-4 rounded-3xl bg-slate-950 p-5 text-left text-white shadow-lg transition hover:bg-slate-800">
          <Users className="h-8 w-8 text-amber-300" /><span><strong className="block text-xl">组队游戏</strong><small className="text-sm text-slate-300">和朋友一起决定今天吃什么</small></span>
        </button>
        {message && <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800">{message}</p>}
      </section>
    </PageShell>
  );
}
