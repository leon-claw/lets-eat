import { useState } from 'react';
import { Copy, LogOut, Play, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DatasetType, RoomSnapshot } from '@lets-eat/contracts';
import { RoomClient } from '@/entities/room/room-client';
import { classifyMultiplayerError } from '@/features/multiplayer/error-policy';
import { JoinRoomDialog } from './JoinRoomDialog';
import { PageShell } from '@/shared/components/PageShell';

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
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const isHost = room.hostUserId === userId;
  const isResults = room.status === 'results';
  const datasetName = room.selectedDataset === 'large' ? '大类菜品' : '小类菜品';

  const handleActionError = (cause: unknown) => {
    const policy = classifyMultiplayerError(cause);
    if (policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired')) {
      navigate('/mode', { replace: true, state: { notice: policy.message } });
      return;
    }
    if (policy.type === 'refresh' && policy.target === 'room') {
      void onRefresh?.();
    }
    setActionError(policy.message);
  };

  const changeDataset = async (datasetType: DatasetType) => {
    setActionError('');
    setBusy(true);
    try { onRoomChange?.(await roomClient.changeDataset(room, { datasetType })); }
    catch (cause) { handleActionError(cause); }
    finally { setBusy(false); }
  };

  const closeOrLeave = async () => {
    if (typeof window.confirm === 'function' && !window.confirm(isHost ? '确定关闭房间吗？' : '确定退出房间吗？')) return;
    setActionError('');
    setBusy(true);
    try {
      if (isHost) await roomClient.deleteRoom(room.id);
      else await roomClient.leaveRoom(room.id);
      navigate('/mode', { replace: true });
    } catch (cause) {
      const policy = classifyMultiplayerError(cause);
      if (policy.type === 'terminal' && (policy.target === 'room-closed' || policy.target === 'room-expired')) {
        navigate('/mode', { replace: true, state: { notice: policy.message } });
      } else {
        setActionError(policy.message);
      }
    } finally { setBusy(false); }
  };

  const join = async (code: string) => {
    try {
      const joined = await roomClient.joinRoom({ code, displayName: room.members.find((member) => member.userId === userId)?.displayName ?? '食客', replaceCurrentRoom: isHost });
      setJoinOpen(false);
      navigate(`/room/${joined.id}`, { replace: true });
    } catch (cause) {
      handleActionError(cause);
    }
  };

  const startRound = async () => {
    setActionError('');
    setBusy(true);
    try {
      const round = await roomClient.startRound(room);
      navigate(`/game/round/${round.id}`);
    } catch (cause) {
      handleActionError(cause);
    } finally { setBusy(false); }
  };

  const openNextRound = async () => {
    setActionError('');
    setBusy(true);
    try {
      onRoomChange?.(await roomClient.openNextRound(room));
    } catch (cause) {
      handleActionError(cause);
    } finally { setBusy(false); }
  };

  return (
    <PageShell title="房间匹配" backLabel={isHost ? '关闭房间' : '退出房间'} onBack={() => void closeOrLeave()}>
      <section className="space-y-4">
        {notice && <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800">{notice}</p>}
        {actionError && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">{actionError}</p>}
        <div className="rounded-3xl bg-slate-950 p-6 text-center text-white shadow-lg">
          <p className="text-sm text-slate-300">房间号 {room.code}</p>
          <p className="mt-2 text-4xl font-black tracking-[0.18em]">{room.code}</p>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(room.code)} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-amber-300"><Copy className="h-4 w-4" />复制房间号</button>
        </div>
        {isResults ? (
          <div className="rounded-3xl bg-white p-5 text-center shadow-md">
            <p className="text-sm text-slate-500">上一轮游戏已结束</p>
            {isHost && <button type="button" onClick={() => setJoinOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-4 font-black"><Users className="h-5 w-5" />加入房间</button>}
            {isHost ? (
              <button type="button" disabled={busy} onClick={() => void openNextRound()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-4 py-4 font-black shadow-lg">
                <Play className="h-5 w-5" />开始下一轮
              </button>
            ) : <p className="mt-5 text-xl font-black">等待房主开始下一轮</p>}
          </div>
        ) : isHost ? (
          <>
            <div className="rounded-3xl bg-white p-5 shadow-md">
              <p className="text-sm font-bold text-slate-500">菜品数据集</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => void changeDataset('large')} className={`rounded-2xl px-3 py-3 font-black ${room.selectedDataset === 'large' ? 'bg-[#FFD100]' : 'bg-slate-100'}`}>大类菜品</button>
                <button type="button" disabled={busy} onClick={() => void changeDataset('small')} className={`rounded-2xl px-3 py-3 font-black ${room.selectedDataset === 'small' ? 'bg-[#FFD100]' : 'bg-slate-100'}`}>小类菜品</button>
              </div>
              <p className="mt-3 text-xs text-slate-400">周围菜品：待上线</p>
            </div>
            <button type="button" onClick={() => setJoinOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 font-black shadow-md"><Users className="h-5 w-5" />加入房间</button>
            <button type="button" disabled={busy} onClick={() => void startRound()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-4 py-4 font-black shadow-lg"><Play className="h-5 w-5" />开始游戏</button>
          </>
        ) : (
          <div className="rounded-3xl bg-white p-5 text-center shadow-md">
            <p className="text-sm text-slate-500">当前数据集：{datasetName}</p>
            <p className="mt-5 text-xl font-black">待房主开始</p>
          </div>
        )}
        <div className="rounded-3xl bg-white p-5 shadow-md">
          <h2 className="font-black">客人列表（{room.members.length}/8）</h2>
          <ul className="mt-3 space-y-2">{room.members.map((member) => <li key={member.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span className="font-bold">{member.displayName}</span><span className="text-xs text-slate-500">{member.role === 'host' ? '房主' : member.userId === userId ? '我' : '客人'}</span></li>)}</ul>
        </div>
        <button type="button" disabled={busy} onClick={() => void closeOrLeave()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-600"><LogOut className="h-4 w-4" />{isHost ? '关闭房间' : '退出房间'}</button>
      </section>
      <JoinRoomDialog open={joinOpen} displayName={room.members.find((member) => member.userId === userId)?.displayName ?? '食客'} onJoin={join} onClose={() => setJoinOpen(false)} />
    </PageShell>
  );
}
