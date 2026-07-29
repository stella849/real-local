import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { MapCanvas, type Pin } from '@/components/MapCanvas';
import { SaveButton } from '@/components/SaveButton';
import { MapCard } from '@/components/MapCard';
import { CuratorAvatar, CuratorName } from '@/components/CuratorLine';
import { IconBack } from '@/components/Icons';
import { ShareButton } from '@/components/ShareButton';
import { photoUrl, categoryLabel, type MapCard as Card, type Place } from '@/lib/types';

type Params = { params: Promise<{ slug: string }> };

/* map_cards 는 published 만 담는다. 따라서 pending·hidden·draft 슬러그로
   직접 들어오면 여기서 404 가 난다 — 403 은 화면의 존재를 알려준다 (§5).
   큐레이터 본인·어드민의 미리보기는 S11/S8 에서 별도 경로로 붙인다. */
async function load(slug: string) {
  const db = await createClient();
  const { data: m } = await db.from('map_cards').select('*').eq('slug', slug).maybeSingle();
  if (!m) return null;

  const { data: places } = await db.from('places')
    .select('*').eq('map_id', m.id).order('order');

  return { m: m as Card, places: (places ?? []) as Place[] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: 'Not found' };

  const { m } = found;
  const img = m.cover_refs[0] ? photoUrl(m.cover_refs[0], 1200) : undefined;

  return {
    title: `${m.title} · Real Local`,
    description: m.one_liner,
    openGraph: {
      title: m.title,
      description: `${m.one_liner} — a map by ${m.curator_name}`,
      images: img ? [img] : undefined,
      type: 'article',
    },
  };
}

export default async function MapDetail({ params }: Params) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();

  const { m, places } = found;
  const db = await createClient();
  const saved = await getSaved();

  // 같은 큐레이터의 다른 맵 2개 (§5 S2 'More from')
  const { data: more } = await db.from('map_cards')
    .select('*').eq('curator_id', m.curator_id).neq('id', m.id)
    .order('save_count', { ascending: false }).limit(2);

  const pins: Pin[] = places.map((p) => ({
    id: p.id, n: p.order, name: p.name_en, lat: p.lat, lng: p.lng,
  }));

  return (
    <>
      {/* 이 화면에서 유일한 sticky 다 (§10.2) */}
      <header className="topbar">
        <Link className="iconbtn" href="/" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">{m.title}</span>
        <span className="topbar-spacer" />
        <ShareButton title={m.title} text={m.one_liner} />
      </header>

      <main className="view">
        <MapCanvas
          pins={pins}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        />

        <section className="detail-head">
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {m.concept_tag && <p className="concept-tag">{m.concept_tag}</p>}
              <h1 className="detail-title">{m.title}</h1>
            </div>
            {/* 맵 저장은 장소 저장과 완전히 독립이다 (§4.1 F5) */}
            <SaveButton kind="map" id={m.id} saved={saved.maps.has(m.id)} />
          </div>
          <p className="detail-summary">{m.one_liner}</p>
          <p className="card-meta">
            <CuratorAvatar name={m.curator_name ?? '?'} url={m.curator_avatar} />
            <CuratorName
              name={m.curator_name ?? 'Unknown'}
              handle={m.curator_handle}
              listed={m.curator_listed}
            />
            <span>·</span>
            {m.review_count > 0
              ? <span>★ {m.avg_rating} ({m.review_count} reviews)</span>
              : <span>New</span>}
          </p>
        </section>

        {/* 일반 섹션 헤더다. sticky 가 아니다 (§10.2) */}
        <div className="section-head">
          <h2>{m.place_count} Places</h2>
        </div>

        <ul className="places">
          {places.map((p) => (
            <li className="place" key={p.id} data-place-id={p.id}>
              <span className="place-n">{p.order}</span>
              {p.photo_ref
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="place-thumb" src={photoUrl(p.photo_ref, 200)} alt="" loading="lazy" />
                : <span className="place-thumb" aria-hidden />}
              <div className="place-main">
                <Link href={`/places/${p.id}`} style={{ textDecoration: 'none' }}>
                  <h3 className="place-name">{p.name_en}</h3>
                  {/* name_ko 가 없으면 그 행 자체를 렌더하지 않는다 (§5 S3) */}
                  {p.name_ko && <p className="place-name-ko">{p.name_ko}</p>}
                  <p className="place-cat">{categoryLabel(p.category)}</p>
                </Link>
                {/* curator_note 가 없으면 블록 전체를 숨긴다 */}
                {p.curator_note && <p className="place-tip">{p.curator_note}</p>}
              </div>
              <div className="place-actions">
                <SaveButton kind="place" id={p.id} mapId={m.id} saved={saved.places.has(p.id)} />
              </div>
            </li>
          ))}
        </ul>

        {/* 일반 섹션 헤더다. sticky 가 아니다 (§10.2) */}
        <div className="section-head">
          <h2>Reviews</h2>
          <span className="count">{m.review_count}</span>
          <Link className="more" href={`/maps/${m.slug}/reviews`}>See all →</Link>
        </div>

        {(more?.length ?? 0) > 0 && (
          <>
            <div className="section-head">
              <h2>More from {m.curator_name}</h2>
              {m.curator_listed && m.curator_handle && (
                <Link className="more" href={`/curators/${m.curator_handle}`}>See all →</Link>
              )}
            </div>
            <ul className="feed">
              {(more as Card[]).map((x) => (
                <MapCard key={x.id} m={x} saved={saved.maps.has(x.id)} />
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
