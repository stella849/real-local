import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저 클라이언트. anon 키는 브라우저에 그대로 나가는 것이 정상이며,
 * 접근 제어는 키를 숨기는 것이 아니라 RLS 가 담당한다.
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
