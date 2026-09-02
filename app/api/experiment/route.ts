import { requireApiUser } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/database';

export async function GET() {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  await ensureSchema();
  const experiment = await db()
    .prepare('SELECT * FROM experiments WHERE user_id = ?')
    .bind(auth.user.id)
    .first();
  const records = await db()
    .prepare(
      'SELECT id, record_date, value, note, phase, created_at, updated_at FROM records WHERE user_id = ? ORDER BY record_date',
    )
    .bind(auth.user.id)
    .all();
  const legacyRecords = await db()
    .prepare(
      'SELECT legacy_id, record_date, value, unit, memo, tag, created_at, updated_at FROM legacy_records WHERE user_id = ? ORDER BY record_date',
    )
    .bind(auth.user.id)
    .all();
  return Response.json({
    user: auth.user,
    experiment,
    records: records.results,
    legacyRecords: legacyRecords.results,
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string
  >;
  const countRow = await db()
    .prepare('SELECT COUNT(*) AS count FROM records WHERE user_id = ?')
    .bind(auth.user.id)
    .first<{ count: number }>();
  const count = Number(countRow?.count ?? 0);
  const current = await db()
    .prepare('SELECT * FROM experiments WHERE user_id = ?')
    .bind(auth.user.id)
    .first<Record<string, string>>();
  if (!current)
    return Response.json(
      { error: '실험 설정을 찾을 수 없습니다.' },
      { status: 404 },
    );
  const fixed = [
    'question',
    'metric',
    'unit',
    'calculation',
    'missing_rule',
    'duplicate_rule',
    'outlier_rule',
    'rounding_rule',
    'week_start',
    'plan_before',
  ];
  if (
    count > 0 &&
    fixed.some((key) => body[key] !== undefined && body[key] !== current[key])
  )
    return Response.json(
      { error: '1일차 기록 뒤에는 질문·지표·계산 규칙을 바꿀 수 없습니다.' },
      { status: 409 },
    );
  if (body.plan_after && !current.changed_at) {
    if (count !== 2)
      return Response.json(
        {
          error:
            '계획 규칙은 2일차 기록 뒤, 3일차 기록 앞에서만 바꿀 수 있습니다.',
        },
        { status: 409 },
      );
    if (!body.changed_reason?.trim())
      return Response.json(
        { error: '규칙을 바꾼 이유를 적어 주세요.' },
        { status: 400 },
      );
    await db()
      .prepare(
        'UPDATE experiments SET plan_after = ?, changed_at = ?, changed_reason = ? WHERE user_id = ?',
      )
      .bind(
        body.plan_after.trim(),
        new Date().toISOString(),
        body.changed_reason.trim(),
        auth.user.id,
      )
      .run();
    return Response.json({ ok: true });
  }
  if (count === 0) {
    const values = fixed.map((key) => body[key]?.trim() || current[key]);
    await db()
      .prepare(
        `UPDATE experiments SET question=?, metric=?, unit=?, calculation=?, missing_rule=?, duplicate_rule=?, outlier_rule=?, rounding_rule=?, week_start=?, plan_before=? WHERE user_id=?`,
      )
      .bind(...values, auth.user.id)
      .run();
  }
  return Response.json({ ok: true });
}
