import { describe, it, expect } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  it('allows requests under limit', () => {
    expect(rateLimit('test-allow', 5, 60000)).toBe(true);
  });

  it('blocks requests over limit', () => {
    for (let i = 0; i < 3; i++) rateLimit('test-block', 3, 60000);
    expect(rateLimit('test-block', 3, 60000)).toBe(false);
  });
});
