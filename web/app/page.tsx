import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { MapCard } from '@/components/MapCard';
import { TabBar } from '@/components/TabBar';
import type { MapCard as Card } from '@/lib/types';

/** 맵 20개 미만 전제라 페이지네이션이 없다 (§5 S1 · D10).
    저장 상태가 사람마다 달라 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

export default async function Explore() {
  const db = await createClient();
  const saved = await getSaved();

  /* map_cards 뷰는 published 만 담는다. 정렬은 §8 —
     저장수 → 후기수 → 최신순. 검색·필터는 스코프 밖이다 (§4.3):
     사용자는 장소를 검색하지 않고 사람의 취향을 소비한다 (§1). */
  const { data, error } = await db
    .from('map_cards')
    .select('*')
    .order('save_count', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false });

  const maps = (data ?? []) as Card[];

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Real Local</span>
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

        <ul className="feed">
          {maps.map((m) => <MapCard key={m.id} m={m} saved={saved.maps.has(m.id)} />)}
        </ul>
      </main>

      <TabBar current="/" />
    </>
  );
}
