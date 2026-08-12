import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { createSingleRoundStore } from '@/features/single-round/single-round-store';
import { CandidateListDialog } from '@/features/choose-food/components/CandidateListDialog';
import { PageShell } from '@/shared/components/PageShell';

interface ResultPageProps { repository: FoodChoiceRepository; }

export function ResultPage({ repository }: ResultPageProps) {
  const navigate = useNavigate();
  const [choices, setChoices] = useState<FoodChoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const store = createSingleRoundStore();
  const session = store.load();

  useEffect(() => {
    if (!session) { setLoaded(true); return; }
    repository.list(session.datasetType, {
      catalogVersion: session.catalogVersion,
      catalogHash: session.catalogHash,
    }).then((items) => {
      setChoices(items.filter((item) => session.decisions[item.id] === 'liked'));
    }).finally(() => setLoaded(true));
  }, [repository, session?.catalogHash, session?.catalogVersion, session?.datasetType]);

  const leave = () => {
    store.clear();
    navigate('/mode', { replace: true });
  };

  return (
    <PageShell title="本轮结果">
      <section className="rounded-[2rem] bg-white p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD100] text-3xl">🎉</div>
        <h2 className="text-2xl font-black">看完全部菜品啦！</h2>
        <p className="mt-2 text-sm text-slate-500">{choices.length > 0 ? `你选中了 ${choices.length} 道心仪菜品` : '你还没有选中菜品'}</p>
        {!loaded && <p className="mt-5 text-sm text-slate-400">正在整理结果…</p>}
        {loaded && choices.length > 0 && (
          <>
            <button type="button" onClick={() => setIsListOpen(true)} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">查看备选清单 ({choices.length})</button>
            <div className="mt-4 space-y-2 text-left">{choices.map((choice) => <div key={choice.id} className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900">{choice.name}</div>)}</div>
          </>
        )}
        <button type="button" onClick={leave} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">返回模式选择</button>
      </section>
      <CandidateListDialog isOpen={isListOpen} choices={choices} onClose={() => setIsListOpen(false)} />
    </PageShell>
  );
}
