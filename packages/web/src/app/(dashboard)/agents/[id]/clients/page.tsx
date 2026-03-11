import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { InviteClientForm } from './invite-form';

interface PageProps {
  params: { id: string };
}

export default async function ClientsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'DEVELOPER') redirect('/overview');
  if (!session.user.organizationId) redirect('/agents');

  // Verify agent ownership
  const agent = await prisma.agent.findFirst({
    where: { id: params.id, organizationId: session.user.organizationId },
  });
  if (!agent) notFound();

  // Fetch dashboards (clients)
  const dashboards = await prisma.businessDashboard.findMany({
    where: { agentId: agent.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch pending invitations
  const invitations = await prisma.invitation.findMany({
    where: { agentId: agent.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold font-[family-name:var(--font-syne)]"
            style={{ color: 'var(--text)' }}
          >
            Client Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {agent.name}
          </p>
        </div>
      </div>

      {/* Active Clients */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Active Clients ({dashboards.length})
        </h2>
        {dashboards.length === 0 ? (
          <div
            className="rounded-lg border p-8 text-center"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No clients yet. Invite your first client below.
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--elevated)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {['Client', 'Email', 'Tier', 'Status', 'Since'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-medium"
                      style={{ color: 'var(--muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboards.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>
                      {d.user.name ?? '—'}
                    </td>
                    <td
                      className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs"
                      style={{ color: 'var(--muted)' }}
                    >
                      {d.user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor:
                            d.billingTier === 'PRO'
                              ? 'rgba(99,102,241,0.15)'
                              : 'rgba(113,113,122,0.15)',
                          color: d.billingTier === 'PRO' ? 'var(--accent)' : 'var(--muted)',
                        }}
                      >
                        {d.billingTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: 'var(--success)' }}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: 'var(--success)' }}
                        />
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Pending Invitations ({invitations.length})
          </h2>
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {invitations.map((inv, i) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: i < invitations.length - 1 ? '1px solid var(--border)' : 'none',
                  backgroundColor: 'var(--surface)',
                }}
              >
                <span
                  className="text-sm font-[family-name:var(--font-mono)]"
                  style={{ color: 'var(--text)' }}
                >
                  {inv.email}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Sent {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: 'rgba(234,179,8,0.12)',
                      color: 'var(--warning)',
                    }}
                  >
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite Client Form */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Invite a Client
        </h2>
        <InviteClientForm agentId={agent.id} />
      </section>
    </div>
  );
}
