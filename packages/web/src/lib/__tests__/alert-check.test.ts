import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAlerts, _resetAlertTimestamps } from '../alert-check';

describe('checkAlerts', () => {
  beforeEach(() => {
    _resetAlertTimestamps(); // reset dedup state between tests
  });

  it('triggers QUALITY_DROP alert when score below threshold', async () => {
    const alerts = [{
      id: 'alert_1',
      type: 'QUALITY_DROP',
      threshold: { minScore: 70 },
      channel: 'EMAIL',
      enabled: true,
      userId: 'user_1',
      user: { email: 'dev@test.com' },
    }];

    const metrics = { qualityScore: 60, errorRate: 0.01, totalCostCents: 100 };
    const sendFn = vi.fn();

    await checkAlerts(alerts as any, metrics, sendFn);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when threshold not breached', async () => {
    const alerts = [{
      id: 'alert_1',
      type: 'QUALITY_DROP',
      threshold: { minScore: 70 },
      channel: 'EMAIL',
      enabled: true,
      userId: 'user_1',
      user: { email: 'dev@test.com' },
    }];

    const metrics = { qualityScore: 85, errorRate: 0.01, totalCostCents: 100 };
    const sendFn = vi.fn();

    await checkAlerts(alerts as any, metrics, sendFn);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('deduplicates - max 1 alert per type per hour', async () => {
    const alerts = [{
      id: 'alert_1',
      type: 'QUALITY_DROP',
      threshold: { minScore: 70 },
      channel: 'EMAIL',
      enabled: true,
      userId: 'user_1',
      user: { email: 'dev@test.com' },
    }];

    const metrics = { qualityScore: 60, errorRate: 0.01, totalCostCents: 100 };
    const sendFn = vi.fn();

    await checkAlerts(alerts as any, metrics, sendFn);
    await checkAlerts(alerts as any, metrics, sendFn);
    expect(sendFn).toHaveBeenCalledTimes(1); // second call deduped
  });
});
