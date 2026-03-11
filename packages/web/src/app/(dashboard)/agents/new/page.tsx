'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to create agent');
        return;
      }

      setApiKey(data.agent.apiKey);
      setAgentId(data.agent.id);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (apiKey && agentId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          className="w-full max-w-lg rounded-lg border p-8 space-y-6"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div>
            <h1
              className="text-xl font-bold font-[family-name:var(--font-syne)]"
              style={{ color: 'var(--text)' }}
            >
              Agent Created!
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Copy your API key now — it will not be shown again.
            </p>
          </div>

          <div
            className="rounded-md border p-4 space-y-3"
            style={{ backgroundColor: 'var(--elevated)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              API KEY
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-sm font-[family-name:var(--font-mono)] break-all"
                style={{ color: 'var(--text)' }}
              >
                {apiKey}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: copied ? 'var(--success)' : 'var(--accent)',
                  color: '#fff',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div
            className="rounded-md border p-3 text-sm"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.08)',
              borderColor: 'var(--warning)',
              color: 'var(--warning)',
            }}
          >
            Store this key securely. You will not be able to view it again.
          </div>

          <button
            onClick={() => router.push(`/agents/${agentId}`)}
            className="w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Go to Agent Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-lg border p-8 space-y-6"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <h1
            className="text-xl font-bold font-[family-name:var(--font-syne)]"
            style={{ color: 'var(--text)' }}
          >
            New Agent
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Create a new AI agent to monitor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Agent Name
            </label>
            <input
              ref={inputRef}
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support Bot"
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                // @ts-expect-error custom property
                '--tw-ring-color': 'var(--accent)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/agents')}
              className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#1e1e24]"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
