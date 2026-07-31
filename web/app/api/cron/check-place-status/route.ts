import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * 발행된 맵의 장소를 월 1회 훑어 구글 businessStatus(폐업·이전 여부)를
 * 캐시한다. supabase/migrations/008_place_business_status.sql 참조.
 *
 * Vercel Cron 전용. CRON_SECRET 이 안 맞으면 401 — demote-inactive-
 * curators 와 같은 인증 패턴이다.
 *
 * 자동 삭제·비공개는 하지 않는다 — API 오탐일 수 있고, 큐레이터의
 * 팁 자체는 여전히 유효할 수 있어서 최종 판단은 어드민에게 남긴다
 * (§3.3 삭제 금지 원칙과 같은 이유). 어드민 Maps 탭이 캐시된 값을 읽어
 * OPERATIONAL 이 아닌 장소가 있는 맵에 경고를 보여준다.
 *
 * published 맵의 장소만 확인한다 — 실제로 방문자에게 보이는 것만
 * 비용 들여 확인한다. draft·pending·rejected·hidden 은 스코프 밖이다.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!key) return Response.json({ error: 'search not configured' }, { status: 503 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: maps } = await db.from('maps').select('id').eq('status', 'published');
  const mapIds = (maps ?? []).map((m) => m.id);
  if (mapIds.length === 0) return Response.json({ checked: 0, flagged: [] });

  const { data: places, error } = await db.from('places')
    .select('id,name_en,google_place_id')
    .in('map_id', mapIds)
    .not('google_place_id', 'is', null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const flagged: { id: string; name_en: string; status: string }[] = [];
  const checkedAt = new Date().toISOString();

  for (const p of places ?? []) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${p.google_place_id}?languageCode=en`,
        { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'businessStatus' } },
      );
      if (!res.ok) continue;

      const j = await res.json() as { businessStatus?: string };
      const status = j.businessStatus ?? 'OPERATIONAL';

      await db.from('places')
        .update({ google_business_status: status, business_status_checked_at: checkedAt })
        .eq('id', p.id);

      if (status !== 'OPERATIONAL') flagged.push({ id: p.id, name_en: p.name_en, status });
    } catch {
      // 이 장소 하나 실패해도 나머지는 계속 확인한다
    }
  }

  return Response.json({ checked: places?.length ?? 0, flagged });
}
