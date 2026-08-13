import type { ReactNode } from 'react';
import { BackButton } from './BackButton';

interface PageShellProps {
  children: ReactNode;
  back?: boolean;
  backLabel?: string;
  onBack?: () => void;
  title?: string;
}

export function PageShell({ children, back = true, backLabel, onBack, title }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] px-4 py-5 text-slate-950">
      <main className="page-shell-enter mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col">
        {(back || title) && (
          <header className="mb-6 flex min-h-8 items-center justify-between">
            {back ? <BackButton label={backLabel} onClick={onBack} /> : <span />}
            {title && <h1 className="text-lg font-black">{title}</h1>}
            {back && <span className="w-12" />}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
