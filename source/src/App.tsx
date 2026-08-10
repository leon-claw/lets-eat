import React, { useState, useMemo } from 'react';
import { TabType, CategoryType, Dish, SwipeRecord, UserSettings } from './types';
import { INITIAL_DISHES } from './data/dishes';
import { MeituanHeader } from './components/MeituanHeader';
import { TinderSwipeDeck } from './components/TinderSwipeDeck';
import { LikedList } from './components/LikedList';
import { CouponCenter } from './components/CouponCenter';
import { OrdersPage } from './components/OrdersPage';
import { SettingsPage } from './components/SettingsPage';
import { BottomNavBar } from './components/BottomNavBar';
import { DecisionWheelModal } from './components/DecisionWheelModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('swipe');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [likedDishes, setLikedDishes] = useState<Dish[]>([]);
  const [swipeRecords, setSwipeRecords] = useState<SwipeRecord[]>([]);
  const [isDecisionWheelOpen, setIsDecisionWheelOpen] = useState(false);

  const [userSettings, setUserSettings] = useState<UserSettings>({
    elderMode: false,
    minorMode: false,
    language: '简体中文',
    accountStatus: '实名待认证',
    address: '海珠区东晓南路128号',
    autoOrder: false,
    budgetLimit: 50,
    spicyPreference: 'all',
  });

  // Filter dishes by category & search query
  const filteredDishes = useMemo(() => {
    return INITIAL_DISHES.filter((d) => {
      const matchesCategory = activeCategory === 'all' || d.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Handle Tinder Swipe Action
  const handleSwipe = (dish: Dish, action: 'like' | 'dislike' | 'superlike') => {
    const record: SwipeRecord = {
      dish,
      action,
      timestamp: Date.now(),
    };
    setSwipeRecords((prev) => [...prev, record]);

    if (action === 'like' || action === 'superlike') {
      if (!likedDishes.some((item) => item.id === dish.id)) {
        setLikedDishes((prev) => [dish, ...prev]);
      }
    }
  };

  // Undo last swipe
  const handleUndo = () => {
    if (swipeRecords.length === 0) return;

    const lastRecord = swipeRecords[swipeRecords.length - 1];
    setSwipeRecords((prev) => prev.slice(0, -1));

    if (lastRecord.action === 'like' || lastRecord.action === 'superlike') {
      setLikedDishes((prev) => prev.filter((d) => d.id !== lastRecord.dish.id));
    }
  };

  const handleResetSwipe = () => {
    setSwipeRecords([]);
    setLikedDishes([]);
  };

  const handleRemoveLiked = (dishId: string) => {
    setLikedDishes((prev) => prev.filter((d) => d.id !== dishId));
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setUserSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <div
      className={`min-h-screen bg-[#F5F5F7] text-gray-900 font-sans antialiased ${
        userSettings.elderMode ? 'text-lg' : 'text-sm'
      }`}
    >
      {/* Phone App Frame Container for Mobile Aesthetic */}
      <div className="max-w-md mx-auto min-h-screen bg-[#F5F5F7] relative shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Header - Only on Swipe tab */}
        {activeTab === 'swipe' && (
          <MeituanHeader
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onResetSwipe={handleResetSwipe}
            swipedCount={swipeRecords.length}
          />
        )}

        {/* Main Tab Views */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'swipe' && (
            <TinderSwipeDeck
              dishes={filteredDishes}
              onSwipe={handleSwipe}
              onUndo={handleUndo}
              canUndo={swipeRecords.length > 0}
              onFinishSwiping={() => setActiveTab('liked')}
              onTriggerDecision={() => setIsDecisionWheelOpen(true)}
              likedCount={likedDishes.length}
            />
          )}

          {activeTab === 'coupons' && <CouponCenter />}

          {activeTab === 'liked' && (
            <LikedList
              likedDishes={likedDishes}
              onRemoveLiked={handleRemoveLiked}
              onOpenDecisionWheel={() => setIsDecisionWheelOpen(true)}
              onGoToSwipe={() => setActiveTab('swipe')}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersPage
              swipeRecords={swipeRecords}
              onReOrder={(dish) => {
                if (!likedDishes.some((d) => d.id === dish.id)) {
                  setLikedDishes([dish, ...likedDishes]);
                }
                setActiveTab('liked');
              }}
              onGoToSwipe={() => setActiveTab('swipe')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={userSettings}
              onUpdateSettings={handleUpdateSettings}
              onBackToSwipe={() => setActiveTab('swipe')}
            />
          )}
        </main>

        {/* Decision Wheel Randomizer Modal */}
        <DecisionWheelModal
          isOpen={isDecisionWheelOpen}
          onClose={() => setIsDecisionWheelOpen(false)}
          likedDishes={likedDishes}
          allDishes={filteredDishes}
        />

        {/* Bottom Meituan Navigation Bar */}
        <BottomNavBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          likedCount={likedDishes.length}
        />
      </div>
    </div>
  );
}
