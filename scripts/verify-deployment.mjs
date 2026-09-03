import { randomBytes } from 'node:crypto';

const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const marker = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const accounts = [
  {
    email: `verify-a-${marker}@example.test`,
    password: randomBytes(18).toString('base64url'),
  },
  {
    email: `verify-b-${marker}@example.test`,
    password: randomBytes(18).toString('base64url'),
  },
];
const results = {};

function cookieOf(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

async function call(path, { method = 'GET', cookie = '', body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
}

async function expectStatus(label, response, expected) {
  results[label] = response.status;
  if (response.status !== expected) {
    const payload = await response.text();
    throw new Error(
      `${label}: expected ${expected}, received ${response.status}: ${payload.slice(0, 200)}`,
    );
  }
  return response;
}

let cookieA = '';
let cookieB = '';

try {
  const signupA = await expectStatus(
    'signupA',
    await call('/api/auth/signup', { method: 'POST', body: accounts[0] }),
    201,
  );
  cookieA = cookieOf(signupA);
  const signupB = await expectStatus(
    'signupB',
    await call('/api/auth/signup', { method: 'POST', body: accounts[1] }),
    201,
  );
  cookieB = cookieOf(signupB);

  await expectStatus(
    'loginSuccess',
    await call('/api/auth/login', { method: 'POST', body: accounts[0] }),
    200,
  );
  await expectStatus(
    'loginDenied',
    await call('/api/auth/login', {
      method: 'POST',
      body: { email: accounts[0].email, password: 'definitely-wrong' },
    }),
    401,
  );
  await expectStatus(
    'readOwn',
    await call('/api/experiment', { cookie: cookieA }),
    200,
  );
  await expectStatus('readAnonymousDenied', await call('/api/experiment'), 401);

  const diaryCreate = await expectStatus(
    'diaryCreateOwn',
    await call('/api/diary', {
      method: 'POST',
      cookie: cookieA,
      body: {
        date: '2026-08-25',
        value: 60,
        memo: '다이어리 소유권 검증 기록',
        tag: '개인공부 관련 계획',
      },
    }),
    201,
  );
  const diaryId = (await diaryCreate.json()).id;
  const diaryRead = await expectStatus(
    'diaryReadOwn',
    await call('/api/diary', { cookie: cookieA }),
    200,
  );
  const diaryPayload = await diaryRead.json();
  if (
    diaryPayload.records.length !== 1 ||
    diaryPayload.records[0].legacy_id !== diaryId
  )
    throw new Error('own diary list mismatch');
  const diaryReadB = await expectStatus(
    'diaryReadOtherIsEmpty',
    await call('/api/diary', { cookie: cookieB }),
    200,
  );
  if ((await diaryReadB.json()).records.length !== 0)
    throw new Error('other account can see diary data');
  await expectStatus(
    'diaryUpdateOtherDenied',
    await call(`/api/diary/${diaryId}`, {
      method: 'PUT',
      cookie: cookieB,
      body: {
        date: '2026-08-25',
        value: 999,
        memo: '타인 수정 시도',
        tag: '개인공부 관련 계획',
      },
    }),
    404,
  );
  await expectStatus(
    'diaryDeleteOtherDenied',
    await call(`/api/diary/${diaryId}`, { method: 'DELETE', cookie: cookieB }),
    404,
  );
  await expectStatus(
    'diaryUpdateOwn',
    await call(`/api/diary/${diaryId}`, {
      method: 'PUT',
      cookie: cookieA,
      body: {
        date: '2026-08-25',
        value: 65,
        memo: '본인 다이어리 수정 확인',
        tag: '개인공부 관련 계획',
      },
    }),
    200,
  );

  const dates = [
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
  ];
  const values = [60, 70, 80, 65, 80];
  for (let index = 0; index < 2; index += 1) {
    await expectStatus(
      `day${index + 1}`,
      await call('/api/records', {
        method: 'POST',
        cookie: cookieA,
        body: {
          date: dates[index],
          value: values[index],
          note: `검증 ${index + 1}일차`,
        },
      }),
      201,
    );
  }
  await expectStatus(
    'day3BeforeRuleDenied',
    await call('/api/records', {
      method: 'POST',
      cookie: cookieA,
      body: { date: dates[2], value: values[2], note: '변경 전 거절 확인' },
    }),
    409,
  );
  await expectStatus(
    'ruleChange',
    await call('/api/experiment', {
      method: 'PUT',
      cookie: cookieA,
      body: {
        plan_after: '집중 작업 전에 10분 준비 시간을 둔다.',
        changed_reason: '시작 지연을 줄이는지 확인하기 위해서다.',
      },
    }),
    200,
  );
  for (let index = 2; index < 5; index += 1) {
    await expectStatus(
      `day${index + 1}`,
      await call('/api/records', {
        method: 'POST',
        cookie: cookieA,
        body: {
          date: dates[index],
          value: values[index],
          note: `검증 ${index + 1}일차`,
        },
      }),
      201,
    );
  }
  await expectStatus(
    'day6Denied',
    await call('/api/records', {
      method: 'POST',
      cookie: cookieA,
      body: { date: '2026-08-30', value: 10 },
    }),
    409,
  );

  const experimentResponse = await expectStatus(
    'fiveDayRead',
    await call('/api/experiment', { cookie: cookieA }),
    200,
  );
  const experimentPayload = await experimentResponse.json();
  const total = experimentPayload.records.reduce(
    (sum, record) => sum + Number(record.value),
    0,
  );
  const average = Math.round(total / experimentPayload.records.length);
  if (
    experimentPayload.records.length !== 5 ||
    total !== 355 ||
    average !== 71
  ) {
    throw new Error(
      `five-day calculation mismatch: count=${experimentPayload.records.length}, total=${total}, average=${average}`,
    );
  }
  results.fiveDayCalculation = { count: 5, total, average };

  const firstId = experimentPayload.records[0].id;
  const latestId = experimentPayload.records.at(-1).id;
  await expectStatus(
    'updateOwn',
    await call(`/api/records/${firstId}`, {
      method: 'PUT',
      cookie: cookieA,
      body: { value: 60, note: '본인 수정 확인' },
    }),
    200,
  );
  await expectStatus(
    'updateOtherDenied',
    await call(`/api/records/${firstId}`, {
      method: 'PUT',
      cookie: cookieB,
      body: { value: 999, note: '타인 수정 시도' },
    }),
    404,
  );
  await expectStatus(
    'deleteOtherDenied',
    await call(`/api/records/${latestId}`, {
      method: 'DELETE',
      cookie: cookieB,
    }),
    409,
  );
  await expectStatus(
    'deleteOwn',
    await call(`/api/records/${latestId}`, {
      method: 'DELETE',
      cookie: cookieA,
    }),
    200,
  );

  const exportResponse = await expectStatus(
    'exportOwn',
    await call('/api/account/export', { cookie: cookieA }),
    200,
  );
  results.exportIsJson = (
    exportResponse.headers.get('content-type') ?? ''
  ).includes('application/json');
  await expectStatus(
    'diaryDeleteOwn',
    await call(`/api/diary/${diaryId}`, { method: 'DELETE', cookie: cookieA }),
    200,
  );

  await expectStatus(
    'logout',
    await call('/api/auth/logout', { method: 'POST', cookie: cookieA }),
    200,
  );
  await expectStatus(
    'readAfterLogoutDenied',
    await call('/api/experiment', { cookie: cookieA }),
    401,
  );

  const reloginA = await expectStatus(
    'reloginA',
    await call('/api/auth/login', { method: 'POST', body: accounts[0] }),
    200,
  );
  cookieA = cookieOf(reloginA);
  await expectStatus(
    'deleteAccountA',
    await call('/api/account', {
      method: 'DELETE',
      cookie: cookieA,
      body: { confirmation: '계정 삭제' },
    }),
    200,
  );
  cookieA = '';
  await expectStatus(
    'deletedAccountDenied',
    await call('/api/experiment', { cookie: cookieOf(reloginA) }),
    401,
  );

  await expectStatus(
    'deleteAccountB',
    await call('/api/account', {
      method: 'DELETE',
      cookie: cookieB,
      body: { confirmation: '계정 삭제' },
    }),
    200,
  );
  cookieB = '';
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  for (const [cookie, account] of [
    [cookieA, accounts[0]],
    [cookieB, accounts[1]],
  ]) {
    if (!cookie) continue;
    await call('/api/account', {
      method: 'DELETE',
      cookie,
      body: { confirmation: '계정 삭제' },
    }).catch(() => {});
  }
}
