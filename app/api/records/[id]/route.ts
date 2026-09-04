import { requireApiUser } from '@/lib/auth';
import {
  databaseErrorResponse,
  deleteRows,
  firstRow,
  updateRows,
} from '@/lib/database';

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
  try {
    const rows = await updateRows(
      'records',
      { id: `eq.${id}`, user_id: `eq.${auth.user.id}` },
      {
        value,
        note: body.note?.trim() ?? '',
        updated_at: new Date().toISOString(),
      },
    );
    if (!rows.length)
      return Response.json(
        { error: '내 기록에서 찾을 수 없습니다.' },
        { status: 404 },
      );
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    const owned = await firstRow<{ id: string }>('records', {
      select: 'id',
      id: `eq.${id}`,
      user_id: `eq.${auth.user.id}`,
    });
    if (!owned)
      return Response.json(
        { error: '내 기록에서 찾을 수 없습니다.' },
        { status: 404 },
      );
    const latest = await firstRow<{ id: string }>('records', {
      select: 'id',
      user_id: `eq.${auth.user.id}`,
      order: 'record_date.desc',
    });
    if (!latest || latest.id !== id)
      return Response.json(
        { error: '순서를 지키기 위해 가장 최근 기록만 지울 수 있습니다.' },
        { status: 409 },
      );
    const rows = await deleteRows('records', {
      id: `eq.${id}`,
      user_id: `eq.${auth.user.id}`,
    });
    if (!rows.length)
      return Response.json(
        { error: '내 기록에서 찾을 수 없습니다.' },
        { status: 404 },
      );
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
