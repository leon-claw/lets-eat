import React from 'react';
import { Utensils, Tag, Heart, ShoppingBag, Settings, Flame } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavBarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  likedCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onChangeTab,
  likedCount,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'swipe',
      label: '刷一刷',
      icon: <Utensils className="w-5 h-5" />,
    },
    {
      id: 'coupons',
      label: '神券',
      icon: <Tag className="w-5 h-5" />,
    },
    {
      id: 'liked',
      label: '备选',
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'orders',
      label: '订单',
      icon: <ShoppingBag className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: '设置',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 max-w-md mx-auto shadow-lg select-none px-2 py-1">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-gray-900 font-extrabold scale-105'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              {/* Meituan Style Active Yellow Icon Circle Container */}
              <div
                className={`p-1.5 rounded-full transition-all ${
                  isActive ? 'bg-[#FFD100] text-gray-900 shadow-xs' : 'bg-transparent'
                }`}
              >
                {tab.icon}
              </div>

              <span className="text-[10px] mt-0.5 leading-none">{tab.label}</span>

              {/* Badge for Liked items count */}
              {tab.id === 'liked' && likedCount > 0 && (
                <span className="absolute top-0.5 right-1.5 bg-red-500 text-white font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                  {likedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
