import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Batcher } from '../src/batcher';
import type { EventPayload } from '../src/types';

function makeEvent(): EventPayload {
  return {
    sessionId: 'sess_test',
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
  };
}

describe('Batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flushes when batch size is reached', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const batcher = new Batcher({ batchSize: 3, flushIntervalMs: 60000, onFlush });
    batcher.add(makeEvent());
    batcher.add(makeEvent());
    expect(onFlush).not.toHaveBeenCalled();
    batcher.add(makeEvent());
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush.mock.calls[0][0].length).toBe(3);
    batcher.destroy();
  });

  it('flushes on interval', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const batcher = new Batcher({ batchSize: 100, flushIntervalMs: 5000, onFlush });
    batcher.add(makeEvent());
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush.mock.calls[0][0].length).toBe(1);
    batcher.destroy();
  });

  it('does not flush empty batch on interval', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const batcher = new Batcher({ batchSize: 100, flushIntervalMs: 5000, onFlush });
    vi.advanceTimersByTime(5000);
    expect(onFlush).not.toHaveBeenCalled();
    batcher.destroy();
  });

  it('flush() sends remaining events', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const batcher = new Batcher({ batchSize: 100, flushIntervalMs: 60000, onFlush });
    batcher.add(makeEvent());
    batcher.add(makeEvent());
    await batcher.flush();
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush.mock.calls[0][0].length).toBe(2);
    batcher.destroy();
  });
});
