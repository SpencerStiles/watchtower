import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        flags: { orderBy: { createdAt: 'asc' } },
        agent: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope check
    if (session.user.role === 'DEVELOPER') {
      if (!session.user.organizationId || conversation.agent.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    } else {
      // BUSINESS_OWNER: must have dashboard access for the agent
      const dashboard = await prisma.businessDashboard.findUnique({
        where: {
          agentId_userId: {
            agentId: conversation.agentId,
            userId: session.user.id,
          },
        },
      });
      if (!dashboard) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    logger.error('GET /api/v1/conversations/[id] failed', {
      error: err instanceof Error ? err.message : String(err),
      conversationId: params.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
