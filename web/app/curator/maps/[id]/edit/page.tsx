import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { MapEditor } from '@/components/curator/MapEditor';
import { LiveMapEditor } from '@/components/curator/LiveMapEditor';
import { IconBack } from '@/components/Icons';
import type { DraftPlace } from '@/app/curator/maps/actions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * 맵 재편집. 본인 맵만 연다.
 *
 * draft·rejected 는 MapEditor(F13 후속) — 장소를 통째로 지웠다 다시
 * 넣는 재작성 방식. published·pending·hidden 은 LiveMapEditor — 이미
 * 나간 장소는 삭제할 수 없어(§3.3) 팁 수정 + 새 장소 추가만 가능한
 * 별도 화면이다. "작성한 맵을 고칠 방법이 없다"는 요청으로 신설.
 */
export default async function EditMap({ params }: Params) {
  const { id } = await params;
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();

  const { data: me } = await db.from('users')
    .select('role,curator_tier').eq('id', user.id).maybeSingle();
  if (!me || (me.role !== 'curator' && me.role !== 'admin')) notFound();

  const { data: map } = await db.from('maps')
    .select('id,title,one_liner,concept_tag,status,curator_id,review_note')
    .eq('id', id).maybeSingle();
  if (!map || map.curator_id !== user.id) notFound();

  const isDraftFlow = map.status === 'draft' || map.status === 'rejected';

  if (isDraftFlow) {
    const { data: places } = await db.from('places')
      .select('google_place_id,name_en,name_ko,address,lat,lng,curator_note,photo_ref,photo_attribution,photo_candidates')
      .eq('map_id', id).order('order');

    return (
      <>
        <header className="topbar">
          <Link className="iconbtn" href="/curator" aria-label="Back"><IconBack /></Link>
          <span className="topbar-title">{map.status === 'rejected' ? 'Fix rejected map' : 'Edit draft'}</span>
        </header>

        <main className="view pad">
          <MapEditor
            tier={me.curator_tier as 'resident' | 'guest' | null}
            mapId={map.id}
            rejectionNote={map.status === 'rejected' ? map.review_note : null}
            initial={{
              title: map.title,
              one_liner: map.one_liner,
              concept_tag: map.concept_tag ?? '',
              places: (places ?? []) as DraftPlace[],
            }}
          />
        </main>
      </>
    );
  }

  const { data: places } = await db.from('places')
    .select('id,name_en,curator_note')
    .eq('map_id', id).order('order');

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/curator" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">Edit map</span>
      </header>

      <main className="view pad">
        <LiveMapEditor
          mapId={map.id}
          initial={{
            title: map.title,
            one_liner: map.one_liner,
            concept_tag: map.concept_tag ?? '',
          }}
          places={places ?? []}
        />
      </main>
    </>
  );
}
