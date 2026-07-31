import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { AvatarUploader, ProfileFields, MyMapRow } from '@/components/curator/ProfileEditor';
import { IconBack } from '@/components/Icons';

export const dynamic = 'force-dynamic';

// 등급 옆 괄호는 발행 시 어드민 승인이 필요한지 여부를 즉시 알려준다 —
// 큐레이터 본인이 "왜 내 맵이 바로 안 뜨지"를 매번 묻지 않게 (요청).
const TIER_LABEL = {
  resident: 'Resident curator (no admin approval needed)',
  guest: 'Guest curator (admin approval needed for each map)',
} as const;

/**
 * S11 Curator editor (F15). role='curator' 만 접근하며 그 외는 404 다.
 */
export default async function CuratorEditor() {
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();

  const { data: me } = await db.from('users')
    .select('display_name,avatar_url,byline,about,handle,role,curator_tier')
    .eq('id', user.id).maybeSingle();

  if (!me || (me.role !== 'curator' && me.role !== 'admin')) notFound();

  const { data: maps } = await db.from('maps')
    .select('id,title,slug,status,review_note')
    .eq('curator_id', user.id)
    .order('created_at', { ascending: false });

  const name = me.display_name ?? user.email?.split('@')[0] ?? 'You';

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/profile" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">Your curator page</span>
      </header>

      <main className="view pad" style={{ display: 'grid', gap: 'var(--sp-lg)' }}>
        {/* 공개 주소·등급은 맨 위 — 스크롤 안 해도 바로 보여야 하는
            정보다 (요청). handle 은 편집 불가다: 공개 주소라 바꾸면
            공유된 링크가 깨진다 (§9) */}
        <div className="curator-page-info">
          <p className="url">
            Profile URL: {me.handle
              ? <Link href={`/curators/${me.handle}`}>/curators/{me.handle}</Link>
              : 'not assigned yet'}
          </p>
          {/* 변경 불가 안내는 아랫줄로 내리고 볼드를 뺐다 — 같은 줄에
              굵게 붙어 있으면 안내가 아니라 경고처럼 읽힌다 (요청). */}
          <p className="note">(set by an admin and fixed after that)</p>
          {/* 등급은 본인에게만 보인다. 일반 사용자에게는 어디에도 없다 (§3.2) */}
          {me.curator_tier && (
            <p className="tier">{TIER_LABEL[me.curator_tier as keyof typeof TIER_LABEL]}</p>
          )}
        </div>

        <AvatarUploader userId={user.id} name={name} url={me.avatar_url} />

        <ProfileFields initial={{
          display_name: me.display_name ?? '',
          byline: me.byline ?? '',
          about: me.about ?? '',
        }} />

        <div>
          <div className="section-head" style={{ padding: '0 0 var(--sp-xs)' }}>
            <h2>Your maps</h2>
            <span className="count">{maps?.length ?? 0}</span>
          </div>

          {(maps?.length ?? 0) === 0 ? (
            <p className="admin-hint">You have not made a map yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--sp-xs)' }}>
              {(maps ?? []).map((m) => (
                <MyMapRow key={m.id} id={m.id} title={m.title} slug={m.slug}
                  status={m.status} note={m.review_note} />
              ))}
            </div>
          )}
        </div>

        <Link className="btn btn-dark btn-block" href="/curator/maps/new">+ New map</Link>
      </main>
    </>
  );
}
