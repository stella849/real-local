import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { MapCard } from '@/components/MapCard';
import { SaveButton } from '@/components/SaveButton';
import { TabBar } from '@/components/TabBar';
import { PlaceThumb } from '@/components/PlaceThumb';
import { type MapCard as Card } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { searchParams: Promise<{ tab?: string }> };

export default async function Saved({ searchParams }: Params) {
  const { tab } = await searchParams;
  const onPlaces = tab === 'places';

  const db = await createClient();
  const user = await getUser(db);
  if (!user) redirect('/signin?next=%2Fsaved');

  const { data: savedMaps } = await db.from('saved_maps')
    .select('map_id, created_at').order('created_at', { ascending: false });

  const mapIds = (savedMaps ?? []).map((s) => s.map_id);
  const { data: cards } = mapIds.length
    ? await db.from('map_cards').select('*').in('id', mapIds)
    : { data: [] };

  // 저장 시각 DESC 를 유지한다 (§8) — in() 은 순서를 보장하지 않는다
  const byId = new Map((cards ?? []).map((c) => [c.id, c as Card]));
  const maps = mapIds.map((id) => byId.get(id)).filter(Boolean) as Card[];

  const { data: savedPlaces } = await db.from('saved_places')
    .select('place_id, map_id, created_at, places(*), maps(slug,title)')
    .order('created_at', { ascending: false });

  /* 한 가게가 두 맵에 있으면 서로 다른 행이 된다 (§9.1). 각각 저장하면
     저장 탭에 같은 가게가 두 번 뜬다. google_place_id 기준으로 중복을
     제거하고, 카드에는 **최초 저장한 맵**의 문맥을 남긴다.
     구조를 고치려면 places / recommendations 분리가 필요하나 이번
     일정에 맞지 않아 증상만 없앤다. */
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const places = ((savedPlaces ?? []) as any[]).filter((row) => {
    const p = row.places;
    if (!p) return false;
    const key = p.google_place_id ?? p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <>
      <header className="topbar"><span className="wordmark">Saved</span></header>

      <nav className="segmented">
        <Link className="seg" href="/saved" aria-selected={!onPlaces}>
          Maps <span className="n">{maps.length}</span>
        </Link>
        <Link className="seg" href="/saved?tab=places" aria-selected={onPlaces}>
          Places <span className="n">{places.length}</span>
        </Link>
      </nav>

      <main className="view">
        {!onPlaces && (maps.length === 0 ? (
          <div className="empty">
            <h3>No saved maps yet</h3>
            <p>Tap the bookmark on any map to keep it here.</p>
            <Link className="btn btn-dark" href="/">Explore maps</Link>
          </div>
        ) : (
          <ul className="feed">{maps.map((m) => <MapCard key={m.id} m={m} saved />)}</ul>
        ))}

        {onPlaces && (places.length === 0 ? (
          <div className="empty">
            <h3>No saved places yet</h3>
            <p>Saving a place does not save the map it came from — they are separate lists.</p>
            <Link className="btn btn-dark" href="/">Explore maps</Link>
          </div>
        ) : (
          <ul className="places">
            {places.map((row) => {
              const p = row.places;
              return (
                <li className="saved-place" key={p.id}>
                  <PlaceThumb photoRef={p.photo_ref} />
                  <div className="place-main">
                    <Link href={`/places/${p.id}`} style={{ textDecoration: 'none' }}>
                      {/* 목록이므로 한글 상호를 넣지 않는다 — 상세에서만 (R3) */}
                      <h3 className="place-name">{p.name_en}</h3>
                    </Link>
                    {row.maps && (
                      <p className="saved-from">From {row.maps.title}</p>
                    )}
                  </div>
                  <div className="place-actions">
                    <SaveButton kind="place" id={p.id} saved />
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
      </main>

      <TabBar current="/saved" />
    </>
  );
}
