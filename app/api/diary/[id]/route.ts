import { requireApiUser } from '@/lib/auth';
import { databaseErrorResponse, deleteRows, updateRows } from '@/lib/database';
import { DIARY_UNIT, validateDiaryInput } from '@/lib/diary';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const input = validateDiaryInput(await request.json().catch(() => ({})));
  if ('error' in input)
    return Response.json({ error: input.error }, { status: 400 });
  try {
    const rows = await updateRows(
      'legacy_records',
      { legacy_id: `eq.${id}`, user_id: `eq.${auth.user.id}` },
      {
        record_date: input.value.date,
        value: input.value.value,
        unit: DIARY_UNIT,
        memo: input.value.memo,
        tag: input.value.tag,
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
    const rows = await deleteRows('legacy_records', {
      legacy_id: `eq.${id}`,
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
