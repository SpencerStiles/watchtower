'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface FlagItem {
  id: string;
  category: string;
  severity: string;
  reason: string;
  resolution: string | null;
  conversationId: string;
  sessionId: string;
  agentId: string;
}

interface FlagBreakdownItem {
  category: string;
  count: number;
}

interface Props {
  range: '24h' | '7d' | '30d';
  avgScore: number | null;
  flagBreakdown: FlagBreakdownItem[];
  totalConversations: number;
  avgLatencyMs: number;
  errorRate: number;
  totalEvents: number;
  costDollars: number;
  costPerConv: number;
  laborSavings: number;
  recentFlags: FlagItem[];
}

const RANGES = ['24h', '7d', '30d'] as const;

function scoreColor(score: number | null) {
  if (score === null) return 'var(--muted)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--danger)';
}

function DonutChart({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth="14"
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
      />
      <text x="80" y="86" textAnchor="middle" fontSize="28" fontWeight="bold" fill={scoreColor(score)}>
        {score}
      </text>
    </svg>
  );
}

export function OverviewClient({
  range,
  avgScore,
  flagBreakdown,
  totalConversations,
  avgLatencyMs,
  errorRate,
  totalEvents,
  costDollars,
  costPerConv,
  laborSavings,
  recentFlags: initialFlags,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [flags, setFlags] = useState<FlagItem[]>(initialFlags);

  function handleRangeChange(r: '24h' | '7d' | '30d') {
    router.push(`${pathname}?range=${r}`);
  }

  async function resolveFlag(flagId: string, resolution: 'ACCEPTABLE' | 'NEEDS_FIX') {
    const res = await fetch(`/api/v1/flags/${flagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    if (res.ok) {
      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, resolution } : f))
      );
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Time Range */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold font-[family-name:var(--font-syne)]"
          style={{ color: 'var(--text)' }}
        >
          Overview
        </h1>
        <div
          className="flex rounded-md border overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: range === r ? 'var(--accent)' : 'var(--elevated)',
                color: range === r ? '#fff' : 'var(--muted)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Conversation Quality Hero */}
      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Conversation Quality
        </h2>
        <div className="flex items-center gap-8">
          {avgScore !== null ? (
            <>
              <DonutChart score={avgScore} />
              <div className="flex-1 space-y-2">
                <p className="text-lg font-semibold" style={{ color: scoreColor(avgScore) }}>
                  {avgScore >= 80 ? 'Excellent' : avgScore >= 60 ? 'Good' : 'Needs Attention'}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Average quality score across {totalConversations.toLocaleString()} conversations
                </p>
                {flagBreakdown.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {flagBreakdown.map((fb) => (
                      <div key={fb.category} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--muted)' }}>
                          {fb.category.replace(/_/g, ' ')}
                        </span>
                        <span
                          className="font-[family-name:var(--font-mono)]"
                          style={{ color: 'var(--text)' }}
                        >
                          {fb.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 py-6 text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--muted)' }}>—</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                No scored conversations in this period
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sections 2 & 3: Is it working? + Is it worth it? */}
      <div className="grid grid-cols-2 gap-4">
        {/* Is it working? */}
        <div
          className="rounded-lg border p-6 space-y-4"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Is it working?
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Status
              </span>
              <span
                className="text-sm font-semibold flex items-center gap-1.5"
                style={{ color: errorRate < 5 ? 'var(--success)' : 'var(--danger)' }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: errorRate < 5 ? 'var(--success)' : 'var(--danger)',
                  }}
                />
                {errorRate < 5 ? 'Operational' : 'Degraded'}
              </span>
            </div>
            {[
              {
                label: 'Conversations Handled',
                value: totalConversations.toLocaleString(),
                color: 'var(--text)',
              },
              {
                label: 'Avg Response Time',
                value: `${avgLatencyMs}ms`,
                color:
                  avgLatencyMs > 5000
                    ? 'var(--danger)'
                    : avgLatencyMs > 2000
                      ? 'var(--warning)'
                      : 'var(--success)',
              },
              {
                label: 'Error Rate',
                value: `${errorRate.toFixed(1)}%`,
                color:
                  errorRate > 10
                    ? 'var(--danger)'
                    : errorRate > 2
                      ? 'var(--warning)'
                      : 'var(--success)',
              },
              {
                label: 'Total Events',
                value: totalEvents.toLocaleString(),
                color: 'var(--text)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {label}
                </span>
                <span
                  className="text-sm font-semibold font-[family-name:var(--font-mono)]"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Is it worth it? */}
        <div
          className="rounded-lg border p-6 space-y-4"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Is it worth it?
          </h2>
          <div className="space-y-3">
            {[
              {
                label: 'Total AI Cost',
                value: `$${costDollars.toFixed(4)}`,
                color: 'var(--text)',
              },
              {
                label: 'Cost per Conversation',
                value: `$${costPerConv.toFixed(6)}`,
                color: 'var(--text)',
              },
              {
                label: 'Est. Labor Savings',
                value: `$${laborSavings.toFixed(2)}`,
                color: 'var(--success)',
              },
              {
                label: 'Savings / Cost Ratio',
                value: costDollars > 0 ? `${(laborSavings / costDollars).toFixed(1)}x` : '—',
                color: 'var(--success)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {label}
                </span>
                <span
                  className="text-sm font-semibold font-[family-name:var(--font-mono)]"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Labor savings estimated at $25/hr, 5 min avg conversation
          </p>
        </div>
      </div>

      {/* Section 4: Flagged for Review */}
      <div
        className="rounded-lg border p-6 space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          Flagged for Review ({flags.filter((f) => !f.resolution).length})
        </h2>
        {flags.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
            No flags in this period.
          </p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-start justify-between rounded-md border px-4 py-3 gap-4"
                style={{
                  borderColor:
                    flag.severity === 'CRITICAL' || flag.severity === 'HIGH'
                      ? 'rgba(239,68,68,0.4)'
                      : 'var(--border)',
                  backgroundColor: 'var(--elevated)',
                }}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color:
                          flag.severity === 'CRITICAL' || flag.severity === 'HIGH'
                            ? 'var(--danger)'
                            : 'var(--warning)',
                      }}
                    >
                      {flag.severity}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {flag.category.replace(/_/g, ' ')}
                    </span>
                    <span
                      className="text-xs font-[family-name:var(--font-mono)] truncate"
                      style={{ color: 'var(--muted)' }}
                    >
                      {flag.sessionId.slice(0, 16)}…
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    {flag.reason}
                  </p>
                  {flag.resolution && (
                    <span
                      className="inline-block text-xs rounded px-1.5 py-0.5"
                      style={{
                        backgroundColor:
                          flag.resolution === 'ACCEPTABLE'
                            ? 'rgba(34,197,94,0.12)'
                            : 'rgba(239,68,68,0.12)',
                        color:
                          flag.resolution === 'ACCEPTABLE' ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {flag.resolution.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                {!flag.resolution && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => resolveFlag(flag.id, 'ACCEPTABLE')}
                      className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'rgba(34,197,94,0.12)',
                        color: 'var(--success)',
                        border: '1px solid var(--success)',
                      }}
                    >
                      Acceptable
                    </button>
                    <button
                      onClick={() => resolveFlag(flag.id, 'NEEDS_FIX')}
                      className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'rgba(239,68,68,0.12)',
                        color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                      }}
                    >
                      Needs Fix
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
