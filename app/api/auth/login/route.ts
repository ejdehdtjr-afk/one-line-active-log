import { createSession, sessionCookie, verifyPassword } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/database';

export async function POST(request: Request) {
  await ensureSchema();
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const row = email
    ? await db()
        .prepare('SELECT id, password_hash FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: string; password_hash: string }>()
    : null;
  const valid =
    row && body.password
      ? await verifyPassword(body.password, row.password_hash)
      : false;
  if (!row || !valid)
    return Response.json(
      { error: '이메일 또는 비밀번호가 맞지 않습니다.' },
      { status: 401 },
    );
  const session = await createSession(row.id);
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': sessionCookie(session.raw, session.expires) } },
  );
}
