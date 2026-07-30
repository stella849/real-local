import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MembersTab, PendingTab, MapsTab, type Member, type AdminMap } from '@/components/admin/AdminTabs';

export const dynamic = 'force-dynamic';

type Params = { searchParams: Promise<{ tab?: string }> };

/**
 * S8 Admin. 운영자용이라 데스크톱 폭을 허용한다 — 밀도 우선.
 *
 * 권한 없는 접근은 404 다. 403 은 화면의 존재를 알려준다 (§5 라우팅).
 */
export default async function Admin({ searchParams }: Params) {
  const { tab = 'members' } = await searchParams;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) notFound();

  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') notFound();

  // users_read_self 정책이 어드민에게는 전체를 돌려준다.
  // 이메일 알파벳순 — 회원이 늘면 role 로 먼저 묶는 것보다 이메일로
  // 바로 찾는 편이 실무에서 더 빠르다.
  const { data: members } = await db.from('users')
    .select('id,email,display_name,role,curator_tier,handle,byline,about,curator_listed,auth_provider')
    .order('email');

  /* maps 를 직접 조회한다. map_cards 뷰는 published 만 담기 때문이다 —
     어드민은 draft·pending·rejected·hidden 을 전부 봐야 한다.
     maps_read 정책이 어드민에게 전체를 열어 준다. */
  const { data: rawMaps } = await db.from('maps')
    .select('id,slug,title,status,review_note,curator_id,places(count)')
    .order('status').order('created_at', { ascending: false });

  const nameOf = new Map((members ?? []).map((m) => [m.id, m.display_name ?? m.email ?? '?']));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maps: AdminMap[] = ((rawMaps ?? []) as any[]).map((m) => ({
    id: m.id, slug: m.slug, title: m.title, status: m.status,
    review_note: m.review_note,
    curator_name: nameOf.get(m.curator_id) ?? '?',
    place_count: m.places?.[0]?.count ?? 0,
  }));

  const pending = maps.filter((m) => m.status === 'pending');

  const TABS = [
    { id: 'members', label: `Members (${members?.length ?? 0})` },
    { id: 'pending', label: `Pending (${pending.length})` },
    { id: 'maps', label: `Maps (${maps.length})` },
  ];

  return (
    <div className="admin">
      <header className="topbar">
        <Link className="wordmark" href="/">Real Local</Link>
        <span className="topbar-title">Admin</span>
        <span className="topbar-spacer" />
        <Link className="admin-hint" href="/profile">Profile</Link>
      </header>

      <nav className="segmented">
        {TABS.map((t) => (
          <Link key={t.id} className="seg" href={`/admin?tab=${t.id}`}
            aria-selected={tab === t.id}>
            {t.label}
          </Link>
        ))}
      </nav>

      <main className="view">
        {tab === 'members' && (
          <MembersTab members={(members ?? []) as Member[]} meId={user.id} />
        )}
        {tab === 'pending' && <PendingTab maps={pending} />}
        {tab === 'maps' && <MapsTab maps={maps} />}
      </main>
    </div>
  );
}
