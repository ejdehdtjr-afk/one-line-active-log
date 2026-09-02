import { cookies } from 'next/headers';
import { db, ensureSchema, type User } from './database';

export const SESSION_COOKIE = 'fivefive_session';
const ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
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
  await ensureSchema();
  const raw = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await digest(raw);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db()
    .prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      expires.toISOString(),
      now.toISOString(),
    )
    .run();
  return { raw, expires };
}

export async function getCurrentUser(): Promise<User | null> {
  await ensureSchema();
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const row = await db()
    .prepare(`SELECT users.id, users.email, users.created_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .bind(await digest(raw), new Date().toISOString())
    .first<User>();
  return row ?? null;
}

export async function deleteCurrentSession() {
  await ensureSchema();
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw)
    await db()
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await digest(raw))
      .run();
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
