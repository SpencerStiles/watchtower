import { describe, it, expect, vi } from 'vitest';
import { wrapAnthropic } from '../src/wrappers/anthropic';
import type { EventPayload } from '../src/types';

describe('wrapAnthropic', () => {
  it('captures messages.create calls and emits events', async () => {
    const captured: EventPayload[] = [];
    const mockResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(mockResponse),
      },
    };

    const wrapped = wrapAnthropic(mockClient as any, 'sess_test', (e) => captured.push(e));

    const result = await wrapped.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result).toBe(mockResponse);
    expect(captured.length).toBe(1);
    expect(captured[0].provider).toBe('anthropic');
    expect(captured[0].model).toBe('claude-sonnet-4-6');
    expect(captured[0].inputTokens).toBe(10);
    expect(captured[0].outputTokens).toBe(20);
    expect(captured[0].isError).toBe(false);
  });

  it('captures errors', async () => {
    const captured: EventPayload[] = [];
    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('Rate limited')),
      },
    };

    const wrapped = wrapAnthropic(mockClient as any, 'sess_test', (e) => captured.push(e));

    await expect(
      wrapped.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Rate limited');

    expect(captured.length).toBe(1);
    expect(captured[0].isError).toBe(true);
    expect(captured[0].errorMessage).toBe('Rate limited');
  });
});
