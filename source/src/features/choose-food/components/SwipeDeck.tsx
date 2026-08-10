import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import type { FoodChoice } from '@/entities/food-choice/types';
import { FoodChoiceCard } from './FoodChoiceCard';

interface SwipeDeckProps {
  choice: FoodChoice;
  onSkip(): void;
  onSelect(): void;
  onInteractionLockChange(locked: boolean): void;
}

type ExitAction = 'skip' | 'select';
const SWIPE_OFFSET = 80;
const SWIPE_VELOCITY = 250;
const EXIT_DURATION = 220;

export function SwipeDeck({
  choice,
  onSkip,
  onSelect,
  onInteractionLockChange,
}: SwipeDeckProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-10, 10]);
  const [exitAction, setExitAction] = useState<ExitAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const triggerAction = (action: ExitAction) => {
    if (exitAction || timerRef.current) return;

    onInteractionLockChange(true);
    setExitAction(action);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setExitAction(null);
      onInteractionLockChange(false);
      if (action === 'skip') onSkip();
      else onSelect();
      x.set(0);
    }, EXIT_DURATION);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (exitAction) return;

    if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) {
      triggerAction('skip');
    } else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) {
      triggerAction('select');
    } else {
      x.set(0);
    }
  };

  return (
    <div className="space-y-5">
      <motion.article
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        animate={{
          x: exitAction === 'skip' ? -520 : exitAction === 'select' ? 520 : 0,
          opacity: exitAction ? 0 : 1,
        }}
        transition={{ duration: EXIT_DURATION / 1000, ease: 'easeIn' }}
        className="cursor-grab touch-pan-y active:cursor-grabbing"
      >
        <FoodChoiceCard choice={choice} />
      </motion.article>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={Boolean(exitAction)}
          onClick={() => triggerAction('skip')}
          className="rounded-2xl border border-stone-300 bg-white px-5 py-4 text-sm font-black text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          换一个
        </button>
        <button
          type="button"
          disabled={Boolean(exitAction)}
          onClick={() => triggerAction('select')}
          className="rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          就吃这个
        </button>
      </div>
      <p className="text-center text-xs font-medium text-stone-500">左滑换一个，右滑就吃这个</p>
    </div>
  );
}
