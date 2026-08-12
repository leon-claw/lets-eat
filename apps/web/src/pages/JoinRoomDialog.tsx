import { useEffect, useState } from 'react';

interface JoinRoomDialogProps {
  open: boolean;
  displayName: string;
  onJoin: (code: string) => Promise<void> | void;
  onClose: () => void;
}

export function JoinRoomDialog({ open, displayName, onJoin, onClose }: JoinRoomDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (!open) { setCode(''); setError(''); } }, [open]);
  if (!open) return null;

  const submit = async () => {
    if (!/^\d{8}$/.test(code)) {
      setError('请输入 8 位数字房间号');
      return;
    }
    setSubmitting(true);
    setError('');
    try { await onJoin(code); } catch (cause) { setError(cause instanceof Error ? cause.message : '加入房间失败'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-5" role="dialog" aria-modal="true" aria-label="加入房间">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-black">加入房间</h2>
        <p className="mt-2 text-sm text-slate-500">将以“{displayName}”加入</p>
        <label className="mt-5 block text-sm font-bold text-slate-700">
          房间号
          <input aria-label="房间号" inputMode="numeric" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-amber-400" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm font-bold text-rose-500">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-700">取消</button>
          <button type="button" disabled={submitting} onClick={() => void submit()} className="flex-1 rounded-2xl bg-[#FFD100] px-4 py-3 font-black">加入</button>
        </div>
      </section>
    </div>
  );
}
