import { requireApiUser } from '@/lib/auth';
import { db } from '@/lib/database';

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
  const rows = await db()
    .prepare(
      'SELECT record_date FROM records WHERE user_id = ? ORDER BY record_date',
    )
    .bind(auth.user.id)
    .all<{ record_date: string }>();
  if (rows.results.length >= 5)
    return Response.json(
      { error: '기록은 정확히 5일까지만 남길 수 있습니다.' },
      { status: 409 },
    );
  const last = rows.results.at(-1)?.record_date;
  if (last && body.date <= last)
    return Response.json(
      {
        error:
          '앞선 기록보다 뒤 날짜를 입력해 주세요. 같은 날짜는 중복할 수 없습니다.',
      },
      { status: 409 },
    );
  const exp = await db()
    .prepare('SELECT changed_at FROM experiments WHERE user_id = ?')
    .bind(auth.user.id)
    .first<{ changed_at: string | null }>();
  if (rows.results.length >= 2 && !exp?.changed_at)
    return Response.json(
      { error: '3일차를 기록하기 전에 계획 규칙을 한 번 바꿔 주세요.' },
      { status: 409 },
    );
  const now = new Date().toISOString();
  await db()
    .prepare(
      'INSERT INTO records (id, user_id, record_date, value, note, phase, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      auth.user.id,
      body.date,
      value,
      body.note?.trim() ?? '',
      rows.results.length < 2 ? '변경 전' : '변경 후',
      now,
      now,
    )
    .run();
  return Response.json({ ok: true }, { status: 201 });
}
