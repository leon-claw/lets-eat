import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { AppRouter } from './AppRouter';
import type { RoomClient } from '@/entities/room/room-client';

export interface AppProps {
  repository?: FoodChoiceRepository;
  random?: () => number;
  roomClient?: RoomClient;
}

export default function App({
  repository,
  random = Math.random,
  roomClient,
}: AppProps) {
  void random;
  return <AppRouter repository={repository} roomClient={roomClient} />;
}
