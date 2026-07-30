import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { MapCard } from '@/components/MapCard';
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
     저장수 → 후기수 → 최신순. 검색·필터는 스코프 밖이다 (§4.3):
     사용자는 장소를 검색하지 않고 사람의 취향을 소비한다 (§1). */
  const { data, error } = await db
    .from('map_cards')
    .select('*')
    .order('save_count', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false });

  const maps = (data ?? []) as Card[];

  /* 지역 그루핑 (PRD v1.4 §1) — 필터가 아니라 브라우즈 보조다. region 이
     지정된 맵이 하나도 없으면(운영 초기) 아무것도 안 그리고 기존 전체
     피드만 보인다 — 빈 섹션을 억지로 채우지 않는다. */
  const regionGroups = new Map<string, Card[]>();
  for (const m of maps) {
    const region = m.region?.trim();
    if (!region) continue;
    if (!regionGroups.has(region)) regionGroups.set(region, []);
    regionGroups.get(region)!.push(m);
  }
  const regionEntries = [...regionGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const nationwide = maps.filter((m) => !m.region?.trim());

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

        {regionEntries.length > 0 && (
          <>
            {regionEntries.map(([region, list]) => (
              <div key={region}>
                <div className="section-head"><h2>{region}</h2></div>
                <ul className="feed">
                  {list.map((m) => <MapCard key={m.id} m={m} saved={saved.maps.has(m.id)} />)}
                </ul>
              </div>
            ))}
            {nationwide.length > 0 && (
              <div>
                <div className="section-head"><h2>Nationwide</h2></div>
                <ul className="feed">
                  {nationwide.map((m) => <MapCard key={m.id} m={m} saved={saved.maps.has(m.id)} />)}
                </ul>
              </div>
            )}
            {/* 그루핑은 진입점이지 전체 목록을 대체하지 않는다 (PRD v1.4 §1) */}
            <div className="section-head"><h2>All maps</h2></div>
          </>
        )}

        <ul className="feed">
          {maps.map((m) => <MapCard key={m.id} m={m} saved={saved.maps.has(m.id)} />)}
        </ul>
      </main>

      <TabBar current="/" />
    </>
  );
}
