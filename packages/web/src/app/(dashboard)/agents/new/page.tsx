'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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

      setApiKey(data.apiKey);
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="w-full max-w-lg rounded-lg border border-border bg-surface p-8 space-y-6"
        >
          <div>
            <h1 className="text-xl font-bold font-display text-text">
              Agent Created!
            </h1>
            <p className="mt-1 text-sm text-muted">
              Copy your API key now — it will not be shown again.
            </p>
          </div>

          <div className="rounded-md border border-border bg-elevated p-4 space-y-3">
            <p className="text-xs font-medium text-muted">
              API KEY
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono break-all text-text">
                {apiKey}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]"
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
            className="w-full rounded-md px-4 py-2.5 text-sm font-medium bg-accent text-white transition-all active:scale-[0.97]"
          >
            Go to Agent Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-8 space-y-6"
      >
        <div>
          <h1 className="text-xl font-bold font-display text-text">
            New Agent
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create a new AI agent to monitor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-1.5 text-text"
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
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/agents')}
              className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text transition-all active:scale-[0.97] hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium bg-accent text-white transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
