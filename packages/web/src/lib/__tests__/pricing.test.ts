import { describe, it, expect } from 'vitest';
import { calculateCostCents } from '../pricing';

describe('calculateCostCents', () => {
  it('calculates cost for known model', () => {
    const cost = calculateCostCents('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBe(1800);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCostCents('unknown-model', 1000, 1000)).toBe(0);
  });
});
