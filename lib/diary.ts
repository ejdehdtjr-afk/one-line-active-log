export const DIARY_UNIT = '분';
export const DIARY_TAGS = [
  '운동관련 계획',
  'ALEPH 수업 관련 계획',
  '개인공부 관련 계획',
] as const;

export function seoulToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function validateDiaryInput(body: {
  date?: unknown;
  value?: unknown;
  memo?: unknown;
  tag?: unknown;
}) {
  const date = typeof body.date === 'string' ? body.date : '';
  const parsed = new Date(`${date}T12:00:00+09:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed) !== date ||
    date > seoulToday()
  )
    return {
      error: 'Asia/Seoul 기준 오늘 또는 지난 실제 날짜를 입력해 주세요.',
    };

  const value = Number(body.value);
  if (!Number.isInteger(value) || value < 1 || value > 1440)
    return { error: '능동 작업시간은 1~1,440분 사이의 정수로 입력해 주세요.' };

  const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
  if (!memo || memo.length > 120)
    return { error: '오늘 한 일을 1~120자로 입력해 주세요.' };

  const tag = typeof body.tag === 'string' ? body.tag : '';
  if (!DIARY_TAGS.includes(tag as (typeof DIARY_TAGS)[number]))
    return { error: '세 가지 계획 유형 가운데 하나를 골라 주세요.' };

  return { value: { date, value, memo, tag } };
}
