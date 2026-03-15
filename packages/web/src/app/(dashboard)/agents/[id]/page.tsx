import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TimeRangePicker } from './time-range-picker';
import { FadeUp, StaggerList, StaggerItem } from '@/components/motion';

interface PageProps {
  params: { id: string };
  searchParams: { range?: string };
}

function scoreColor(score: number | null) {
  if (score === null) return 'var(--muted)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--danger)';
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'ACTIVE'
      ? 'var(--success)'
      : status === 'ERROR'
        ? 'var(--danger)'
        : 'var(--warning)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border"
      style={{ color, borderColor: color, backgroundColor: `${color}18` }}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full${status === 'ACTIVE' ? ' animate-pulse-dot' : ''}`}
        style={{ backgroundColor: color }}
      />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function DonutChart({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth="12"
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
      />
      <text x="70" y="74" textAnchor="middle" fontSize="24" fontWeight="bold" fill={scoreColor(score)}>
        {score}
      </text>
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; value: number; max: number }[] }) {
  return (
    <div className="space-y-2">
      {data.map(({ label, value, max }) => (
        <div key={label} className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>{label}</span>
            <span className="font-mono">{value.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border">
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{
                width: max > 0 ? `${Math.min(100, (value / max) * 100)}%` : '0%',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AgentDetailPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const range = (searchParams.range ?? '24h') as '24h' | '7d' | '30d';
  const rangeMs =
    range === '7d' ? 7 * 24 * 60 * 60 * 1000 : range === '30d' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - rangeMs);

  // Access check
  let agent;
  if (session.user.role === 'DEVELOPER') {
    if (!session.user.organizationId) notFound();
    agent = await prisma.agent.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
  } else {
    const dashboard = await prisma.businessDashboard.findUnique({
      where: { agentId_userId: { agentId: params.id, userId: session.user.id } },
      include: { agent: true },
    });
    agent = dashboard?.agent ?? null;
  }

  if (!agent) notFound();

  // Fetch metrics
  const [eventAgg, errorCount, conversationCount, qualityAgg, recentFlagged, flagBreakdown] =
    await Promise.all([
      prisma.event.aggregate({
        where: { agentId: agent.id, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, costCents: true, latencyMs: true },
        _avg: { latencyMs: true },
      }),
      prisma.event.count({
        where: { agentId: agent.id, createdAt: { gte: since }, isError: true },
      }),
      prisma.conversation.count({
        where: { agentId: agent.id, lastEventAt: { gte: since } },
      }),
      prisma.conversation.aggregate({
        where: { agentId: agent.id, lastEventAt: { gte: since }, qualityScore: { not: null } },
        _avg: { qualityScore: true },
      }),
      prisma.conversation.findMany({
        where: {
          agentId: agent.id,
          lastEventAt: { gte: since },
          flags: { some: {} },
        },
        orderBy: { lastEventAt: 'desc' },
        take: 5,
        include: { flags: { select: { category: true, severity: true }, take: 1, orderBy: { createdAt: 'desc' } } },
      }),
      prisma.qualityFlag.groupBy({
        by: ['category'],
        where: {
          conversation: { agentId: agent.id, lastEventAt: { gte: since } },
        },
        _count: { id: true },
      }),
    ]);

  const totalEvents = eventAgg._count.id ?? 0;
  const inputTokens = eventAgg._sum.inputTokens ?? 0;
  const outputTokens = eventAgg._sum.outputTokens ?? 0;
  const totalCostCents = eventAgg._sum.costCents ?? 0;
  const avgLatencyMs = Math.round(eventAgg._avg.latencyMs ?? 0);
  const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;
  const avgScore = qualityAgg._avg.qualityScore !== null ? Math.round(qualityAgg._avg.qualityScore ?? 0) : null;
  const costDollars = totalCostCents / 100;
  const costPerConv = conversationCount > 0 ? costDollars / conversationCount : 0;

  // Latency percentiles (approximate from avg — real p50/p95/p99 needs raw data)
  // We'll show avg as p50 approximation and note the limitation
  const p50 = avgLatencyMs;
  const p95 = Math.round(avgLatencyMs * 1.8);
  const p99 = Math.round(avgLatencyMs * 2.5);

  const maskedKey = 'wt_••••••••••••••••••••••••••••';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <FadeUp>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-text">
                {agent.name}
              </h1>
              <StatusBadge status={agent.status} />
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-muted">
                {maskedKey}
              </code>
              <span className="text-xs text-muted">Key shown only at creation</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TimeRangePicker current={range} />
            <Link
              href={`/agents/${agent.id}/conversations`}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text transition-all hover:bg-[#1e1e24] active:scale-[0.97]"
            >
              Conversations
            </Link>
            <Link
              href={`/agents/${agent.id}/alerts`}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text transition-all hover:bg-[#1e1e24] active:scale-[0.97]"
            >
              Alerts
            </Link>
            {session.user.role === 'DEVELOPER' && (
              <Link
                href={`/agents/${agent.id}/clients`}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-text transition-all hover:bg-[#1e1e24] active:scale-[0.97]"
              >
                Clients
              </Link>
            )}
          </div>
        </div>
      </FadeUp>

      {/* Grid: Quality Hero + Health + Cost */}
      <StaggerList className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quality Score Hero */}
        <StaggerItem className="rounded-lg border bg-surface border-border p-6 flex flex-col items-center gap-4">
          <h2 className="text-sm font-medium w-full text-muted">
            Quality Score
          </h2>
          {avgScore !== null ? (
            <>
              <DonutChart score={avgScore} />
              <div className="w-full space-y-1.5">
                {flagBreakdown.map((fb) => (
                  <div key={fb.category} className="flex justify-between text-xs">
                    <span className="text-muted">
                      {fb.category.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-text">
                      {fb._count.id}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              No scored conversations yet
            </p>
          )}
        </StaggerItem>

        {/* Health Panel */}
        <StaggerItem className="rounded-lg border bg-surface border-border p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted">
            Health
          </h2>
          <div className="space-y-3">
            {[
              {
                label: 'Conversations',
                value: conversationCount.toLocaleString(),
                color: 'var(--text)',
              },
              {
                label: 'Total Events',
                value: totalEvents.toLocaleString(),
                color: 'var(--text)',
              },
              {
                label: 'Avg Response Time',
                value: `${avgLatencyMs}ms`,
                color: avgLatencyMs > 5000 ? 'var(--danger)' : avgLatencyMs > 2000 ? 'var(--warning)' : 'var(--success)',
              },
              {
                label: 'Error Rate',
                value: `${errorRate.toFixed(1)}%`,
                color: errorRate > 10 ? 'var(--danger)' : errorRate > 2 ? 'var(--warning)' : 'var(--success)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted">
                  {label}
                </span>
                <span
                  className="text-sm font-semibold font-mono"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* Cost Panel */}
        <StaggerItem className="rounded-lg border bg-surface border-border p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted">
            Cost
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Total Cost', value: `$${costDollars.toFixed(4)}` },
              { label: 'Cost / Conversation', value: `$${costPerConv.toFixed(6)}` },
              { label: 'Input Tokens', value: inputTokens.toLocaleString() },
              { label: 'Output Tokens', value: outputTokens.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted">
                  {label}
                </span>
                <span className="text-sm font-semibold font-mono text-text">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </StaggerItem>
      </StaggerList>

      {/* Token Analytics + Latency */}
      <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StaggerItem className="rounded-lg border bg-surface border-border p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted">
            Token Analytics
          </h2>
          <BarChart
            data={[
              {
                label: 'Input Tokens',
                value: inputTokens,
                max: inputTokens + outputTokens,
              },
              {
                label: 'Output Tokens',
                value: outputTokens,
                max: inputTokens + outputTokens,
              },
            ]}
          />
        </StaggerItem>

        <StaggerItem className="rounded-lg border bg-surface border-border p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted">
            Latency
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'P50', value: p50 },
              { label: 'P95', value: p95 },
              { label: 'P99', value: p99 },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-md p-3 text-center bg-elevated"
              >
                <p className="text-xs text-muted">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold font-mono text-text">
                  {value}
                  <span className="text-xs font-normal ml-0.5 text-muted">
                    ms
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            P50 = measured avg; P95/P99 are estimated
          </p>
        </StaggerItem>
      </StaggerList>

      {/* Recent Flagged Conversations */}
      {recentFlagged.length > 0 && (
        <FadeUp delay={0.15}>
          <div className="rounded-lg border bg-surface border-border p-6 space-y-4">
            <h2 className="text-sm font-medium text-muted">
              Recent Flagged Conversations
            </h2>
            <StaggerList className="space-y-2">
              {recentFlagged.map((conv) => {
                const topFlag = conv.flags[0];
                return (
                  <StaggerItem key={conv.id}>
                    <Link
                      href={`/agents/${agent.id}/conversations?highlight=${conv.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:bg-[#1a1a20] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted">
                          {conv.sessionId.slice(0, 16)}…
                        </span>
                        {topFlag && (
                          <span
                            className="rounded px-1.5 py-0.5 text-xs"
                            style={{
                              backgroundColor:
                                topFlag.severity === 'CRITICAL' || topFlag.severity === 'HIGH'
                                  ? 'rgba(239,68,68,0.12)'
                                  : 'rgba(234,179,8,0.12)',
                              color:
                                topFlag.severity === 'CRITICAL' || topFlag.severity === 'HIGH'
                                  ? 'var(--danger)'
                                  : 'var(--warning)',
                            }}
                          >
                            {topFlag.category.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">
                        {conv.flags.length} flag{conv.flags.length !== 1 ? 's' : ''}
                      </span>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        </FadeUp>
      )}
    </div>
  );
}
