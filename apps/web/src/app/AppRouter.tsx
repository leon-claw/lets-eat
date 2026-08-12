import type { ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { createBrowserCatalogFoodChoiceRepository } from '@/entities/catalog/food-choice-repository';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { DatasetPage } from '@/pages/DatasetPage';
import { GamePage } from '@/pages/GamePage';
import { HomePage } from '@/pages/HomePage';
import { ModePage } from '@/pages/ModePage';
import { ResultPage } from '@/pages/ResultPage';

interface AppRouterProps {
  repository?: FoodChoiceRepository;
  initialPath?: string;
}

const defaultRepository = createBrowserCatalogFoodChoiceRepository();

function RouteTree({ repository }: { repository: FoodChoiceRepository }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/mode" element={<ModePage />} />
      <Route path="/single/dataset" element={<DatasetPage repository={repository} />} />
      <Route path="/game/single" element={<GamePage repository={repository} />} />
      <Route path="/result/single" element={<ResultPage repository={repository} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function AppRouter({ repository = defaultRepository, initialPath }: AppRouterProps) {
  const content: ReactNode = <RouteTree repository={repository} />;
  return initialPath ? <MemoryRouter initialEntries={[initialPath]}>{content}</MemoryRouter> : <BrowserRouter>{content}</BrowserRouter>;
}
