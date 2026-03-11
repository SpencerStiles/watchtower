import { prisma } from './db';
import { randomBytes, createHash } from 'crypto';

export function generateApiKey(): string {
  return `wt_${randomBytes(24).toString('hex')}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(key: string) {
  if (!key.startsWith('wt_')) return null;
  const hash = hashApiKey(key);
  const agent = await prisma.agent.findUnique({
    where: { apiKeyHash: hash },
    include: { organization: true },
  });
  return agent;
}
