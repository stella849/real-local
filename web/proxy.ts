import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 세션 토큰을 갱신한다. 서버 컴포넌트는 쿠키를 쓸 수 없으므로 여기서
 * 하지 않으면 토큰이 만료된 뒤 로그인 상태가 조용히 풀린다.
 */
export async function proxy(req: NextRequest) {
  /* Supabase 가 Redirect URLs 패턴에 걸려 redirect_to 를 버리면 code 를
     Site URL(홈)에 붙여 보낸다. 그대로 두면 사용자는 로그인은 됐는데
     엉뚱한 화면에 서 있게 된다. 콜백으로 넘겨 원래 가려던 곳으로 보낸다. */
  const code = req.nextUrl.searchParams.get('code');
  if (code && req.nextUrl.pathname === '/') {
    const to = new URL('/auth/callback', req.url);
    to.searchParams.set('code', code);
    const next = req.nextUrl.searchParams.get('next');
    if (next) to.searchParams.set('next', next);
    return NextResponse.redirect(to);
  }

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() 를 불러야 토큰이 갱신된다. 반환값 자체는 쓰지 않는다.
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: [
    // 정적 자산과 사진 프록시는 세션이 필요 없다. 프록시까지 태우면
    // 이미지 한 장마다 인증 왕복이 붙는다.
    '/((?!_next/static|_next/image|api/photo|favicon.ico|.*\\.webp$).*)',
  ],
};
