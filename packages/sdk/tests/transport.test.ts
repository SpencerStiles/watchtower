import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../src/transport';
import type { EventPayload } from '../src/types';

function makeEvent(overrides?: Partial<EventPayload>): EventPayload {
  return {
    eventId: 'evt_test',
    sessionId: 'sess_test',
    agentId: 'agent_1',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    inputTokens: 100,
    outputTokens: 200,
    latencyMs: 500,
    requestBody: {},
    responseBody: {},
    isError: false,
    errorMessage: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('Transport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends events to the endpoint', async () => {
    const transport = new Transport('wt_test', 'https://example.com/api/v1');
    await transport.send([makeEvent()]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/api/v1/events');
  });

  it('includes auth header', async () => {
    const transport = new Transport('wt_test', 'https://example.com/api/v1');
    await transport.send([makeEvent()]);
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer wt_test');
  });

  it('buffers events when send fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    const transport = new Transport('wt_test', 'https://example.com/api/v1');
    await transport.send([makeEvent()]);
    expect(transport.bufferedCount).toBe(1);
  });

  it('drops events when buffer is full', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const transport = new Transport('wt_test', 'https://example.com/api/v1', { maxBufferSize: 3 });
    for (let i = 0; i < 5; i++) {
      await transport.send([makeEvent()]);
    }
    expect(transport.bufferedCount).toBe(3);
  });

  it('retries buffered events on next successful send', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fail'));
    const transport = new Transport('wt_test', 'https://example.com/api/v1');
    await transport.send([makeEvent({ sessionId: 'first' })]);
    expect(transport.bufferedCount).toBe(1);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 202 });
    await transport.send([makeEvent({ sessionId: 'second' })]);
    expect(transport.bufferedCount).toBe(0);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.length).toBe(2);
  });

  it('calls onDrop when buffer is full and events are dropped', async () => {
    const onDrop = vi.fn();
    fetchMock.mockRejectedValue(new Error('Network error'));
    const transport = new Transport('wt_test', 'https://example.com/api/v1', {
      maxBufferSize: 2,
      onDrop,
    });
    // Fill the buffer to capacity
    await transport.send([makeEvent(), makeEvent()]);
    expect(transport.bufferedCount).toBe(2);
    // This send will try to add 1 more event but buffer is full — 1 drop
    await transport.send([makeEvent()]);
    expect(onDrop).toHaveBeenCalledWith(1);
  });

  it('console.warns when buffer is full and no onDrop provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('Network error'));
    const transport = new Transport('wt_test', 'https://example.com/api/v1', { maxBufferSize: 2 });
    // Fill to capacity
    await transport.send([makeEvent(), makeEvent()]);
    // Trigger a drop
    await transport.send([makeEvent()]);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[WatchTower]');
  });
});
