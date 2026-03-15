import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Module mocks (must be before any imports that use them) ---

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    alertConfig: { findMany: vi.fn() },
    event: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    agent: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/api-key', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/sse', () => ({
  sseManager: { broadcast: vi.fn() },
}));

vi.mock('@/lib/alert-check', () => ({
  checkAlerts: vi.fn(),
}));

vi.mock('@/lib/scoring', () => ({
  scoreEvent: vi.fn(),
  calculateConversationScore: vi.fn(),
  updateAgentScore: vi.fn(),
  extractResponseText: vi.fn(),
}));

vi.mock('@/lib/pricing', () => ({
  calculateCostCents: vi.fn(),
}));

// --- Import after mocks ---
import { POST, OPTIONS } from '@/app/api/v1/events/route';
import { prisma } from '@/lib/db';
import { validateApiKey } from '@/lib/api-key';
import { rateLimit } from '@/lib/rate-limit';
import { scoreEvent, calculateConversationScore, updateAgentScore, extractResponseText } from '@/lib/scoring';
import { calculateCostCents } from '@/lib/pricing';

// --- Types for mocks ---
const mockValidateApiKey = validateApiKey as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockScoreEvent = scoreEvent as ReturnType<typeof vi.fn>;
const mockCalculateConversationScore = calculateConversationScore as ReturnType<typeof vi.fn>;
const mockUpdateAgentScore = updateAgentScore as ReturnType<typeof vi.fn>;
const mockExtractResponseText = extractResponseText as ReturnType<typeof vi.fn>;
const mockCalculateCostCents = calculateCostCents as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as any;

// --- Fixtures ---

const FAKE_AGENT = {
  id: 'agent_123',
  qualityScore: 90,
  config: {},
};

const VALID_EVENT = {
  eventId: '00000000-0000-0000-0000-000000000001',
  sessionId: 'session_abc',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-4-6',
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 350,
  requestBody: { messages: [] },
  responseBody: { content: [{ type: 'text', text: 'Hello' }] },
  isError: false,
  errorMessage: null,
  timestamp: '2026-01-01T00:00:00.000Z',
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new Request('http://localhost/api/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer wt_test_key',
      ...headers,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

// Build a mock $transaction that runs the callback with a fake tx
function buildMockTransaction() {
  const fakeTx = {
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: 'conv_1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    event: {
      upsert: vi.fn().mockResolvedValue({ id: 'event_1' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'event_1' }]),
    },
    qualityFlag: {
      createMany: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    agent: {
      update: vi.fn().mockResolvedValue({}),
    },
  };

  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => cb(fakeTx));

  return fakeTx;
}

// --- Tests ---

describe('OPTIONS /api/v1/events', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('POST /api/v1/events — CORS', () => {
  beforeEach(() => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    buildMockTransaction();
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);
  });

  it('POST response includes Access-Control-Allow-Origin: *', async () => {
    const req = makeRequest([VALID_EVENT]);
    const res = await POST(req);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('POST /api/v1/events — Auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([VALID_EVENT]),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.requestId).toBeDefined();
  });

  it('returns 401 when API key is invalid', async () => {
    mockValidateApiKey.mockResolvedValue(null);

    const req = makeRequest([VALID_EVENT]);
    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.requestId).toBeDefined();
  });

  it('proceeds to process events when API key is valid', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    buildMockTransaction();
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);

    const req = makeRequest([VALID_EVENT]);
    const res = await POST(req);
    expect(res.status).toBe(202);
  });
});

describe('POST /api/v1/events — Payload size', () => {
  it('returns 413 when Content-Length exceeds 1MB', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);

    const req = makeRequest([VALID_EVENT], {
      'Content-Length': String(1_048_577),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body.requestId).toBeDefined();
  });

  it('proceeds when Content-Length is exactly 1MB', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    buildMockTransaction();
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);

    const req = makeRequest([VALID_EVENT], {
      'Content-Length': String(1_048_576),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
  });
});

