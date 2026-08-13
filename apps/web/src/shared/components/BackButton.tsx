import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  onClick?: () => void;
  label?: string;
}

export function BackButton({ onClick, label = '返回' }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      data-testid="page-back-button"
      onClick={onClick ?? (() => navigate(-1))}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
