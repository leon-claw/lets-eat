import React from 'react';
import { Heart, Trash2, Dices, ShoppingBag, Star, Clock, MapPin, ExternalLink } from 'lucide-react';
import { Dish } from '../types';

interface LikedListProps {
  likedDishes: Dish[];
  onRemoveLiked: (dishId: string) => void;
  onOpenDecisionWheel: () => void;
  onGoToSwipe: () => void;
}

export const LikedList: React.FC<LikedListProps> = ({
  likedDishes,
  onRemoveLiked,
  onOpenDecisionWheel,
  onGoToSwipe,
}) => {
  const totalPrice = likedDishes.reduce((acc, curr) => acc + curr.price, 0);

  if (likedDishes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-3 text-2xl">
          ❤️
        </div>
        <h3 className="text-base font-extrabold text-gray-900 mb-1">选菜备选清单为空</h3>
        <p className="text-xs text-gray-400 max-w-xs mb-5">
          在“刷一刷”页面向右滑心仪的菜品，即可添加至备选清单！
        </p>
        <button
          onClick={onGoToSwipe}
          className="bg-[#FFD100] text-gray-900 font-extrabold text-xs px-6 py-2.5 rounded-full shadow-md active:scale-95 transition-transform"
        >
          去划一划选菜
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-24">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-4 rounded-2xl mb-4 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-xs text-amber-900 font-extrabold flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            已选 {likedDishes.length} 道心仪菜品
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            合计预估: <span className="font-black text-red-600 text-sm">¥{totalPrice.toFixed(1)}</span>
          </div>
        </div>

        <button
          onClick={onOpenDecisionWheel}
          className="bg-[#FFD100] hover:bg-[#ffc800] text-gray-900 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Dices className="w-4 h-4 text-gray-900" />
          摇号做决定
        </button>
      </div>

      {/* Liked Cards List */}
      <div className="space-y-3">
        {likedDishes.map((dish) => (
          <div
            key={dish.id}
            className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 flex gap-3 relative overflow-hidden group"
          >
            <img
              src={dish.image}
              alt=""
              className="w-22 h-22 object-cover rounded-xl shrink-0"
              referrerPolicy="no-referrer"
            />

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-gray-400 truncate">{dish.storeName}</span>
                  <button
                    onClick={() => onRemoveLiked(dish.id)}
                    className="text-gray-300 hover:text-red-500 p-1 text-xs"
                    title="从清单中移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4 className="font-extrabold text-sm text-gray-900 truncate leading-snug">
                  {dish.name}
                </h4>

                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-bold">
                    ⭐ {dish.rating}
                  </span>
                  <span>•</span>
                  <span>{dish.distance}</span>
                  <span>•</span>
                  <span>{dish.deliveryFee}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-50">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-red-600 font-bold">¥</span>
                  <span className="text-base font-black text-red-600">{dish.price}</span>
                </div>

                <button
                  onClick={() => alert(`模拟跳转美团订单外卖提交页面：【${dish.storeName} - ${dish.name}】`)}
                  className="bg-gray-900 hover:bg-gray-800 text-[#FFD100] text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <ShoppingBag className="w-3 h-3" />
                  一键下单
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
