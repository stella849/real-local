import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { PhotoPicker, type Candidate } from '@/components/admin/PhotoPicker';
import { PlaceThumb } from '@/components/PlaceThumb';
import type { PlacePhoto } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/**
 * 맵 하나의 장소 사진을 한 화면에서 훑고 교체한다 (F11 · §5 S8 Maps 탭).
 *
 * 어드민 전용이었으나 PRD v1.4 §4.2 로 큐레이터 본인 맵도 열 수 있게
 * 넓혔다 — 대표 사진(단일, photo_ref) 교체는 여전히 어드민만 하고,
 * 갤러리·직접 업로드(photo_refs)는 큐레이터도 할 수 있다(PhotoPicker
 * 의 canPickCover 로 구분).
 */
export default async function Photos({ params }: Params) {
  const { slug } = await params;
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();
  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  const isAdmin = me?.role === 'admin';

  const { data: m } = await db.from('maps')
    .select('id,title,slug,curator_id').eq('slug', slug).maybeSingle();
  if (!m) notFound();
  if (!isAdmin && m.curator_id !== user.id) notFound();

  const { data: places } = await db.from('places')
    .select('id,order,name_en,name_ko,category,photo_ref,photo_candidates,photo_refs,google_place_id')
    .eq('map_id', m.id).order('order');

  const missing = (places ?? []).filter((p) => !p.photo_ref).length;

  return (
    <div className="admin">
      <header className="topbar">
        <Link className="wordmark" href={isAdmin ? '/admin?tab=maps' : '/curator'}>
          {isAdmin ? '← Admin' : '← Your maps'}
        </Link>
        <span className="topbar-title">{m.title}</span>
      </header>

      <main className="view">
        <p className="admin-hint" style={{ padding: 'var(--sp-md) var(--sp-md) 0' }}>
          {places?.length ?? 0} places · {missing} without a photo
        </p>

        <div className="admin-list">
          {(places ?? []).map((p) => (
            <div className="admin-row" key={p.id}>
              <div className="admin-row-main">
                <span className="place-n">{p.order}</span>
                <PlaceThumb photoRef={p.photo_ref} category={p.category} size={160} />
                <div>
                  <b>{p.name_en}</b>
                  {p.name_ko && <p className="admin-hint">{p.name_ko}</p>}
                  {!p.google_place_id && (
                    <p className="admin-hint">Not matched on Google — name is a romanisation.</p>
                  )}
                </div>
              </div>
              <PhotoPicker
                placeId={p.id}
                current={p.photo_ref}
                candidates={(p.photo_candidates ?? []) as Candidate[]}
                gallery={(p.photo_refs ?? []) as PlacePhoto[]}
                canPickCover={isAdmin}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
