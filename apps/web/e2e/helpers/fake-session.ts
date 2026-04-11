import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ??
  'super-secret-jwt-token-with-at-least-32-characters-long';

export interface FakeSession {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: {
    id: string;
    aud: 'authenticated';
    role: 'authenticated';
    email: string;
    user_metadata: { full_name: string };
    app_metadata: { provider: 'google' };
  };
}

export function buildFakeSession(
  userId: string,
  email: string,
  fullName: string,
): FakeSession {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const accessToken = jwt.sign(
    {
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase-demo',
      exp,
    },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'fake-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      user_metadata: { full_name: fullName },
      app_metadata: { provider: 'google' },
    },
  };
}

export const SUPABASE_STORAGE_KEY = 'sb-127-auth-token';
