import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Dices, RefreshCw, Sparkles, X } from 'lucide-react';
import type { FoodChoice } from '@/entities/food-choice/types';

interface DecisionWheelDialogProps {
  isOpen: boolean;
  choices: FoodChoice[];
  onClose(): void;
}

export function DecisionWheelDialog({ isOpen, choices, onClose }: DecisionWheelDialogProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [winner, setWinner] = useState<FoodChoice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsSpinning(false);
    setHighlightIndex(0);
    setWinner(null);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const startSpin = () => {
    if (choices.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setWinner(null);
    const steps = choices.length * 5 + Math.floor(Math.random() * choices.length);
    let step = 0;

    const spin = () => {
      step += 1;
      setHighlightIndex(step % choices.length);

      if (step >= steps) {
        const winnerIndex = Math.floor(Math.random() * choices.length);
        setHighlightIndex(winnerIndex);
        setWinner(choices[winnerIndex]);
        setIsSpinning(false);
        timerRef.current = null;
        return;
      }

      timerRef.current = setTimeout(spin, 75);
    };

    spin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-wheel-title"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-5 shadow-2xl"
      >
        <button type="button" aria-label="关闭摇号" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-slate-500 hover:text-slate-900">
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8 text-center">
          <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900"><Dices className="h-4 w-4" /> 治愈选择困难症</p>
          <h2 id="decision-wheel-title" className="mt-2 text-xl font-black text-slate-900">今天吃什么？摇号决断！</h2>
          <p className="mt-1 text-xs text-slate-500">
            {choices.length > 0 ? `从你选中的 ${choices.length} 道备选菜品中挑选` : '先右划加入至少一道备选菜系'}
          </p>
        </div>

        {choices.length > 0 && (
          <div className="my-5 grid grid-cols-2 gap-2">
            {choices.slice(0, 6).map((choice, index) => {
              const isWinner = winner?.id === choice.id;
              const isHighlighted = isSpinning && highlightIndex === index;
              return (
                <article key={choice.id} className={`relative flex items-center gap-2 overflow-hidden rounded-2xl border p-2 transition ${isWinner ? 'border-[#FFD100] bg-amber-100 ring-2 ring-[#FFD100]' : isHighlighted ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                  <img src={choice.coverImage} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <h3 className="truncate text-xs font-bold text-slate-900">{choice.name}</h3>
                  {isWinner && <CheckCircle2 className="absolute right-1 top-1 h-4 w-4 text-emerald-600" />}
                </article>
              );
            })}
          </div>
        )}

        {winner ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-4 rounded-2xl border-2 border-[#FFD100] bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-center">
            <p className="flex items-center justify-center gap-1 text-xs font-black text-amber-800"><Sparkles className="h-4 w-4" /> 天意决定，今天就吃它！</p>
            <p className="mt-1 text-lg font-black text-slate-900">{winner.name}</p>
          </motion.div>
        ) : (
          <div className="my-4 flex h-14 items-center justify-center text-xs text-slate-400">
            {isSpinning ? '🎲 命运之轮高速旋转中…' : '点击下方按钮，一键做决定！'}
          </div>
        )}

        <button type="button" onClick={startSpin} disabled={isSpinning || choices.length === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-4 py-3 text-sm font-black text-slate-900 shadow-md transition hover:bg-[#ffc800] disabled:cursor-not-allowed disabled:opacity-45">
          {isSpinning ? <><RefreshCw className="h-4 w-4 animate-spin" /> 摇号决断中…</> : winner ? <><RefreshCw className="h-4 w-4" /> 不服气？重新摇一次</> : <><Dices className="h-4 w-4" /> 开始摇号选菜</>}
        </button>
      </motion.section>
    </div>
  );
}
