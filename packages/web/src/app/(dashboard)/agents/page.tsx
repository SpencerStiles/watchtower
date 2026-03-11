import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ACTIVE'
      ? 'var(--success)'
      : status === 'ERROR'
        ? 'var(--danger)'
        : 'var(--warning)';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}

function scoreColor(score: number | null) {
  if (score === null) return 'var(--muted)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--danger)';
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold font-[family-name:var(--font-syne)]"
          style={{ color: 'var(--text)' }}
        >
          Agents
        </h1>
        <Link
          href="/agents/new"
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + New Agent
        </Link>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Agents', value: agents.length },
          { label: 'Events (24h)', value: totalEvents24h.toLocaleString() },
          { label: 'Cost (24h)', value: `$${totalCost24h.toFixed(2)}` },
          { label: 'Error Rate (24h)', value: `${errorRate24h}%` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              {label}
            </p>
            <p
              className="mt-1 text-xl font-bold font-[family-name:var(--font-mono)]"
              style={{ color: 'var(--text)' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Agents table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {agents.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">No agents yet. Create your first agent to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Status', 'Quality Score', 'Events (24h)', 'Cost (24h)', 'Error Rate'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-medium"
                      style={{ color: 'var(--muted)' }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const stats = agentStats[i];
                return (
                  <tr
                    key={agent.id}
                    className="border-t transition-colors hover:bg-[#1a1a20]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {agent.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <StatusDot status={agent.status} />
                        <span style={{ color: 'var(--text)' }}>
                          {agent.status.charAt(0) + agent.status.slice(1).toLowerCase()}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)]">
                      <span style={{ color: scoreColor(agent.qualityScore) }}>
                        {agent.qualityScore !== null ? agent.qualityScore : '—'}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-[family-name:var(--font-mono)]"
                      style={{ color: 'var(--text)' }}
                    >
                      {stats.events24h.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 font-[family-name:var(--font-mono)]"
                      style={{ color: 'var(--text)' }}
                    >
                      ${stats.cost24h.toFixed(4)}
                    </td>
                    <td
                      className="px-4 py-3 font-[family-name:var(--font-mono)]"
                      style={{
                        color:
                          stats.errorRate > 10
                            ? 'var(--danger)'
                            : stats.errorRate > 2
                              ? 'var(--warning)'
                              : 'var(--success)',
                      }}
                    >
                      {stats.errorRate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
