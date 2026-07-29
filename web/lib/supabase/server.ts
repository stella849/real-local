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
