import { randomBytes } from 'node:crypto';

const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const marker = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const sharedPassword = randomBytes(18).toString('base64url');
const accounts = [
  {
    email: `verify-a-${marker}@example.test`,
    password: sharedPassword,
  },
  {
    email: `verify-b-${marker}@example.test`,
    password: sharedPassword,
  },
];
const results = {};

function cookieOf(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

async function call(
  path,
  { method = 'GET', cookie = '', body, headers = {} } = {},
) {
  const options = {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    redirect: 'manual',
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  return fetch(`${baseUrl}${path}`, options);
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

async function storedPasswordHashes() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const url = new URL(`${supabaseUrl}/rest/v1/users`);
  url.searchParams.set('select', 'email,password_hash');
  url.searchParams.set(
    'email',
    `in.(${accounts.map((account) => account.email).join(',')})`,
  );
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      ...(serviceRoleKey.startsWith('eyJ')
        ? { Authorization: `Bearer ${serviceRoleKey}` }
        : {}),
    },
  });
  if (!response.ok) throw new Error('stored password hash lookup failed');
  return response.json();
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
    'duplicateSignupDenied',
    await call('/api/auth/signup', { method: 'POST', body: accounts[0] }),
    409,
  );

  const hashes = await storedPasswordHashes();
  if (hashes) {
    if (
      hashes.length !== 2 ||
      hashes[0].password_hash === hashes[1].password_hash ||
      hashes.some(
        (row) =>
          !row.password_hash.startsWith('pbkdf2-sha256$210000$') ||
          row.password_hash.includes(sharedPassword),
      )
    )
      throw new Error('stored password hash evidence mismatch');
    results.passwordStorage = {
      method: 'PBKDF2-SHA-256, 210000 iterations, per-account random salt',
      sameInputProducesDifferentStoredValues: true,
      storedValues: hashes.map((row) => row.password_hash),
    };
  }

  await expectStatus(
    'loginSuccess',
    await call('/api/auth/login', { method: 'POST', body: accounts[0] }),
    200,
  );
  const wrongPassword = await expectStatus(
    'loginDenied',
    await call('/api/auth/login', {
      method: 'POST',
      body: { email: accounts[0].email, password: 'definitely-wrong' },
    }),
    401,
  );
  const missingAccount = await expectStatus(
    'missingAccountDenied',
    await call('/api/auth/login', {
      method: 'POST',
      body: {
        email: `missing-${marker}@example.test`,
        password: sharedPassword,
      },
    }),
    401,
  );
  const [wrongPasswordBody, missingAccountBody] = await Promise.all([
    wrongPassword.json(),
    missingAccount.json(),
  ]);
  if (wrongPasswordBody.error !== missingAccountBody.error)
    throw new Error('login failure messages differ');
  results.loginFailureMessageIsIdentical = wrongPasswordBody.error;
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
  const diaryCreateB = await expectStatus(
    'diaryCreateOwnB',
    await call('/api/diary', {
      method: 'POST',
      cookie: cookieB,
      body: {
        date: '2026-08-24',
        value: 35,
        memo: '계정 B 다이어리 소유권 검증 기록',
        tag: '운동관련 계획',
      },
    }),
    201,
  );
  const diaryIdB = (await diaryCreateB.json()).id;
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
  const diaryPayloadB = await diaryReadB.json();
  if (
    diaryPayloadB.records.length !== 1 ||
    diaryPayloadB.records[0].legacy_id !== diaryIdB ||
    diaryPayloadB.records.some((record) => record.legacy_id === diaryId)
  )
    throw new Error('account B diary list isolation mismatch');
  if (diaryPayload.records.some((record) => record.legacy_id === diaryIdB))
    throw new Error('account A can see account B diary data');
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
    'diaryUpdateOtherDeniedReverse',
    await call(`/api/diary/${diaryIdB}`, {
      method: 'PUT',
      cookie: cookieA,
      body: {
        date: '2026-08-24',
        value: 999,
        memo: '반대 방향 타인 수정 시도',
        tag: '운동관련 계획',
      },
    }),
    404,
  );
  await expectStatus(
    'diaryDeleteOtherDeniedReverse',
    await call(`/api/diary/${diaryIdB}`, {
      method: 'DELETE',
      cookie: cookieA,
    }),
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
  for (let index = 0; index < 1; index += 1) {
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
    'recordCreateOwnB',
    await call('/api/records', {
      method: 'POST',
      cookie: cookieB,
      body: { date: '2026-08-25', value: 35, note: '계정 B 본인 기록' },
    }),
    201,
  );
  const [beforeCrossAResponse, beforeCrossBResponse] = await Promise.all([
    call('/api/experiment', { cookie: cookieA }),
    call('/api/experiment', { cookie: cookieB }),
  ]);
  const [beforeCrossA, beforeCrossB] = await Promise.all([
    beforeCrossAResponse.json(),
    beforeCrossBResponse.json(),
  ]);
  const recordIdA = beforeCrossA.records[0].id;
  const recordIdB = beforeCrossB.records[0].id;
  if (
    beforeCrossA.records.some((record) => record.id === recordIdB) ||
    beforeCrossB.records.some((record) => record.id === recordIdA)
  )
    throw new Error('cross-account record appeared in list');

  for (const [label, cookie, id] of [
    ['BtoA', cookieB, recordIdA],
    ['AtoB', cookieA, recordIdB],
  ]) {
    await expectStatus(
      `updateOtherDenied${label}`,
      await call(`/api/records/${id}`, {
        method: 'PUT',
        cookie,
        body: { value: 999, note: '양방향 타인 수정 시도' },
      }),
      404,
    );
    await expectStatus(
      `deleteOtherDenied${label}`,
      await call(`/api/records/${id}`, { method: 'DELETE', cookie }),
      404,
    );
  }

  const spoofedResponse = await expectStatus(
    'spoofedIdentityIgnored',
    await call(
      `/api/experiment?user_id=${encodeURIComponent(accounts[1].email)}`,
      {
        cookie: cookieA,
        headers: { 'X-User-Id': accounts[1].email },
      },
    ),
    200,
  );
  const spoofedPayload = await spoofedResponse.json();
  if (
    spoofedPayload.user.email !== accounts[0].email ||
    spoofedPayload.records.some((record) => record.id === recordIdB)
  )
    throw new Error('spoofed identity changed response ownership');

  const [afterCrossAResponse, afterCrossBResponse] = await Promise.all([
    call('/api/experiment', { cookie: cookieA }),
    call('/api/experiment', { cookie: cookieB }),
  ]);
  const [afterCrossA, afterCrossB] = await Promise.all([
    afterCrossAResponse.json(),
    afterCrossBResponse.json(),
  ]);
  if (
    afterCrossA.records.length !== beforeCrossA.records.length ||
    afterCrossB.records.length !== beforeCrossB.records.length
  )
    throw new Error('denied cross-account request changed record counts');
  results.ownershipIsolation = {
    accountAOwnCount: afterCrossA.records.length,
    accountBOwnCount: afterCrossB.records.length,
    bidirectionalReadIsolation: true,
    bidirectionalUpdateDenied: '404/404',
    bidirectionalDeleteDenied: '404/404',
    countsUnchangedAfterDeniedRequests: true,
    spoofedQueryAndHeaderIgnored: true,
  };

  await expectStatus(
    'day2',
    await call('/api/records', {
      method: 'POST',
      cookie: cookieA,
      body: { date: dates[1], value: values[1], note: '검증 2일차' },
    }),
    201,
  );
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
    'diaryDeleteOwnB',
    await call(`/api/diary/${diaryIdB}`, {
      method: 'DELETE',
      cookie: cookieB,
    }),
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
  for (const cookie of [cookieA, cookieB]) {
    if (!cookie) continue;
    await call('/api/account', {
      method: 'DELETE',
      cookie,
      body: { confirmation: '계정 삭제' },
    }).catch(() => {});
  }
}
