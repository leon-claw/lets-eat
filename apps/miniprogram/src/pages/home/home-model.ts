export const DISPLAY_NAME_STORAGE_KEY = 'lets-eat.miniprogram.display-name.v1';

const ADJECTIVES = ['元气', '快乐', '认真', '随和', '幸运', '贪吃'];
const FOODS = ['饭团', '小厨', '食客', '面包', '汤圆', '饺子'];

export const HOME_PLACEHOLDER_ROUTES = {
  mode: '/pages/mode/index',
  settings: '/pages/settings/index',
} as const;

export interface DisplayNameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadOrCreateDisplayName(
  storage: DisplayNameStorage,
  random: () => number = Math.random,
): string {
  const saved = storage.getItem(DISPLAY_NAME_STORAGE_KEY)?.trim();
  if (saved) return saved;

  const name = `${ADJECTIVES[indexOf(ADJECTIVES.length, random)]}${FOODS[indexOf(FOODS.length, random)]}${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
  storage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
  return name;
}

export function saveDisplayName(name: string, storage: DisplayNameStorage): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('请输入用户名');
  storage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
  return trimmed;
}

function indexOf(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}
