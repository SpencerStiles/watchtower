import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WatchTower } from '../src/watchtower';

describe('WatchTower', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 202 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates with required config', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1' });
    expect(wt).toBeDefined();
    wt.destroy();
  });

  it('auto-generates sessionId if not provided', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1' });
    expect(wt.sessionId).toBeDefined();
    expect(wt.sessionId.startsWith('sess_')).toBe(true);
    wt.destroy();
  });

  it('uses provided sessionId', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1', sessionId: 'sess_custom' });
    expect(wt.sessionId).toBe('sess_custom');
    wt.destroy();
  });

  it('wrap returns a proxied client', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1' });
    const mockClient = { messages: { create: vi.fn() } };
    const wrapped = wt.wrap(mockClient as any);
    expect(wrapped).toBeDefined();
    expect(wrapped.messages.create).toBeDefined();
    wt.destroy();
  });

  it('detects Anthropic client', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1' });
    const anthropicLike = { messages: { create: vi.fn() } };
    const wrapped = wt.wrap(anthropicLike as any);
    expect(wrapped.messages).toBeDefined();
    wt.destroy();
  });

  it('detects OpenAI client', () => {
    const wt = new WatchTower({ apiKey: 'wt_test', agentId: 'agent_1' });
    const openaiLike = { chat: { completions: { create: vi.fn() } } };
    const wrapped = wt.wrap(openaiLike as any);
    expect(wrapped.chat.completions).toBeDefined();
    wt.destroy();
  });

  it('throws if apiKey is empty string', () => {
    expect(() => new WatchTower({ apiKey: '', agentId: 'agent_1' })).toThrow(
      'WatchTower: apiKey is required'
    );
  });

  it('throws if agentId is empty string', () => {
    expect(() => new WatchTower({ apiKey: 'wt_test', agentId: '' })).toThrow(
      'WatchTower: agentId is required'
    );
  });

  it('throws if apiKey is missing', () => {
    expect(() => new WatchTower({ apiKey: undefined as any, agentId: 'agent_1' })).toThrow(
      'WatchTower: apiKey is required'
    );
  });
});
