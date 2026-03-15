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

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', 'agent_1', (e) => captured.push(e));

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

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', 'agent_1', (e) => captured.push(e));

    await expect(
      wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Quota exceeded');

    expect(captured.length).toBe(1);
    expect(captured[0].isError).toBe(true);
  });

  it('throws when stream: true is passed', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', 'agent_1', vi.fn());

    await expect(
      wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      })
    ).rejects.toThrow('WatchTower does not yet support streaming');
  });

  it('emitted event includes eventId (UUID format)', async () => {
    const captured: EventPayload[] = [];
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
    };

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    };

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', 'agent_1', (e) => captured.push(e));
    await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(captured[0].eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('emitted event includes agentId', async () => {
    const captured: EventPayload[] = [];
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
    };

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    };

    const wrapped = wrapOpenAI(mockClient as any, 'sess_test', 'my_agent', (e) => captured.push(e));
    await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(captured[0].agentId).toBe('my_agent');
  });
});
