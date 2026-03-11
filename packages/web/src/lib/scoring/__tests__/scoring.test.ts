import { describe, it, expect } from 'vitest';
import { scoreEvent, calculateConversationScore, updateAgentScore, extractResponseText } from '../index';

describe('scoreEvent', () => {
  const baseCtx = { responseText: 'Hello!', isError: false, errorMessage: null, agentConfig: {} };

  it('scores clean response as 100', () => {
    expect(scoreEvent(baseCtx).score).toBe(100);
  });

  it('flags error responses', () => {
    const { flags } = scoreEvent({ ...baseCtx, isError: true, errorMessage: 'timeout' });
    expect(flags.some(f => f.category === 'TOOL_FAILURE')).toBe(true);
  });

  it('flags AI identity leaks', () => {
    const { flags } = scoreEvent({ ...baseCtx, responseText: 'As an AI language model, I cannot do that.' });
    expect(flags.some(f => f.category === 'HALLUCINATION')).toBe(true);
  });

  it('flags blocked keywords', () => {
    const { flags } = scoreEvent({ ...baseCtx, responseText: 'Buy our competitor product!', agentConfig: { blockedKeywords: ['competitor'] } });
    expect(flags.some(f => f.category === 'OFF_BRAND')).toBe(true);
  });

  it('flags excessive hedging', () => {
    const { flags } = scoreEvent({ ...baseCtx, responseText: 'I think perhaps I believe it seems possible' });
    expect(flags.some(f => f.category === 'HALLUCINATION' && f.layer === 2)).toBe(true);
  });

  it('deducts points per flag severity', () => {
    const { score } = scoreEvent({ ...baseCtx, isError: true, errorMessage: 'timeout' });
    expect(score).toBeLessThan(100);
  });
});

describe('calculateConversationScore', () => {
  it('averages event scores', () => {
    expect(calculateConversationScore([100, 80, 60])).toBe(80);
  });
  it('returns 100 for empty array', () => {
    expect(calculateConversationScore([])).toBe(100);
  });
});

describe('updateAgentScore', () => {
  it('returns new score when no prior score', () => {
    expect(updateAgentScore(null, 80)).toBe(80);
  });
  it('applies EWMA with alpha=0.3', () => {
    expect(updateAgentScore(100, 60)).toBe(88); // 0.3*60 + 0.7*100 = 88
  });
});

describe('extractResponseText', () => {
  it('extracts Anthropic text', () => {
    const body = { content: [{ type: 'text', text: 'Hello' }] };
    expect(extractResponseText(body, 'anthropic')).toBe('Hello');
  });
  it('extracts OpenAI text', () => {
    const body = { choices: [{ message: { content: 'Hello' } }] };
    expect(extractResponseText(body, 'openai')).toBe('Hello');
  });
});
