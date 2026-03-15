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

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const flagCategory = searchParams.get('flagCategory');

  try {
    const where = {
      agentId: params.id,
      ...(flagCategory
        ? {
            flags: {
              some: {
                category: flagCategory as import('@prisma/client').FlagCategory,
              },
            },
          }
        : {}),
    };

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        orderBy: { lastEventAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          flags: {
            select: { category: true },
          },
        },
      }),
    ]);

    const result = conversations.map((conv) => {
      const flagCounts: Record<string, number> = {};
      for (const flag of conv.flags) {
        flagCounts[flag.category] = (flagCounts[flag.category] ?? 0) + 1;
      }
      return {
        id: conv.id,
        sessionId: conv.sessionId,
        qualityScore: conv.qualityScore,
        eventCount: conv.eventCount,
        totalCostCents: conv.totalCostCents,
        startedAt: conv.startedAt,
        lastEventAt: conv.lastEventAt,
        flagCounts,
      };
    });

    return NextResponse.json({
      conversations: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id]/conversations failed', {
      error: err instanceof Error ? err.message : String(err),
      agentId: params.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
