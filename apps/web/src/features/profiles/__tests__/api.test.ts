import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProfile, updateProfile } from '../api';

const fakeProfile = {
  id: 'p1',
  user_id: 'u1',
  display_name: 'Test',
  timezone: 'UTC',
  home_lat: null,
  home_lng: null,
  home_radius_m: null,
  notification_prefs: {},
  created_at: '',
  updated_at: '',
};

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const updateEq = vi.fn();
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));
  return { maybeSingle, eq, select, updateEq, update, from };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => (mocks.from as (...a: unknown[]) => unknown)(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
  },
}));

describe('profiles api', () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.select.mockClear();
    mocks.eq.mockClear();
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle.mockResolvedValue({ data: fakeProfile, error: null });
    mocks.update.mockClear();
    mocks.updateEq.mockReset();
    mocks.updateEq.mockResolvedValue({ data: [fakeProfile], error: null });
  });

  it('getProfile returns the current user row', async () => {
    const result = await getProfile();
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.select).toHaveBeenCalledWith('*');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(result?.display_name).toBe('Test');
  });

  it('updateProfile writes a partial update scoped to user_id', async () => {
    await updateProfile({ home_lat: 43.65, home_lng: -79.38, home_radius_m: 50 });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.update).toHaveBeenCalledWith({
      home_lat: 43.65,
      home_lng: -79.38,
      home_radius_m: 50,
    });
    expect(mocks.updateEq).toHaveBeenCalledWith('user_id', 'u1');
  });
});
