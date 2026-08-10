import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'motion/react';
import {
  Heart,
  X,
  Star,
  RotateCcw,
  Utensils,
  ShoppingBag,
  Info,
  Flame,
  MapPin,
  Clock,
  Dices
} from 'lucide-react';
import { Dish } from '../types';

interface TinderSwipeDeckProps {
  dishes: Dish[];
  onSwipe: (dish: Dish, action: 'like' | 'dislike' | 'superlike') => void;
  onUndo: () => void;
  canUndo: boolean;
  onFinishSwiping: () => void;
  onTriggerDecision: () => void;
  likedCount: number;
}

export const TinderSwipeDeck: React.FC<TinderSwipeDeckProps> = ({
  dishes,
  onSwipe,
  onUndo,
  canUndo,
  onFinishSwiping,
  onTriggerDecision,
  likedCount,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetailModal, setShowDetailModal] = useState<Dish | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Continuous motion values for smooth gesture-based exit
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const cardOpacity = useMotionValue(1);

  // Rotation follows horizontal drag
  const rotate = useTransform(x, [-200, 200], [-22, 22]);

  // Dynamic overlays during dragging
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const dislikeOpacity = useTransform(x, [-20, -100], [0, 1]);
  const superlikeOpacity = useTransform(y, [-20, -100], [0, 1]);

  const currentDish = dishes[currentIndex];
  const nextDish = dishes[currentIndex + 1];

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (isSwiping) return;

    const threshold = 80;
    const velocityThreshold = 250;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      triggerSwipe('like', 'right');
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      triggerSwipe('dislike', 'left');
    } else if (info.offset.y < -threshold || info.velocity.y < -velocityThreshold) {
      triggerSwipe('superlike', 'up');
    } else {
      // Rebound gently back to center from current offset
      animate(x, 0, { type: 'spring', stiffness: 450, damping: 28 });
      animate(y, 0, { type: 'spring', stiffness: 450, damping: 28 });
    }
  };

  const triggerSwipe = (
    action: 'like' | 'dislike' | 'superlike',
    dir: 'left' | 'right' | 'up'
  ) => {
    if (!currentDish || isSwiping) return;
    setIsSwiping(true);

    const currentX = x.get();
    const currentY = y.get();

    let targetX = currentX;
    let targetY = currentY;

    if (dir === 'right') {
      targetX = Math.max(currentX + 350, 550);
    } else if (dir === 'left') {
      targetX = Math.min(currentX - 350, -550);
    } else if (dir === 'up') {
      targetY = Math.min(currentY - 350, -550);
    }

    // Smoothly animate motion values directly from current position
    Promise.all([
      animate(x, targetX, { duration: 0.2, ease: [0.32, 0.72, 0, 1] }),
      animate(y, targetY, { duration: 0.2, ease: [0.32, 0.72, 0, 1] }),
      animate(cardOpacity, 0, { duration: 0.18, ease: 'easeOut' })
    ]).then(() => {
      onSwipe(currentDish, action);
      setCurrentIndex((prev) => prev + 1);
      x.set(0);
      y.set(0);
      cardOpacity.set(1);
      setIsSwiping(false);
    });
  };

  const handleUndoClick = () => {
    if (canUndo && currentIndex > 0 && !isSwiping) {
      onUndo();
      setCurrentIndex((prev) => prev - 1);
      x.set(0);
      y.set(0);
      cardOpacity.set(1);
    }
  };

  const handleResetDeck = () => {
    setCurrentIndex(0);
    x.set(0);
    y.set(0);
    cardOpacity.set(1);
    setIsSwiping(false);
  };

  if (currentIndex >= dishes.length) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center min-h-[70vh] bg-[#F5F5F7]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 max-w-sm w-full"
        >
          <div className="w-16 h-16 bg-[#FFD100] rounded-full flex items-center justify-center mx-auto mb-4 shadow-md text-2xl">
            🎉
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-1">看完全部菜品啦！</h2>
          <p className="text-xs text-gray-500 mb-6">
            你一共选中了 <span className="text-amber-600 font-bold text-sm">{likedCount}</span> 道心仪菜品
          </p>

          <div className="space-y-3">
            {likedCount > 0 && (
              <>
                <button
                  onClick={onTriggerDecision}
                  className="w-full bg-[#FFD100] hover:bg-[#ffc800] text-gray-900 font-extrabold py-3 px-4 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer"
                >
                  <Dices className="w-5 h-5 text-gray-900" />
                  今天吃什么？摇号帮你决断！
                </button>

                <button
                  onClick={onFinishSwiping}
                  className="w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-2xl text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-98 transition-transform cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#FFD100]" />
                  查看备选清单 ({likedCount})
                </button>
              </>
            )}

            <button
              onClick={handleResetDeck}
              className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 px-4 rounded-2xl text-xs hover:bg-gray-200 transition-colors cursor-pointer"
            >
              再刷一遍
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-140px)] px-4 py-2 select-none overflow-hidden">
      {/* Top Counter Bar */}
      <div className="w-full max-w-sm flex items-center justify-between text-xs text-gray-500 mb-2 px-2">
        <span className="font-semibold text-gray-700 flex items-center gap-1">
          <Utensils className="w-3.5 h-3.5 text-amber-500" />
          滑动选菜器
        </span>
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
            已挑 {currentIndex + 1} / {dishes.length}
          </span>
          <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Heart className="w-3 h-3 fill-red-500" /> {likedCount}
          </span>
        </div>
      </div>

      {/* Card Deck Area */}
      <div className="relative w-full max-w-sm h-[480px] flex items-center justify-center">
        {/* Next Card Background Preview */}
        {nextDish && (
          <motion.div
            animate={{
              scale: isSwiping ? 1 : 0.95,
              y: isSwiping ? 0 : 12,
              opacity: isSwiping ? 1 : 0.7,
            }}
            transition={{ duration: 0.2 }}
            className="absolute w-full h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden pointer-events-none"
          >
            <div className="h-60 w-full bg-gray-100 relative">
              <img
                src={nextDish.image}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <div className="text-[10px] text-amber-300 font-bold">{nextDish.storeName}</div>
                <div className="font-extrabold text-base line-clamp-1">{nextDish.name}</div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex gap-1">
                {nextDish.coupons.slice(0, 2).map((c, i) => (
                  <span key={i} className="bg-red-50 text-red-600 font-bold text-[9px] px-1.5 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">{nextDish.description}</p>
            </div>
          </motion.div>
        )}

        {/* Active Top Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDish.id}
            style={{ x, y, rotate, opacity: cardOpacity }}
            drag={!isSwiping}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.85}
            onDragEnd={handleDragEnd}
            whileGrab={{ cursor: 'grabbing' }}
            className="absolute w-full h-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col justify-between cursor-grab touch-pan-y z-10"
          >
            {/* Visual Drag Feedback Overlays */}
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-6 right-6 z-20 bg-emerald-500 text-white font-black text-lg px-3.5 py-1 rounded-2xl border-2 border-white shadow-lg rotate-12 flex items-center gap-1 pointer-events-none"
            >
              <Heart className="w-5 h-5 fill-white" /> 想吃 / YUM
            </motion.div>

            <motion.div
              style={{ opacity: dislikeOpacity }}
              className="absolute top-6 left-6 z-20 bg-rose-500 text-white font-black text-lg px-3.5 py-1 rounded-2xl border-2 border-white shadow-lg -rotate-12 flex items-center gap-1 pointer-events-none"
            >
              <X className="w-5 h-5 stroke-[3]" /> 换一个
            </motion.div>

            <motion.div
              style={{ opacity: superlikeOpacity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xl px-5 py-2 rounded-2xl border-2 border-white shadow-2xl flex items-center gap-1.5 pointer-events-none"
            >
              <Star className="w-6 h-6 fill-white" /> 必吃超赞
            </motion.div>

            {/* Dish Hero Image with Badges */}
            <div className="relative h-60 w-full shrink-0 bg-gray-100 overflow-hidden">
              <img
                src={currentDish.image}
                alt={currentDish.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

              {/* Top Rating & Distance Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                <span className="bg-amber-400/95 text-gray-900 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                  ⭐ {currentDish.rating}分
                </span>
                {currentDish.isBestSeller && (
                  <span className="bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-white" /> 必点榜TOP
                  </span>
                )}
              </div>

              {/* Delivery Time & Distance */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 text-amber-400" /> {currentDish.distance}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 text-amber-400" /> {currentDish.deliveryTime}
                </span>
              </div>

              {/* Bottom Image Overlay Info */}
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <div className="text-[11px] text-amber-300 font-semibold mb-0.5 flex items-center gap-1">
                  <span>{currentDish.storeName}</span>
                  {currentDish.storeBadge && (
                    <span className="bg-emerald-600/80 text-white text-[9px] px-1.5 py-0.2 rounded">
                      {currentDish.storeBadge}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-lg leading-tight line-clamp-1">{currentDish.name}</h3>
              </div>
            </div>

            {/* Dish Card Content Details */}
            <div className="p-4 flex-1 flex flex-col justify-between bg-white">
              <div className="space-y-2">
                {/* Meituan Style Discount Badges */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  {currentDish.coupons.map((coupon, idx) => (
                    <span
                      key={idx}
                      className="bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded border border-red-200/80"
                    >
                      神券 {coupon}
                    </span>
                  ))}
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {currentDish.minOrder}
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {currentDish.deliveryFee}
                  </span>
                </div>

                {/* Taste/Review Quote Tags */}
                <div className="flex items-center gap-1 flex-wrap">
                  {currentDish.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-amber-50 text-amber-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-200/50"
                    >
                      “{tag}”
                    </span>
                  ))}
                </div>

                {/* Short Description */}
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {currentDish.description}
                </p>
              </div>

              {/* Price Row & Detail Button */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-red-600">¥</span>
                  <span className="text-2xl font-black text-red-600 leading-none">
                    {currentDish.price}
                  </span>
                  {currentDish.originalPrice && (
                    <span className="text-xs text-gray-400 line-through">
                      ¥{currentDish.originalPrice}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-1">
                    {currentDish.salesCount}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailModal(currentDish);
                  }}
                  className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" /> 详情
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Swipe Action Controls Bar */}
      <div className="w-full max-w-sm flex items-center justify-around py-2 px-4 mt-2">
        {/* Undo Button */}
        <button
          onClick={handleUndoClick}
          disabled={!canUndo || currentIndex === 0}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer ${
            canUndo && currentIndex > 0
              ? 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
              : 'bg-gray-100 text-gray-300 border border-gray-100 cursor-not-allowed'
          }`}
          title="撤销上一划"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Swipe Left (Dislike) */}
        <button
          onClick={() => triggerSwipe('dislike', 'left')}
          disabled={isSwiping}
          className="w-14 h-14 bg-white text-rose-500 border-2 border-rose-100 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-50 active:scale-90 transition-transform cursor-pointer"
          title="不喜欢 / 换一个"
        >
          <X className="w-7 h-7 stroke-[2.5]" />
        </button>

        {/* Super Like / Star */}
        <button
          onClick={() => triggerSwipe('superlike', 'up')}
          disabled={isSwiping}
          className="w-12 h-12 bg-gradient-to-tr from-amber-400 to-[#FFD100] text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:brightness-105 active:scale-90 transition-transform cursor-pointer"
          title="必吃榜 / 强推"
        >
          <Star className="w-6 h-6 fill-gray-900" />
        </button>

        {/* Swipe Right (Like) */}
        <button
          onClick={() => triggerSwipe('like', 'right')}
          disabled={isSwiping}
          className="w-14 h-14 bg-[#FFD100] text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:bg-[#ffc800] active:scale-90 transition-transform cursor-pointer"
          title="喜欢 / 想吃"
        >
          <Heart className="w-7 h-7 fill-gray-900" />
        </button>

        {/* Decision Wheel Trigger Button */}
        <button
          onClick={onTriggerDecision}
          className="w-11 h-11 bg-gray-900 text-[#FFD100] rounded-full flex items-center justify-center shadow-md hover:bg-gray-800 active:scale-90 transition-transform cursor-pointer"
          title="决策转盘摇号"
        >
          <Dices className="w-5 h-5" />
        </button>
      </div>

      {/* Dish Detailed Info Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 shadow-2xl relative"
          >
            <button
              onClick={() => setShowDetailModal(null)}
              className="absolute top-4 right-4 bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <img
              src={showDetailModal.image}
              alt=""
              className="w-full h-48 object-cover rounded-2xl mb-4"
              referrerPolicy="no-referrer"
            />

            <div className="text-xs text-amber-600 font-bold mb-1">
              {showDetailModal.storeName}
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">
              {showDetailModal.name}
            </h2>

            <p className="text-xs text-gray-600 leading-relaxed mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
              {showDetailModal.description}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                <span className="text-gray-500 block text-[10px]">卡路里估算</span>
                <span className="font-bold text-amber-900 text-sm">
                  {showDetailModal.calories || '约 550'} kcal
                </span>
              </div>
              <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                <span className="text-gray-500 block text-[10px]">辣度指数</span>
                <span className="font-bold text-red-900 text-sm">
                  {showDetailModal.spicyLevel === 0
                    ? '🌶️ 不辣'
                    : '🌶️'.repeat(showDetailModal.spicyLevel || 1)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-red-600">¥</span>
                <span className="text-2xl font-black text-red-600">
                  {showDetailModal.price}
                </span>
              </div>

              <button
                onClick={() => {
                  triggerSwipe('like', 'right');
                  setShowDetailModal(null);
                }}
                className="bg-[#FFD100] text-gray-900 font-extrabold px-5 py-2.5 rounded-full text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-gray-900" />
                加入我的选菜候选
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
