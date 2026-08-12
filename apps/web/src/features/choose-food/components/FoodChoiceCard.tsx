import type { FoodChoice } from '@/entities/food-choice/types';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';

interface FoodChoiceCardProps {
  choice: FoodChoice;
}

export function FoodChoiceCard({ choice }: FoodChoiceCardProps) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_70px_rgba(66,42,24,0.16)]">
      <ImageWithFallback
        src={choice.coverImage}
        alt={choice.name}
        className="h-64 w-full object-cover sm:h-80"
      />

      <div className="space-y-5 p-6 sm:p-8">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
            这次试试
          </p>
          <h2 className="text-4xl font-black tracking-tight text-stone-950">{choice.name}</h2>
          <p className="mt-3 text-base leading-7 text-stone-600">{choice.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {choice.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              {tag}
            </span>
          ))}
        </div>

        <div className="rounded-2xl bg-stone-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">代表食物</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-stone-800">
            {choice.representativeFoods.join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}
