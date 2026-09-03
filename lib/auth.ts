import { cookies } from 'next/headers';
import { deleteRows, firstRow, insertRows, type User } from './database';

export const SESSION_COOKIE = 'fivefive_session';
const ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function randomSessionToken() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(bytes));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsText, saltText, expected] = stored.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !saltText || !expected) return false;
  const iterations = Number(iterationsText);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltText),
      iterations,
    },
    key,
    256,
  );
  const actual = bytesToBase64(new Uint8Array(bits));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1)
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function createSession(userId: string) {
  const raw = randomSessionToken();
  const tokenHash = await digest(raw);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await insertRows('sessions', {
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  });
  return { raw, expires };
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const session = await firstRow<{ user_id: string }>('sessions', {
      select: 'user_id',
      token_hash: `eq.${await digest(raw)}`,
      expires_at: `gt.${new Date().toISOString()}`,
    });
    if (!session) return null;
    return await firstRow<User>('users', {
      select: 'id,email,created_at',
      id: `eq.${session.user_id}`,
    });
  } catch {
    return null;
  }
}

export async function deleteCurrentSession() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw)
    await deleteRows('sessions', { token_hash: `eq.${await digest(raw)}` });
}

export function sessionCookie(raw: string, expires: Date) {
  return `${SESSION_COOKIE}=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user)
    return {
      response: Response.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    } as const;
  return { user } as const;
}
