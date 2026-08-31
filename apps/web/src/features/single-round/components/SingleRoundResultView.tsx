import { useState } from 'react';
import type { FoodChoice } from '@/entities/food-choice/types';
import { CandidateListDialog } from '@/features/choose-food/components/CandidateListDialog';
import { PageShell } from '@/shared/components/PageShell';

interface SingleRoundResultViewProps {
  choices: FoodChoice[];
  loaded: boolean;
  onLeave(): void;
  leaveLabel: string;
}

export function SingleRoundResultView({ choices, loaded, onLeave, leaveLabel }: SingleRoundResultViewProps) {
  const [isListOpen, setIsListOpen] = useState(false);

  return (
    <PageShell title="本轮结果" onBack={onLeave}>
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
        <button type="button" onClick={onLeave} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">{leaveLabel}</button>
      </section>
      <CandidateListDialog isOpen={isListOpen} choices={choices} onClose={() => setIsListOpen(false)} />
    </PageShell>
  );
}
