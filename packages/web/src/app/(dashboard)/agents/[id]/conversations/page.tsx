'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface ConversationRow {
  id: string;
  sessionId: string;
  qualityScore: number | null;
  eventCount: number;
  totalCostCents: number;
  startedAt: string;
  lastEventAt: string;
  flagCounts: Record<string, number>;
}

interface Flag {
  id: string;
  category: string;
  severity: string;
  reason: string;
  resolution: string | null;
}

interface Event {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  isError: boolean;
  errorMessage: string | null;
  requestBody: unknown;
  responseBody: unknown;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  sessionId: string;
  qualityScore: number | null;
  eventCount: number;
  totalCostCents: number;
  startedAt: string;
  lastEventAt: string;
  events: Event[];
  flags: Flag[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FLAG_CATEGORIES = [
  'HALLUCINATION',
  'OFF_BRAND',
  'POLICY_VIOLATION',
  'TOOL_FAILURE',
  'SENTIMENT_NEGATIVE',
  'ANOMALY',
];

function scoreColor(score: number | null) {
  if (score === null) return 'var(--muted)';
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--danger)';
}

function JsonViewer({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium"
        style={{ color: 'var(--accent)' }}
      >
        {open ? '▾ Hide' : '▸ Show'} payload
      </button>
      {open && (
        <pre
          className="mt-2 rounded p-3 text-xs overflow-auto max-h-48 font-[family-name:var(--font-mono)]"
          style={{
            backgroundColor: 'var(--elevated)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const searchParams = useSearchParams();
  const highlight = searchParams.get('highlight');

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(highlight ?? null);
  const [detail, setDetail] = useState<Record<string, ConversationDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(filterCategory ? { flagCategory: filterCategory } : {}),
      });
      const res = await fetch(`/api/v1/agents/${agentId}/conversations?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setPagination(data.pagination ?? null);
    } finally {
      setLoading(false);
    }
  }, [agentId, page, filterCategory]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function fetchDetail(convId: string) {
    if (detail[convId]) return;
    setDetailLoading(convId);
    try {
      const res = await fetch(`/api/v1/conversations/${convId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDetail((prev) => ({ ...prev, [convId]: data.conversation }));
    } finally {
      setDetailLoading(null);
    }
  }

  function handleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      fetchDetail(id);
    }
  }

  async function resolveFlag(flagId: string, resolution: 'ACCEPTABLE' | 'NEEDS_FIX') {
    const res = await fetch(`/api/v1/flags/${flagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    if (res.ok) {
      const data = await res.json();
      // Update local detail state
      setDetail((prev) => {
        const updated = { ...prev };
        for (const convId of Object.keys(updated)) {
          updated[convId] = {
            ...updated[convId],
            flags: updated[convId].flags.map((f) =>
              f.id === flagId ? { ...f, resolution: data.flag.resolution } : f
            ),
          };
        }
        return updated;
      });
    }
  }

  const filteredConversations = search
    ? conversations.filter((c) => c.sessionId.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="text-xl font-bold font-[family-name:var(--font-syne)]"
          style={{ color: 'var(--text)' }}
        >
          Conversations
        </h1>
        {pagination && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {pagination.total.toLocaleString()} total
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search session ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60 rounded-md border px-3 py-1.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-md border px-3 py-1.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        >
          <option value="">All flag types</option>
          {FLAG_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {loading ? (
          <div className="p-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Loading…</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">No conversations found.</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div
              className="grid text-xs font-medium px-4 py-3"
              style={{
                backgroundColor: 'var(--elevated)',
                color: 'var(--muted)',
                gridTemplateColumns: '2fr 80px 70px 90px 100px 80px 80px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>Session ID</span>
              <span>Score</span>
              <span>Events</span>
              <span>Cost</span>
              <span>Started</span>
              <span>Flags</span>
              <span></span>
            </div>

            {filteredConversations.map((conv) => {
              const isExpanded = expanded === conv.id;
              const convDetail = detail[conv.id];
              const totalFlags = Object.values(conv.flagCounts).reduce((a, b) => a + b, 0);

              return (
                <div
                  key={conv.id}
                  className="border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Row */}
                  <div
                    className="grid items-center px-4 py-3 cursor-pointer hover:bg-[#1a1a20] transition-colors"
                    style={{
                      gridTemplateColumns: '2fr 80px 70px 90px 100px 80px 80px',
                    }}
                    onClick={() => handleExpand(conv.id)}
                  >
                    <span
                      className="text-sm font-[family-name:var(--font-mono)] truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {conv.sessionId}
                    </span>
                    <span
                      className="text-sm font-[family-name:var(--font-mono)] font-bold"
                      style={{ color: scoreColor(conv.qualityScore) }}
                    >
                      {conv.qualityScore ?? '—'}
                    </span>
                    <span
                      className="text-sm font-[family-name:var(--font-mono)]"
                      style={{ color: 'var(--text)' }}
                    >
                      {conv.eventCount}
                    </span>
                    <span
                      className="text-sm font-[family-name:var(--font-mono)]"
                      style={{ color: 'var(--text)' }}
                    >
                      ${(conv.totalCostCents / 100).toFixed(4)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(conv.startedAt).toLocaleDateString()}
                    </span>
                    <span
                      className="text-sm font-[family-name:var(--font-mono)]"
                      style={{ color: totalFlags > 0 ? 'var(--warning)' : 'var(--muted)' }}
                    >
                      {totalFlags > 0 ? totalFlags : '—'}
                    </span>
                    <span className="text-xs text-right" style={{ color: 'var(--accent)' }}>
                      {isExpanded ? '▲ Hide' : '▼ Show'}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="px-4 pb-4 space-y-4 border-t"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--elevated)',
                      }}
                    >
                      {detailLoading === conv.id ? (
                        <p className="py-4 text-sm text-center" style={{ color: 'var(--muted)' }}>
                          Loading detail…
                        </p>
                      ) : convDetail ? (
                        <>
                          {/* Flags */}
                          {convDetail.flags.length > 0 && (
                            <div className="pt-4 space-y-2">
                              <p
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--muted)' }}
                              >
                                Quality Flags
                              </p>
                              {convDetail.flags.map((flag) => (
                                <div
                                  key={flag.id}
                                  className="rounded-md border p-3 flex items-start justify-between gap-4"
                                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                                >
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-xs font-medium"
                                        style={{
                                          color:
                                            flag.severity === 'CRITICAL' || flag.severity === 'HIGH'
                                              ? 'var(--danger)'
                                              : 'var(--warning)',
                                        }}
                                      >
                                        {flag.severity}
                                      </span>
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                                        {flag.category.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                                      {flag.reason}
                                    </p>
                                    {flag.resolution && (
                                      <span
                                        className="inline-block text-xs rounded px-1.5 py-0.5"
                                        style={{
                                          backgroundColor:
                                            flag.resolution === 'ACCEPTABLE'
                                              ? 'rgba(34,197,94,0.12)'
                                              : 'rgba(239,68,68,0.12)',
                                          color:
                                            flag.resolution === 'ACCEPTABLE'
                                              ? 'var(--success)'
                                              : 'var(--danger)',
                                        }}
                                      >
                                        {flag.resolution.replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </div>
                                  {!flag.resolution && (
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        onClick={() => resolveFlag(flag.id, 'ACCEPTABLE')}
                                        className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                                        style={{
                                          backgroundColor: 'rgba(34,197,94,0.12)',
                                          color: 'var(--success)',
                                          border: '1px solid var(--success)',
                                        }}
                                      >
                                        Acceptable
                                      </button>
                                      <button
                                        onClick={() => resolveFlag(flag.id, 'NEEDS_FIX')}
                                        className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                                        style={{
                                          backgroundColor: 'rgba(239,68,68,0.12)',
                                          color: 'var(--danger)',
                                          border: '1px solid var(--danger)',
                                        }}
                                      >
                                        Needs Fix
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Events */}
                          <div className="space-y-2">
                            <p
                              className="text-xs font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--muted)' }}
                            >
                              Events ({convDetail.events.length})
                            </p>
                            {convDetail.events.map((ev) => (
                              <div
                                key={ev.id}
                                className="rounded-md border p-3 space-y-2"
                                style={{
                                  borderColor: ev.isError ? 'var(--danger)' : 'var(--border)',
                                  backgroundColor: 'var(--surface)',
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span style={{ color: 'var(--text)' }}>
                                      {ev.provider} / {ev.model}
                                    </span>
                                    {ev.isError && (
                                      <span style={{ color: 'var(--danger)' }}>ERROR</span>
                                    )}
                                  </div>
                                  <div
                                    className="flex gap-3 text-xs font-[family-name:var(--font-mono)]"
                                    style={{ color: 'var(--muted)' }}
                                  >
                                    <span>{ev.latencyMs}ms</span>
                                    <span>${(ev.costCents / 100).toFixed(6)}</span>
                                    <span>{ev.inputTokens + ev.outputTokens} tok</span>
                                  </div>
                                </div>
                                {ev.isError && ev.errorMessage && (
                                  <p className="text-xs" style={{ color: 'var(--danger)' }}>
                                    {ev.errorMessage}
                                  </p>
                                )}
                                <JsonViewer data={{ request: ev.requestBody, response: ev.responseBody }} />
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 transition-colors hover:bg-[#1e1e24]"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Previous
            </button>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 transition-colors hover:bg-[#1e1e24]"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
