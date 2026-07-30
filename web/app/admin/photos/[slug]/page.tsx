import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { PhotoPicker, type Candidate } from '@/components/admin/PhotoPicker';
import { photoUrl } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/** 맵 하나의 장소 사진을 한 화면에서 훑고 교체한다 (F11 · §5 S8 Maps 탭). */
export default async function Photos({ params }: Params) {
  const { slug } = await params;
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();
  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') notFound();

  const { data: m } = await db.from('maps').select('id,title,slug').eq('slug', slug).maybeSingle();
  if (!m) notFound();

  const { data: places } = await db.from('places')
    .select('id,order,name_en,name_ko,photo_ref,photo_candidates,google_place_id')
    .eq('map_id', m.id).order('order');

  const missing = (places ?? []).filter((p) => !p.photo_ref).length;

  return (
    <div className="admin">
      <header className="topbar">
        <Link className="wordmark" href="/admin?tab=maps">← Admin</Link>
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
                {p.photo_ref
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="place-thumb" src={photoUrl(p.photo_ref, 160)} alt="" />
                  : <span className="place-thumb" aria-hidden />}
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
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
