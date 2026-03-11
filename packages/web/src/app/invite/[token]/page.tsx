import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PLANS } from '@/lib/stripe';
import { logger } from '@/lib/logger';

interface InvitePageProps {
  params: { token: string };
  searchParams: { tier?: string };
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = params;
  const billingTier = (searchParams.tier === 'PRO' ? 'PRO' : 'STARTER') as 'STARTER' | 'PRO';

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { agent: true },
  });

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-[#2d2d35] bg-[#111114] p-8 text-center">
          <h1 className="text-xl font-bold text-red-400">Invalid Invitation</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">This invitation link is invalid.</p>
        </div>
      </main>
    );
  }

  if (invitation.status === 'ACCEPTED') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-[#2d2d35] bg-[#111114] p-8 text-center">
          <h1 className="text-xl font-bold text-yellow-400">Already Accepted</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">This invitation has already been accepted.</p>
        </div>
      </main>
    );
  }

  if (invitation.status === 'EXPIRED') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-[#2d2d35] bg-[#111114] p-8 text-center">
          <h1 className="text-xl font-bold text-red-400">Invitation Expired</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">This invitation link has expired.</p>
        </div>
      </main>
    );
  }

  // Valid invitation — handle accept action via server action
  async function acceptInvitation() {
    'use server';

    const inv = await prisma.invitation.findUnique({
      where: { token },
      include: { agent: true },
    });

    if (!inv || inv.status !== 'PENDING') {
      redirect('/');
    }

    // Get or create user
    const session = await getServerSession(authOptions);
    let userId: string;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Create a new BUSINESS_OWNER user record for the invited email
      const existing = await prisma.user.findUnique({ where: { email: inv.email } });
      if (existing) {
        userId = existing.id;
      } else {
        const newUser = await prisma.user.create({
          data: {
            email: inv.email,
            role: 'BUSINESS_OWNER',
          },
        });
        userId = newUser.id;
      }
    }

    // Create Stripe checkout session
    const plan = PLANS[billingTier];
    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: plan.priceId, quantity: 1 }],
        metadata: {
          invitationId: inv.id,
          agentId: inv.agentId,
          userId,
          billingTier,
        },
        success_url: `${process.env.NEXTAUTH_URL}/dashboard?invited=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/invite/${token}?tier=${billingTier}`,
      });

      logger.info('Stripe checkout session created for invitation', {
        invitationId: inv.id,
        userId,
        billingTier,
      });

      if (checkoutSession.url) {
        redirect(checkoutSession.url);
      }
    } catch (err) {
      logger.error('Failed to create Stripe checkout session', { error: String(err) });
      redirect('/');
    }
  }

  const plan = PLANS[billingTier];

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-[#2d2d35] bg-[#111114] p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)]">WatchTower</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">You&apos;ve been invited to monitor an agent</p>
        </div>

        <div className="rounded-md border border-[#2d2d35] bg-[#1e1e24] p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Agent</span>
            <span className="font-medium text-[#fafafa]">{invitation.agent.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Plan</span>
            <span className="font-medium text-[#fafafa]">{plan.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Price</span>
            <span className="font-medium text-[#fafafa]">${(plan.priceCents / 100).toFixed(2)}/month</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Events/month</span>
            <span className="font-medium text-[#fafafa]">{plan.eventsPerMonth.toLocaleString()}</span>
          </div>
        </div>

        <form action={acceptInvitation}>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Accept &amp; Subscribe
          </button>
        </form>

        <p className="text-center text-xs text-[#a1a1aa]">
          You&apos;ll be redirected to Stripe to complete your subscription.
        </p>
      </div>
    </main>
  );
}
