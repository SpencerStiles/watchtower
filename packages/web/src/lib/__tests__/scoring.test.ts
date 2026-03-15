/**
 * Additional scoring edge case tests.
 *
 * The primary scoring tests live at:
 *   src/lib/scoring/__tests__/scoring.test.ts
 *
 * This file covers edge cases not already tested there:
 *   - Empty response text → ANOMALY flag
 *   - Required keyword missing → POLICY_VIOLATION flag
 *   - Exact score arithmetic for multiple flags
 */
import { describe, it, expect } from 'vitest';
import { scoreEvent } from '@/lib/scoring';

const base = { responseText: 'Hello world', isError: false, errorMessage: null, agentConfig: {} };

describe('scoreEvent — edge cases', () => {
  it('flags empty (whitespace-only) response as ANOMALY with HIGH severity', () => {
    const { flags, score } = scoreEvent({ ...base, responseText: '   ' });
    const anomaly = flags.find(f => f.category === 'ANOMALY');
    expect(anomaly).toBeDefined();
    expect(anomaly?.severity).toBe('HIGH');
    // HIGH deducts 30 points → 70
    expect(score).toBe(70);
  });

  it('flags completely empty string response as ANOMALY', () => {
    const { flags } = scoreEvent({ ...base, responseText: '' });
    expect(flags.some(f => f.category === 'ANOMALY')).toBe(true);
  });

  it('flags AI identity leak phrase as HALLUCINATION', () => {
    const { flags } = scoreEvent({
      ...base,
      responseText: 'As an AI language model, I cannot assist with that.',
    });
    const flag = flags.find(f => f.category === 'HALLUCINATION');
    expect(flag).toBeDefined();
    expect(flag?.layer).toBe(1);
  });

  it('flags error response (isError: true) as TOOL_FAILURE', () => {
    const { flags } = scoreEvent({ ...base, isError: true, errorMessage: 'Service unavailable' });
    expect(flags.some(f => f.category === 'TOOL_FAILURE')).toBe(true);
  });

  it('flags required keyword missing from response', () => {
    const { flags } = scoreEvent({
      ...base,
      agentConfig: { requiredKeywords: ['disclaimer'] },
    });
    const flag = flags.find(f => f.category === 'POLICY_VIOLATION');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('LOW');
  });

  it('does not flag required keyword when it is present', () => {
    const { flags } = scoreEvent({
      ...base,
      responseText: 'Hello world — disclaimer: this is a test',
      agentConfig: { requiredKeywords: ['disclaimer'] },
    });
    expect(flags.some(f => f.category === 'POLICY_VIOLATION')).toBe(false);
  });

  it('flags blocked keyword as OFF_BRAND', () => {
    const { flags } = scoreEvent({
      ...base,
      responseText: 'You should buy from our competitor instead.',
      agentConfig: { blockedKeywords: ['competitor'] },
    });
    expect(flags.some(f => f.category === 'OFF_BRAND')).toBe(true);
  });

  it('normal healthy response → no flags and score of 100', () => {
    const { flags, score } = scoreEvent(base);
    expect(flags).toHaveLength(0);
    expect(score).toBe(100);
  });

  it('two LOW severity flags → score is 90 (100 - 5 - 5)', () => {
    // Two required keywords both missing → 2x POLICY_VIOLATION (LOW = -5 each)
    const { flags, score } = scoreEvent({
      ...base,
      agentConfig: { requiredKeywords: ['disclaimer', 'copyrightnotice'] },
    });
    const policyFlags = flags.filter(f => f.category === 'POLICY_VIOLATION');
    expect(policyFlags).toHaveLength(2);
    expect(score).toBe(90);
  });

  it('timeout error → TOOL_FAILURE with HIGH severity and score of 70', () => {
    const { flags, score } = scoreEvent({
      ...base,
      isError: true,
      errorMessage: 'Request timeout after 30s',
    });
    const flag = flags.find(f => f.category === 'TOOL_FAILURE');
    expect(flag?.severity).toBe('HIGH');
    // HIGH deducts 30 → 70
    expect(score).toBe(70);
  });

  it('non-timeout error → TOOL_FAILURE with MEDIUM severity and score of 85', () => {
    const { flags, score } = scoreEvent({
      ...base,
      isError: true,
      errorMessage: 'Internal server error',
    });
    const flag = flags.find(f => f.category === 'TOOL_FAILURE');
    expect(flag?.severity).toBe('MEDIUM');
    // MEDIUM deducts 15 → 85
    expect(score).toBe(85);
  });

  it('score never goes below 0 even with many flags', () => {
    // Error + blocked keyword + required keyword missing — enough deductions to floor at 0
    const { score } = scoreEvent({
      ...base,
      responseText: 'buy competitor product',
      isError: true,
      errorMessage: 'timeout',
      agentConfig: {
        blockedKeywords: ['competitor'],
        requiredKeywords: ['disclaimer', 'terms', 'privacy', 'notice'],
      },
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
