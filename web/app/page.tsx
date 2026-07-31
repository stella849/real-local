import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { RegionFilter } from '@/components/RegionFilter';
import { TabBar } from '@/components/TabBar';
import { Logo } from '@/components/Icons';
import type { MapCard as Card } from '@/lib/types';

/** 맵 20개 미만 전제라 페이지네이션이 없다 (§5 S1 · D10).
    저장 상태가 사람마다 달라 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

export default async function Explore() {
  const db = await createClient();
  const saved = await getSaved();

  /* map_cards 뷰는 published 만 담는다. 정렬은 §8 —
     저장수 → 후기수 → 최신순. 텍스트 검색은 여전히 스코프 밖이다
     (§4.3·§1) — region 알약 필터만 명시적 예외다(PRD v1.4 §1 개정,
     RegionFilter.tsx 참조). 기본(알약 미선택) 상태는 이 정렬 그대로다. */
  const { data, error } = await db
    .from('map_cards')
    .select('*')
    .order('save_count', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false });

  const maps = (data ?? []) as Card[];
  const mapsWithSaved = maps.map((m) => ({ ...m, saved: saved.maps.has(m.id) }));

  return (
    <>
      <header className="topbar">
        <span className="brand">
          <Logo className="brand-mark" />
          <span className="wordmark">Real Local</span>
        </span>
      </header>

      <main className="view">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Real Local</p>
            <h1 className="lede">Eat where Korea actually eats.</h1>
            <p className="lede-sub">{maps.length} maps by approved locals.</p>
          </div>
        </section>

        {error && (
          <p className="notice">
            <b>Maps are unavailable right now.</b> Please try again in a moment.
          </p>
        )}

        {!error && maps.length === 0 && (
          <div className="empty">
            <h3>No maps yet</h3>
            <p>Curators are still putting their first maps together.</p>
          </div>
        )}

        {!error && maps.length > 0 && <RegionFilter maps={mapsWithSaved} />}
      </main>

      <TabBar current="/" />
    </>
  );
}
