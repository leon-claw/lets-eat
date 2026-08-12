interface ChoiceHeaderProps {
  current: number;
  total: number;
}

export function ChoiceHeader({ current, total }: ChoiceHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 px-1">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">
          Food choice
        </p>
        <h1 className="text-3xl font-black tracking-tight text-stone-950">今天吃什么</h1>
      </div>
      <span className="rounded-full bg-stone-950 px-3 py-1.5 text-sm font-bold text-amber-200">
        {current} / {total}
      </span>
    </header>
  );
}
