import { requireApiUser } from '@/lib/auth';
import { databaseErrorResponse, insertRows, selectRows } from '@/lib/database';
import { DIARY_UNIT, validateDiaryInput } from '@/lib/diary';

export async function GET() {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  try {
    const records = await selectRows('legacy_records', {
      select: 'legacy_id,record_date,value,unit,memo,tag,created_at,updated_at',
      user_id: `eq.${auth.user.id}`,
      order: 'record_date.desc',
    });
    return Response.json({ records });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const input = validateDiaryInput(await request.json().catch(() => ({})));
  if ('error' in input)
    return Response.json({ error: input.error }, { status: 400 });
  try {
    const now = new Date().toISOString();
    const legacyId = crypto.randomUUID();
    await insertRows('legacy_records', {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      legacy_id: legacyId,
      record_date: input.value.date,
      value: input.value.value,
      unit: DIARY_UNIT,
      memo: input.value.memo,
      tag: input.value.tag,
      created_at: now,
      updated_at: now,
    });
    return Response.json({ ok: true, id: legacyId }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