describe('POST /api/v1/events — Validation', () => {
  beforeEach(() => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
  });

  it('returns 400 for empty array body', async () => {
    const req = makeRequest([]);
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.requestId).toBeDefined();
  });

  it('returns 400 when array has more than 100 events', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      ...VALID_EVENT,
      eventId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    }));
    const req = makeRequest(tooMany);
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when event is missing required fields', async () => {
    const bad = { eventId: 'not-a-uuid', sessionId: '' };
    const req = makeRequest([bad]);
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wt_test_key',
      },
      body: 'not-json-{{{',
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/events — Valid payloads', () => {
  beforeEach(() => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);
  });

  it('returns 202 for a single valid event (sent as object)', async () => {
    buildMockTransaction();

    const req = makeRequest(VALID_EVENT);
    const res = await POST(req);
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.received).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].status).toBe('ok');
    expect(body.requestId).toBeDefined();
  });

  it('returns 202 for a batch of 3 events', async () => {
    buildMockTransaction();

    const batch = [
      { ...VALID_EVENT, eventId: '00000000-0000-0000-0000-000000000001' },
      { ...VALID_EVENT, eventId: '00000000-0000-0000-0000-000000000002' },
      { ...VALID_EVENT, eventId: '00000000-0000-0000-0000-000000000003' },
    ];
    const req = makeRequest(batch);
    const res = await POST(req);
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.received).toBe(3);
    expect(body.results).toHaveLength(3);
    body.results.forEach((r: { eventId: string; status: string }) => {
      expect(r.status).toBe('ok');
    });
  });
});

describe('POST /api/v1/events — Request ID', () => {
  it('success response includes X-Request-Id header', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    buildMockTransaction();
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);

    const req = makeRequest([VALID_EVENT]);
    const res = await POST(req);
    expect(res.status).toBe(202);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('error responses include requestId in body', async () => {
    // Missing auth — 401
    const req = new Request('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([VALID_EVENT]),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.requestId).toBeDefined();
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/events — Deduplication', () => {
  beforeEach(() => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockScoreEvent.mockReturnValue({ score: 100, flags: [] });
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockCalculateCostCents.mockReturnValue(0);
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);
  });

  it('processes duplicate eventId in same batch idempotently (both return ok)', async () => {
    // The route uses upsert with update:{} — same eventId still goes through
    buildMockTransaction();

    const sameId = '00000000-0000-0000-0000-000000000001';
    const batch = [
      { ...VALID_EVENT, eventId: sameId },
      { ...VALID_EVENT, eventId: sameId },
    ];

    const req = makeRequest(batch);
    const res = await POST(req);
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.received).toBe(2);
    body.results.forEach((r: { status: string }) => {
      expect(r.status).toBe('ok');
    });
  });
});

describe('POST /api/v1/events — Per-event error isolation', () => {
  it('marks second event as error when scoreEvent throws on second call', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(true);
    mockExtractResponseText.mockReturnValue('Hello');
    mockCalculateCostCents.mockReturnValue(0);
    mockCalculateConversationScore.mockReturnValue(95);
    mockUpdateAgentScore.mockReturnValue(92);
    mockPrisma.alertConfig.findMany.mockResolvedValue([]);

    // First call succeeds, second throws
    mockScoreEvent
      .mockReturnValueOnce({ score: 100, flags: [] })
      .mockImplementationOnce(() => {
        throw new Error('scoring exploded');
      });

    buildMockTransaction();

    const batch = [
      { ...VALID_EVENT, eventId: '00000000-0000-0000-0000-000000000001' },
      { ...VALID_EVENT, eventId: '00000000-0000-0000-0000-000000000002' },
    ];

    const req = makeRequest(batch);
    const res = await POST(req);
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.received).toBe(2);
    expect(body.results[0].status).toBe('ok');
    expect(body.results[1].status).toBe('error');
  });
});

describe('POST /api/v1/events — Rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockValidateApiKey.mockResolvedValue(FAKE_AGENT);
    mockRateLimit.mockReturnValue(false);

    const req = makeRequest([VALID_EVENT]);
    const res = await POST(req);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.code).toBe('RATE_LIMITED');
  });
});
