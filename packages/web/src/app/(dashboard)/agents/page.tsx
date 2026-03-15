import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Radar } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { FadeUp, StaggerList, StaggerItem } from '@/components/motion';
import { AnimatedNumber } from '@/components/animated-number';

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'ACTIVE'
      ? 'bg-success'
      : status === 'ERROR'
        ? 'bg-danger'
        : 'bg-warning';
  const pulseClass = status === 'ACTIVE' ? 'animate-pulse-dot' : '';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colorClass} ${pulseClass}`}
      title={status}
    />
  );
}

function scoreColorClass(score: number | null) {
  if (score === null) return 'text-muted';
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-danger';
}

function errorRateColorClass(rate: number) {
  if (rate > 10) return 'text-danger';
  if (rate > 2) return 'text-warning';
  return 'text-success';
}

export default async function AgentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'DEVELOPER') redirect('/overview');

  const agents = session.user.organizationId
    ? await prisma.agent.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // Quick aggregate stats for the last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const agentIds = agents.map((a) => a.id);

  const [eventAgg24h, errorCount24h] = await Promise.all([
    agentIds.length > 0
      ? prisma.event.aggregate({
          where: { agentId: { in: agentIds }, createdAt: { gte: since24h } },
          _count: { id: true },
          _sum: { costCents: true },
        })
      : { _count: { id: 0 }, _sum: { costCents: 0 } },
    agentIds.length > 0
      ? prisma.event.count({
          where: { agentId: { in: agentIds }, createdAt: { gte: since24h }, isError: true },
        })
      : 0,
  ]);

  const totalEvents24h = eventAgg24h._count.id ?? 0;
  const totalCost24h = (eventAgg24h._sum.costCents ?? 0) / 100;
  const errorRate24h =
    totalEvents24h > 0 ? ((errorCount24h / totalEvents24h) * 100).toFixed(1) : '0.0';

  // Per-agent stats for the table
  const agentStats = await Promise.all(
    agents.map(async (agent) => {
      const [evAgg, errCnt] = await Promise.all([
        prisma.event.aggregate({
          where: { agentId: agent.id, createdAt: { gte: since24h } },
          _count: { id: true },
          _sum: { costCents: true },
        }),
        prisma.event.count({
          where: { agentId: agent.id, createdAt: { gte: since24h }, isError: true },
        }),
      ]);
      const evCount = evAgg._count.id ?? 0;
      return {
        events24h: evCount,
        cost24h: (evAgg._sum.costCents ?? 0) / 100,
        errorRate: evCount > 0 ? (errCnt / evCount) * 100 : 0,
      };
    })
  );

  const stats = [
    { label: 'Total Agents', value: agents.length, raw: agents.length },
    { label: 'Events (24h)', value: totalEvents24h.toLocaleString(), raw: totalEvents24h },
    { label: 'Cost (24h)', value: `$${totalCost24h.toFixed(2)}`, raw: totalCost24h },
    { label: 'Error Rate (24h)', value: `${errorRate24h}%`, raw: parseFloat(errorRate24h) },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <FadeUp>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display text-text">
            Agents
          </h1>
          <Link
            href="/agents/new"
            className="rounded-md px-4 py-2 text-sm font-medium bg-accent text-white transition-all active:scale-[0.97]"
          >
            + New Agent
          </Link>
        </div>
      </FadeUp>

      {/* Quick stats bar */}
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, raw }) => (
          <StaggerItem key={label}>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs font-medium text-muted">{label}</p>
              <p className="mt-1 text-xl font-bold font-mono text-text">
                <AnimatedNumber
                  value={raw}
                  format={
                    label === 'Cost (24h)'
                      ? (n) => `$${n.toFixed(2)}`
                      : label === 'Error Rate (24h)'
                        ? (n) => `${n.toFixed(1)}%`
                        : label === 'Events (24h)'
                          ? (n) => Math.round(n).toLocaleString()
                          : (n) => String(Math.round(n))
                  }
                />
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerList>

      {/* Agents table */}
      <FadeUp delay={0.1}>
        <div className="rounded-lg border border-border overflow-hidden">
          {agents.length === 0 ? (
            <div className="p-12 text-center text-muted flex flex-col items-center gap-3">
              <Radar className="w-10 h-10 opacity-40" />
              <p className="text-sm">No agents yet. Create your first agent to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-elevated border-b border-border">
                  {['Name', 'Status', 'Quality Score', 'Events (24h)', 'Cost (24h)', 'Error Rate'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-medium text-muted"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => {
                  const agentStat = agentStats[i];
                  return (
                    <tr
                      key={agent.id}
                      className="border-t border-border transition-colors hover:bg-elevated"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/agents/${agent.id}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {agent.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <StatusDot status={agent.status} />
                          <span className="text-text">
                            {agent.status.charAt(0) + agent.status.slice(1).toLowerCase()}
                          </span>
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono ${scoreColorClass(agent.qualityScore)}`}>
                        {agent.qualityScore !== null ? agent.qualityScore : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-text">
                        {agentStat.events24h.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-text">
                        ${agentStat.cost24h.toFixed(4)}
                      </td>
                      <td className={`px-4 py-3 font-mono ${errorRateColorClass(agentStat.errorRate)}`}>
                        {agentStat.errorRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </FadeUp>
    </div>
  );
}
