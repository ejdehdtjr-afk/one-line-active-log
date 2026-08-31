'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArchiveRestore, CalendarDays, Check, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, Download, FileCheck2, FlaskConical, Info, Pencil,
  Plus, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const STORAGE_KEY = 'daily-active-log-v2';
const TIMEZONE = 'Asia/Seoul';
const ITEM = '능동 작업시간';
const UNIT = '분';

type LogRecord = {
  id: string;
  date: string;
  timezone: typeof TIMEZONE;
  item: typeof ITEM;
  value: number;
  unit: typeof UNIT;
  memo: string;
  tag: string;
  source: 'sample' | 'user';
  createdAt: string;
  updatedAt: string;
};

type StoredData = {
  schemaVersion: 2;
  exportedAt: string;
  records: LogRecord[];
};

type Notice = { type: 'success' | 'error' | 'info'; text: string };

const SAMPLE_RECORDS: LogRecord[] = [
  {
    id: 'sample-focus-001', date: '2026-08-31', timezone: TIMEZONE, item: ITEM,
    value: 45, unit: UNIT, memo: '과제 기능 구현', tag: '개발', source: 'sample',
    createdAt: '2026-08-31T01:30:00.000Z', updatedAt: '2026-08-31T01:30:00.000Z',
  },
  {
    id: 'sample-focus-002', date: '2026-09-01', timezone: TIMEZONE, item: ITEM,
    value: 70, unit: UNIT, memo: '문서 읽기와 정리', tag: '학습', source: 'sample',
    createdAt: '2026-09-01T05:10:00.000Z', updatedAt: '2026-09-01T05:10:00.000Z',
  },
  {
    id: 'sample-focus-003', date: '2026-09-02', timezone: TIMEZONE, item: ITEM,
    value: 35, unit: UNIT, memo: '경계값 검사', tag: '검증', source: 'sample',
    createdAt: '2026-09-02T02:20:00.000Z', updatedAt: '2026-09-02T02:20:00.000Z',
  },
];

const todayInSeoul = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const emptyForm = () => ({ date: todayInSeoul(), value: '', memo: '', tag: '학습' });

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short', timeZone: TIMEZONE })
    .format(new Date(`${value}T12:00:00+09:00`));
}

function isoFromDate(date: Date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekRange(reference = new Date(`${todayInSeoul()}T12:00:00+09:00`)) {
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - ((reference.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoFromDate(monday), end: isoFromDate(sunday) };
}

function recordError(record: Partial<LogRecord>) {
  if (!record.id || typeof record.id !== 'string') return '고유 ID가 없습니다.';
  if (!isValidIsoDate(record.date)) return '날짜가 YYYY-MM-DD 형식의 실제 날짜가 아닙니다.';
  if (typeof record.value !== 'number' || !Number.isFinite(record.value) || record.value <= 0 || record.value > 1440) return '값은 1~1,440 사이의 숫자여야 합니다.';
  if (!Number.isInteger(record.value)) return '시간은 1분 단위의 정수로 입력해 주세요.';
  if (!record.memo || typeof record.memo !== 'string' || !record.memo.trim()) return '메모는 필수입니다.';
  return null;
}

function normalizeImported(input: unknown): { data: StoredData; migrated: boolean } {
  if (!input || typeof input !== 'object') throw new Error('JSON 최상위 구조가 올바르지 않습니다.');
  const source = input as { schemaVersion?: unknown; records?: unknown };
  const version = source.schemaVersion ?? 1;
  if (version !== 1 && version !== 2) throw new Error(`지원하지 않는 자료 형식 v${String(version)}입니다.`);
  if (!Array.isArray(source.records)) throw new Error('records 배열을 찾을 수 없습니다.');
  const ids = new Set<string>();
  const now = new Date().toISOString();
  const records = source.records.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`${index + 1}번째 기록이 객체가 아닙니다.`);
    const item = raw as Partial<LogRecord>;
    const converted: LogRecord = {
      id: String(item.id ?? ''), date: String(item.date ?? ''), timezone: TIMEZONE,
      item: ITEM, value: typeof item.value === 'number' ? item.value : Number.NaN,
      unit: UNIT, memo: String(item.memo ?? ''), tag: version === 1 ? '미분류' : String(item.tag ?? '미분류'),
      source: item.source === 'user' ? 'user' : 'sample',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
    };
    const error = recordError(converted);
    if (error) throw new Error(`${index + 1}번째 기록: ${error}`);
    if (ids.has(converted.id)) throw new Error(`${index + 1}번째 기록: 중복 ID ${converted.id}`);
    ids.add(converted.id);
    return converted;
  });
  return { data: { schemaVersion: 2, exportedAt: now, records }, migrated: version === 1 };
}

function minutesLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes}분`;
  return `${hours}시간${minutes ? ` ${minutes}분` : ''}`;
}

export default function Home() {
  const [records, setRecords] = useState<LogRecord[]>(SAMPLE_RECORDS);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({ type: 'info', text: '합성 기록 3건이 준비되어 있습니다. 자유롭게 추가·수정·삭제해 보세요.' });
  const [hydrated, setHydrated] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [migrationResult, setMigrationResult] = useState('현재 v2 · 변환 필요 없음');
  const [testResult, setTestResult] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { data, migrated } = normalizeImported(JSON.parse(saved));
        setRecords(data.records);
        if (migrated) {
          setMigrationResult(`v1 → v2 자동 변환 완료 · ${data.records.length}건 보존`);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch (error) {
        setCanPersist(false);
        setNotice({ type: 'error', text: `저장 자료를 읽지 못해 덮어쓰지 않았습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !canPersist) return;
    const payload: StoredData = { schemaVersion: 2, exportedAt: new Date().toISOString(), records };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [records, hydrated, canPersist]);

  const weekRange = useMemo(() => getWeekRange(), []);
  const weeklyRecords = useMemo(() => records.filter((record) => record.date >= weekRange.start && record.date <= weekRange.end), [records, weekRange]);
  const weeklyMinutes = weeklyRecords.reduce((sum, record) => sum + record.value, 0);
  const realDays = new Set(records.filter((record) => record.source === 'user').map((record) => record.date)).size;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)), [records]);

  function persistMutation(next: LogRecord[], successText: string) {
    setCanPersist(true);
    setRecords(next);
    setNotice({ type: 'success', text: successText });
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(form.value);
    const candidate = { id: editingId ?? 'new', date: form.date, value, memo: form.memo };
    const error = recordError(candidate);
    if (error) {
      setNotice({ type: 'error', text: `저장하지 않았습니다: ${error}` });
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      const target = records.find((record) => record.id === editingId);
      if (!target) {
        setNotice({ type: 'error', text: '수정할 기록을 찾지 못했습니다.' });
        return;
      }
      const next = records.map((record) => record.id === editingId ? {
        ...record, date: form.date, value, memo: form.memo.trim(), tag: form.tag.trim() || '미분류', updatedAt: now,
      } : record);
      persistMutation(next, `“${target.memo}” 기록을 수정했습니다. 주간 요약도 다시 계산되었습니다.`);
    } else {
      const nextRecord: LogRecord = {
        id: crypto.randomUUID(), date: form.date, timezone: TIMEZONE, item: ITEM,
        value, unit: UNIT, memo: form.memo.trim(), tag: form.tag.trim() || '미분류',
        source: 'user', createdAt: now, updatedAt: now,
      };
      persistMutation([...records, nextRecord], `${formatDate(nextRecord.date)} 기록을 추가했습니다.`);
    }
    resetForm();
  }

  function startEdit(record: LogRecord) {
    setEditingId(record.id);
    setForm({ date: record.date, value: String(record.value), memo: record.memo, tag: record.tag });
    setNotice({ type: 'info', text: `“${record.memo}” 기록을 수정 중입니다. 저장하면 관련 요약값도 즉시 바뀝니다.` });
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  function deleteRecord(record: LogRecord) {
    if (!window.confirm(`“${record.memo}” 기록 1건을 삭제할까요?`)) return;
    persistMutation(records.filter((item) => item.id !== record.id), '정확히 한 건을 삭제했습니다.');
    if (editingId === record.id) resetForm();
  }

  function deleteAll() {
    if (!records.length) return;
    if (!window.confirm(`저장된 기록 ${records.length}건을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    persistMutation([], '전체 기록을 삭제했습니다. 현재 0건입니다.');
    resetForm();
  }

  function restoreSamples() {
    const userRecords = records.filter((record) => record.source === 'user');
    persistMutation([...userRecords, ...SAMPLE_RECORDS], '합성 기록 3건을 복원했습니다. 실제 입력 기록은 그대로 유지했습니다.');
  }

  function exportJson() {
    const payload: StoredData = { schemaVersion: 2, exportedAt: new Date().toISOString(), records };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daily-log-${todayInSeoul()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ type: 'success', text: `v2 JSON 파일로 ${records.length}건을 내보냈습니다.` });
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { data, migrated } = normalizeImported(parsed);
      persistMutation(data.records, `${data.records.length}건을 복원했습니다. 기존 기록은 검증 성공 후에만 교체했습니다.`);
      setMigrationResult(migrated ? `v1 → v2 자동 변환 완료 · ${data.records.length}건과 기존 값 보존` : `v2 파일 복원 완료 · ${data.records.length}건`);
    } catch (error) {
      setNotice({ type: 'error', text: `가져오기를 취소했습니다. 기존 기록은 그대로입니다: ${error instanceof Error ? error.message : '파일을 읽을 수 없습니다.'}` });
    }
  }

  function runMigrationTest() {
    const v1 = { schemaVersion: 1, records: records.slice(0, 5).map(({ tag: _tag, timezone: _timezone, ...record }) => record) };
    try {
      const before = v1.records.map((record) => `${record.id}:${record.date}:${record.value}:${record.unit}`).join('|');
      const once = normalizeImported(v1).data;
      const twice = normalizeImported(once).data;
      const after = twice.records.map((record) => `${record.id}:${record.date}:${record.value}:${record.unit}`).join('|');
      const passed = before === after && once.records.length === twice.records.length && twice.records.every((record) => record.tag);
      setMigrationResult(passed ? `검사 통과 · ${once.records.length}건 보존 · 두 번 실행해도 중복 0건` : '검사 실패 · 자료 구조를 확인하세요.');
      setNotice({ type: passed ? 'success' : 'error', text: passed ? 'v1 → v2 반복 변환 검사가 통과했습니다.' : '변환 검사에서 값 차이를 발견했습니다.' });
    } catch (error) {
      setMigrationResult(`검사 실패 · ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  function runBoundaryTest() {
    const cases = [
      { id: 'edge-mon', date: '2026-08-31', value: 30, memo: '월요일 00:00' },
      { id: 'edge-sun', date: '2026-09-06', value: 45, memo: '일요일 23:59' },
      { id: 'edge-missing', date: '2026-09-02', value: 20, memo: '' },
      { id: 'edge-mon', date: '2026-09-03', value: 10, memo: '중복 ID' },
      { id: 'edge-date', date: '2026-02-30', value: 10, memo: '잘못된 날짜' },
      { id: 'edge-value', date: '2026-09-04', value: Number.NaN, memo: '숫자가 아닌 값' },
    ];
    const accepted: typeof cases = [];
    const ids = new Set<string>();
    for (const test of cases) {
      if (recordError(test) || ids.has(test.id)) continue;
      ids.add(test.id);
      accepted.push(test);
    }
    const total = accepted.filter((test) => test.date >= '2026-08-31' && test.date <= '2026-09-06').reduce((sum, test) => sum + test.value, 0);
    const passed = accepted.length === 2 && total === 75;
    setTestResult(passed ? '6건 중 경계 2건만 채택 · 오류 4건 제외 · 예상/실제 합계 75분 일치' : '검사 결과가 예상값과 다릅니다.');
    setNotice({ type: passed ? 'success' : 'error', text: passed ? '주 경계·누락·중복·잘못된 값 검사가 통과했습니다.' : '경계값 검사를 다시 확인해 주세요.' });
  }

  const noticeStyles = notice.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : notice.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-sky-200 bg-sky-50 text-sky-800';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Activity className="size-5" /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Personal log</p><h1 className="text-base font-bold tracking-tight sm:text-lg">오늘의 한 줄 기록</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><ShieldCheck className="mr-1.5 size-3.5" />내 PC에만 저장</span>
            <Button variant="outline" size="sm" onClick={exportJson}><Download /> <span className="hidden sm:inline">JSON</span> 내보내기</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8">
        <div className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(310px,.55fr)] lg:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="size-4" /> 6번째 과제 · 개인 기록기</p>
            <h2 className="max-w-2xl text-3xl font-black tracking-[-0.045em] sm:text-5xl sm:leading-[1.08]">기다린 시간은 빼고,<br />집중한 시간만 기록해요.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">항목은 <strong className="text-foreground">{ITEM}</strong>, 단위는 <strong className="text-foreground">{UNIT}</strong>, 기준 시간대는 <strong className="text-foreground">{TIMEZONE}</strong>입니다. 실제 원자료는 서버로 전송되지 않습니다.</p>
          </div>
          <div className="rounded-[22px] border bg-card px-5 py-4 text-sm shadow-sm">
            <div className="flex items-start gap-3"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><p className="leading-6"><strong>제출 전 확인</strong><br /><span className="text-muted-foreground">합성 기록으로 기능을 검증하세요. 실제 기록이 보이는 화면이나 파일은 공개 제출하지 마세요.</span></p></div>
          </div>
        </div>

        <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${noticeStyles}`} role="status" aria-live="polite">
          {notice.type === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span className="leading-5">{notice.text}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
          <section className="space-y-6">
            <div className="rounded-[28px] border bg-card p-5 shadow-[0_18px_60px_-38px_rgba(32,45,35,.38)] sm:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div><p className="font-bold">{editingId ? '기록 수정' : '새 기록'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">필수값을 모두 입력하세요. 저장 즉시 목록과 이번 주 합계에 반영됩니다.</p></div>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${editingId ? 'bg-amber-100 text-amber-800' : 'bg-secondary'}`}>{editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}</span>
              </div>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
                <div className="space-y-2"><Label htmlFor="date">날짜 *</Label><Input id="date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="h-11" /></div>
                <div className="space-y-2"><Label htmlFor="value">능동 작업시간 (분) *</Label><Input id="value" type="number" min="1" max="1440" step="1" inputMode="numeric" required placeholder="예: 45" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="h-11" /></div>
                <div className="space-y-2"><Label htmlFor="tag">태그</Label><Input id="tag" maxLength={20} placeholder="학습, 개발, 운동 등" value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} className="h-11" /></div>
                <div className="space-y-2"><Label htmlFor="timezone">기준 시간대</Label><Input id="timezone" value={TIMEZONE} disabled className="h-11" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="memo">메모 *</Label><Textarea id="memo" required maxLength={120} placeholder="무엇에 집중했나요?" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} className="min-h-20 resize-none" /></div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button className="h-11 flex-1 rounded-xl" type="submit">{editingId ? <><Save /> 수정 저장</> : <><Plus /> 기록 추가하기</>}</Button>
                  {editingId && <Button className="h-11 rounded-xl" variant="outline" type="button" onClick={resetForm}><X /> 취소</Button>}
                </div>
              </form>
            </div>

            <div className="overflow-hidden rounded-[26px] border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
                <div><h3 className="font-bold">전체 기록 <span className="ml-1 text-sm font-medium text-muted-foreground">{records.length}건</span></h3><p className="mt-1 text-xs text-muted-foreground">고유 ID 기준으로 정확한 한 건만 수정·삭제합니다.</p></div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={restoreSamples}><RotateCcw /> 합성 기록 복원</Button><Button size="sm" variant="destructive" disabled={!records.length} onClick={deleteAll}><Trash2 /> 전체 삭제</Button></div>
              </div>
              {sortedRecords.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>날짜 / 태그</TableHead><TableHead>기록</TableHead><TableHead className="text-right">시간</TableHead><TableHead><span className="sr-only">작업</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sortedRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell><p className="font-semibold">{formatDate(record.date)}</p><p className="mt-1 text-[11px] text-muted-foreground">{record.tag} · {record.source === 'sample' ? '합성' : '내 기록'}</p></TableCell>
                        <TableCell className="max-w-[210px] whitespace-normal"><p className="line-clamp-2 font-medium">{record.memo}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{record.id.slice(0, 12)}</p></TableCell>
                        <TableCell className="text-right"><strong>{record.value}</strong><span className="ml-1 text-xs text-muted-foreground">{record.unit}</span></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`${record.memo} 수정`} onClick={() => startEdit(record)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`${record.memo} 삭제`} className="text-destructive" onClick={() => deleteRecord(record)}><Trash2 /></Button></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid place-items-center px-5 py-14 text-center"><ArchiveRestore className="mb-3 size-8 text-muted-foreground" /><p className="font-semibold">저장된 기록이 없습니다.</p><p className="mt-1 text-sm text-muted-foreground">새 기록을 추가하거나 합성 기록을 복원해 검증하세요.</p></div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[26px] bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/10">
              <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary-foreground/60">이번 주 요약</p><Clock3 className="size-4 text-primary-foreground/60" /></div>
              <p className="mt-3 text-4xl font-black tracking-tight">{weeklyMinutes}<span className="ml-1 text-base font-semibold text-primary-foreground/70">분</span></p>
              <p className="mt-1 text-sm text-primary-foreground/70">{minutesLabel(weeklyMinutes)} · 유효 기록만 집계</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><span className="rounded-2xl bg-white/10 p-3"><FileCheck2 className="mb-2 size-4" /><strong className="block text-lg">{weeklyRecords.length}</strong><span className="text-xs text-primary-foreground/65">주간 기록</span></span><span className="rounded-2xl bg-white/10 p-3"><CalendarDays className="mb-2 size-4" /><strong className="block text-lg">{new Set(weeklyRecords.map((record) => record.date)).size}</strong><span className="text-xs text-primary-foreground/65">기록한 날짜</span></span></div>
              <p className="mt-4 border-t border-white/15 pt-4 text-xs text-primary-foreground/65">{formatDate(weekRange.start)} — {formatDate(weekRange.end)} · 월요일 시작</p>
            </div>

            <div className="rounded-[24px] border bg-card p-5">
              <div className="flex items-center justify-between"><p className="font-bold">5일 사용 진행</p><span className="text-sm font-black text-primary">{Math.min(realDays, 5)}/5</span></div>
              <div className="mt-4 grid grid-cols-5 gap-2" aria-label={`실제 사용 ${Math.min(realDays, 5)}일, 목표 5일`}>{[0, 1, 2, 3, 4].map((day) => <span key={day} className={`grid aspect-square place-items-center rounded-xl text-xs font-bold ${day < realDays ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{day < realDays ? <Check className="size-4" /> : day + 1}</span>)}</div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">합성 데이터는 제외합니다. 서로 다른 실제 날짜에 직접 추가한 기록만 하루로 계산합니다.</p>
            </div>

            <div className="rounded-[24px] border bg-card p-5">
              <div className="flex items-center justify-between"><div><p className="font-bold">백업과 복원</p><p className="mt-1 text-xs text-muted-foreground">현재 자료 형식: v2</p></div><Save className="size-5 text-primary" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={exportJson}><Download /> 내보내기</Button><Button variant="outline" onClick={() => importRef.current?.click()}><Upload /> 가져오기</Button></div>
              <input ref={importRef} className="hidden" type="file" accept="application/json,.json" onChange={importJson} />
              <div className="mt-4 rounded-xl bg-secondary/70 p-3 text-xs leading-5"><strong className="block text-foreground">변환 상태</strong><span className="text-muted-foreground">{migrationResult}</span></div>
              <Button className="mt-3 w-full" variant="ghost" size="sm" onClick={runMigrationTest}><FlaskConical /> v1 반복 변환 검사</Button>
            </div>

            <div className="rounded-[24px] border bg-card p-5">
              <div className="flex items-center justify-between"><div><p className="font-bold">경계·오류 검사</p><p className="mt-1 text-xs text-muted-foreground">월 00:00 — 일 23:59</p></div><ShieldCheck className="size-5 text-primary" /></div>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground"><li className="flex gap-2"><Check className="size-4 text-emerald-600" />잘못된 날짜·숫자 제외</li><li className="flex gap-2"><Check className="size-4 text-emerald-600" />누락값 저장 거부</li><li className="flex gap-2"><Check className="size-4 text-emerald-600" />중복 ID 파일 복원 거부</li></ul>
              {testResult && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{testResult}</p>}
              <Button className="mt-3 w-full" variant="outline" size="sm" onClick={runBoundaryTest}><FlaskConical /> 합성 검사 실행</Button>
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-[28px] border bg-card p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-secondary"><FileCheck2 className="size-5" /></span><div><h3 className="font-bold">30초 검증 안내서</h3><p className="mt-1 text-xs text-muted-foreground">공개 주소에서 세 단계 안에 확인할 수 있습니다.</p></div></div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['어디로 가나요', '이 공개 주소의 첫 화면으로 갑니다.'],
              ['무엇을 하나요', '① 합성 기록 수정 ② 합성 검사 실행 ③ JSON 내보내기를 누릅니다.'],
              ['무엇이 보이면 통과인가요', '한 행과 주간 합계가 함께 바뀌고, 검사 통과 문구와 JSON 파일이 보입니다.'],
              ['안 될 때', '빨간 안내문에서 오류 이유를 확인하고 합성 기록 복원 후 다시 시도합니다.'],
            ].map(([title, body], index) => <div key={title} className="rounded-2xl bg-secondary/60 p-4"><span className="mb-3 grid size-7 place-items-center rounded-full bg-card text-xs font-black text-primary shadow-sm">{index + 1}</span><p className="text-sm font-bold">{title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p></div>)}
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-dashed bg-card/60 p-5">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold">과제 제출용 AI 3줄 <ChevronRight className="size-4" /></summary>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <p className="rounded-xl bg-background p-4"><strong className="mb-1 block">AI에게 맡긴 일</strong><span className="text-muted-foreground">기록기 화면과 CRUD·백업·검사 기능의 첫 구현을 맡겼다.</span></p>
              <p className="rounded-xl bg-background p-4"><strong className="mb-1 block">내가 판단한 일</strong><span className="text-muted-foreground">기록 항목을 능동 작업시간으로, 단위를 분으로 정했다.</span></p>
              <p className="rounded-xl bg-background p-4"><strong className="mb-1 block">AI 말을 안 들은 일</strong><span className="text-muted-foreground">실제 기록은 공개하지 않고 내 PC에만 남기기로 했다.</span></p>
            </div>
          </details>
        </section>

        <footer className="py-8 text-center text-xs text-muted-foreground">개인정보 0건 · 비밀값 0건 · 공개 화면 기본 자료는 합성 데이터입니다.</footer>
      </div>
    </main>
  );
}
