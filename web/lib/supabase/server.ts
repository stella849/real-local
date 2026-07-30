import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 컴포넌트 · Server Action 용 클라이언트.
 *
 * anon 키를 쓴다. 접근 제어는 키를 숨기는 것이 아니라 RLS 가 담당하므로
 * 여기서 service_role 을 쓰면 안 된다 — 쓰는 순간 모든 정책이 무력화되고
 * 비공개 맵과 회원 이메일이 화면으로 흘러나온다.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신하므로 무시한다.
          }
        },
      },
    },
  );
}

/**
 * 로그인한 사용자를 읽는다. auth.getUser() 대신 auth.getSession() 을 쓴다.
 *
 * proxy.ts(미들웨어)가 이 요청이 페이지·서버 액션에 닿기 전에 이미
 * auth.getUser() 로 토큰을 검증·갱신했다 — 그게 미들웨어가 존재하는
 * 이유다. 여기서 getUser() 를 또 부르면 같은 요청 안에서 Supabase Auth
 * 서버 왕복이 두 번(때로는 더) 일어나 페이지마다 체감될 만큼 느려진다.
 * getSession() 은 미들웨어가 이미 갱신해 둔 쿠키를 로컬에서 읽기만
 * 하므로 네트워크 왕복이 없다 — 같은 요청 안이라 안전하다(미들웨어의
 * matcher 를 벗어난 경로에서는 이 함수를 쓰지 말 것. 지금은 전부
 * 매칭된다).
 */
export async function getUser(db: Awaited<ReturnType<typeof createClient>>) {
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}
