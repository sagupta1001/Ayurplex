import { describe, it, expect } from 'vitest';
import type { UserId } from './types';
import { makeUserId } from './types';

describe('UserId branded type', () => {
  it('constructs a UserId from a uuid string', () => {
    const id: UserId = makeUserId('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
    expect(typeof id).toBe('string');
    expect(id).toBe('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
  });
});
