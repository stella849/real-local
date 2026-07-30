'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

/**
 * 회원 탈퇴.
 *
 * 이 프로젝트에서 service_role 을 쓰는 유일한 서버 액션이다 — 다른
 * 곳은 전부 자기 세션의 RLS 로 처리한다(lib/supabase/server.ts 참조).
 * 예외를 둔 이유: Supabase 계정 자체를 지우는 공식 경로가
 * auth.admin.deleteUser 뿐이다. SQL 로 auth.users 를 직접 지우면
 * identities·sessions 등 내부 테이블에 잔재가 남을 수 있어 권장되지
 * 않는다.
 *
 * 위험을 좁히는 장치: 지울 대상 id 는 클라이언트에서 절대 받지 않고
 * 이 함수 안에서 db.auth.getUser() 로 직접 읽은 본인 uid 뿐이다 —
 * 파라미터 자체가 없다. 즉 이 액션이 할 수 있는 유일한 일은
 * "지금 로그인한 사람이 자기 자신을 지우는 것"이다.
 */
export async function deleteMyAccount(): Promise<Result> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in.' };

    const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();

    // 어드민은 자기 역할을 못 바꾸는 것과 같은 이유로 자기 계정도 못
    // 지운다 — 마지막 어드민이 스스로를 지우면 아무도 어드민에 못
    // 들어간다.
    if (me?.role === 'admin') {
      return {
        ok: false,
        error: 'Admins can’t delete their own account here. Ask another admin to change your role first.',
      };
    }

    // 큐레이터가 맵을 하나라도 갖고 있으면 지울 수 없다 — maps.curator_id
    // 는 on delete restrict 라 DB 가 그 자체로 막는다(맵은 절대 지워지지
    // 않는다는 원칙이 여기도 적용된다). draft 도 걸린다.
    if (me?.role === 'curator') {
      const { count } = await db.from('maps')
        .select('id', { count: 'exact', head: true }).eq('curator_id', user.id);
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: 'You still have maps. An admin needs to move you back to a regular member '
            + 'before you can delete your account — maps can’t be removed.',
        };
      }
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
