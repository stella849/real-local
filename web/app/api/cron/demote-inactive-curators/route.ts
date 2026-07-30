import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6; // 근사치 — 30일 x 6

/**
 * 6개월 이상 새 맵을 발행하지 않은 큐레이터를 일반 회원으로 강등한다.
 *
 * Vercel Cron 전용. CRON_SECRET 이 안 맞으면 401 — Vercel 이 크론
 * 요청에 Authorization: Bearer {CRON_SECRET} 을 자동으로 붙여 준다.
 * 사람이 브라우저로 열 일이 없는 라우트라 GET 이다(크론이 GET 을
 * 보낸다).
 *
 * service_role 을 쓴다. web/app/profile/actions.ts 의 회원 탈퇴와
 * 함께 이 프로젝트에서 service_role 을 쓰는 두 곳 중 하나다 — 여기는
 * 사용자 입력이 전혀 없는 고정된 배치 작업이라 RLS 우회의 위험이
 * "누가 무엇을 지울 수 있느냐"에서 오지 않는다(다른 서버 액션들의
 * service_role 금지 원칙과 대비되는 지점, lib/supabase/server.ts 참조).
 *
 * 판단 기준: 발행(published_at) 만 센다 — draft 를 계속 만지작거리기만
 * 해도 활동으로 치면 강등을 영원히 피할 수 있다. 발행한 적이 아예
 * 없는 큐레이터는 "큐레이터가 된 시점"을 기록하는 컬럼이 없어(§9 스키마)
 * users.created_at(계정 생성일)으로 대신한다 — 실제 큐레이터 지정일보다
 * 이르므로 더 관대한 쪽으로 치우친다.
 *
 * 맵은 강등돼도 내려가지 않는다(§3.4) — setRole 의 강등 로직과 동일
 * 원칙. 자격을 회수하는 것이지 콘텐츠가 틀린 게 아니다.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const cutoff = new Date(Date.now() - SIX_MONTHS_MS).toISOString();

  const { data: curators, error: e1 } = await db.from('users')
    .select('id,email,created_at').eq('role', 'curator');
  if (e1) return Response.json({ error: e1.message }, { status: 500 });

  const demoted: string[] = [];

  for (const c of curators ?? []) {
    const { data: latest } = await db.from('maps')
      .select('published_at')
      .eq('curator_id', c.id).eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1).maybeSingle();

    const lastActive = latest?.published_at ?? c.created_at;
    if (lastActive && lastActive < cutoff) {
      const { error: e2 } = await db.from('users')
        .update({ role: 'user', curator_tier: null, curator_listed: false })
        .eq('id', c.id);
      if (!e2) demoted.push(c.email ?? c.id);
    }
  }

  return Response.json({ checked: curators?.length ?? 0, demoted });
}
