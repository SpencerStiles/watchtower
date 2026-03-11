import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

export const PLANS = {
  STARTER: {
    name: 'Starter',
    priceId: env.STRIPE_STARTER_PRICE_ID,
    priceCents: 900,
    eventsPerMonth: 50_000,
  },
  PRO: {
    name: 'Pro',
    priceId: env.STRIPE_PRO_PRICE_ID,
    priceCents: 1900,
    eventsPerMonth: 500_000,
  },
} as const;
