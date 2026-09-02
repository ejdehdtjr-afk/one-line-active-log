import { clearSessionCookie, requireApiUser } from '@/lib/auth';
import { db } from '@/lib/database';

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: string;
  };
  if (body.confirmation !== '계정 삭제')
    return Response.json(
      { error: '확인란에 “계정 삭제”를 정확히 입력해 주세요.' },
      { status: 400 },
    );
  await db().batch([
    db()
      .prepare('DELETE FROM legacy_records WHERE user_id=?')
      .bind(auth.user.id),
    db().prepare('DELETE FROM records WHERE user_id=?').bind(auth.user.id),
    db().prepare('DELETE FROM experiments WHERE user_id=?').bind(auth.user.id),
    db().prepare('DELETE FROM sessions WHERE user_id=?').bind(auth.user.id),
    db().prepare('DELETE FROM users WHERE id=?').bind(auth.user.id),
  ]);
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  );
}
