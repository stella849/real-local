import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSaved } from '@/lib/saved';
import { Directions } from '@/components/Directions';
import { SaveButton } from '@/components/SaveButton';
import { IconBack, IconHome } from '@/components/Icons';
import { ShareButton } from '@/components/ShareButton';
import { photoUrl, resolvePhotoUrl, categoryLabel, type Place } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const db = await createClient();
  // uuid 가 아닌 값이 오면 PostgREST 가 에러를 낸다. 404 로 돌린다.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data: p } = await db.from('places').select('*').eq('id', id).maybeSingle();
  if (!p) return null;

  const { data: m } = await db.from('map_cards')
    .select('slug,title,curator_name').eq('id', p.map_id).maybeSingle();

  return { p: p as Place, m };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const found = await load(id);
  if (!found) return { title: 'Not found' };

  const { p } = found;
  return {
    title: `${p.name_en} · Real Local`,
    description: p.curator_note ?? undefined,
    openGraph: {
      title: p.name_en,
      description: p.curator_note ?? undefined,
      images: p.photo_ref ? [photoUrl(p.photo_ref, 1200)] : undefined,
    },
  };
}

export default async function PlaceDetail({ params }: Params) {
  const { id } = await params;
  const found = await load(id);
  if (!found) notFound();

  const { p, m } = found;
  const saved = await getSaved();

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href={m ? `/maps/${m.slug}` : '/'} aria-label="Back">
          <IconBack />
        </Link>
        <span className="topbar-spacer" />
        <Link className="iconbtn" href="/" aria-label="Home"><IconHome /></Link>
        <ShareButton title={p.name_en} text={p.curator_note ?? undefined} />
      </header>

      <main className="view">
        {(() => {
          // 대표 사진(photo_ref) + 갤러리(photo_refs) 를 한 캐러셀로
          // 합친다 — 같은 크기로 옆으로 스와이프해서 본다. 중복은 뺀다
          // (갤러리를 고를 때 대표 사진을 같이 고른 경우가 있을 수 있다).
          const photos = Array.from(new Set([p.photo_ref, ...p.photo_refs].filter(Boolean))) as string[];
          if (photos.length === 0) {
            return (
              <div className="collage" data-n="0" style={{ aspectRatio: '4 / 3' }} aria-hidden>
                {p.name_en.trim()[0]?.toUpperCase() ?? '?'}
              </div>
            );
          }
          return (
            <>
              <div className={`photo-carousel${photos.length === 1 ? ' single' : ''}`}>
                {photos.map((ref, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={ref} src={resolvePhotoUrl(ref, 900)} alt=""
                    loading={i === 0 ? undefined : 'lazy'} />
                ))}
              </div>
              {/* 출처 표기는 의무다(§6.1) — 여러 장이어도 대표 사진 하나만
                  붙어 있다(갤러리 개별 항목엔 출처를 안 받는다). */}
              <p className="photo-credit">
                Photo: Google{p.photo_attribution ? ` / ${p.photo_attribution}` : ''}
              </p>
            </>
          );
        })()}

        <section className="detail-head">
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-start' }}>
            <h1 className="detail-title" style={{ flex: 1, minWidth: 0 }}>{p.name_en}</h1>
            <SaveButton kind="place" id={p.id} mapId={p.map_id} saved={saved.places.has(p.id)} />
          </div>
          {/* 없으면 그 행 자체를 렌더하지 않는다 */}
          {p.name_ko && <p className="place-name-ko">{p.name_ko}</p>}
          <p className="place-cat">{categoryLabel(p.category)}</p>
          {p.address && <p className="place-addr" style={{ whiteSpace: 'normal' }}>{p.address}</p>}
        </section>

        {/* curator_note 가 없으면 인용 블록 전체를 숨긴다.
            인용 부호 + 이탤릭으로 사람이 쓴 문장임을 표시한다 (§10.1). */}
        {p.curator_note && (
          <section className="pad" style={{ borderBottom: '1px solid var(--line)' }}>
            <p className="quote">&ldquo;{p.curator_note}&rdquo;</p>
            {m?.curator_name && <p className="quote-by">— {m.curator_name}</p>}
          </section>
        )}

        <section className="pad" style={{ display: 'grid', gap: 'var(--sp-xs)' }}>
          <Directions lat={p.lat} lng={p.lng} placeId={p.google_place_id} />
          <a className="btn btn-secondary btn-block" target="_blank" rel="noreferrer"
            href={p.google_place_id
              ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=${p.google_place_id}`
              : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}>
            Open in Google Maps
          </a>
        </section>

        {/* 'From the map' 라벨을 두지 않는다. 링크가 아닌 글자라 눌러도
            아무 일이 없었고, 모바일에서는 그 탭이 텍스트 선택으로 넘어가
            사전 팝업이 떴다. 맵으로 돌아가는 길은 상단 뒤로가기가 맡는다. */}
      </main>
    </>
  );
}
