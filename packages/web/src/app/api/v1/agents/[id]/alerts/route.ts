import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const createAlertSchema = z.object({
  type: z.enum(['QUALITY_DROP', 'ERROR_SPIKE', 'BUDGET_EXCEEDED', 'FLAG_TYPE']),
  threshold: z.record(z.unknown()),
  channel: z.enum(['EMAIL']),
});

async function checkDeveloperAgentAccess(
  agentId: string,
  organizationId: string | null | undefined
) {
  if (!organizationId) return null;
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.organizationId !== organizationId) return null;
  return agent;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow both roles to view alert configs, but scope appropriately
  try {
    let agentAccessible = false;

    if (session.user.role === 'DEVELOPER') {
      const agent = await checkDeveloperAgentAccess(params.id, session.user.organizationId);
      agentAccessible = !!agent;
    } else {
      const dashboard = await prisma.businessDashboard.findUnique({
        where: { agentId_userId: { agentId: params.id, userId: session.user.id } },
      });
      agentAccessible = !!dashboard;
    }

    if (!agentAccessible) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const alerts = await prisma.alertConfig.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id]/alerts failed', { error: String(err), agentId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const agent = await checkDeveloperAgentAccess(params.id, session.user.organizationId);
  if (!agent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const alert = await prisma.alertConfig.create({
      data: {
        agentId: params.id,
        userId: session.user.id,
        type: parsed.data.type,
        threshold: parsed.data.threshold as import('@prisma/client').Prisma.InputJsonValue,
        channel: parsed.data.channel,
      },
    });

    logger.info('Alert config created', { alertId: alert.id, agentId: params.id, userId: session.user.id });
    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    logger.error('POST /api/v1/agents/[id]/alerts failed', { error: String(err), agentId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
