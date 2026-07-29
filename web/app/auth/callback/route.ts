import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const NEXT_COOKIE = 'rl_next';

const safe = (p: string | undefined | null) =>
  p && p.startsWith('/') && !p.startsWith('//') ? p : null;

/**
 * OAuth 콜백. 구글이 여기로 code 를 돌려주면 세션으로 바꾼다.
 *
 * 돌아갈 주소는 쿼리(next)를 먼저 보고, 없으면 로그인 직전에 심어 둔
 * 쿠키를 본다. 구글 로그인은 사이트를 떠났다가 Supabase 를 거쳐 오는데,
 * Supabase Redirect URLs 패턴이 경로를 못 덮으면(`/*` 는 슬래시를 넘지
 * 못한다) 쿼리째 버려지고 Site URL 로 떨어진다. 그때 쿠키가 받아낸다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  const store = await cookies();
  const fromCookie = safe(
    store.get(NEXT_COOKIE)?.value ? decodeURIComponent(store.get(NEXT_COOKIE)!.value) : null,
  );
  const dest = safe(url.searchParams.get('next')) ?? fromCookie ?? '/';

  const back = (to: string) => {
    const res = NextResponse.redirect(new URL(to, url.origin));
    res.cookies.delete(NEXT_COOKIE);      // 한 번 쓰고 버린다
    return res;
  };

  if (!code) return back('/signin?error=missing_code');

  const db = await createClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return back('/signin?error=exchange_failed');

  return back(dest);
}
