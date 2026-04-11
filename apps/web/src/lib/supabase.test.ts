import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('supabase client singleton', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('exports a non-null supabase client built from env vars', async () => {
    const { supabase } = await import('./supabase');
    expect(supabase).not.toBeNull();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });

  it('throws if VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it('throws if VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/);
  });
});
