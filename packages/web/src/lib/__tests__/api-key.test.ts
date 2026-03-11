import { describe, it, expect } from 'vitest';
import { generateApiKey } from '../api-key';

describe('generateApiKey', () => {
  it('generates keys with wt_ prefix', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^wt_[a-f0-9]{48}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    expect(keys.size).toBe(10);
  });
});
