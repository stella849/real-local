import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { MapCanvas, type Pin } from '@/components/MapCanvas';
import { SaveButton } from '@/components/SaveButton';
import { MapCard } from '@/components/MapCard';
import { CuratorAvatar, CuratorName } from '@/components/CuratorLine';
import { IconBack, IconHome, IconStar } from '@/components/Icons';
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

  // 최신 후기 3개 — Reviews 와 More from 사이에 미리보기로 노출.
  // 이름·날짜는 안 보여줄 거라 여기서도 안 읽는다.
  const { data: recentReviews } = await db.from('map_reviews')
    .select('id,rating,body')
    .eq('map_id', m.id).order('created_at', { ascending: false }).limit(3);

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
        {/* 상세 화면에는 하단 탭바가 없다. 홈으로 한 번에 갈 길을 둔다 */}
        <Link className="iconbtn" href="/" aria-label="Home"><IconHome /></Link>
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
              ? (
                <span className="meta-count">
                  <IconStar /> {m.avg_rating} ({m.review_count} reviews)
                </span>
              )
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
                  {/* 한글 상호는 여기 넣지 않는다. 목록에서는 큐레이터의 한 줄이
                      주인공이어야 하는데, 상호가 두 줄을 차지하면 그것이 밀린다.
                      현장에서 쓸 한글명은 장소 상세에서 보여준다.
                      §5 S2 와이어프레임은 목록에도 그렸으나 뒤집은 결정이다. */}
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

        {/* 일반 섹션 헤더다. sticky 가 아니다 (§10.2)

            후기가 0건이면 'See all' 을 걸지 않는다 — 볼 것이 없는데 보러
            가라는 빈 약속이 되고, 첫 후기를 남길 수 있다는 것도 알리지
            못한다. 카피는 구체적인 행동을 지칭한다 (§10.1). */}
        {/* 줄 전체가 링크다. 제목만 글자로 두면 눌러도 반응이 없고,
            모바일에서는 그 탭이 텍스트 선택으로 넘어가 사전 팝업이 뜬다.
            'See all' 이 저 멀리 오른쪽에만 있는 것도 어색하다. */}
        <Link className="section-head section-head-link" href={`/maps/${m.slug}/reviews`}>
          <h2>Reviews</h2>
          {m.review_count > 0 && <span className="count">{m.review_count}</span>}
          <span className="more">
            {m.review_count > 0 ? 'See all →' : 'Write the first one →'}
          </span>
        </Link>

        {/* 이름·날짜는 뺐다 — 여긴 미리보기다. 누가 언제 썼는지는
            'See all' 로 들어간 후기 화면에서 본다. */}
        {(recentReviews?.length ?? 0) > 0 && (
          <ul className="reviews">
            {(recentReviews ?? []).map((r) => (
              <li className="review" key={r.id}>
                {/* 별점 옆에 본문을 바로 잇는다 — 줄바꿈하면 미리보기가
                    후기 화면과 다를 게 없어진다 */}
                <p className="review-head" style={{ lineHeight: '1.2' }}>
                  <span className="meta-count"><IconStar /> {r.rating}</span>
                  <span style={{ color: 'var(--text-2)' }}>{r.body}</span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {(more?.length ?? 0) > 0 && (
          <>
            {/* 은퇴·강등된 큐레이터는 소개 페이지가 404 라 링크를 걸지
                않는다 (§3.4). 그때는 제목만 남는다. */}
            {m.curator_listed && m.curator_handle ? (
              <Link className="section-head section-head-link"
                href={`/curators/${m.curator_handle}`}>
                <h2>More from {m.curator_name}</h2>
                <span className="more">See all →</span>
              </Link>
            ) : (
              <div className="section-head">
                <h2>More from {m.curator_name}</h2>
              </div>
            )}
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
