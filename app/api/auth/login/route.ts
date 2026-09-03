import { createSession, sessionCookie, verifyPassword } from '@/lib/auth';
import { databaseErrorResponse, firstRow } from '@/lib/database';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  try {
    const row = email
      ? await firstRow<{ id: string; password_hash: string }>('users', {
          select: 'id,password_hash',
          email: `eq.${email}`,
        })
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
      {
        headers: { 'Set-Cookie': sessionCookie(session.raw, session.expires) },
      },
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
