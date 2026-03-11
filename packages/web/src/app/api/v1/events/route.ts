import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateApiKey } from '@/lib/api-key';
import { rateLimit } from '@/lib/rate-limit';
import { calculateCostCents } from '@/lib/pricing';
import { scoreEvent, calculateConversationScore, updateAgentScore, extractResponseText } from '@/lib/scoring';
import { logger } from '@/lib/logger';
import { checkAlerts } from '@/lib/alert-check';
import { sseManager } from '@/lib/sse';

const eventSchema = z.object({
  sessionId: z.string().min(1),
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  requestBody: z.unknown(),
  responseBody: z.unknown(),
  isError: z.boolean(),
  errorMessage: z.string().nullable(),
  timestamp: z.string().datetime(),
});

const batchSchema = z.array(eventSchema).min(1).max(100);

export async function POST(req: NextRequest) {
  // Auth via API key
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const agent = await validateApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Rate limit
  if (!rateLimit(agent.id, 1000, 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }, { status: 429 });
  }

  // Parse body — accept single event or array
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const events = Array.isArray(body) ? body : [body];
  const parsed = batchSchema.safeParse(events);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Process each event
  const agentConfig = (agent.config as Record<string, unknown>) ?? {};

  for (const eventData of parsed.data) {
    const costCents = calculateCostCents(eventData.model, eventData.inputTokens, eventData.outputTokens);

    // Find or create conversation
    const conversation = await prisma.conversation.upsert({
      where: {
        sessionId_agentId: {
          sessionId: eventData.sessionId,
          agentId: agent.id,
        },
      },
      create: {
        agentId: agent.id,
        sessionId: eventData.sessionId,
        eventCount: 0,
        totalTokens: 0,
        totalCostCents: 0,
      },
      update: {},
    });

    // Create event
    const event = await prisma.event.create({
      data: {
        conversationId: conversation.id,
        agentId: agent.id,
        provider: eventData.provider === 'anthropic' ? 'ANTHROPIC' : 'OPENAI',
        model: eventData.model,
        inputTokens: eventData.inputTokens,
        outputTokens: eventData.outputTokens,
        costCents,
        latencyMs: eventData.latencyMs,
        requestBody: eventData.requestBody as Record<string, unknown>,
        responseBody: eventData.responseBody as Record<string, unknown>,
        isError: eventData.isError,
        errorMessage: eventData.errorMessage,
      },
    });

    // Quality scoring
    const responseText = extractResponseText(eventData.responseBody, eventData.provider);
    const { score: _score, flags } = scoreEvent({
      responseText,
      isError: eventData.isError,
      errorMessage: eventData.errorMessage,
      agentConfig,
    });

    // Create quality flags
    if (flags.length > 0) {
      await prisma.qualityFlag.createMany({
        data: flags.map((f) => ({
          conversationId: conversation.id,
          eventId: event.id,
          category: f.category,
          severity: f.severity,
          reason: f.reason,
          layer: f.layer,
        })),
      });
    }

    // Update conversation aggregates
    const allEventScores = await prisma.event.findMany({
      where: { conversationId: conversation.id },
      select: { id: true },
    });

    const allFlags = await prisma.qualityFlag.findMany({
      where: { conversationId: conversation.id },
      select: { severity: true, eventId: true },
    });

    const eventFlagMap = new Map<string, number>();
    for (const flag of allFlags) {
      const eid = flag.eventId || 'unknown';
      const deduction = flag.severity === 'LOW' ? 5 : flag.severity === 'MEDIUM' ? 15 : flag.severity === 'HIGH' ? 30 : 50;
      eventFlagMap.set(eid, (eventFlagMap.get(eid) || 0) + deduction);
    }

    const eventScores = allEventScores.map((e) => Math.max(0, 100 - (eventFlagMap.get(e.id) || 0)));
    const conversationScore = calculateConversationScore(eventScores);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        eventCount: allEventScores.length,
        totalTokens: { increment: eventData.inputTokens + eventData.outputTokens },
        totalCostCents: { increment: costCents },
        qualityScore: conversationScore,
        lastEventAt: new Date(),
      },
    });

    // Update agent-level EWMA quality score
    const newAgentScore = updateAgentScore(agent.qualityScore, conversationScore);
    await prisma.agent.update({
      where: { id: agent.id },
      data: { qualityScore: newAgentScore },
    });

    // SSE broadcast
    sseManager.broadcast(agent.id, { type: 'event', data: { qualityScore: conversationScore, eventCount: allEventScores.length } });
  }

  // Check alerts
  const alertConfigs = await prisma.alertConfig.findMany({
    where: { agentId: agent.id, enabled: true },
    include: { user: { select: { email: true } } },
  });

  if (alertConfigs.length > 0) {
    const recentEvents = await prisma.event.findMany({
      where: { agentId: agent.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { isError: true },
    });

    const errorRate = recentEvents.length > 0
      ? recentEvents.filter(e => e.isError).length / recentEvents.length
      : 0;

    const totalCostToday = await prisma.event.aggregate({
      where: { agentId: agent.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _sum: { costCents: true },
    });

    const latestAgent = await prisma.agent.findUnique({ where: { id: agent.id } });

    await checkAlerts(
      alertConfigs as any,
      {
        qualityScore: latestAgent?.qualityScore ?? null,
        errorRate,
        totalCostCents: totalCostToday._sum.costCents ?? 0,
      }
    );
  }

  logger.info('Events ingested', { agentId: agent.id, count: parsed.data.length });

  return NextResponse.json({ received: parsed.data.length }, { status: 202 });
}
