import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MapEditor } from '@/components/curator/MapEditor';
import { IconBack } from '@/components/Icons';
import type { DraftPlace } from '@/app/curator/maps/actions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Draft 재편집 (F13 후속).
 *
 * status='draft' 인 본인 맵만 연다. published·pending·hidden·rejected 로
 * 들어오면 404 — 그 상태들은 편집 경로가 아직 없다(§5 S9 스코프 밖).
 */
export default async function EditMap({ params }: Params) {
  const { id } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) notFound();

  const { data: me } = await db.from('users')
    .select('role,curator_tier').eq('id', user.id).maybeSingle();
  if (!me || (me.role !== 'curator' && me.role !== 'admin')) notFound();

  const { data: map } = await db.from('maps')
    .select('id,title,one_liner,concept_tag,status,curator_id')
    .eq('id', id).maybeSingle();
  if (!map || map.curator_id !== user.id || map.status !== 'draft') notFound();

  const { data: places } = await db.from('places')
    .select('google_place_id,name_en,address,lat,lng,curator_note,photo_ref,photo_attribution,photo_candidates')
    .eq('map_id', id).order('order');

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/curator" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">Edit draft</span>
      </header>

      <main className="view pad">
        <MapEditor
          tier={me.curator_tier as 'resident' | 'guest' | null}
          mapId={map.id}
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
