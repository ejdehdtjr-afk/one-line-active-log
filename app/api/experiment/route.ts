import { requireApiUser } from '@/lib/auth';
import {
  databaseErrorResponse,
  firstRow,
  selectRows,
  updateRows,
} from '@/lib/database';

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
        select: 'id,record_date,value,note,phase,created_at,updated_at',
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
    return Response.json({
      user: auth.user,
      experiment,
      records,
      legacyRecords,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string
  >;
  try {
    const [records, current] = await Promise.all([
      selectRows<{ id: string }>('records', {
        select: 'id',
        user_id: `eq.${auth.user.id}`,
      }),
      firstRow<Record<string, string>>('experiments', {
        select: '*',
        user_id: `eq.${auth.user.id}`,
      }),
    ]);
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
      records.length > 0 &&
      fixed.some((key) => body[key] !== undefined && body[key] !== current[key])
    )
      return Response.json(
        { error: '1일차 기록 뒤에는 질문·지표·계산 규칙을 바꿀 수 없습니다.' },
        { status: 409 },
      );
    if (body.plan_after && !current.changed_at) {
      if (records.length !== 2)
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
      await updateRows(
        'experiments',
        { user_id: `eq.${auth.user.id}` },
        {
          plan_after: body.plan_after.trim(),
          changed_at: new Date().toISOString(),
          changed_reason: body.changed_reason.trim(),
        },
      );
      return Response.json({ ok: true });
    }
    if (records.length === 0) {
      const values = Object.fromEntries(
        fixed.map((key) => [key, body[key]?.trim() || current[key]]),
      );
      await updateRows(
        'experiments',
        { user_id: `eq.${auth.user.id}` },
        values,
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
