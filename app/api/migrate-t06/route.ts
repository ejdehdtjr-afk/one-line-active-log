import { requireApiUser } from '@/lib/auth';
import { databaseErrorResponse, upsertRows } from '@/lib/database';

type LegacyRecord = {
  id?: unknown;
  date?: unknown;
  value?: unknown;
  unit?: unknown;
  memo?: unknown;
  tag?: unknown;
  source?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    records?: LegacyRecord[];
  };
  if (!Array.isArray(body.records) || body.records.length > 500)
    return Response.json(
      { error: 'T06 records 배열 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const item of body.records) {
    const legacyId = typeof item.id === 'string' ? item.id : '';
    const date = typeof item.date === 'string' ? item.date : '';
    const value = Number(item.value);
    if (
      !legacyId ||
      seen.has(legacyId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      item.source !== 'user'
    )
      return Response.json(
        { error: '실제 사용자가 입력한 올바른 T06 기록만 이전할 수 있습니다.' },
        { status: 400 },
      );
    seen.add(legacyId);
    const createdAt =
      typeof item.createdAt === 'string'
        ? item.createdAt
        : new Date().toISOString();
    rows.push({
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      legacy_id: legacyId,
      record_date: date,
      value,
      unit: typeof item.unit === 'string' ? item.unit : '분',
      memo: typeof item.memo === 'string' ? item.memo : '',
      tag: typeof item.tag === 'string' ? item.tag : '개인공부 관련 계획',
      created_at: createdAt,
      updated_at:
        typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
    });
  }
  try {
    const imported = rows.length
      ? await upsertRows('legacy_records', rows, 'user_id,legacy_id')
      : [];
    return Response.json({ ok: true, imported: imported.length });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
