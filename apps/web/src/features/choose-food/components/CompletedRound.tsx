import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import type { FoodChoice } from '@/entities/food-choice/types';

interface CompletedRoundProps {
  likedChoices: FoodChoice[];
  onOpenCandidates(): void;
  onRestart(): void;
}

export function CompletedRound({
  likedChoices,
  onOpenCandidates,
  onRestart,
}: CompletedRoundProps) {
  const likedCount = likedChoices.length;

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center bg-[#F5F5F7] p-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 shadow-lg"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD100] text-2xl shadow-md">
          🎉
        </div>

        <div>
          <h2 className="mb-1 text-xl font-black text-gray-900">看完全部菜品啦！</h2>
          {likedCount > 0 ? (
            <p className="mb-6 text-xs text-gray-500">
              你一共选中了 <span className="text-sm font-bold text-amber-600">{likedCount}</span> 道心仪菜品
            </p>
          ) : (
            <p className="mb-6 text-xs text-gray-500">你还没有选中菜系，再刷一遍吧</p>
          )}
        </div>

        <div className="space-y-3">
          {likedCount > 0 && (
            <>
              <button
                type="button"
                onClick={onOpenCandidates}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:bg-gray-800 active:scale-[0.98]"
              >
                <ShoppingBag className="h-4 w-4 text-[#FFD100]" />
                查看备选清单 ({likedCount})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            再刷一遍
          </button>
        </div>
      </motion.div>
    </section>
  );
}
