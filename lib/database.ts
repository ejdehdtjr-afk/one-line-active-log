export type User = { id: string; email: string; created_at: string };

export class SupabaseHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function config() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    throw new SupabaseHttpError(
      503,
      'Supabase 연결 설정이 아직 완료되지 않았습니다.',
    );
  }
  return { baseUrl, serviceRoleKey };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string>;
  body?: unknown;
  prefer?: string;
};

async function request<T>(
  table: string,
  options: RequestOptions = {},
): Promise<T> {
  const { baseUrl, serviceRoleKey } = config();
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(options.query ?? {}))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      details?: string;
    };
    throw new SupabaseHttpError(
      response.status,
      payload.message ?? payload.details ?? 'Supabase 요청에 실패했습니다.',
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function selectRows<T>(table: string, query: Record<string, string>) {
  return request<T[]>(table, { query });
}

export async function firstRow<T>(
  table: string,
  query: Record<string, string>,
) {
  const rows = await selectRows<T>(table, { ...query, limit: '1' });
  return rows[0] ?? null;
}

export function insertRows<T>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
) {
  return request<T[]>(table, {
    method: 'POST',
    body: rows,
    prefer: 'return=representation',
  });
}

export function updateRows<T>(
  table: string,
  query: Record<string, string>,
  values: Record<string, unknown>,
) {
  return request<T[]>(table, {
    method: 'PATCH',
    query,
    body: values,
    prefer: 'return=representation',
  });
}

export function deleteRows<T>(table: string, query: Record<string, string>) {
  return request<T[]>(table, {
    method: 'DELETE',
    query,
    prefer: 'return=representation',
  });
}

export function upsertRows<T>(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumns: string,
) {
  return request<T[]>(table, {
    method: 'POST',
    query: { on_conflict: conflictColumns },
    body: rows,
    prefer: 'resolution=ignore-duplicates,return=representation',
  });
}

export function databaseErrorResponse(error: unknown) {
  if (error instanceof SupabaseHttpError) {
    const status =
      error.status === 409 ? 409 : error.status === 503 ? 503 : 500;
    return Response.json(
      {
        error:
          status === 503 ? error.message : '데이터 요청을 처리하지 못했습니다.',
      },
      { status },
    );
  }
  return Response.json(
    { error: '데이터 요청을 처리하지 못했습니다.' },
    { status: 500 },
  );
}
