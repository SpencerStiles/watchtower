interface AlertConfig {
  id: string;
  type: string;
  threshold: any;
  channel: string;
  enabled: boolean;
  userId: string;
  user: { email: string };
}

interface AlertMetrics {
  qualityScore: number | null;
  errorRate: number;
  totalCostCents: number;
}

type SendFn = (to: string, subject: string, html: string) => Promise<void>;

// In-memory deduplication: alertConfigId -> last sent timestamp
const lastAlertSent = new Map<string, number>();

export function _resetAlertTimestamps() {
  lastAlertSent.clear();
}

const ONE_HOUR = 60 * 60 * 1000;

export async function checkAlerts(
  alerts: AlertConfig[],
  metrics: AlertMetrics,
  send?: SendFn
): Promise<void> {
  const sendFn: SendFn = send ?? (async (to, subject, html) => {
    const { sendEmail } = await import('./email');
    return sendEmail(to, subject, html);
  });
  for (const alert of alerts) {
    if (!alert.enabled) continue;

    // Dedup check
    const lastSent = lastAlertSent.get(alert.id);
    if (lastSent && Date.now() - lastSent < ONE_HOUR) continue;

    let triggered = false;
    let subject = '';
    let html = '';

    switch (alert.type) {
      case 'QUALITY_DROP': {
        const minScore = alert.threshold?.minScore ?? 70;
        if (metrics.qualityScore !== null && metrics.qualityScore < minScore) {
          triggered = true;
          subject = `WatchTower Alert: Quality score dropped to ${metrics.qualityScore}`;
          html = `<p>Quality score (${metrics.qualityScore}) is below threshold (${minScore}).</p>`;
        }
        break;
      }
      case 'ERROR_SPIKE': {
        const maxErrorRate = alert.threshold?.maxErrorRate ?? 0.1;
        if (metrics.errorRate > maxErrorRate) {
          triggered = true;
          subject = `WatchTower Alert: Error rate spike (${(metrics.errorRate * 100).toFixed(1)}%)`;
          html = `<p>Error rate (${(metrics.errorRate * 100).toFixed(1)}%) exceeds threshold (${(maxErrorRate * 100).toFixed(1)}%).</p>`;
        }
        break;
      }
      case 'BUDGET_EXCEEDED': {
        const maxCostCents = alert.threshold?.maxCostCents ?? 50000;
        if (metrics.totalCostCents > maxCostCents) {
          triggered = true;
          subject = `WatchTower Alert: Budget exceeded ($${(metrics.totalCostCents / 100).toFixed(2)})`;
          html = `<p>Cost ($${(metrics.totalCostCents / 100).toFixed(2)}) exceeds budget ($${(maxCostCents / 100).toFixed(2)}).</p>`;
        }
        break;
      }
    }

    if (triggered) {
      lastAlertSent.set(alert.id, Date.now());
      await sendFn(alert.user.email, subject, html);
    }
  }
}
