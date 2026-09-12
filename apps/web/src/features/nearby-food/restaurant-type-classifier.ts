export type NearbyRestaurantClassification = {
  category: string;
  confidence: number;
  source: 'local-model' | 'fallback';
};

type Feature = {
  phrase: string;
  weight: number;
};

const FALLBACK_CATEGORY = '其他';

// 这是一个很小的本地线性分类器：用商家名称中的短语作为特征，
// 特征权重越高，代表它对菜系的区分度越强。它不改变高德原始分类。
const CATEGORY_FEATURES: Record<string, Feature[]> = {
  粤菜: [
    { phrase: '粤菜', weight: 4 },
    { phrase: '广东菜', weight: 4 },
    { phrase: '潮州菜', weight: 4 },
    { phrase: '潮汕', weight: 3 },
    { phrase: '烧鹅', weight: 3 },
    { phrase: '早茶', weight: 3 },
  ],
  川菜: [
    { phrase: '川菜', weight: 4 },
    { phrase: '四川菜', weight: 4 },
    { phrase: '川味', weight: 3 },
    { phrase: '麻辣', weight: 2 },
    { phrase: '水煮鱼', weight: 3 },
    { phrase: '冒菜', weight: 3 },
  ],
  湘菜: [
    { phrase: '湘菜', weight: 4 },
    { phrase: '湖南菜', weight: 4 },
    { phrase: '湘味', weight: 3 },
    { phrase: '剁椒', weight: 3 },
    { phrase: '小炒肉', weight: 3 },
  ],
  火锅: [
    { phrase: '火锅', weight: 5 },
    { phrase: '串串', weight: 4 },
    { phrase: '冒菜', weight: 3 },
    { phrase: '涮', weight: 3 },
    { phrase: '牛油', weight: 3 },
    { phrase: '麻辣烫', weight: 4 },
  ],
  烧烤: [
    { phrase: '烧烤', weight: 5 },
    { phrase: '烤串', weight: 4 },
    { phrase: '炭火', weight: 3 },
    { phrase: '烤肉', weight: 3 },
    { phrase: 'bbq', weight: 4 },
  ],
  螺蛳粉: [
    { phrase: '螺蛳粉', weight: 5 },
    { phrase: '柳州螺蛳粉', weight: 5 },
    { phrase: '螺丝粉', weight: 5 },
  ],
  日料: [
    { phrase: '日料', weight: 5 },
    { phrase: '日本料理', weight: 5 },
    { phrase: '寿司', weight: 4 },
    { phrase: '刺身', weight: 4 },
    { phrase: '和食', weight: 4 },
    { phrase: '居酒屋', weight: 4 },
    { phrase: '天妇罗', weight: 4 },
  ],
  韩餐: [
    { phrase: '韩餐', weight: 5 },
    { phrase: '韩国料理', weight: 5 },
    { phrase: '韩式', weight: 4 },
    { phrase: '石锅', weight: 3 },
    { phrase: '泡菜', weight: 3 },
    { phrase: '部队锅', weight: 4 },
  ],
  西餐: [
    { phrase: '西餐', weight: 5 },
    { phrase: '牛排', weight: 4 },
    { phrase: '扒房', weight: 4 },
    { phrase: '披萨', weight: 4 },
    { phrase: 'pizza', weight: 4 },
    { phrase: '意大利', weight: 4 },
    { phrase: '意面', weight: 4 },
    { phrase: '汉堡', weight: 3 },
  ],
  东南亚菜: [
    { phrase: '泰国菜', weight: 5 },
    { phrase: '越南菜', weight: 5 },
    { phrase: '东南亚', weight: 5 },
    { phrase: '泰式', weight: 4 },
    { phrase: '越式', weight: 4 },
    { phrase: '冬阴功', weight: 4 },
    { phrase: '叻沙', weight: 4 },
  ],
  东北菜: [
    { phrase: '东北菜', weight: 5 },
    { phrase: '东北', weight: 3 },
    { phrase: '锅包肉', weight: 4 },
    { phrase: '铁锅炖', weight: 4 },
    { phrase: '杀猪菜', weight: 4 },
  ],
  云南菜: [
    { phrase: '云南菜', weight: 5 },
    { phrase: '云南', weight: 3 },
    { phrase: '过桥米线', weight: 4 },
    { phrase: '菌子', weight: 3 },
    { phrase: '汽锅鸡', weight: 4 },
  ],
  面食: [
    { phrase: '面馆', weight: 4 },
    { phrase: '面食', weight: 4 },
    { phrase: '拉面', weight: 4 },
    { phrase: '刀削面', weight: 4 },
    { phrase: '牛肉面', weight: 4 },
    { phrase: '面条', weight: 3 },
  ],
  轻食: [
    { phrase: '轻食', weight: 5 },
    { phrase: '沙拉', weight: 4 },
    { phrase: '低卡', weight: 3 },
    { phrase: '健身餐', weight: 4 },
    { phrase: '三明治', weight: 3 },
  ],
  甜品奶茶: [
    { phrase: '奶茶', weight: 5 },
    { phrase: '咖啡', weight: 4 },
    { phrase: '甜品', weight: 4 },
    { phrase: '甜点', weight: 4 },
    { phrase: '蛋糕', weight: 4 },
    { phrase: '面包', weight: 3 },
    { phrase: '冰淇淋', weight: 4 },
    { phrase: '星巴克', weight: 5 },
  ],
  海鲜: [
    { phrase: '海鲜', weight: 5 },
    { phrase: '海产', weight: 4 },
    { phrase: '渔港', weight: 3 },
    { phrase: '生蚝', weight: 4 },
    { phrase: '海胆', weight: 4 },
  ],
};

const CATEGORY_NAMES = Object.keys(CATEGORY_FEATURES);

function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[、，。！？；：/\\|()[\]{}<>《》“”‘’'"`·•_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fallback(confidence = 0): NearbyRestaurantClassification {
  return {
    category: FALLBACK_CATEGORY,
    confidence: clamp(confidence),
    source: 'fallback',
  };
}

export function classifyNearbyRestaurantName(name: string): NearbyRestaurantClassification {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return fallback();
  }

  const scores = CATEGORY_NAMES.map((category) => {
    const score = CATEGORY_FEATURES[category].reduce(
      (total, feature) => (normalizedName.includes(feature.phrase) ? total + feature.weight : total),
      0,
    );

    return { category, score };
  }).sort((left, right) => right.score - left.score);

  const [best, second] = scores;
  if (!best || best.score < 3 || best.score - (second?.score ?? 0) < 1) {
    return fallback();
  }

  const confidence = clamp(best.score / (best.score + (second?.score ?? 0) + 1));
  return {
    category: best.category,
    confidence,
    source: 'local-model',
  };
}
