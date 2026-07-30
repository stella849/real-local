import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { MapCanvas, type Pin } from '@/components/MapCanvas';
import { IconBack } from '@/components/Icons';
import { photoUrl, categoryLabel, type Place } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/**
 * 어드민 전용 미리보기 (Maps 'Open' · Pending 'Preview').
 *
 * /maps/[slug] 는 map_cards 뷰(published 전용)만 읽는다 — draft·pending·
 * rejected·hidden 슬러그로 들어오면 거기서 404 난다. 승인 전 검수가
 * 목적인 화면인데 그 제약을 그대로 쓰면 검수 자체가 불가능해지므로,
 * 여기는 원본 테이블(maps·places)을 직접 읽어 어드민에게만 연다.
 */
export default async function AdminPreview({ params }: Params) {
  const { slug } = await params;
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();
  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') notFound();

  const { data: map } = await db.from('maps')
    .select('id,title,one_liner,concept_tag,status,review_note,curator_id')
    .eq('slug', slug).maybeSingle();
  if (!map) notFound();

  const { data: curator } = await db.from('users')
    .select('display_name,email').eq('id', map.curator_id).maybeSingle();

  const { data: places } = await db.from('places')
    .select('*').eq('map_id', map.id).order('order');

  const pins: Pin[] = (places ?? []).map((p) => ({
    id: p.id, n: p.order, name: p.name_en, lat: p.lat, lng: p.lng,
  }));

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/admin?tab=maps" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">{map.title}</span>
        <span className="topbar-spacer" />
        <span className="badge quiet">{map.status.toUpperCase()}</span>
      </header>

      <main className="view">
        <MapCanvas
          pins={pins}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        />

        <section className="detail-head">
          {map.concept_tag && <p className="concept-tag">{map.concept_tag}</p>}
          <h1 className="detail-title">{map.title}</h1>
          <p className="detail-summary">{map.one_liner}</p>
          <p className="admin-hint">by {curator?.display_name ?? curator?.email ?? 'Unknown'}</p>
          {map.review_note && <p className="admin-hint">Rejected: {map.review_note}</p>}
        </section>

        <div className="section-head"><h2>{places?.length ?? 0} Places</h2></div>

        <ul className="places">
          {(places ?? []).map((p: Place) => (
            <li className="place" key={p.id}>
              <span className="place-n">{p.order}</span>
              {p.photo_ref
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="place-thumb" src={photoUrl(p.photo_ref, 200)} alt="" loading="lazy" />
                : <span className="place-thumb" aria-hidden />}
              <div className="place-main">
                <h3 className="place-name">{p.name_en}</h3>
                <p className="place-cat">{categoryLabel(p.category)}</p>
                {p.curator_note && <p className="place-tip">{p.curator_note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
