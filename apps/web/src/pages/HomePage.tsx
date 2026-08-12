import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createDisplayNameStore } from '@/features/identity/display-name-store';
import { PageShell } from '@/shared/components/PageShell';

const displayNameStore = createDisplayNameStore();

export function HomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState(displayNameStore.loadOrCreate());
  const [error, setError] = useState('');

  const start = () => {
    try {
      displayNameStore.save(name);
      navigate('/mode');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请输入用户名');
    }
  };

  return (
    <PageShell back={false}>
      <section className="flex flex-1 flex-col items-center justify-center gap-8 rounded-[2rem] bg-white px-6 py-10 shadow-xl">
        <button type="button" aria-label="设置" onClick={() => setError('设置功能将在下一阶段开放')} className="absolute right-7 top-7 rounded-full p-2 text-slate-500 hover:bg-slate-100">
          <Settings className="h-5 w-5" />
        </button>
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFD100] text-5xl shadow-lg">🍜</div>
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">今天吃什么</h1>
          <p className="mt-2 text-sm text-slate-500">让每一次选择，都变得轻松一点</p>
        </div>
        <label className="w-full text-sm font-bold text-slate-700">
          你的名字
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-amber-400" />
        </label>
        {error && <p role="alert" className="-mt-5 text-sm font-bold text-rose-500">{error}</p>}
        <button type="button" onClick={start} className="w-full rounded-2xl bg-[#FFD100] px-5 py-4 text-lg font-black text-slate-950 shadow-lg transition hover:bg-[#ffc800] active:scale-[0.99]">开始游戏</button>
      </section>
    </PageShell>
  );
}
