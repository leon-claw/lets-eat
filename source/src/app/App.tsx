import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { mockFoodChoiceRepository } from '@/entities/food-choice/mock-repository';
import { ChoiceHeader } from '@/features/choose-food/components/ChoiceHeader';
import { ChoiceResult } from '@/features/choose-food/components/ChoiceResult';
import { SwipeDeck } from '@/features/choose-food/components/SwipeDeck';
import { useChooseFood } from '@/features/choose-food/useChooseFood';

export interface AppProps {
  repository?: FoodChoiceRepository;
  random?: () => number;
}

export default function App({
  repository = mockFoodChoiceRepository,
  random = Math.random,
}: AppProps) {
  const chooseFood = useChooseFood(repository, random);
  const { status } = chooseFood.state;

  const statusCopy = {
    empty: '暂时没有可选的菜系',
    error: '加载失败，请重试',
    exhausted: '这一轮已经看完了',
  } as const;

  let content;

  if (status === 'loading') {
    content = <p className="text-center text-sm font-semibold text-stone-500">正在准备今天的选项…</p>;
  } else if (status === 'choosing' && chooseFood.currentChoice) {
    content = (
      <>
        <ChoiceHeader current={chooseFood.progress.current} total={chooseFood.progress.total} />
        <SwipeDeck
          choice={chooseFood.currentChoice}
          onSkip={chooseFood.skip}
          onSelect={chooseFood.select}
          onInteractionLockChange={chooseFood.setInteractionLocked}
        />
      </>
    );
  } else if (status === 'selected' && chooseFood.state.selectedChoice) {
    content = (
      <ChoiceResult
        choice={chooseFood.state.selectedChoice}
        onRestart={chooseFood.restart}
      />
    );
  } else {
    const isExhausted = status === 'exhausted';
    content = (
      <section className="space-y-4 text-center">
        <p className="text-lg font-black text-stone-950">
          {statusCopy[status as keyof typeof statusCopy] ?? '暂时没有可选的菜系'}
        </p>
        <button
          type="button"
          onClick={isExhausted ? chooseFood.restart : chooseFood.retry}
          className="rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-amber-200 transition hover:bg-stone-800"
        >
          {isExhausted ? '重新开始' : '重新加载'}
        </button>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f1ea] px-4 py-6 text-stone-950 sm:px-6 sm:py-10">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col justify-center gap-6">
        {content}
      </main>
    </div>
  );
}
