import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Heart, RotateCcw, Utensils, X } from 'lucide-react';
import type { FoodChoice } from '@/entities/food-choice/types';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';

interface SwipeDeckProps {
  choice: FoodChoice;
  nextChoice?: FoodChoice | null;
  current: number;
  total: number;
  canUndo: boolean;
  representativeFoodsLabel?: string;
  emphasizeRepresentativeFoods?: boolean;
  onDislike(): void;
  onLike(): void;
  onUndo(): void;
  onInteractionLockChange(locked: boolean): void;
}

type SwipeAction = 'dislike' | 'like';
const SWIPE_OFFSET = 80;
const SWIPE_VELOCITY = 250;
const SWIPE_DURATION = 220;

function ChoicePreview({ choice, fallbackSrc }: { choice: FoodChoice; fallbackSrc?: string }) {
  return (
    <div className="h-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-60 w-full overflow-hidden bg-gray-100">
        <ImageWithFallback src={choice.coverImage} alt="" fallbackSrc={fallbackSrc} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <div className="text-[10px] font-bold text-amber-300">下一道菜系灵感</div>
          <h3 className="truncate text-base font-extrabold">{choice.name}</h3>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-1">
          {choice.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
              {tag}
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs text-gray-400">{choice.description}</p>
      </div>
    </div>
  );
}

function ChoiceCard({
  choice,
  representativeFoodsLabel = '代表食物',
  emphasizeRepresentativeFoods = false,
}: {
  choice: FoodChoice;
  representativeFoodsLabel?: string;
  emphasizeRepresentativeFoods?: boolean;
}) {
  return (
    <>
      <div className="relative h-60 w-full shrink-0 overflow-hidden bg-gray-100">
        <ImageWithFallback src={choice.coverImage} alt={choice.name} fallbackSrc={emphasizeRepresentativeFoods ? '/brand-logo.png' : undefined} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-0.5 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[11px] font-extrabold text-gray-900 shadow-xs">
            ⭐ 菜系灵感
          </span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-xs">
          {choice.tags[0] ?? '今日推荐'}
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <div className="mb-0.5 text-[11px] font-semibold text-amber-300">今天吃点什么</div>
          <h2 className="truncate text-lg font-extrabold leading-tight">{choice.name}</h2>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between bg-white p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {choice.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-amber-200/50 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                “{tag}”
              </span>
            ))}
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">{choice.description}</p>
        </div>
        <div className={emphasizeRepresentativeFoods
          ? 'mt-4 rounded-2xl border border-red-100 bg-red-50/70 p-3.5'
          : 'flex items-center justify-between border-t border-gray-100 pt-2'}>
          {emphasizeRepresentativeFoods ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-gray-500">{representativeFoodsLabel}</span>
                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">菜系详情</span>
              </div>
              <p className="mt-2 break-words text-base font-black leading-6 text-red-600">{choice.representativeFoods.join(' · ')}</p>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <span className="text-[10px] text-gray-400">{representativeFoodsLabel}</span>
                <p className="truncate text-sm font-black text-red-600">{choice.representativeFoods.join(' · ')}</p>
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">菜系详情</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function SwipeDeck({
  choice,
  nextChoice,
  current,
  total,
  canUndo,
  representativeFoodsLabel,
  emphasizeRepresentativeFoods,
  onDislike,
  onLike,
  onUndo,
  onInteractionLockChange,
}: SwipeDeckProps) {
  const [isSwiping, setIsSwiping] = useState(false);
  const x = useMotionValue(0);
  const cardOpacity = useMotionValue(1);
  const rotate = useTransform(x, [-200, 200], [-22, 22]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const dislikeOpacity = useTransform(x, [-20, -100], [0, 1]);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const finishAction = (action: SwipeAction) => {
    x.set(0);
    cardOpacity.set(1);
    setIsSwiping(false);
    onInteractionLockChange(false);
    if (action === 'dislike') onDislike();
    else onLike();
  };

  const triggerSwipe = (action: SwipeAction) => {
    if (isSwiping || timerRef.current) return;
    setIsSwiping(true);
    onInteractionLockChange(true);
    const targetX = action === 'like' ? Math.max(x.get() + 350, 550) : Math.min(x.get() - 350, -550);
    animate(x, targetX, { duration: 0.2, ease: [0.32, 0.72, 0, 1] });
    animate(cardOpacity, 0, { duration: 0.18, ease: 'easeOut' });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (mountedRef.current) finishAction(action);
    }, SWIPE_DURATION);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSwiping) return;
    if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) triggerSwipe('like');
    else if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) triggerSwipe('dislike');
    else animate(x, 0, { type: 'spring', stiffness: 450, damping: 28 });
  };

  return (
    <section className="flex min-h-[calc(100vh-2rem)] select-none flex-col items-center justify-between overflow-hidden px-4 py-2">
      <div className="mb-2 flex w-full max-w-sm items-center justify-between px-2 text-xs text-gray-500">
        <span className="flex items-center gap-1 font-semibold text-gray-700"><Utensils className="h-3.5 w-3.5 text-amber-500" />滑动选菜器</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">已挑 {current} / {total}</span>
      </div>

      <div className="relative flex h-[480px] w-full max-w-sm items-center justify-center">
        {nextChoice && (
          <motion.div animate={{ scale: isSwiping ? 1 : 0.95, y: isSwiping ? 0 : 12, opacity: isSwiping ? 1 : 0.7 }} transition={{ duration: 0.2 }} className="pointer-events-none absolute h-full w-full">
            <ChoicePreview choice={nextChoice} fallbackSrc={emphasizeRepresentativeFoods ? '/brand-logo.png' : undefined} />
          </motion.div>
        )}
        <motion.article
          key={choice.id}
          style={{ x, rotate, opacity: cardOpacity }}
          drag={!isSwiping}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.85}
          onDragEnd={handleDragEnd}
          className="absolute z-10 flex h-full w-full cursor-grab flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl active:cursor-grabbing touch-pan-y"
        >
          <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute left-6 top-6 z-20 flex -rotate-12 items-center gap-1 rounded-2xl border-2 border-emerald-500 bg-white px-3.5 py-1 text-lg font-black text-emerald-600 shadow-lg"><Heart className="h-5 w-5 fill-emerald-600" />喜欢</motion.div>
          <motion.div style={{ opacity: dislikeOpacity }} className="pointer-events-none absolute right-6 top-6 z-20 flex rotate-12 items-center gap-1 rounded-2xl border-2 border-rose-500 bg-white px-3.5 py-1 text-lg font-black text-rose-600 shadow-lg"><X className="h-5 w-5 stroke-[3]" />不喜欢</motion.div>
          <ChoiceCard choice={choice} representativeFoodsLabel={representativeFoodsLabel} emphasizeRepresentativeFoods={emphasizeRepresentativeFoods} />
        </motion.article>
      </div>

      <div className="mt-2 flex w-full max-w-sm items-center justify-around px-10 py-2">
        <button type="button" onClick={onUndo} disabled={!canUndo || isSwiping} title="撤销上一划" className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-all active:scale-90 ${canUndo && !isSwiping ? 'border-amber-200 bg-white text-amber-600 hover:bg-amber-50' : 'cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300'}`}><RotateCcw className="h-5 w-5" /></button>
        <button type="button" onClick={() => triggerSwipe('dislike')} disabled={isSwiping} title="不喜欢" className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-rose-100 bg-white text-rose-500 shadow-lg transition-transform hover:bg-rose-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-7 w-7 stroke-[2.5]" /></button>
        <button type="button" onClick={() => triggerSwipe('like')} disabled={isSwiping} title="喜欢" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFD100] text-gray-900 shadow-lg transition-transform hover:bg-[#ffc800] active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"><Heart className="h-7 w-7 fill-gray-900" /></button>
      </div>
    </section>
  );
}
