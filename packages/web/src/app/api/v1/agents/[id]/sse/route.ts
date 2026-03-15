import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { sseManager } from '@/lib/sse';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const agentId = params.id;

  // Check access
  let agent: Awaited<ReturnType<typeof prisma.agent.findUnique>>;
  try {
    agent = await prisma.agent.findUnique({ where: { id: agentId } });
  } catch (err) {
    logger.error('GET /api/v1/agents/[id]/sse failed', {
      error: err instanceof Error ? err.message : String(err),
      agentId,
    });
    return new Response('Internal server error', { status: 500 });
  }

  if (!agent) {
    return new Response('Not found', { status: 404 });
  }

  if (session.user.role === 'DEVELOPER') {
    if (!session.user.organizationId || agent.organizationId !== session.user.organizationId) {
      return new Response('Forbidden', { status: 403 });
    }
  } else {
    // BUSINESS_OWNER: must have a BusinessDashboard
    const dashboard = await prisma.businessDashboard.findUnique({
      where: { agentId_userId: { agentId, userId: session.user.id } },
    });
    if (!dashboard) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  let keepaliveInterval: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const writer = {
        write(data: string) {
          controller.enqueue(encoder.encode(data));
        },
      };

      sseManager.register(agentId, writer);

      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Keepalive every 30 seconds
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 30_000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        sseManager.unregister(agentId, writer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
