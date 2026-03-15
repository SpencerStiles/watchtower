import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { sendEmail, invitationEmailHtml } from '@/lib/email';
import { logger } from '@/lib/logger';

const createInvitationSchema = z.object({
  email: z.string().email(),
  agentId: z.string().min(1),
  billingTier: z.enum(['STARTER', 'PRO']),
});

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

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { email, agentId, billingTier } = parsed.data;

  // Verify developer owns the agent's org
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const token = randomBytes(32).toString('hex');

    const invitation = await prisma.invitation.create({
      data: {
        email,
        agentId,
        invitedBy: session.user.id,
        token,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${token}?tier=${billingTier}`;
    const html = invitationEmailHtml(agent.name, inviteUrl);

    await sendEmail(email, `You've been invited to monitor ${agent.name} on WatchTower`, html);

    logger.info('Invitation created', {
      invitationId: invitation.id,
      email,
      agentId,
      userId: session.user.id,
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (err) {
    logger.error('POST /api/v1/invitations failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
