import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { generateApiKey, hashApiKey } from '@/lib/api-key';
import { logger } from '@/lib/logger';

const createAgentSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (session.user.role === 'DEVELOPER') {
      if (!session.user.organizationId) {
        return NextResponse.json({ agents: [] });
      }
      const agents = await prisma.agent.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ agents });
    }

    // BUSINESS_OWNER: return agents linked via BusinessDashboard
    const dashboards = await prisma.businessDashboard.findMany({
      where: { userId: session.user.id },
      include: { agent: true },
    });
    const agents = dashboards.map((d) => d.agent);
    return NextResponse.json({ agents });
  } catch (err) {
    logger.error('GET /api/v1/agents failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const apiKey = generateApiKey();
    const agent = await prisma.agent.create({
      data: {
        name: parsed.data.name,
        organizationId: session.user.organizationId,
        apiKeyHash: hashApiKey(apiKey),
      },
    });

    logger.info('Agent created', { agentId: agent.id, userId: session.user.id });
    // Return the raw key only on creation — it cannot be retrieved later
    return NextResponse.json({ agent: { ...agent, apiKey }, apiKey }, { status: 201 });
  } catch (err) {
    logger.error('POST /api/v1/agents failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
