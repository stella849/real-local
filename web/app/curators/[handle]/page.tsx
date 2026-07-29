import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { MapCard } from '@/components/MapCard';
import { CuratorAvatar } from '@/components/CuratorLine';
import { IconBack } from '@/components/Icons';
import { ShareButton } from '@/components/ShareButton';
import type { CuratorProfile, MapCard as Card } from '@/lib/types';

type Params = { params: Promise<{ handle: string }> };

/* curator_profiles 뷰가 role in (curator, admin) · handle not null ·
   curator_listed = true 를 이미 걸러 준다. 따라서 은퇴한 큐레이터,
   없는 handle, 일반 유저 handle 은 전부 여기서 404 가 된다 (§5 S10).
   뷰에 email 도 curator_tier 도 없다 — 등급은 사용자에게 노출하지 않는다. */
async function load(handle: string) {
  const db = await createClient();
  const { data: c } = await db.from('curator_profiles')
    .select('*').eq('handle', handle).maybeSingle();
  if (!c) return null;

  const { data: maps } = await db.from('map_cards')
    .select('*').eq('curator_id', c.id)
    .order('save_count', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false });

  return { c: c as CuratorProfile, maps: (maps ?? []) as Card[] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) return { title: 'Not found' };

  const { c } = found;
  return {
    title: `${c.display_name} · Real Local`,
    description: c.byline ?? undefined,
    openGraph: {
      title: `${c.display_name} on Real Local`,
      description: c.byline ?? undefined,
      images: c.avatar_url ? [c.avatar_url] : undefined,
    },
  };
}

export default async function CuratorPage({ params }: Params) {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) notFound();

  const { c, maps } = found;
  const name = c.display_name ?? handle;
  const saved = await getSaved();

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/" aria-label="Back"><IconBack /></Link>
        <span className="topbar-spacer" />
        <ShareButton title={`${name} on Real Local`} text={c.byline ?? undefined} />
      </header>

      <main className="view">
        <section className="curator-head">
          <CuratorAvatar name={name} url={c.avatar_url} className="curator-avatar" />
          <h1 className="curator-title">{name}</h1>
          {c.byline && <p className="curator-byline">{c.byline}</p>}
        </section>

        {/* about 이 없으면 블록 자체를 렌더하지 않는다 */}
        {c.about && <p className="curator-about">{c.about}</p>}

        <p className="curator-stats">
          {c.map_count} maps · {c.place_count} places · ♡ {c.save_count}
        </p>

        {maps.length === 0 ? (
          <div className="empty">
            <h3>No published maps yet</h3>
            <p>This curator is still working on their first map.</p>
          </div>
        ) : (
          <>
            <div className="section-head"><h2>Maps</h2></div>
            <ul className="feed">
              {maps.map((m) => <MapCard key={m.id} m={m} saved={saved.maps.has(m.id)} />)}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
