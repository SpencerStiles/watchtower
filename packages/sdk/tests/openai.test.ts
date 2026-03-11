import { describe, it, expect, vi } from 'vitest';
import { wrapOpenAI } from '../src/wrappers/openai';
import type { EventPayload } from '../src/types';

describe('wrapOpenAI', () => {
  it('captures chat.completions.create calls', async () => {
    const captured: EventPayload[] = [];
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    };

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', (e) => captured.push(e));

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result).toBe(mockResponse);
    expect(captured.length).toBe(1);
    expect(captured[0].provider).toBe('openai');
    expect(captured[0].inputTokens).toBe(10);
    expect(captured[0].outputTokens).toBe(20);
  });

  it('captures errors', async () => {
    const captured: EventPayload[] = [];
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
        },
      },
    };

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', (e) => captured.push(e));

    await expect(
      wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Quota exceeded');

    expect(captured.length).toBe(1);
    expect(captured[0].isError).toBe(true);
  });
});
