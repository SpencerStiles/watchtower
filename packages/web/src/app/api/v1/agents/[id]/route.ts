import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const patchAgentSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ERROR']).optional(),
  config: z.record(z.unknown()).optional(),
});

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

  // BUSINESS_OWNER: must have a BusinessDashboard
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

  try {
    const agent = await checkAgentAccess(
      params.id,
      session.user.id,
      session.user.organizationId,
      session.user.role
    );
    if (!agent) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id] failed', { error: err instanceof Error ? err.message : String(err), agentId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.config !== undefined && {
          config: parsed.data.config as import('@prisma/client').Prisma.InputJsonValue,
        }),
      },
    });

    logger.info('Agent updated', { agentId: params.id, userId: session.user.id });
    return NextResponse.json({ agent: updated });
  } catch (err) {
    logger.error('PATCH /api/v1/agents/[id] failed', { error: err instanceof Error ? err.message : String(err), agentId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
