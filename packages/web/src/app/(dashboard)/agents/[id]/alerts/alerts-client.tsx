'use client';

import { useState } from 'react';
import { motion, fadeUpVariants, staggerContainer } from '@/components/motion';

interface Alert {
  id: string;
  type: string;
  threshold: Record<string, unknown>;
  channel: string;
  enabled: boolean;
  createdAt: string;
}

interface Props {
  agentId: string;
  initialAlerts: Alert[];
}

const ALERT_TYPES = [
  { value: 'QUALITY_DROP', label: 'Quality Drop' },
  { value: 'ERROR_SPIKE', label: 'Error Spike' },
  { value: 'BUDGET_EXCEEDED', label: 'Budget Exceeded' },
  { value: 'FLAG_TYPE', label: 'Flag Type' },
] as const;

const THRESHOLD_LABELS: Record<string, { label: string; placeholder: string }> = {
  QUALITY_DROP: { label: 'Min quality score', placeholder: '70' },
  ERROR_SPIKE: { label: 'Max error rate (%)', placeholder: '10' },
  BUDGET_EXCEEDED: { label: 'Budget limit ($)', placeholder: '10.00' },
  FLAG_TYPE: { label: 'Flag category', placeholder: 'HALLUCINATION' },
};

export function AlertsClient({ agentId, initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [alertType, setAlertType] = useState<string>('QUALITY_DROP');
  const [thresholdValue, setThresholdValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function buildThreshold(type: string, value: string): Record<string, unknown> {
    switch (type) {
      case 'QUALITY_DROP':
        return { minScore: Number(value) };
      case 'ERROR_SPIKE':
        return { maxErrorRate: Number(value) / 100 };
      case 'BUDGET_EXCEEDED':
        return { maxCostCents: Math.round(Number(value) * 100) };
      case 'FLAG_TYPE':
        return { category: value };
      default:
        return { value };
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const threshold = buildThreshold(alertType, thresholdValue);
      const res = await fetch(`/api/v1/agents/${agentId}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: alertType, threshold, channel: 'EMAIL' }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create alert');
        return;
      }

      const newAlert: Alert = {
        id: data.alert.id,
        type: data.alert.type,
        threshold: data.alert.threshold,
        channel: data.alert.channel,
        enabled: data.alert.enabled,
        createdAt: data.alert.createdAt,
      };

      setAlerts((prev) => [newAlert, ...prev]);
      setSuccess('Alert created');
      setThresholdValue('');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAlert(alertId: string, enabled: boolean) {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, enabled: !enabled } : a))
    );
    // Note: toggling enabled is done via direct DB, no dedicated toggle endpoint in spec.
    // We'll use a workaround via the existing PATCH endpoint if it exists, otherwise just optimistic.
    // For now this is UI-only optimistic (real toggle would need a PATCH /api/v1/alert-configs/[id]).
  }

  const thresholdInfo = THRESHOLD_LABELS[alertType];

  return (
    <div className="space-y-8">
      {/* Existing Alerts */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Active Alerts ({alerts.length})
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              No alerts configured. Create one below.
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                variants={fadeUpVariants}
                transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">
                      {ALERT_TYPES.find((t) => t.value === alert.type)?.label ?? alert.type}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-xs bg-[rgba(113,113,122,0.15)] text-muted">
                      {alert.channel}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted">
                    threshold: {JSON.stringify(alert.threshold)}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleAlert(alert.id, alert.enabled)}
                  className="relative w-10 h-5 rounded-full transition-colors active:scale-[0.97] transition-all"
                  style={{
                    backgroundColor: alert.enabled ? 'var(--success)' : 'var(--border)',
                  }}
                  title={alert.enabled ? 'Disable' : 'Enable'}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: '#fff',
                      left: '2px',
                      transform: alert.enabled ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* New Alert Form */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          New Alert
        </h2>
        <div className="rounded-lg border border-border bg-surface p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-text">
                  Alert Type
                </label>
                <select
                  value={alertType}
                  onChange={(e) => {
                    setAlertType(e.target.value);
                    setThresholdValue('');
                  }}
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text"
                >
                  {ALERT_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-text">
                  {thresholdInfo?.label ?? 'Threshold'}
                </label>
                <input
                  type="text"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  placeholder={thresholdInfo?.placeholder ?? ''}
                  required
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-text">
                  Channel
                </label>
                <div className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-muted">
                  EMAIL
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}

            <button
              type="submit"
              disabled={loading || !thresholdValue.trim()}
              className="rounded-md px-4 py-2 text-sm font-medium bg-accent text-white transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Alert'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
