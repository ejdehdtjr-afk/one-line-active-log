import { requireApiUser } from '@/lib/auth';
import { databaseErrorResponse, firstRow, selectRows } from '@/lib/database';

export async function GET() {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  try {
    const [experiment, records, legacyRecords] = await Promise.all([
      firstRow<Record<string, unknown>>('experiments', {
        select: '*',
        user_id: `eq.${auth.user.id}`,
      }),
      selectRows('records', {
        select: 'record_date,value,note,phase,created_at,updated_at',
        user_id: `eq.${auth.user.id}`,
        order: 'record_date.asc',
      }),
      selectRows('legacy_records', {
        select:
          'legacy_id,record_date,value,unit,memo,tag,created_at,updated_at',
        user_id: `eq.${auth.user.id}`,
        order: 'record_date.asc',
      }),
    ]);
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
      records,
      t06_records: legacyRecords,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="five-five-export.json"',
      },
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
