import { useState, type ReactNode } from 'react';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { createBrowserCatalogFoodChoiceRepository } from '@/entities/catalog/food-choice-repository';
import { CandidateListDialog } from '@/features/choose-food/components/CandidateListDialog';
import { CompletedRound } from '@/features/choose-food/components/CompletedRound';
import { DecisionWheelDialog } from '@/features/choose-food/components/DecisionWheelDialog';
import { SwipeDeck } from '@/features/choose-food/components/SwipeDeck';
import { useChooseFood } from '@/features/choose-food/useChooseFood';

export interface AppProps {
  repository?: FoodChoiceRepository;
  random?: () => number;
}

const defaultRepository = createBrowserCatalogFoodChoiceRepository();

export default function App({
  repository = defaultRepository,
  random = Math.random,
}: AppProps) {
  const chooseFood = useChooseFood(repository, random);
  const [isCandidateListOpen, setIsCandidateListOpen] = useState(false);
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const { state } = chooseFood;

  let content: ReactNode;

  if (state.status === 'loading') {
    content = <p className="text-center text-sm font-semibold text-slate-500">正在准备今天的选项…</p>;
  } else if (state.status === 'choosing' && chooseFood.currentChoice) {
    content = (
      <SwipeDeck
        choice={chooseFood.currentChoice}
        nextChoice={chooseFood.nextChoice}
        current={chooseFood.progress.current}
        total={chooseFood.progress.total}
        likedCount={state.likedChoices.length}
        canUndo={state.history.length > 0}
        onSkip={chooseFood.skip}
        onLike={chooseFood.like}
        onSuperlike={chooseFood.superlike}
        onUndo={chooseFood.undo}
        onOpenDecision={() => setIsDecisionOpen(true)}
        onInteractionLockChange={chooseFood.setInteractionLocked}
      />
    );
  } else if (state.status === 'exhausted') {
    content = (
      <CompletedRound
        likedChoices={state.likedChoices}
        onOpenDecision={() => setIsDecisionOpen(true)}
        onOpenCandidates={() => setIsCandidateListOpen(true)}
        onRestart={chooseFood.restart}
      />
    );
  } else {
    const message = state.status === 'error'
      ? '加载失败，请重试'
      : '暂时没有可选的菜系';

    content = (
      <section className="space-y-4 text-center">
        <p className="text-lg font-black text-slate-950">{message}</p>
        <button
          type="button"
          onClick={chooseFood.retry}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-amber-200 transition hover:bg-slate-800"
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        {content}
      </main>
      <CandidateListDialog
        isOpen={isCandidateListOpen}
        choices={state.likedChoices}
        onClose={() => setIsCandidateListOpen(false)}
      />
      <DecisionWheelDialog
        isOpen={isDecisionOpen}
        choices={state.likedChoices}
        onClose={() => setIsDecisionOpen(false)}
      />
    </div>
  );
}
