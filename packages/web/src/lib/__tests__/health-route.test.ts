import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/db';

const mockPrisma = prisma as any;

describe('GET /api/health', () => {
  it('returns 200 with status ok when DB responds', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 503 with status error when DB throws', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe('error');
    expect(typeof body.timestamp).toBe('string');
  });
});
