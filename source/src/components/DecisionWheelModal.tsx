import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Dices, Utensils, CheckCircle2, RefreshCw, ShoppingBag, X } from 'lucide-react';
import { Dish } from '../types';

interface DecisionWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  likedDishes: Dish[];
  allDishes: Dish[];
}

export const DecisionWheelModal: React.FC<DecisionWheelModalProps> = ({
  isOpen,
  onClose,
  likedDishes,
  allDishes,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Dish | null>(null);
  const [candidateList, setCandidateList] = useState<Dish[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const list = likedDishes.length > 0 ? likedDishes : allDishes.slice(0, 6);
      setCandidateList(list);
      setWinner(null);
    }
  }, [isOpen, likedDishes, allDishes]);

  const startRandomSpin = () => {
    if (candidateList.length === 0) return;
    setIsSpinning(true);
    setWinner(null);

    let counter = 0;
    const totalSteps = 25 + Math.floor(Math.random() * 10);
    const interval = setInterval(() => {
      counter++;
      setHighlightIndex((prev) => (prev + 1) % candidateList.length);

      if (counter >= totalSteps) {
        clearInterval(interval);
        const finalWinnerIndex = Math.floor(Math.random() * candidateList.length);
        setHighlightIndex(finalWinnerIndex);
        setWinner(candidateList[finalWinnerIndex]);
        setIsSpinning(false);
      }
    }, 80);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl relative overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-gray-100 text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 font-extrabold text-xs px-3 py-1 rounded-full mb-1">
            <Dices className="w-4 h-4 text-amber-600" />
            治愈选择困难症
          </div>
          <h3 className="text-lg font-black text-gray-900">今天吃什么？摇号决断！</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {likedDishes.length > 0
              ? `从你选中的 ${likedDishes.length} 道备选菜品中挑选`
              : '从推荐菜品中随机挑选'}
          </p>
        </div>

        {/* Candidate Cards Grid / Slot Machine */}
        <div className="grid grid-cols-2 gap-2 my-4">
          {candidateList.slice(0, 6).map((dish, idx) => {
            const isSelected = highlightIndex === idx;
            const isWinner = winner?.id === dish.id;

            return (
              <div
                key={dish.id}
                className={`relative rounded-2xl p-2 border transition-all flex items-center gap-2 overflow-hidden ${
                  isWinner
                    ? 'bg-amber-100 border-[#FFD100] ring-2 ring-[#FFD100] scale-102 shadow-md'
                    : isSelected
                    ? 'bg-amber-50 border-amber-300 scale-98'
                    : 'bg-gray-50 border-gray-100 opacity-80'
                }`}
              >
                <img
                  src={dish.image}
                  alt=""
                  className="w-10 h-10 object-cover rounded-xl shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-gray-900 truncate">
                    {dish.name}
                  </div>
                  <div className="text-[9px] text-red-600 font-bold">
                    ¥{dish.price}
                  </div>
                </div>

                {isWinner && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute top-1 right-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Winner Showcase */}
        {winner ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-[#FFD100] rounded-2xl p-3 text-center my-3"
          >
            <div className="text-xs font-bold text-amber-800 mb-1 flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              天意决定，今天就吃它！
            </div>
            <div className="font-extrabold text-gray-900 text-sm">{winner.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{winner.storeName}</div>
            <div className="text-sm font-black text-red-600 mt-1">¥{winner.price}</div>
          </motion.div>
        ) : (
          <div className="h-16 flex items-center justify-center text-xs text-gray-400 italic">
            {isSpinning ? '🎲 命运之轮高速旋转中...' : '点击下方按钮，一键做决定！'}
          </div>
        )}

        {/* Control Buttons */}
        <div className="space-y-2 mt-2">
          <button
            onClick={startRandomSpin}
            disabled={isSpinning}
            className={`w-full bg-[#FFD100] hover:bg-[#ffc800] text-gray-900 font-black py-3 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform ${
              isSpinning ? 'opacity-50 cursor-wait' : ''
            }`}
          >
            {isSpinning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-gray-900" />
                摇号决断中...
              </>
            ) : winner ? (
              <>
                <RefreshCw className="w-4 h-4 text-gray-900" />
                不服气？重新摇一次
              </>
            ) : (
              <>
                <Dices className="w-4 h-4 text-gray-900" />
                开始摇号选菜
              </>
            )}
          </button>

          {winner && (
            <button
              onClick={() => {
                alert(`已成功帮你下决断！为您跳转下单页面：【${winner.storeName} - ${winner.name}】`);
                onClose();
              }}
              className="w-full bg-gray-900 text-[#FFD100] font-bold py-2.5 rounded-2xl text-xs shadow-sm flex items-center justify-center gap-1.5 hover:bg-gray-800"
            >
              <ShoppingBag className="w-4 h-4" />
              就吃这个，去下单 (¥{winner.price})
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
