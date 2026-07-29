'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconBack } from '@/components/Icons';

/**
 * 로그인 · 가입 (F1).
 *
 * 일반 회원은 이메일과 구글 둘 다 쓸 수 있다. 계정이 갈려도 저장 목록이
 * 비어 보이는 정도라 감당 가능한 사고다.
 *
 * 큐레이터·어드민은 구글 전용이지만(§3.1) 그 강제는 여기가 아니라
 * 어드민 화면에서 한다 — 여기서 막으면 아직 큐레이터가 아닌 사람이
 * 이메일로 가입하는 정상 경로까지 막힌다.
 */
function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(
    params.get('error') ? 'Sign-in did not complete. Please try again.' : null,
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
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">{mode === 'in' ? 'Sign in' : 'Create account'}</span>
      </header>

      <main className="view pad">
        <p className="lede" style={{ fontSize: 20 }}>
          {mode === 'in' ? 'Welcome back.' : 'Save the places you want to come back to.'}
        </p>
        <p className="lede-sub">
          Your saved maps follow your account, not this device.
        </p>

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
          <button className="curator-name" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }}>
            {mode === 'in' ? 'Create an account' : 'I already have an account'}
          </button>
        </p>
      </main>
    </>
  );
}

export default function SignIn() {
  return <Suspense><SignInForm /></Suspense>;
}
