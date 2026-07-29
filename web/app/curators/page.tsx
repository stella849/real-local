import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CuratorAvatar } from '@/components/CuratorLine';
import { TabBar } from '@/components/TabBar';
import { IconSaveCount } from '@/components/Icons';
import type { CuratorProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * 큐레이터 목록.
 *
 * curator_profiles 뷰가 은퇴자·handle 없는 계정·일반 유저를 이미 걸러
 * 준다. email 도 등급도 담기지 않는다 (§3.2 · §9).
 *
 * 정렬은 ① 발행 맵이 많은 사람 ② 최근에 발행한 사람 순.
 * 뷰에 '마지막 발행 시각'이 없어 maps 를 따로 읽어 앱에서 붙인다 —
 * 큐레이터가 3~4명(§3.1)이라 뷰를 고쳐 마이그레이션을 하나 더
 * 만드는 것보다 이쪽이 인계가 가볍다.
 */
export default async function Curators() {
  const db = await createClient();

  const [{ data: rows }, { data: maps }] = await Promise.all([
    db.from('curator_profiles').select('*'),
    db.from('maps').select('curator_id,published_at').eq('status', 'published'),
  ]);

  const latest = new Map<string, number>();
  for (const m of maps ?? []) {
    if (!m.published_at) continue;
    const t = new Date(m.published_at).getTime();
    if (t > (latest.get(m.curator_id) ?? 0)) latest.set(m.curator_id, t);
  }

  const curators = ((rows ?? []) as CuratorProfile[]).sort((a, b) =>
    b.map_count - a.map_count
    || (latest.get(b.id) ?? 0) - (latest.get(a.id) ?? 0));

  return (
    <>
      <header className="topbar"><span className="wordmark">Curators</span></header>

      <main className="view">
        <section className="pad" style={{ paddingBottom: 0 }}>
          <p className="lede" style={{ fontSize: 20 }}>The people behind the maps.</p>
          <p className="lede-sub">
            Every map here was put together by someone who eats in that neighbourhood.
          </p>
        </section>

        {curators.length === 0 ? (
          <div className="empty">
            <h3>No curators yet</h3>
            <p>Curators appear here once an admin gives them a page.</p>
          </div>
        ) : (
          <ul className="curator-list">
            {curators.map((c) => {
              const name = c.display_name ?? c.handle;
              return (
                <li key={c.id}>
                  <Link className="curator-row" href={`/curators/${c.handle}`}>
                    <CuratorAvatar name={name} url={c.avatar_url} className="curator-thumb" />
                    <span className="curator-row-main">
                      <span className="curator-row-name">{name}</span>
                      {c.byline && <span className="curator-row-byline">{c.byline}</span>}
                      <span className="curator-row-meta">
                        {c.map_count} {c.map_count === 1 ? 'map' : 'maps'}
                        {' · '}{c.place_count} places{' · '}
                        <span className="meta-count"><IconSaveCount /> {c.save_count}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <TabBar current="/curators" />
    </>
  );
}
