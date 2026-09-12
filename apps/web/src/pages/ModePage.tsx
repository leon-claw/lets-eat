import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '@/shared/components/PageShell';
import type { RoomClient } from '@/entities/room/room-client';
import { createDisplayNameStore } from '@/features/identity/display-name-store';
import { useFeedback } from '@/shared/components/FeedbackProvider';
import { createCustomCatalogStore, type CustomCatalogStore } from '@/features/custom-catalog/custom-catalog-store';
import riceBallSingle from '@/assets/rice-ball-single.png';
import riceBallPair from '@/assets/rice-ball-pair.png';

interface ModePageProps { roomClient?: RoomClient; customCatalogStore?: CustomCatalogStore; }

const browserCustomCatalogStore = createCustomCatalogStore();

export function ModePage({ roomClient, customCatalogStore = browserCustomCatalogStore }: ModePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useFeedback();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const routeNotice = typeof location.state === 'object' && location.state !== null && 'notice' in location.state && typeof location.state.notice === 'string'
    ? location.state.notice
    : '';
  useEffect(() => {
    if (routeNotice) toast({ message: routeNotice, tone: 'error' });
  }, [routeNotice, toast]);

  const createRoom = () => {
    if (!roomClient) {
      toast('组队功能正在连接中');
      return;
    }

    setCreatingRoom(true);
    const displayName = createDisplayNameStore().loadOrCreate();
    const customCatalog = customCatalogStore.load();
    void roomClient.createRoom({ displayName, ...(customCatalog ? { customCatalog } : {}) }).then((room) => navigate(`/room/${room.id}`)).catch((cause) => {
      setCreatingRoom(false);
      toast({ message: cause instanceof Error ? cause.message : '创建房间失败', tone: 'error' });
    });
  };

  return (
    <PageShell title="选择游戏模式">
      <section className="space-y-4">
        <button type="button" aria-label="单人游戏" onClick={() => navigate('/single/dataset')} className="pressable hover-lift entry-fade-up entry-delay-40 flex w-full items-center gap-4 rounded-3xl bg-[#FFD100] p-5 text-left shadow-lg hover:bg-[#ffc800]">
          <span className="mode-image-frame flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden"><img src={riceBallSingle} alt="" aria-hidden="true" className="h-full w-full scale-[1.45] object-contain" /></span><span><strong className="block text-xl">单人游戏</strong><small className="text-sm opacity-70">按自己的口味做决定</small></span>
        </button>
        <button type="button" aria-label={creatingRoom ? '正在创建房间…' : '组队游戏'} aria-busy={creatingRoom} disabled={creatingRoom} onClick={createRoom} className="pressable hover-lift entry-fade-up entry-delay-80 flex w-full items-center gap-4 rounded-3xl bg-slate-950 p-5 text-left text-white shadow-lg hover:bg-slate-800 disabled:cursor-wait disabled:opacity-80">
          <span className="mode-image-frame flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden"><img src={riceBallPair} alt="" aria-hidden="true" className="h-full w-full scale-[1.45] object-contain" /></span><span><strong className="block text-xl">{creatingRoom ? '正在创建房间…' : '组队游戏'}</strong><small className="text-sm text-slate-300">和朋友一起决定今天吃什么</small></span>
        </button>
      </section>
    </PageShell>
  );
}
