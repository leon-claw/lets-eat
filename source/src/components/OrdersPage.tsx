import React from 'react';
import { ShoppingBag, Clock, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Dish, SwipeRecord } from '../types';

interface OrdersPageProps {
  swipeRecords: SwipeRecord[];
  onReOrder: (dish: Dish) => void;
  onGoToSwipe: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  swipeRecords,
  onReOrder,
  onGoToSwipe,
}) => {
  const recentOrders = [
    {
      id: 'o1',
      storeName: 'BOOCUR CHICKEN 不可炸鸡(海珠店)',
      time: '2026-08-08 19:20',
      status: '订单已完成',
      items: '黄金芝士土豆球套餐等共2件',
      price: 26.8,
      image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=200&auto=format&fit=crop&q=80',
    },
    {
      id: 'o2',
      storeName: '熊记虾王(小龙虾·东晓南店)',
      time: '2026-08-05 21:10',
      status: '订单已完成',
      items: '招牌蒜香小龙虾超大份',
      price: 88.0,
      image: 'https://images.unsplash.com/photo-1559742811-822863c46f83?w=200&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <div className="p-4 max-w-md mx-auto pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">选菜与订单记录</h2>
        <span className="text-xs text-gray-400">美团吃什么</span>
      </div>

      {/* Swipe History Summary */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
        <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between">
          <span>本次刷一刷历史 ({swipeRecords.length})</span>
          <button
            onClick={onGoToSwipe}
            className="text-amber-700 text-[11px] font-bold flex items-center gap-0.5 hover:underline"
          >
            继续挑选 <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {swipeRecords.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 text-center">暂无滑动选菜记录，去滑一滑吧！</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
            {swipeRecords.slice(-5).reverse().map((rec, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                      rec.action === 'like'
                        ? 'bg-red-50 text-red-600'
                        : rec.action === 'superlike'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rec.action === 'like'
                      ? '❤️ 想吃'
                      : rec.action === 'superlike'
                      ? '🌟 必吃'
                      : '👎 跳过'}
                  </span>
                  <span className="font-bold text-gray-800 truncate">{rec.dish.name}</span>
                </div>
                <span className="text-gray-400 text-[10px] shrink-0">¥{rec.dish.price}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mock Meituan Order Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 pl-1">近期美团外卖订单</h3>
        {recentOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3"
          >
            <div className="flex items-center justify-between text-xs border-b border-gray-50 pb-2">
              <span className="font-bold text-gray-900 truncate max-w-[200px]">
                {order.storeName}
              </span>
              <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {order.status}
              </span>
            </div>

            <div className="flex gap-3 items-center">
              <img
                src={order.image}
                alt=""
                className="w-14 h-14 object-cover rounded-xl shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{order.items}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{order.time}</div>
                <div className="text-xs font-black text-gray-900 mt-1">
                  实付 ¥{order.price.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-50">
              <button
                onClick={() => alert(`已为您再次加入购物车：【${order.storeName}】`)}
                className="bg-[#FFD100] text-gray-900 font-bold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-3 h-3 text-gray-900" />
                再来一单
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
