'use client';

import { useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? '요청을 처리하지 못했습니다.');
      setBusy(false);
      return;
    }
    window.location.assign('/dashboard');
  }

  return (
    <>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium">
          이메일
          <Input
            required
            className="mt-2 h-12 rounded-xl px-4"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          비밀번호
          <Input
            required
            minLength={8}
            maxLength={128}
            className="mt-2 h-12 rounded-xl px-4"
            type="password"
            placeholder="8자 이상 입력"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Button
          disabled={busy}
          className="h-12 w-full rounded-xl text-base"
          type="submit"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : mode === 'login' ? (
            '로그인'
          ) : (
            '계정 만들기'
          )}{' '}
          {!busy && <ArrowRight className="ml-1 size-4" />}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {mode === 'login' ? '처음이신가요?' : '이미 계정이 있나요?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          className="font-semibold text-foreground underline underline-offset-4"
        >
          {mode === 'login' ? '계정 만들기' : '로그인하기'}
        </button>
      </p>
    </>
  );
}
