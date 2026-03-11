import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertsClient } from './alerts-client';

interface PageProps {
  params: { id: string };
}

export default async function AlertsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'DEVELOPER') redirect('/overview');
  if (!session.user.organizationId) redirect('/agents');

  const agent = await prisma.agent.findFirst({
    where: { id: params.id, organizationId: session.user.organizationId },
  });
  if (!agent) notFound();

  const alerts = await prisma.alertConfig.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
  });

  // Serialize for client (Prisma's Json type needs to be plain objects)
  const serializedAlerts = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    threshold: a.threshold as Record<string, unknown>,
    channel: a.channel,
    enabled: a.enabled,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1
          className="text-xl font-bold font-[family-name:var(--font-syne)]"
          style={{ color: 'var(--text)' }}
        >
          Alert Configuration
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {agent.name}
        </p>
      </div>

      <AlertsClient agentId={agent.id} initialAlerts={serializedAlerts} />
    </div>
  );
}
