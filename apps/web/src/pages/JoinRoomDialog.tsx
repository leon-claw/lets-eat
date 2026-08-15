import { useEffect, useState } from 'react';
import { useFeedback } from '@/shared/components/FeedbackProvider';

interface JoinRoomDialogProps {
  open: boolean;
  displayName: string;
  onJoin: (code: string) => Promise<void> | void;
  onClose: () => void;
}

export function JoinRoomDialog({ open, displayName, onJoin, onClose }: JoinRoomDialogProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useFeedback();
  useEffect(() => { if (!open) setCode(''); }, [open]);
  if (!open) return null;

  const submit = async () => {
    if (!/^\d{8}$/.test(code)) {
      toast({ message: '请输入 8 位数字房间号', tone: 'error' });
      return;
    }
    setSubmitting(true);
    try { await onJoin(code); } catch (cause) { toast({ message: cause instanceof Error ? cause.message : '加入房间失败', tone: 'error' }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="dialog-backdrop fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-5" role="dialog" aria-modal="true" aria-label="加入房间">
      <section data-testid="join-room-dialog-panel" className="entry-pop w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-black">加入房间</h2>
        <p className="mt-2 text-sm text-slate-500">将以“{displayName}”加入</p>
        <label className="mt-5 block text-sm font-bold text-slate-700">
          房间号
          <input aria-label="房间号" inputMode="numeric" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))} className="pressable mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-amber-400" />
        </label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="pressable flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-700">取消</button>
          <button type="button" disabled={submitting} aria-busy={submitting} onClick={() => void submit()} className="pressable flex-1 rounded-2xl bg-[#FFD100] px-4 py-3 font-black disabled:cursor-wait disabled:opacity-80">{submitting ? '正在加入…' : '加入'}</button>
        </div>
      </section>
    </div>
  );
}
