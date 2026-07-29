import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth 콜백. 구글이 여기로 code 를 돌려주면 세션으로 바꾼다.
 *
 * next 파라미터로 원래 있던 화면에 돌려보낸다 — 저장하려다 로그인으로
 * 튕긴 사용자가 홈으로 떨어지면 무엇을 하려 했는지 잊는다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) return NextResponse.redirect(new URL('/signin?error=missing_code', url.origin));

  const db = await createClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/signin?error=exchange_failed', url.origin));
  }

  // 열린 리디렉션 방지 — 내부 경로만 허용한다
  const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(dest, url.origin));
}
