import { prisma } from './db';
import { randomBytes } from 'crypto';

export function generateApiKey(): string {
  return `wt_${randomBytes(24).toString('hex')}`;
}

export async function validateApiKey(key: string) {
  if (!key.startsWith('wt_')) return null;
  const agent = await prisma.agent.findUnique({
    where: { apiKey: key },
    include: { organization: true },
  });
  return agent;
}
