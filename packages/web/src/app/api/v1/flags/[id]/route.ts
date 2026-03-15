import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const patchFlagSchema = z.object({
  resolution: z.enum(['ACCEPTABLE', 'NEEDS_FIX']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchFlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    // Find the flag and verify access
    const flag = await prisma.qualityFlag.findUnique({
      where: { id: params.id },
      include: {
        conversation: {
          include: { agent: true },
        },
      },
    });

    if (!flag) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope check
    const agent = flag.conversation.agent;
    if (session.user.role === 'DEVELOPER') {
      if (!session.user.organizationId || agent.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    } else {
      const dashboard = await prisma.businessDashboard.findUnique({
        where: {
          agentId_userId: {
            agentId: agent.id,
            userId: session.user.id,
          },
        },
      });
      if (!dashboard) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const updated = await prisma.qualityFlag.update({
      where: { id: params.id },
      data: {
        resolution: parsed.data.resolution,
        resolvedById: session.user.id,
      },
    });

    logger.info('Flag resolved', { flagId: params.id, userId: session.user.id, resolution: parsed.data.resolution });
    return NextResponse.json({ flag: updated });
  } catch (err) {
    logger.error('PATCH /api/v1/flags/[id] failed', { error: err instanceof Error ? err.message : String(err), flagId: params.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
