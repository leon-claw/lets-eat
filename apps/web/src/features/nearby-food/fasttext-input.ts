export const NEARBY_FASTTEXT_CATEGORIES = [
  '粤菜',
  '川菜',
  '湘菜',
  '火锅',
  '烧烤',
  '螺蛳粉',
  '日料',
  '韩餐',
  '西餐',
  '东南亚菜',
  '东北菜',
  '云南菜',
  '面食',
  '轻食',
  '甜品奶茶',
  '海鲜',
  '其他',
] as const;

const FASTTEXT_LABEL_PREFIX = '__label__';

function cleanText(value: string): string {
  return String(value).replace(/[\r\n\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatNearbyRestaurantForFastText(name: string, amapType: string): string {
  const nameFeature = cleanText(name).replace(/\s/g, '_');
  const amapFeatures = cleanText(amapType)
    .split(' ')
    .flatMap((part) => part.split('|'))
    .filter(Boolean)
    .map((part) => `amap_${part.replace(/[()（）/]/g, '_')}`);

  return [`name_${nameFeature}`, ...amapFeatures].join(' ');
}

export function parseNearbyFastTextLabel(label: string): typeof NEARBY_FASTTEXT_CATEGORIES[number] | undefined {
  const normalizedLabel = String(label).trim().replace(FASTTEXT_LABEL_PREFIX, '');
  return (NEARBY_FASTTEXT_CATEGORIES as readonly string[]).includes(normalizedLabel)
    ? normalizedLabel as typeof NEARBY_FASTTEXT_CATEGORIES[number]
    : undefined;
}
