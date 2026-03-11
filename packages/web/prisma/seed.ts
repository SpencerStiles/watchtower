import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Seed API keys — printed at end so developer can use them
const SEED_KEY_ALPHA = 'wt_seed_key_alpha_000000000000000000000000000000000000000000000000';
const SEED_KEY_BETA = 'wt_seed_key_beta_0000000000000000000000000000000000000000000000000';

async function main() {
  console.log('Seeding database...');

  // Clean up existing seed data
  await prisma.alertConfig.deleteMany({});
  await prisma.qualityFlag.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.businessDashboard.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  // --- Organization ---
  const org = await prisma.organization.create({
    data: {
      id: 'seed_org_id',
      name: 'Demo Agency',
    },
  });

  // --- Developer User ---
  const developer = await prisma.user.create({
    data: {
      id: 'seed_dev_id',
      email: 'dev@demo.com',
      name: 'Demo Developer',
      role: 'DEVELOPER',
      organizationId: org.id,
    },
  });

  // --- Agents ---
  const agentAlpha = await prisma.agent.create({
    data: {
      id: 'seed_agent_alpha',
      name: 'Support Bot Alpha',
      organizationId: org.id,
      apiKeyHash: hashKey(SEED_KEY_ALPHA),
      status: 'ACTIVE',
      config: {
        blockedKeywords: ['competitor', 'lawsuit'],
        maxResponseLength: 2000,
      },
      qualityScore: 82,
    },
  });

  const agentBeta = await prisma.agent.create({
    data: {
      id: 'seed_agent_beta',
      name: 'Sales Bot Beta',
      organizationId: org.id,
      apiKeyHash: hashKey(SEED_KEY_BETA),
      status: 'ACTIVE',
      config: {
        blockedKeywords: ['refund', 'cancel'],
      },
      qualityScore: 74,
    },
  });

  // --- Business Owner User ---
  const businessOwner = await prisma.user.create({
    data: {
      id: 'seed_biz_id',
      email: 'owner@demo.com',
      name: 'Demo Business Owner',
      role: 'BUSINESS_OWNER',
      organizationId: org.id,
    },
  });

  // --- BusinessDashboard ---
  await prisma.businessDashboard.create({
    data: {
      agentId: agentAlpha.id,
      userId: businessOwner.id,
      billingTier: 'PRO',
    },
  });

  await prisma.businessDashboard.create({
    data: {
      agentId: agentBeta.id,
      userId: businessOwner.id,
      billingTier: 'STARTER',
    },
  });

  // --- Sample AlertConfigs ---
  await prisma.alertConfig.create({
    data: {
      agentId: agentAlpha.id,
      userId: developer.id,
      type: 'QUALITY_DROP',
      threshold: { minScore: 70 },
      channel: 'EMAIL',
      enabled: true,
    },
  });

  await prisma.alertConfig.create({
    data: {
      agentId: agentAlpha.id,
      userId: developer.id,
      type: 'ERROR_SPIKE',
      threshold: { maxErrorRate: 0.1 },
      channel: 'EMAIL',
      enabled: true,
    },
  });

  await prisma.alertConfig.create({
    data: {
      agentId: agentBeta.id,
      userId: developer.id,
      type: 'BUDGET_EXCEEDED',
      threshold: { maxCostCents: 5000 },
      channel: 'EMAIL',
      enabled: true,
    },
  });

  // --- Sample Conversations + Events + QualityFlags ---
  const MODELS = ['claude-sonnet-4-6', 'claude-haiku-3-5', 'gpt-4o', 'gpt-4o-mini'];
  const PROVIDERS: ('ANTHROPIC' | 'OPENAI')[] = ['ANTHROPIC', 'ANTHROPIC', 'OPENAI', 'OPENAI'];

  const FLAG_CATEGORIES: ('HALLUCINATION' | 'OFF_BRAND' | 'POLICY_VIOLATION' | 'SENTIMENT_NEGATIVE' | 'ANOMALY')[] = [
    'HALLUCINATION',
    'OFF_BRAND',
    'POLICY_VIOLATION',
    'SENTIMENT_NEGATIVE',
    'ANOMALY',
  ];
  const SEVERITIES: ('LOW' | 'MEDIUM' | 'HIGH')[] = ['LOW', 'MEDIUM', 'HIGH'];

  const SAMPLE_RESPONSES = [
    "I'd be happy to help you with that! Here's what I found...",
    "Thank you for reaching out. Let me check on that for you.",
    "I understand your concern. The issue is related to your account settings.",
    "Great question! Our product supports multiple integrations including Slack, Jira, and GitHub.",
    "I'm sorry to hear that. Let me escalate this to our support team.",
    "You can find the documentation at our help center. Would you like me to share the link?",
    "That feature is available on our PRO plan. Here are the details...",
    "I've updated your preferences. The changes should take effect within 24 hours.",
    "Based on your usage, I recommend upgrading to reduce costs.",
    "The system will be back online shortly. We apologize for the inconvenience.",
  ];

  const targetAgent = agentAlpha;
  const now = Date.now();

  for (let i = 0; i < 50; i++) {
    const sessionId = `seed_session_${i}`;
    const modelIdx = i % MODELS.length;
    const model = MODELS[modelIdx];
    const provider = PROVIDERS[modelIdx];
    const isError = i % 15 === 0; // ~6.7% error rate
    const inputTokens = 50 + Math.floor(Math.random() * 200);
    const outputTokens = 100 + Math.floor(Math.random() * 400);
    const costCents = Math.round((inputTokens * 0.003 + outputTokens * 0.015) / 1000 * 100);
    const daysAgo = Math.floor(i / 5); // spread over ~10 days
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    const conversation = await prisma.conversation.create({
      data: {
        agentId: targetAgent.id,
        sessionId,
        eventCount: 1,
        totalTokens: inputTokens + outputTokens,
        totalCostCents: costCents,
        qualityScore: isError ? 40 + Math.floor(Math.random() * 30) : 70 + Math.floor(Math.random() * 30),
        startedAt: createdAt,
        lastEventAt: createdAt,
      },
    });

    const responseText = isError ? null : SAMPLE_RESPONSES[i % SAMPLE_RESPONSES.length];

    const event = await prisma.event.create({
      data: {
        conversationId: conversation.id,
        agentId: targetAgent.id,
        provider,
        model,
        inputTokens,
        outputTokens,
        costCents,
        latencyMs: 200 + Math.floor(Math.random() * 1500),
        requestBody: {
          model,
          messages: [{ role: 'user', content: `Seed message ${i}` }],
          max_tokens: 1024,
        },
        responseBody: isError
          ? { error: { type: 'api_error', message: 'Internal server error' } }
          : {
              content: [{ type: 'text', text: responseText }],
              usage: { input_tokens: inputTokens, output_tokens: outputTokens },
            },
        isError,
        errorMessage: isError ? 'Internal server error' : null,
        createdAt,
      },
    });

    // Add quality flags for ~30% of non-error conversations
    if (!isError && i % 3 === 0) {
      const category = FLAG_CATEGORIES[i % FLAG_CATEGORIES.length];
      const severity = SEVERITIES[i % SEVERITIES.length];

      await prisma.qualityFlag.create({
        data: {
          conversationId: conversation.id,
          eventId: event.id,
          category,
          severity,
          reason: `Seed flag: ${category.toLowerCase().replace('_', ' ')} detected`,
          layer: i % 2 === 0 ? 1 : 2,
          createdAt,
        },
      });
    }
  }

  console.log('Seed complete!');
  console.log('');
  console.log('Developer login: dev@demo.com');
  console.log('Business Owner login: owner@demo.com');
  console.log('');
  console.log('Agent Alpha API key:', SEED_KEY_ALPHA);
  console.log('Agent Beta API key: ', SEED_KEY_BETA);
  console.log('');
  console.log('Organization:', org.name, '(id:', org.id, ')');
  console.log('Developer user id:', developer.id);
  console.log('Agent Alpha id:', agentAlpha.id);
  console.log('Agent Beta id:', agentBeta.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
