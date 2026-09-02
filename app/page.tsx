import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(247,195,95,.22),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(91,151,126,.28),transparent_40%)]" />
        <div className="relative flex items-center gap-3 text-sm font-semibold tracking-[.18em] text-amber-100">
          <span className="grid size-9 place-items-center rounded-full bg-amber-300 text-slate-950">
            <CheckCircle2 className="size-5" />
          </span>
          FIVE / FIVE
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[.22em] text-amber-200">
            하루 한 번, 같은 기준으로
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.08] tracking-[-.045em]">
            계획을 바꾸기 전에
            <br />
            기록부터 남깁니다.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-slate-300">
            하나의 질문과 하나의 지표로 5일을 관찰하고, 규칙 변경 전후를 같은
            방식으로 비교하세요.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3 border-t border-white/15 pt-6 text-sm text-slate-300">
          <span>
            <b className="block text-2xl text-white">5일</b>정확한 기록
          </span>
          <span>
            <b className="block text-2xl text-white">1개</b>고정된 지표
          </span>
          <span>
            <b className="block text-2xl text-white">100%</b>내 계정 전용
          </span>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle2 className="size-5" />
            </span>
            <span className="text-sm font-bold tracking-[.18em]">
              FIVE / FIVE
            </span>
          </div>
          <div className="mb-8">
            <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <LockKeyhole className="size-5" />
            </span>
            <h2 className="text-3xl font-semibold tracking-[-.035em]">
              내 기록으로 들어가기
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              로그인한 뒤에만 5일 기록과 비교 결과가 보입니다.
            </p>
          </div>
          <AuthForm />
          <p className="mt-12 border-t pt-5 text-center text-xs leading-5 text-muted-foreground">
            비밀번호는 복구할 수 없는 형태로 저장되며, 내 기록은 다른 계정에
            공개되지 않습니다.
          </p>
        </div>
      </section>
    </main>
  );
}
