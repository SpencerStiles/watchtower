import nodemailer from 'nodemailer';
import { logger } from './logger';
import { env } from './env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT, 10),
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Email (dev mode — not sent)', { to, subject });
    return;
  }

  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
  logger.info('Email sent', { to, subject });
}

export function invitationEmailHtml(agentName: string, inviteUrl: string): string {
  return `<h2>You've been invited to monitor "${agentName}" on WatchTower</h2><p><a href="${inviteUrl}">Accept Invitation</a></p>`;
}

export function alertEmailHtml(agentName: string, alertType: string, details: string): string {
  return `<h2>Alert: ${alertType} on "${agentName}"</h2><p>${details}</p>`;
}
