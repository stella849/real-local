import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import { MembersTab, PendingTab, MapsTab, type Member, type AdminMap } from '@/components/admin/AdminTabs';

export const dynamic = 'force-dynamic';

type Params = { searchParams: Promise<{ tab?: string }> };

/* Members 정렬 순서.
   1) 구글 로그인 먼저, 이메일 로그인은 맨 아래 — 큐레이터·어드민은
      구글 전용이라(§3.1) 사실상 이메일 그룹은 일반 회원뿐이다.
   2) 그 안에서 resident 큐레이터 → guest 큐레이터 → 일반 회원 → admin.
      admin 을 맨 아래 두는 이유는 운영자 본인 눈에는 이미 익숙한
      계정이라 새로 처리할 일반 회원·큐레이터가 위로 오는 게 실무 동선에
      맞기 때문이다.
   3) 같은 그룹 안에서는 이메일 알파벳순. */
const ROLE_RANK: Record<string, number> = {
  'curator:resident': 0,
  'curator:guest': 1,
  user: 2,
  admin: 3,
};

function memberSortKey(m: Pick<Member, 'role' | 'curator_tier' | 'auth_provider' | 'email'>) {
  const providerRank = m.auth_provider === 'google' ? 0 : 1;
  const roleKey = m.role === 'curator' ? `curator:${m.curator_tier ?? 'guest'}` : m.role;
  const roleRank = ROLE_RANK[roleKey] ?? 9;
  return [providerRank, roleRank, m.email ?? ''] as const;
}

function sortMembers(members: Member[]) {
  return [...members].sort((a, b) => {
    const ka = memberSortKey(a);
    const kb = memberSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
  });
}

/**
 * S8 Admin. 운영자용이라 데스크톱 폭을 허용한다 — 밀도 우선.
 *
 * 권한 없는 접근은 404 다. 403 은 화면의 존재를 알려준다 (§5 라우팅).
 */
export default async function Admin({ searchParams }: Params) {
  const { tab = 'members' } = await searchParams;
  const db = await createClient();

  const user = await getUser(db);
  if (!user) notFound();

  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') notFound();

  // users_read_self 정책이 어드민에게는 전체를 돌려준다.
  // 정렬은 SQL 로 안 하고 JS 로 한다 — 구글/이메일 · 큐레이터 등급 ·
  // 역할이 뒤섞인 우선순위라 단일 컬럼 order 로 못 줄 세운다 (아래
  // sortMembers 참조). 로직이 보이는 곳에 있어야 나중에 바꾸기 쉽다.
  const { data: rawMembers } = await db.from('users')
    .select('id,email,display_name,role,curator_tier,handle,byline,about,curator_listed,auth_provider');
  const members = sortMembers((rawMembers ?? []) as Member[]);

  /* maps 를 직접 조회한다. map_cards 뷰는 published 만 담기 때문이다 —
     어드민은 draft·pending·rejected·hidden 을 전부 봐야 한다.
     maps_read 정책이 어드민에게 전체를 열어 준다.

     places(count) 대신 places!places_map_id_fkey(count) 를 쓴다 —
     maps → places 로 가는 FK 가 두 개다(1. places.map_id, 2.
     maps.cover_place_id). PostgREST 가 embed 대상을 못 정해 PGRST201
     로 쿼리 전체를 거부했고, 그 결과 Pending·Maps 탭이 항상 0으로
     보였다(이 select 가 실패하면 rawMaps 가 null → maps·pending 모두
     빈 배열). 어느 쪽 FK 인지 명시하면 해결된다. */
  const { data: rawMaps } = await db.from('maps')
    .select('id,slug,title,status,review_note,curator_id,places!places_map_id_fkey(count)')
    .order('status').order('created_at', { ascending: false });

  const nameOf = new Map(members.map((m) => [m.id, m.display_name ?? m.email ?? '?']));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maps: AdminMap[] = ((rawMaps ?? []) as any[]).map((m) => ({
    id: m.id, slug: m.slug, title: m.title, status: m.status,
    review_note: m.review_note, curator_id: m.curator_id,
    curator_name: nameOf.get(m.curator_id) ?? '?',
    place_count: m.places?.[0]?.count ?? 0,
  }));

  const pending = maps.filter((m) => m.status === 'pending');

  const TABS = [
    { id: 'members', label: `Members (${members.length})` },
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
          <MembersTab members={members} meId={user.id} />
        )}
        {tab === 'pending' && <PendingTab maps={pending} />}
        {tab === 'maps' && <MapsTab maps={maps} meId={user.id} />}
      </main>
    </div>
  );
}
