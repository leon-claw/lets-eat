import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { AppRouter } from './AppRouter';

export interface AppProps {
  repository?: FoodChoiceRepository;
  random?: () => number;
}

export default function App({
  repository,
  random = Math.random,
}: AppProps) {
  return <AppRouter repository={repository} />;
}
