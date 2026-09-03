import { requireApiUser } from '@/lib/auth';
import {
  databaseErrorResponse,
  firstRow,
  insertRows,
  selectRows,
} from '@/lib/database';

function seoulToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    value?: number;
    note?: string;
  };
  if (
    !body.date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
    body.date > seoulToday()
  )
    return Response.json(
      { error: 'Asia/Seoul 기준 오늘 또는 지난 실제 날짜를 입력해 주세요.' },
      { status: 400 },
    );
  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0)
    return Response.json(
      { error: '0 이상의 숫자를 입력해 주세요.' },
      { status: 400 },
    );
  try {
    const rows = await selectRows<{ record_date: string }>('records', {
      select: 'record_date',
      user_id: `eq.${auth.user.id}`,
      order: 'record_date.asc',
    });
    if (rows.length >= 5)
      return Response.json(
        { error: '기록은 정확히 5일까지만 남길 수 있습니다.' },
        { status: 409 },
      );
    const last = rows.at(-1)?.record_date;
    if (last && body.date <= last)
      return Response.json(
        {
          error:
            '앞선 기록보다 뒤 날짜를 입력해 주세요. 같은 날짜는 중복할 수 없습니다.',
        },
        { status: 409 },
      );
    const experiment = await firstRow<{ changed_at: string | null }>(
      'experiments',
      { select: 'changed_at', user_id: `eq.${auth.user.id}` },
    );
    if (rows.length >= 2 && !experiment?.changed_at)
      return Response.json(
        { error: '3일차를 기록하기 전에 계획 규칙을 한 번 바꿔 주세요.' },
        { status: 409 },
      );
    const now = new Date().toISOString();
    await insertRows('records', {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      record_date: body.date,
      value,
      note: body.note?.trim() ?? '',
      phase: rows.length < 2 ? '변경 전' : '변경 후',
      created_at: now,
      updated_at: now,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
