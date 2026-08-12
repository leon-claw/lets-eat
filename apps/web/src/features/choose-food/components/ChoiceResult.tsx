import type { FoodChoice } from '@/entities/food-choice/types';
import { FoodChoiceCard } from './FoodChoiceCard';

interface ChoiceResultProps {
  choice: FoodChoice;
  onRestart(): void;
}

export function ChoiceResult({ choice, onRestart }: ChoiceResultProps) {
  return (
    <section className="space-y-5">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">今天就吃</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950">选好了！</h1>
      </div>

      <FoodChoiceCard choice={choice} />

      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-2xl bg-stone-950 px-5 py-4 text-sm font-black text-amber-200 transition hover:bg-stone-800 active:scale-[0.99]"
      >
        重新选择
      </button>
    </section>
  );
}
