import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MapEditor } from '@/components/curator/MapEditor';
import { IconBack } from '@/components/Icons';

export const dynamic = 'force-dynamic';

/** S9 Map editor [P0-lite]. 클라이언트가 정의한 맵 작성의 3요소만 담는다. */
export default async function NewMap() {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) notFound();

  const { data: me } = await db.from('users')
    .select('role,curator_tier').eq('id', user.id).maybeSingle();
  if (!me || (me.role !== 'curator' && me.role !== 'admin')) notFound();

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/curator" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">New map</span>
      </header>

      <main className="view pad">
        <MapEditor tier={me.curator_tier as 'resident' | 'guest' | null} />
      </main>
    </>
  );
}
