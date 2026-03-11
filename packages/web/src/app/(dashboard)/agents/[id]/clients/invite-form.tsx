'use client';

import { useState } from 'react';

interface Props {
  agentId: string;
}

export function InviteClientForm({ agentId }: Props) {
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'STARTER' | 'PRO'>('STARTER');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, agentId, billingTier: tier }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invitation');
        return;
      }
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-lg border p-6"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@company.com"
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Billing Tier
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as 'STARTER' | 'PRO')}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {success && <p className="text-sm" style={{ color: 'var(--success)' }}>{success}</p>}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {loading ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
}
