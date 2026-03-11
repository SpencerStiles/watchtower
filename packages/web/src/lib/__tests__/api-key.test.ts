import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '../api-key';

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

describe('hashApiKey', () => {
  it('returns a consistent SHA-256 hex hash', () => {
    const key = 'wt_abc123';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different keys', () => {
    expect(hashApiKey('wt_key1')).not.toBe(hashApiKey('wt_key2'));
  });
});
