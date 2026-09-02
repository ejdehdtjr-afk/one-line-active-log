import { createSession, hashPassword, sessionCookie } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/database';

export async function POST(request: Request) {
  await ensureSchema();
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return Response.json(
      { error: '올바른 이메일을 입력해 주세요.' },
      { status: 400 },
    );
  if (!body.password || body.password.length < 8 || body.password.length > 128)
    return Response.json(
      { error: '비밀번호는 8~128자로 입력해 주세요.' },
      { status: 400 },
    );
  const exists = await db()
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (exists)
    return Response.json(
      { error: '이미 가입된 이메일입니다.' },
      { status: 409 },
    );
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(body.password);
  const experimentId = crypto.randomUUID();
  await db().batch([
    db()
      .prepare(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(id, email, passwordHash, now),
    db()
      .prepare(`INSERT INTO experiments (id, user_id, question, metric, unit, calculation, missing_rule, duplicate_rule, outlier_rule, rounding_rule, week_start, plan_before, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        experimentId,
        id,
        '계획한 집중 시간을 실제로 지켰는가?',
        '집중 시간',
        '분',
        'Asia/Seoul 날짜별 값을 한 번씩 합산하고, 평균은 합계÷기록일 수로 계산한다.',
        '값이 빠진 날은 기록일 수에서 제외하고 0으로 바꾸지 않는다.',
        '같은 날짜가 중복되면 마지막으로 확인한 값 하나만 남긴다.',
        '유난히 튄 값도 실제 측정이면 그대로 두고 메모에 이유를 적는다.',
        '합계는 정수, 평균은 소수 첫째 자리에서 반올림해 정수로 표시한다.',
        '월요일',
        '집중 작업을 오전 10시에 시작한다.',
        now,
      ),
  ]);
  const session = await createSession(id);
  return Response.json(
    { ok: true },
    {
      status: 201,
      headers: { 'Set-Cookie': sessionCookie(session.raw, session.expires) },
    },
  );
}
