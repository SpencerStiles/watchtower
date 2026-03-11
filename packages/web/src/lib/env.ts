import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  GITHUB_ID: z.string().min(1),
  GITHUB_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_STARTER_PRICE_ID: z.string().startsWith('price_'),
  STRIPE_PRO_PRICE_ID: z.string().startsWith('price_'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
});

export const env = envSchema.parse(process.env);
