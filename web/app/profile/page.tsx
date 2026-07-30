import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/SignOutButton';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { CuratorAvatar } from '@/components/CuratorLine';
import { TabBar } from '@/components/TabBar';

export const dynamic = 'force-dynamic';

/**
 * S7 Profile. 일반 회원의 프로필 편집은 스코프 밖이다 (§4.3) —
 * 여기는 계정 확인과 역할별 진입점만 담는다.
 */
export default async function Profile() {
  const db = await createClient();
  const user = await getUser(db);
  if (!user) redirect('/signin?next=%2Fprofile');

  // users_read_self 정책이 본인 행만 돌려준다
  const { data: me } = await db.from('users')
    .select('display_name, avatar_url, role, handle').eq('id', user.id).maybeSingle();

  const name = me?.display_name ?? user.email?.split('@')[0] ?? 'You';

  return (
    <>
      <header className="topbar"><span className="wordmark">Profile</span></header>

      <main className="view" style={{ display: 'flex', flexDirection: 'column' }}>
        <section className="curator-head">
          <CuratorAvatar name={name} url={me?.avatar_url} className="curator-avatar" />
          <h1 className="curator-title">{name}</h1>
          <p className="curator-byline">{user.email}</p>
        </section>

        <div className="pad" style={{ display: 'grid', gap: 'var(--sp-xs)' }}>
          <Link className="btn btn-secondary btn-block" href="/saved">Saved</Link>

          {/* 큐레이터에게만 보인다. 일반 유저에게는 진입점 자체가 없다 (§4.1 F2) */}
          {(me?.role === 'curator' || me?.role === 'admin') && (
            <Link className="btn btn-secondary btn-block" href="/curator">
              Your curator page
            </Link>
          )}
          {me?.role === 'admin' && (
            <Link className="btn btn-secondary btn-block" href="/admin">Admin</Link>
          )}

          <SignOutButton />
        </div>

        {/* 계정 삭제는 눌러서 되돌릴 수 없다 — Sign out 과 붙여 두면
            실수로 누르기 쉽다. Sign out 과 하단 탭바 사이 남는 공간의
            정중앙에 오도록 flex 로 띄운다 — 화면 높이가 달라져도
            항상 정중앙이다. */}
        <div className="pad" style={{
          flex: 1, display: 'flex', alignItems: 'center', paddingBottom: 64,
        }}>
          <DeleteAccountButton />
        </div>
      </main>

      <TabBar current="/profile" />
    </>
  );
}
