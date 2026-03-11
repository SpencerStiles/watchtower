import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

async function checkAgentAccess(
  agentId: string,
  userId: string,
  organizationId: string | null | undefined,
  role: string
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;

  if (role === 'DEVELOPER') {
    if (!organizationId || agent.organizationId !== organizationId) return null;
    return agent;
  }

  const dashboard = await prisma.businessDashboard.findUnique({
    where: { agentId_userId: { agentId, userId } },
  });
  if (!dashboard) return null;
  return agent;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = await checkAgentAccess(
    params.id,
    session.user.id,
    session.user.organizationId,
    session.user.role
  );
  if (!agent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const range = req.nextUrl.searchParams.get('range') ?? '24h';
  const now = new Date();
  let since: Date;
  if (range === '7d') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '30d') {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  try {
    const [eventAgg, conversationCount, qualityAgg] = await Promise.all([
      prisma.event.aggregate({
        where: { agentId: params.id, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, costCents: true, latencyMs: true },
        _avg: { latencyMs: true },
      }),
      prisma.conversation.count({
        where: { agentId: params.id, lastEventAt: { gte: since } },
      }),
      prisma.conversation.aggregate({
        where: { agentId: params.id, lastEventAt: { gte: since }, qualityScore: { not: null } },
        _avg: { qualityScore: true },
      }),
    ]);

    const totalEvents = eventAgg._count.id;
    const totalTokens = (eventAgg._sum.inputTokens ?? 0) + (eventAgg._sum.outputTokens ?? 0);
    const totalCostCents = eventAgg._sum.costCents ?? 0;
    const avgLatency = eventAgg._avg.latencyMs ?? 0;

    // Error rate: fraction of error events
    const errorCount = await prisma.event.count({
      where: { agentId: params.id, createdAt: { gte: since }, isError: true },
    });
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0;

    return NextResponse.json({
      totalEvents,
      totalConversations: conversationCount,
      totalTokens,
      totalCostCents,
      avgLatency: Math.round(avgLatency),
      errorRate,
      avgQualityScore: qualityAgg._avg.qualityScore ?? null,
    });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id]/metrics failed', { error: String(err), agentId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
