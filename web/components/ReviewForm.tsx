'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconStar } from './Icons';

/**
 * 맵 단위 후기 (F6). 장소별 후기는 스코프 밖이다 (§4.3).
 * 한 사람이 한 맵에 하나 — unique (user_id, map_id) 라 upsert 한다.
 *
 * author_name 을 행에 복제해 넣는다. users 에 본인 행만 보이는 정책이
 * 걸려 있어(§9) 다른 사람의 표시 이름을 조인으로 가져올 수 없다.
 */
export function ReviewForm({ mapId, mine }: {
  mapId: string;
  mine: { rating: number; body: string } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) { setErr('Pick a rating first.'); return; }
    setBusy(true); setErr(null);

    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const { data: me } = await db.from('users')
      .select('display_name').eq('id', user.id).maybeSingle();

    const { error } = await db.from('map_reviews').upsert({
      user_id: user.id,
      map_id: mapId,
      author_name: me?.display_name ?? user.email?.split('@')[0] ?? 'Someone',
      rating,
      body: body.trim(),
    }, { onConflict: 'user_id,map_id' });

    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="pad">
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-xs)' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating >= n}
            style={{
              color: rating >= n ? 'var(--accent)' : 'var(--line-strong)',
              width: 30, height: 30,
            }}>
            <IconStar />
          </button>
        ))}
      </div>
      <textarea className="field" required maxLength={1000} rows={3}
        placeholder="What was it like to follow this map?"
        value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="form-error">{err}</p>
      <div className="row-end">
        <button className="btn btn-dark sm" type="submit" disabled={busy}>
          {mine ? 'Update review' : 'Post review'}
        </button>
      </div>
    </form>
  );
}
