'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconBookmark } from './Icons';

/**
 * 맵 저장 · 장소 저장 (F5).
 *
 * 둘은 완전히 독립이다 — 장소를 저장해도 그 맵이 저장되지 않는다.
 *
 * 비로그인이면 로그인으로 보내되 `next` 에 현재 주소를 실어 보낸다.
 * 저장하려다 튕긴 사람이 홈으로 떨어지면 무엇을 하려 했는지 잊는다.
 */
export function SaveButton({ kind, id, mapId, saved: initial }: {
  kind: 'map' | 'place';
  id: string;
  /** 장소 저장에는 '이 맵에서 저장함' 문맥이 함께 들어간다 */
  mapId?: string;
  saved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);

    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname);
      router.push(`/signin?next=${next}`);
      return;
    }

    const table = kind === 'map' ? 'saved_maps' : 'saved_places';
    const key = kind === 'map' ? { map_id: id } : { place_id: id };

    // 낙관적 갱신. 실패하면 되돌린다.
    setSaved(!saved);

    const { error } = saved
      ? await db.from(table).delete().match({ user_id: user.id, ...key })
      : await db.from(table).insert({
          user_id: user.id,
          ...key,
          ...(kind === 'place' && mapId ? { map_id: mapId } : {}),
        });

    if (error) setSaved(saved);
    else router.refresh();
    setBusy(false);
  }

  return (
    <button
      className="act"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save'}
    >
      <IconBookmark filled={saved} />
    </button>
  );
}
