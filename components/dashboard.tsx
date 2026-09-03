'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  LogOut,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Experiment = {
  question: string;
  metric: string;
  unit: string;
  calculation: string;
  missing_rule: string;
  duplicate_rule: string;
  outlier_rule: string;
  rounding_rule: string;
  week_start: string;
  plan_before: string;
  plan_after: string | null;
  changed_at: string | null;
  changed_reason: string | null;
};
type RecordRow = {
  id: string;
  record_date: string;
  value: number;
  note: string;
  phase: string;
};
type Data = {
  user: { email: string };
  experiment: Experiment;
  records: RecordRow[];
  legacyRecords: Array<{
    legacy_id: string;
    record_date: string;
    value: number;
    unit: string;
    memo: string;
    tag: string;
  }>;
};
type Tab = 'overview' | 'rules' | 'guide' | 'account';

const nav: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'overview', label: '5일 기록', icon: CalendarDays },
  { id: 'rules', label: '계산 규칙', icon: Settings2 },
  { id: 'guide', label: '인증 설명서', icon: FileText },
  { id: 'account', label: '내 계정', icon: ShieldCheck },
];

function formatSeoulDateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [afterRule, setAfterRule] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [legacyPending, setLegacyPending] = useState<Record<string, unknown>[]>(
    [],
  );

  const refresh = useCallback(async () => {
    const response = await fetch('/api/experiment', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.assign('/');
      return;
    }
    setData(await response.json());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (
      !data ||
      data.legacyRecords.length ||
      localStorage.getItem('t07-t06-migrated')
    )
      return;
    try {
      const stored = JSON.parse(
        localStorage.getItem('daily-active-log-v2') ?? '{}',
      ) as { records?: Record<string, unknown>[] };
      setLegacyPending(
        (stored.records ?? []).filter((record) => record.source === 'user'),
      );
    } catch {
      setLegacyPending([]);
    }
  }, [data]);

  const stats = useMemo(() => {
    const records = data?.records ?? [];
    const total = records.reduce((sum, row) => sum + Number(row.value), 0);
    const before = records.filter((r) => r.phase === '변경 전');
    const after = records.filter((r) => r.phase === '변경 후');
    const average = (items: RecordRow[]) =>
      items.length
        ? Math.round(
            items.reduce((sum, r) => sum + Number(r.value), 0) / items.length,
          )
        : null;
    return {
      total: Math.round(total),
      average: records.length ? Math.round(total / records.length) : 0,
      before: average(before),
      after: average(after),
    };
  }, [data]);

  async function request(url: string, options: RequestInit) {
    setBusy(true);
    setError('');
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error ?? '요청을 처리하지 못했습니다.');
      setBusy(false);
      return false;
    }
    await refresh();
    setBusy(false);
    return true;
  }

  async function addRecord(event: React.FormEvent) {
    event.preventDefault();
    if (
      await request('/api/records', {
        method: 'POST',
        body: JSON.stringify({ date, value: Number(value), note }),
      })
    ) {
      setDate('');
      setValue('');
      setNote('');
    }
  }
  async function changeRule(event: React.FormEvent) {
    event.preventDefault();
    if (
      await request('/api/experiment', {
        method: 'PUT',
        body: JSON.stringify({ plan_after: afterRule, changed_reason: reason }),
      })
    ) {
      setAfterRule('');
      setReason('');
    }
  }
  async function editRecord(row: RecordRow) {
    const nextValue = window.prompt(
      `수정할 ${data?.experiment.unit} 값을 입력하세요.`,
      String(row.value),
    );
    if (nextValue === null) return;
    const nextNote = window.prompt('메모를 입력하세요.', row.note);
    if (nextNote === null) return;
    await request(`/api/records/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ value: Number(nextValue), note: nextNote }),
    });
  }

  if (!data)
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">
          내 기록을 안전하게 불러오는 중…
        </p>
      </main>
    );
  const complete = data.records.length === 5;

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b bg-ink px-5 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:p-6">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3 font-semibold tracking-[.12em]">
            <span className="grid size-9 place-items-center rounded-full bg-amber-300 text-ink">
              <Check className="size-5" />
            </span>
            FIVE / FIVE
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 lg:hidden"
            onClick={() =>
              void request('/api/auth/logout', { method: 'POST' }).then(() =>
                window.location.assign('/'),
              )
            }
          >
            <LogOut />
          </Button>
        </div>
        <nav
          className="mt-5 flex gap-2 overflow-x-auto lg:mt-14 lg:block lg:space-y-2"
          aria-label="주요 메뉴"
        >
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setError('');
              }}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition lg:w-full ${tab === item.id ? 'bg-white text-ink' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 hidden border-t border-white/15 pt-5 lg:block">
          <p className="truncate text-xs text-slate-400">{data.user.email}</p>
          <button
            onClick={() =>
              void request('/api/auth/logout', { method: 'POST' }).then(() =>
                window.location.assign('/'),
              )
            }
            className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </div>
      </aside>
      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-11">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>
            <button onClick={() => setError('')}>닫기</button>
          </div>
        )}

        {tab === 'overview' && (
          <>
            {legacyPending.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
                <div>
                  <b>
                    T06 실제 입력 기록 {legacyPending.length}건을 찾았습니다.
                  </b>
                  <p className="mt-1 text-xs text-amber-800">
                    5일 실험과 섞지 않고 이 계정의 T06 보관 기록으로 그대로
                    옮깁니다.
                  </p>
                </div>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await request('/api/migrate-t06', {
                        method: 'POST',
                        body: JSON.stringify({ records: legacyPending }),
                      })
                    ) {
                      localStorage.setItem('t07-t06-migrated', 'yes');
                      setLegacyPending([]);
                    }
                  }}
                >
                  내 계정으로 옮기기
                </Button>
              </div>
            )}
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Asia/Seoul · {data.records.length}/5일
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
                  같은 기준으로, 다섯 번
                </h1>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  {data.experiment.question}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-secondary-foreground'}`}
              >
                {complete ? '5일 완료' : `${5 - data.records.length}일 남음`}
              </span>
            </header>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="합계"
                value={`${stats.total} ${data.experiment.unit}`}
                hint="5일 값을 직접 더한 값"
              />
              <Stat
                label="평균"
                value={`${stats.average} ${data.experiment.unit}`}
                hint="합계 ÷ 기록일 수"
              />
              <Stat
                label="전 → 후 평균"
                value={`${stats.before ?? '—'} → ${stats.after ?? '—'} ${data.experiment.unit}`}
                hint="같은 지표·단위·계산"
              />
            </div>
            <div className="mt-8 overflow-hidden rounded-2xl border bg-card">
              <div className="grid grid-cols-[74px_1fr_88px] border-b bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground sm:grid-cols-[90px_110px_1fr_100px]">
                <span>날짜</span>
                <span className="hidden sm:block">구간</span>
                <span>기록</span>
                <span className="text-right">관리</span>
              </div>
              {data.records.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                  아직 기록이 없습니다. 오늘의 실제 값을 아래에서 남겨 보세요.
                </p>
              )}
              {data.records.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[74px_1fr_88px] items-center border-b px-4 py-4 last:border-0 sm:grid-cols-[90px_110px_1fr_100px]"
                >
                  <span className="text-sm font-medium">
                    {row.record_date.slice(5).replace('-', '.')}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {row.phase}
                  </span>
                  <div>
                    <b>
                      {row.value} {data.experiment.unit}
                    </b>
                    {row.note && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.note}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      aria-label="기록 수정"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void editRecord(row)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      aria-label="기록 삭제"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() =>
                        void request(`/api/records/${row.id}`, {
                          method: 'DELETE',
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {complete && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
                <b>화면 값과 손계산 대조</b>
                <p className="mt-2 font-mono text-xs leading-6">
                  {data.records.map((row) => row.value).join(' + ')} ={' '}
                  {stats.total} {data.experiment.unit}
                  <br />
                  {stats.total} ÷ 5 = {stats.average} {data.experiment.unit}{' '}
                  (정수 반올림)
                </p>
                <p className="mt-2 text-xs text-emerald-800">
                  화면의 합계·평균과 위 손계산 값이 같습니다.
                </p>
              </div>
            )}
            {data.records.length === 2 && !data.experiment.changed_at ? (
              <form
                onSubmit={changeRule}
                className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-6"
              >
                <p className="text-xs font-bold uppercase tracking-[.15em] text-amber-800">
                  지금 한 번만 변경
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  2일차 뒤, 3일차 앞입니다
                </h2>
                <p className="mt-2 text-sm text-amber-900/70">
                  기존 규칙: {data.experiment.plan_before}
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    새 계획 규칙
                    <Input
                      required
                      className="mt-2 h-11 bg-white"
                      value={afterRule}
                      onChange={(e) => setAfterRule(e.target.value)}
                      placeholder="사람이 읽는 한 문장"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    바꾼 이유
                    <Input
                      required
                      className="mt-2 h-11 bg-white"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="왜 바꾸는지 한 문장"
                    />
                  </label>
                </div>
                <Button disabled={busy} className="mt-4">
                  규칙 변경 기록 남기기
                </Button>
              </form>
            ) : (
              !complete && (
                <form
                  onSubmit={addRecord}
                  className="mt-8 rounded-2xl bg-ink p-5 text-white sm:p-6"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="size-4 text-amber-300" />
                    <h2 className="font-semibold">
                      {data.records.length + 1}일차 기록 추가
                    </h2>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[180px_160px_1fr_auto]">
                    <label className="text-xs text-slate-300">
                      실제 날짜
                      <Input
                        required
                        type="date"
                        className="mt-2 h-11 bg-white text-ink"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      {data.experiment.metric} ({data.experiment.unit})
                      <Input
                        required
                        type="number"
                        min="0"
                        step="any"
                        className="mt-2 h-11 bg-white text-ink"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      메모
                      <Textarea
                        className="mt-2 min-h-11 bg-white text-ink"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="특이값이면 이유 기록"
                      />
                    </label>
                    <Button
                      disabled={busy}
                      className="mt-6 h-11 bg-amber-300 text-ink hover:bg-amber-200"
                    >
                      저장
                    </Button>
                  </div>
                </form>
              )
            )}
          </>
        )}

        {tab === 'rules' && (
          <Rules
            experiment={data.experiment}
            editable={data.records.length === 0}
            busy={busy}
            onSave={async (settings) => {
              await request('/api/experiment', {
                method: 'PUT',
                body: JSON.stringify(settings),
              });
            }}
          />
        )}
        {tab === 'guide' && <Guide />}
        {tab === 'account' && (
          <section>
            <p className="text-sm font-semibold text-emerald-700">
              내 자료 관리
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
              내보내거나, 완전히 지우기
            </h1>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6">
                <Download className="size-6 text-emerald-700" />
                <h2 className="mt-5 text-xl font-semibold">
                  파일 하나로 내보내기
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  질문, 계산 규칙, 규칙 변경, 5일 기록을 JSON 파일 하나로
                  받습니다. T06에서 옮긴 {data.legacyRecords.length}건도 함께
                  들어가며 비밀번호와 세션은 포함되지 않습니다.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => window.location.assign('/api/account/export')}
                >
                  JSON 내보내기
                </Button>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <Trash2 className="size-6 text-red-700" />
                <h2 className="mt-5 text-xl font-semibold">계정과 자료 삭제</h2>
                <p className="mt-2 text-sm leading-6 text-red-800/75">
                  계정을 지우면 기록, 실험 설정, 로그인 세션이 모두 함께 영구
                  삭제됩니다.
                </p>
                <label className="mt-5 block text-sm font-medium">
                  확인을 위해 “계정 삭제” 입력
                  <Input
                    className="mt-2 bg-white"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
                <Button
                  variant="destructive"
                  disabled={confirmation !== '계정 삭제' || busy}
                  className="mt-4"
                  onClick={async () => {
                    if (
                      await request('/api/account', {
                        method: 'DELETE',
                        body: JSON.stringify({ confirmation }),
                      })
                    )
                      window.location.assign('/');
                  }}
                >
                  계정과 모든 자료 삭제
                </Button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-.03em]">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Rules({
  experiment: e,
  editable,
  busy,
  onSave,
}: {
  experiment: Experiment;
  editable: boolean;
  busy: boolean;
  onSave: (settings: Experiment) => Promise<void>;
}) {
  const [draft, setDraft] = useState(e);
  useEffect(() => setDraft(e), [e]);
  const fields: [keyof Experiment, string, boolean][] = [
    ['question', '답하려는 질문', false],
    ['metric', '관찰 지표', false],
    ['unit', '단위', false],
    ['calculation', '계산 규칙', true],
    ['missing_rule', '값이 빠질 때', true],
    ['duplicate_rule', '값이 중복될 때', true],
    ['outlier_rule', '값이 유난히 튈 때', true],
    ['rounding_rule', '반올림', true],
    ['week_start', '주 시작 요일', false],
    ['plan_before', '변경 전 계획', true],
  ];
  const rows = [
    ['답하려는 질문', e.question],
    ['관찰 지표', e.metric],
    ['단위', e.unit],
    ['계산 규칙', e.calculation],
    ['값이 빠질 때', e.missing_rule],
    ['값이 중복될 때', e.duplicate_rule],
    ['값이 유난히 튈 때', e.outlier_rule],
    ['반올림', e.rounding_rule],
    ['주 시작 요일', e.week_start],
    ['변경 전 계획', e.plan_before],
    ['변경 후 계획', e.plan_after ?? '아직 변경하지 않음'],
  ];
  return (
    <section>
      <p className="text-sm font-semibold text-emerald-700">1일차에 고정</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
        질문·지표·계산 규칙
      </h1>
      <p className="mt-3 text-muted-foreground">
        {editable
          ? '첫 기록을 남기기 전에 아래 기준을 내 실험에 맞게 한 번 정하세요.'
          : '첫 기록 뒤에는 비교 기준이 흔들리지 않도록 고정됩니다.'}
      </p>
      {editable ? (
        <form
          className="mt-8 grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(draft);
          }}
        >
          {fields.map(([key, label, multiline]) => (
            <label key={key} className="text-sm font-medium">
              {label}
              {multiline ? (
                <Textarea
                  required
                  className="mt-2"
                  value={draft[key] ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                />
              ) : (
                <Input
                  required
                  className="mt-2 h-11"
                  value={draft[key] ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                />
              )}
            </label>
          ))}
          <Button disabled={busy} className="mt-2 w-fit">
            기준 저장하기
          </Button>
        </form>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border bg-card">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid gap-2 border-b px-5 py-4 last:border-0 sm:grid-cols-[150px_1fr]"
            >
              <b className="text-sm">{label}</b>
              <span className="text-sm leading-6 text-muted-foreground">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
      {e.changed_at && (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
          <b>규칙 변경 시각</b> {formatSeoulDateTime(e.changed_at)}
          <br />
          <b>바꾼 이유</b> {e.changed_reason}
          <p className="mt-2 text-xs">
            1일차와 2일차는 변경 전, 3~5일차는 변경 후로 자동 연결됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function Guide() {
  const sections = [
    [
      '① 무엇으로 붙였나',
      '앱 자체 이메일 인증을 구현했습니다. 비밀번호는 Web Crypto PBKDF2-SHA-256(210,000회, 계정별 16바이트 무작위 salt)으로 해시하고, 로그인 세션은 256비트 무작위 토큰의 SHA-256 해시만 Supabase Postgres에 저장합니다.',
    ],
    [
      '② 왜 그걸 골랐나',
      '별도 OAuth 계정 없이 가입·로그인을 심사할 수 있고, 원문 비밀번호와 원문 세션 토큰이 데이터베이스에 남지 않기 때문입니다.',
    ],
    [
      '③ 어디를 어떻게 고쳤나',
      '가입은 /api/auth/signup, 로그인은 /api/auth/login, 로그아웃은 /api/auth/logout을 지납니다. 자료 조회는 /api/experiment에서 세션 확인 뒤 user_id 조건으로 실행합니다. 수정·삭제도 URL의 id만 믿지 않고 항상 id와 user_id를 함께 검사합니다.',
    ],
    [
      '④ 안 열리는 것을 확인한 기록',
      '성공/거절 요청 다섯 쌍은 제출문 SECURITY-TESTS.md에 상태 코드와 함께 나란히 남겼습니다. 비밀번호와 토큰은 모두 [가림]으로 표기했습니다.',
    ],
    [
      '⑤ AI와 나',
      'AI는 구조·초안·반복 검사를 맡았고, 질문·지표·예외 규칙과 보안 선택은 사용자가 직접 확인하도록 분리했습니다. AI 제안을 따르지 않은 항목도 제출문에 기록합니다.',
    ],
    [
      '⑥ 아직 못 막은 것',
      '무차별 대입 속도 제한과 비밀번호 재설정, 두 번째 인증 수단은 아직 없습니다. 공격자가 반복 로그인을 시도하거나 비밀번호를 잊은 사용자가 계정을 되찾지 못할 위험이 있습니다.',
    ],
  ];
  return (
    <section>
      <p className="text-sm font-semibold text-emerald-700">
        T07 인증 구현 설명서
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
        설명과 코드와 응답을 한 묶음으로
      </h1>
      <div className="mt-8 grid gap-4">
        {sections.map(([title, text]) => (
          <article
            key={title}
            className="rounded-2xl border bg-card p-5 sm:p-6"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
