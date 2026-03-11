import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OverviewClient } from './overview-client';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'BUSINESS_OWNER') redirect('/agents');

  const range = (searchParams.range ?? '24h') as '24h' | '7d' | '30d';
  const rangeMs =
    range === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : range === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - rangeMs);

  // Fetch agents via BusinessDashboard
  const dashboards = await prisma.businessDashboard.findMany({
    where: { userId: session.user.id },
    include: { agent: true },
  });

  if (dashboards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          className="rounded-lg border p-12 text-center max-w-md"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h1
            className="text-xl font-bold font-[family-name:var(--font-syne)]"
            style={{ color: 'var(--text)' }}
          >
            No agents yet
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            You haven&apos;t been granted access to any agents. Contact your developer to get an invitation.
          </p>
        </div>
      </div>
    );
  }

  const agentIds = dashboards.map((d) => d.agent.id);

  // Aggregate metrics across all agents
  const [eventAgg, errorCount, conversationCount, qualityAgg, flagBreakdown, recentFlags] =
    await Promise.all([
      prisma.event.aggregate({
        where: { agentId: { in: agentIds }, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, costCents: true, latencyMs: true },
        _avg: { latencyMs: true },
      }),
      prisma.event.count({
        where: { agentId: { in: agentIds }, createdAt: { gte: since }, isError: true },
      }),
      prisma.conversation.count({
        where: { agentId: { in: agentIds }, lastEventAt: { gte: since } },
      }),
      prisma.conversation.aggregate({
        where: {
          agentId: { in: agentIds },
          lastEventAt: { gte: since },
          qualityScore: { not: null },
        },
        _avg: { qualityScore: true },
      }),
      prisma.qualityFlag.groupBy({
        by: ['category'],
        where: {
          conversation: { agentId: { in: agentIds }, lastEventAt: { gte: since } },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.qualityFlag.findMany({
        where: {
          conversation: { agentId: { in: agentIds }, lastEventAt: { gte: since } },
          resolution: null,
        },
        include: {
          conversation: { select: { id: true, sessionId: true, agentId: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
    ]);

  const totalEvents = eventAgg._count.id ?? 0;
  const totalCostCents = eventAgg._sum.costCents ?? 0;
  const avgLatencyMs = Math.round(eventAgg._avg.latencyMs ?? 0);
  const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;
  const avgScore =
    qualityAgg._avg.qualityScore !== null
      ? Math.round(qualityAgg._avg.qualityScore ?? 0)
      : null;
  const costDollars = totalCostCents / 100;
  const costPerConv = conversationCount > 0 ? costDollars / conversationCount : 0;

  // Estimated labor savings: default $25/hr, assume avg 5 min per conversation
  const hourlyRate = 25;
  const avgMinutesPerConversation = 5;
  const laborSavings = conversationCount * (avgMinutesPerConversation / 60) * hourlyRate;

  const serializedFlags = recentFlags.map((f) => ({
    id: f.id,
    category: f.category,
    severity: f.severity,
    reason: f.reason,
    resolution: f.resolution ?? null,
    conversationId: f.conversationId,
    sessionId: f.conversation.sessionId,
    agentId: f.conversation.agentId,
  }));

  const serializedFlagBreakdown = flagBreakdown.map((f) => ({
    category: f.category,
    count: f._count.id,
  }));

  return (
    <OverviewClient
      range={range}
      avgScore={avgScore}
      flagBreakdown={serializedFlagBreakdown}
      totalConversations={conversationCount}
      avgLatencyMs={avgLatencyMs}
      errorRate={errorRate}
      totalEvents={totalEvents}
      costDollars={costDollars}
      costPerConv={costPerConv}
      laborSavings={laborSavings}
      recentFlags={serializedFlags}
    />
  );
}
