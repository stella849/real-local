'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** 돌아갈 주소를 쿠키에도 남긴다 (§R4).
 *
 * 구글 로그인은 사이트를 떠났다가 Supabase 를 거쳐 돌아온다. 그 왕복에서
 * next 쿼리가 유실되면 — Redirect URLs 패턴이 경로를 못 덮는 경우가
 * 대표적이다 — 사용자는 홈으로 떨어지고 무엇을 하려 했는지 잊는다.
 * 쿼리와 쿠키 두 곳에 두어 한쪽이 끊겨도 복구되게 한다. */
const NEXT_COOKIE = 'rl_next';

function rememberNext(next: string) {
  if (!next.startsWith('/') || next.startsWith('//')) return;
  document.cookie =
    `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=600; SameSite=Lax`;
}

export function SignInForm({ next, hadError }: { next: string; hadError: boolean }) {
  const router = useRouter();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(
    hadError ? 'Sign-in did not complete. Please try again.' : null,
  );
  const [busy, setBusy] = useState(false);

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const db = createClient();

    const { error } = mode === 'in'
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });

    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push(next);
    router.refresh();
  }

  async function withGoogle() {
    setBusy(true); setErr(null);
    rememberNext(next);

    const db = createClient();
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) { setErr(error.message); setBusy(false); }
  }

  return (
    <main className="view pad">
      <p className="lede" style={{ fontSize: 20 }}>
        {mode === 'in' ? 'Welcome back.' : 'Save the places you want to come back to.'}
      </p>
      <p className="lede-sub">Your saved maps follow your account, not this device.</p>

      <button className="btn btn-secondary btn-block" onClick={withGoogle} disabled={busy}>
        Continue with Google
      </button>

      <p style={{
        textAlign: 'center', color: 'var(--text-3)', fontSize: 13,
        margin: 'var(--sp-md) 0',
      }}>or</p>

      <form onSubmit={withEmail}>
        <input className="field" type="email" required autoComplete="email"
          placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" type="password" required minLength={6}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <p className="form-error">{err}</p>
        <button className="btn btn-dark btn-block" type="submit" disabled={busy}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--sp-md)', fontSize: 14 }}>
        <button className="curator-name"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }}>
          {mode === 'in' ? 'Create an account' : 'I already have an account'}
        </button>
      </p>
    </main>
  );
}
