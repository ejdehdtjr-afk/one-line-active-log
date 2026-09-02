import { requireApiUser } from '@/lib/auth';
import { db } from '@/lib/database';

export async function GET() {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const experiment = await db()
    .prepare('SELECT * FROM experiments WHERE user_id=?')
    .bind(auth.user.id)
    .first<Record<string, unknown>>();
  const records = await db()
    .prepare(
      'SELECT record_date, value, note, phase, created_at, updated_at FROM records WHERE user_id=? ORDER BY record_date',
    )
    .bind(auth.user.id)
    .all();
  const legacyRecords = await db()
    .prepare(
      'SELECT legacy_id, record_date, value, unit, memo, tag, created_at, updated_at FROM legacy_records WHERE user_id=? ORDER BY record_date',
    )
    .bind(auth.user.id)
    .all();
  const safeExperiment = experiment
    ? Object.fromEntries(
        Object.entries(experiment).filter(
          ([key]) => !['id', 'user_id'].includes(key),
        ),
      )
    : null;
  const payload = {
    exported_at: new Date().toISOString(),
    timezone: 'Asia/Seoul',
    account: { email: auth.user.email, created_at: auth.user.created_at },
    experiment: safeExperiment,
    records: records.results,
    t06_records: legacyRecords.results,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="five-five-export.json"',
    },
  });
}
