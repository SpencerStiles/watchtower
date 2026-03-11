import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: import('stripe').Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { error: String(err) });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session;
        const metadata = session.metadata ?? {};
        const { invitationId, agentId, userId, billingTier } = metadata;

        if (!agentId || !userId || !billingTier) {
          logger.warn('checkout.session.completed missing metadata', { metadata });
          break;
        }

        const stripeSubId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null;

        await prisma.businessDashboard.upsert({
          where: { agentId_userId: { agentId, userId } },
          create: {
            agentId,
            userId,
            billingTier: billingTier as 'STARTER' | 'PRO',
            stripeSubId,
          },
          update: {
            billingTier: billingTier as 'STARTER' | 'PRO',
            stripeSubId,
          },
        });

        if (invitationId) {
          await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: 'ACCEPTED' },
          }).catch(() => {
            // Invitation may not exist; non-fatal
          });
        }

        logger.info('BusinessDashboard created via checkout', { agentId, userId, billingTier });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as import('stripe').Stripe.Subscription;
        const stripeSubId = subscription.id;

        // Find dashboard by stripeSubId and update billing tier if changed
        const dashboard = await prisma.businessDashboard.findFirst({
          where: { stripeSubId },
        });

        if (!dashboard) {
          logger.warn('No dashboard found for subscription', { stripeSubId });
          break;
        }

        // Determine new tier from price ID
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId) {
          const { PLANS } = await import('@/lib/stripe');
          let newTier: 'STARTER' | 'PRO' | null = null;
          if (priceId === PLANS.STARTER.priceId) newTier = 'STARTER';
          else if (priceId === PLANS.PRO.priceId) newTier = 'PRO';

          if (newTier && newTier !== dashboard.billingTier) {
            await prisma.businessDashboard.update({
              where: { id: dashboard.id },
              data: { billingTier: newTier },
            });
            logger.info('BusinessDashboard billing tier updated', {
              dashboardId: dashboard.id,
              newTier,
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice;
        logger.warn('Invoice payment failed', {
          invoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
        });
        break;
      }

      default:
        logger.info('Unhandled Stripe webhook event', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook processing failed', { error: String(err), type: event.type });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
