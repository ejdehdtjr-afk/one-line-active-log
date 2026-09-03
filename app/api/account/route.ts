import { clearSessionCookie, requireApiUser } from '@/lib/auth';
import { databaseErrorResponse, deleteRows } from '@/lib/database';

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
  try {
    const rows = await deleteRows('users', { id: `eq.${auth.user.id}` });
    if (!rows.length)
      return Response.json(
        { error: '계정을 찾을 수 없습니다.' },
        { status: 404 },
      );
    return Response.json(
      { ok: true },
      { headers: { 'Set-Cookie': clearSessionCookie() } },
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
