import { motion } from 'motion/react';
import { Heart, X } from 'lucide-react';
import type { FoodChoice } from '@/entities/food-choice/types';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';

interface CandidateListDialogProps {
  isOpen: boolean;
  choices: FoodChoice[];
  onClose(): void;
}

export function CandidateListDialog({ isOpen, choices, onClose }: CandidateListDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-0 sm:items-center sm:justify-center sm:p-5">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-list-title"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-[#F5F5F7] p-5 shadow-2xl sm:rounded-[2rem]"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1 text-xs font-black text-red-600"><Heart className="h-3.5 w-3.5 fill-red-500" /> 你的心仪菜系</p>
            <h2 id="candidate-list-title" className="mt-1 text-2xl font-black text-slate-900">备选清单 ({choices.length})</h2>
          </div>
          <button type="button" aria-label="关闭备选清单" onClick={onClose} className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {choices.map((choice) => (
            <article key={choice.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <ImageWithFallback src={choice.coverImage} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-slate-900">{choice.name}</h3>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{choice.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {choice.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{tag}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
