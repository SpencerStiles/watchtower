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

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

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
  const category = searchParams.get('category');
  const resolution = searchParams.get('resolution');

  try {
    // Get flagged conversations for this agent
    const flags = await prisma.qualityFlag.findMany({
      where: {
        conversation: { agentId: params.id },
        ...(category ? { category: category as import('@prisma/client').FlagCategory } : {}),
        ...(resolution === 'unresolved'
          ? { resolution: null }
          : resolution
          ? { resolution: resolution as import('@prisma/client').FlagResolution }
          : {}),
      },
      include: {
        conversation: {
          select: {
            id: true,
            sessionId: true,
            qualityScore: true,
            startedAt: true,
            lastEventAt: true,
          },
        },
      },
      orderBy: [
        { severity: 'asc' }, // Prisma sorts alphabetically; we'll reorder in JS
        { createdAt: 'desc' },
      ],
    });

    // Sort by CRITICAL first
    flags.sort((a, b) => {
      const ai = SEVERITY_ORDER.indexOf(a.severity);
      const bi = SEVERITY_ORDER.indexOf(b.severity);
      return ai - bi;
    });

    return NextResponse.json({ flags });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id]/flags failed', {
      error: err instanceof Error ? err.message : String(err),
      agentId: params.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
