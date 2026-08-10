import React, { useState } from 'react';
import { MapPin, Search, Sparkles, ChevronRight, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { CategoryType } from '../types';

interface MeituanHeaderProps {
  activeCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onResetSwipe: () => void;
  swipedCount: number;
}

const CATEGORIES: { id: CategoryType; label: string; icon: string }[] = [
  { id: 'all', label: '全部菜品', icon: '🍽️' },
  { id: 'fastfood', label: '炸鸡汉堡', icon: '🍗' },
  { id: 'bbq', label: '夜宵烧烤', icon: '🍢' },
  { id: 'seafood', label: '海鲜虾蟹', icon: '🦞' },
  { id: 'spicy', label: '川湘麻辣', icon: '🌶️' },
  { id: 'light', label: '减脂轻食', icon: '🥗' },
  { id: 'hotpot', label: '特色火锅', icon: '🍲' },
  { id: 'dessert', label: '甜品奶茶', icon: '🧋' },
];

export const MeituanHeader: React.FC<MeituanHeaderProps> = ({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onResetSwipe,
  swipedCount,
}) => {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [location, setLocation] = useState('海珠区 · 东晓南商圈');

  return (
    <header className="bg-[#FFD100] pt-2 pb-3 px-3 shadow-sm sticky top-0 z-30 transition-all">
      {/* Top Location & App Badge */}
      <div className="flex items-center justify-between text-xs mb-2">
        <button
          onClick={() => setShowLocationModal(true)}
          className="flex items-center gap-1 font-bold text-gray-900 bg-black/5 hover:bg-black/10 px-2.5 py-1 rounded-full transition-colors"
        >
          <MapPin className="w-3.5 h-3.5 text-black fill-black/20" />
          <span className="truncate max-w-[170px]">{location}</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
        </button>

        <div className="flex items-center gap-2">
          {swipedCount > 0 && (
            <button
              onClick={onResetSwipe}
              className="flex items-center gap-1 bg-white/90 text-gray-800 px-2 py-1 rounded-full font-medium shadow-xs text-[11px] active:scale-95 transition-transform"
            >
              <RefreshCw className="w-3 h-3 text-amber-600" />
              重新选菜 ({swipedCount})
            </button>
          )}
          <span className="bg-black text-[#FFD100] font-black text-[10px] px-2 py-0.5 rounded-md tracking-wider">
            美团选菜
          </span>
        </div>
      </div>

      {/* Meituan Style Search Bar */}
      <div className="relative flex items-center bg-white rounded-full p-1 pl-3 shadow-xs border border-amber-300/60">
        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-1.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="胖哥俩肉蟹煲 / 小龙虾 / 炸鸡"
          className="w-full text-xs text-gray-800 placeholder-gray-400 bg-transparent outline-none py-1"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="text-gray-400 text-xs px-1 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        <button
          className="bg-[#FFD100] hover:bg-[#ffc800] text-gray-900 font-bold text-xs px-3.5 py-1.5 rounded-full shrink-0 shadow-xs active:scale-95 transition-transform ml-1"
        >
          搜索
        </button>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 px-0.5">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-gray-900 text-[#FFD100] shadow-sm scale-102'
                  : 'bg-white/80 text-gray-800 hover:bg-white'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Location Selector Dialog */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500" />
              修改配送地址
            </h3>
            <div className="space-y-2 mb-4 text-xs">
              {['海珠区 · 东晓南商圈', '天河区 · 体育西路/正佳广场', '越秀区 · 北京路步行街', '番禺区 · 市桥商圈'].map(
                (loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setLocation(loc);
                      setShowLocationModal(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-colors border ${
                      location === loc
                        ? 'border-[#FFD100] bg-amber-50 font-bold text-gray-900'
                        : 'border-gray-100 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {loc}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => setShowLocationModal(false)}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold hover:bg-gray-200"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
