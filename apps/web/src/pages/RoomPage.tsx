import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Copy, LogOut, Play, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RoomDatasetType, RoomSnapshot } from '@lets-eat/contracts';
import { RoomClient } from '@/entities/room/room-client';
import { classifyMultiplayerError } from '@/features/multiplayer/error-policy';
import { JoinRoomDialog } from './JoinRoomDialog';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';

interface RoomPageProps {
  roomClient: RoomClient;
  userId: string;
  room: RoomSnapshot;
  onRoomChange?: (room: RoomSnapshot) => void;
  onRefresh?: () => Promise<void> | void;
  notice?: string;
}

export function RoomPage({ roomClient, userId, room, onRoomChange, onRefresh, notice }: RoomPageProps) {
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'dataset' | 'leave' | 'start' | 'next' | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const isHost = room.hostUserId === userId;
  const isResults = room.status === 'results';
  const datasetName = room.selectedDataset === 'large'
    ? '大类菜品'
    : room.selectedDataset === 'small'
      ? '小类菜品'
      : `自定义菜品${room.customCatalog ? `（${room.customCatalog.itemCount} 道）` : ''}`;

  useEffect(() => {
    if (notice) toast(notice);
  }, [notice, toast]);

  const handleActionError = (cause: unknown) => {
    const policy = classifyMultiplayerError(cause);
    if (policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired')) {
      navigate('/mode', { replace: true, state: { notice: policy.message } });
      return;
    }
    if (policy.type === 'refresh' && policy.target === 'room') {
      void onRefresh?.();
    }
    toast({ message: policy.message, tone: 'error' });
  };

  const changeDataset = async (datasetType: RoomDatasetType) => {
    setBusy(true);
    setBusyAction('dataset');
    try { onRoomChange?.(await roomClient.changeDataset(room, { datasetType })); }
    catch (cause) { handleActionError(cause); }
    finally { setBusy(false); setBusyAction(null); }
  };

  const closeOrLeave = async () => {
    const confirmed = await confirm({
      title: isHost ? '关闭房间？' : '退出房间？',
      message: isHost ? '关闭后，其他成员也将离开当前房间。' : '退出后，你需要重新加入房间才能继续。',
      confirmLabel: isHost ? '关闭房间' : '退出房间',
    });
    if (!confirmed) return;
    setBusy(true);
    setBusyAction('leave');
    try {
      if (isHost) await roomClient.deleteRoom(room.id);
      else await roomClient.leaveRoom(room.id);
      navigate('/mode', { replace: true });
    } catch (cause) {
      const policy = classifyMultiplayerError(cause);
      if (policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired')) {
        navigate('/mode', { replace: true, state: { notice: policy.message } });
      } else {
        toast({ message: policy.message, tone: 'error' });
      }
    } finally { setBusy(false); setBusyAction(null); }
  };

  const join = async (code: string) => {
    try {
      const joined = await roomClient.joinRoom({ code, displayName: room.members.find((member) => member.userId === userId)?.displayName ?? '食客' });
      setJoinOpen(false);
      navigate(`/room/${joined.id}`, { replace: true });
    } catch (cause) {
      handleActionError(cause);
    }
  };

  const startRound = async () => {
    setBusy(true);
    setBusyAction('start');
    try {
      const round = await roomClient.startRound(room);
      navigate(`/game/round/${round.id}`);
    } catch (cause) {
      handleActionError(cause);
    } finally { setBusy(false); setBusyAction(null); }
  };

  const openNextRound = async () => {
    setBusy(true);
    setBusyAction('next');
    try {
      onRoomChange?.(await roomClient.openNextRound(room));
    } catch (cause) {
      handleActionError(cause);
    } finally { setBusy(false); setBusyAction(null); }
  };

  return (
    <PageShell title="房间匹配" backLabel={isHost ? '关闭房间' : '退出房间'} onBack={() => void closeOrLeave()}>
      <section className="space-y-4">
        <div className="entry-fade-up rounded-3xl bg-slate-950 p-6 text-center text-white shadow-lg">
          <p className="text-sm text-slate-300">房间号 {room.code}</p>
          <p className="mt-2 text-4xl font-black tracking-[0.18em]">{room.code}</p>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(room.code)} className="pressable mt-3 inline-flex items-center gap-1 text-sm font-bold text-amber-300"><Copy className="h-4 w-4" />复制房间号</button>
        </div>
        {isResults ? (
          <div className="entry-fade-up entry-delay-40 rounded-3xl bg-white p-5 text-center shadow-md">
            <p className="text-sm text-slate-500">上一轮游戏已结束</p>
            {isHost && <button type="button" onClick={() => setJoinOpen(true)} className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-4 font-black"><Users className="h-5 w-5" />加入房间</button>}
            {isHost ? (
              <button type="button" disabled={busy} aria-busy={busyAction === 'next'} onClick={() => void openNextRound()} className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-4 py-4 font-black shadow-lg">
                <Play className="h-5 w-5" />{busyAction === 'next' ? '正在准备下一轮…' : '开始下一轮'}
              </button>
            ) : <p className="mt-5 text-xl font-black">等待房主开始下一轮</p>}
          </div>
        ) : isHost ? (
          <>
            <div className="entry-fade-up entry-delay-40 rounded-3xl bg-white p-5 shadow-md">
              <p className="text-sm font-bold text-slate-500">菜品数据集</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" disabled={busy} aria-pressed={room.selectedDataset === 'large'} onClick={() => void changeDataset('large')} className={`pressable rounded-2xl px-3 py-3 font-black ${room.selectedDataset === 'large' ? 'bg-[#FFD100]' : 'bg-slate-100'}`}>大类菜品</button>
                <button type="button" disabled={busy} aria-pressed={room.selectedDataset === 'small'} onClick={() => void changeDataset('small')} className={`pressable rounded-2xl px-3 py-3 font-black ${room.selectedDataset === 'small' ? 'bg-[#FFD100]' : 'bg-slate-100'}`}>小类菜品</button>
                <button type="button" disabled={busy || !room.customCatalog} aria-pressed={room.selectedDataset === 'custom'} onClick={() => void changeDataset('custom')} className={`pressable rounded-2xl px-3 py-3 font-black disabled:cursor-not-allowed disabled:opacity-40 ${room.selectedDataset === 'custom' ? 'bg-[#FFD100]' : 'bg-slate-100'}`}>自定义菜品{room.customCatalog ? `（${room.customCatalog.itemCount}）` : ''}</button>
              </div>
              <p className="mt-3 text-xs text-slate-400">周围菜品：待上线</p>
            </div>
            <button type="button" onClick={() => setJoinOpen(true)} className="pressable hover-lift entry-fade-up entry-delay-80 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 font-black shadow-md"><Users className="h-5 w-5" />加入房间</button>
            <button type="button" disabled={busy} aria-busy={busyAction === 'start'} onClick={() => void startRound()} className="pressable hover-lift entry-fade-up entry-delay-120 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-4 py-4 font-black shadow-lg"><Play className="h-5 w-5" />{busyAction === 'start' ? '正在开始游戏…' : '开始游戏'}</button>
          </>
        ) : (
          <div className="entry-fade-up entry-delay-40 rounded-3xl bg-white p-5 text-center shadow-md">
            <p className="text-sm text-slate-500">当前数据集：{datasetName}</p>
            <p className="mt-5 text-xl font-black">待房主开始</p>
          </div>
        )}
        <div className="entry-fade-up entry-delay-80 rounded-3xl bg-white p-5 shadow-md">
          <h2 className="font-black">客人列表（{room.members.length}/8）</h2>
          <ul className="mt-3 space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {room.members.map((member) => <motion.li key={member.id} initial={{ opacity: 0, transform: prefersReducedMotion ? 'translateY(0)' : 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0, transform: prefersReducedMotion ? 'translateY(0)' : 'translateY(-8px)' }} transition={prefersReducedMotion ? { duration: 0.18 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }} className="member-list-item flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span className="font-bold">{member.displayName}</span><span className="text-xs text-slate-500">{member.role === 'host' ? '房主' : member.userId === userId ? '我' : '客人'}</span></motion.li>)}
            </AnimatePresence>
          </ul>
        </div>
        <button type="button" disabled={busy} aria-busy={busyAction === 'leave'} onClick={() => void closeOrLeave()} className="pressable entry-fade-up entry-delay-120 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-600"><LogOut className="h-4 w-4" />{busyAction === 'leave' ? '正在退出…' : isHost ? '关闭房间' : '退出房间'}</button>
      </section>
      <JoinRoomDialog open={joinOpen} displayName={room.members.find((member) => member.userId === userId)?.displayName ?? '食客'} onJoin={join} onClose={() => setJoinOpen(false)} />
    </PageShell>
  );
}
