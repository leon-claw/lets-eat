export type TabType = 'swipe' | 'coupons' | 'liked' | 'orders' | 'settings';

export type CategoryType = 'all' | 'fastfood' | 'bbq' | 'seafood' | 'spicy' | 'light' | 'dessert' | 'hotpot';

export interface Dish {
  id: string;
  name: string;
  storeName: string;
  storeBadge?: string; // e.g. "堂食店", "无明厨亮灶", "点评收录8年"
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  salesCount: string; // e.g. "月售2000+"
  deliveryFee: string; // e.g. "免配送费", "配送约¥1"
  minOrder: string; // e.g. "起送 ¥15"
  distance: string; // e.g. "1.4km"
  deliveryTime: string; // e.g. "30分钟"
  tags: string[]; // e.g. ["是脆脆的", "芝士超香浓", "掌中宝脆得刚好"]
  coupons: string[]; // e.g. ["满25减7", "满30减11", "新客减1"]
  isBestSeller?: boolean; // 必点榜
  category: CategoryType;
  description: string;
  calories?: number;
  spicyLevel?: number; // 0: 不辣, 1: 微辣, 2: 中辣, 3: 重辣
}

export interface UserSettings {
  elderMode: boolean;
  minorMode: boolean;
  language: string;
  accountStatus: string;
  address: string;
  autoOrder: boolean;
  budgetLimit: number;
  spicyPreference: 'all' | 'none' | 'spicyOnly';
}

export interface SwipeRecord {
  dish: Dish;
  action: 'like' | 'dislike' | 'superlike';
  timestamp: number;
}
