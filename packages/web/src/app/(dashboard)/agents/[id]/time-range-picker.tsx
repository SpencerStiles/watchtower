'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const RANGES = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
] as const;

type Range = '24h' | '7d' | '30d';

export function TimeRangePicker({ current }: { current: Range }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(range: Range) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="flex rounded-md border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      {RANGES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: current === value ? 'var(--accent)' : 'var(--elevated)',
            color: current === value ? '#fff' : 'var(--muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
