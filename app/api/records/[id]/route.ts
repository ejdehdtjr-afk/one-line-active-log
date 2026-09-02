import { requireApiUser } from '@/lib/auth';
import { db } from '@/lib/database';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    value?: number;
    note?: string;
  };
  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0)
    return Response.json(
      { error: '0 이상의 숫자를 입력해 주세요.' },
      { status: 400 },
    );
  const result = await db()
    .prepare(
      'UPDATE records SET value=?, note=?, updated_at=? WHERE id=? AND user_id=?',
    )
    .bind(
      value,
      body.note?.trim() ?? '',
      new Date().toISOString(),
      id,
      auth.user.id,
    )
    .run();
  if (!result.meta.changes)
    return Response.json(
      { error: '내 기록에서 찾을 수 없습니다.' },
      { status: 404 },
    );
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const latest = await db()
    .prepare(
      'SELECT id FROM records WHERE user_id=? ORDER BY record_date DESC LIMIT 1',
    )
    .bind(auth.user.id)
    .first<{ id: string }>();
  if (!latest || latest.id !== id)
    return Response.json(
      { error: '순서를 지키기 위해 가장 최근 기록만 지울 수 있습니다.' },
      { status: 409 },
    );
  const result = await db()
    .prepare('DELETE FROM records WHERE id=? AND user_id=?')
    .bind(id, auth.user.id)
    .run();
  if (!result.meta.changes)
    return Response.json(
      { error: '내 기록에서 찾을 수 없습니다.' },
      { status: 404 },
    );
  return Response.json({ ok: true });
}
