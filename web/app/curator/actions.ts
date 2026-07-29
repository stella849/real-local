'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** 큐레이터 본인용 동작 (F15). */

async function requireCurator() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('not signed in');

  const { data: me } = await db.from('users')
    .select('role,handle').eq('id', user.id).maybeSingle();
  if (me?.role !== 'curator' && me?.role !== 'admin') throw new Error('not a curator');

  return { db, me, userId: user.id };
}

type Result = { ok: true } | { ok: false; error: string };

/**
 * 자기 소개 저장.
 *
 * handle 은 여기서 받지 않는다 — 공개 주소(/curators/mimyo)라 바꾸면
 * 이미 공유된 링크가 전부 깨진다. 어드민이 지정하고 이후 고정이다 (§9).
 * role·curator_tier 도 마찬가지로 본인이 못 바꾼다. RLS 는 컬럼 단위
 * 제한을 표현할 수 없으므로 여기서 강제한다.
 */
export async function saveMyProfile(form: {
  display_name: string; byline: string; about: string;
}): Promise<Result> {
  try {
    const { db, me, userId } = await requireCurator();

    if (form.byline.length > 60) return { ok: false, error: 'Byline must be 60 characters or fewer.' };
    if (form.about.length > 300) return { ok: false, error: 'About must be 300 characters or fewer.' };

    const { error } = await db.from('users').update({
      display_name: form.display_name.trim() || null,
      byline: form.byline.trim() || null,
      about: form.about.trim() || null,
    }).eq('id', userId);

    if (error) return { ok: false, error: error.message };

    revalidatePath('/curator');
    if (me.handle) revalidatePath(`/curators/${me.handle}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 아바타 URL 저장. 업로드 자체는 브라우저가 Storage 로 직접 한다. */
export async function saveMyAvatar(url: string): Promise<Result> {
  try {
    const { db, me, userId } = await requireCurator();
    const { error } = await db.from('users').update({ avatar_url: url }).eq('id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/curator');
    if (me.handle) revalidatePath(`/curators/${me.handle}`);
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 자기 맵 비공개 전환. 삭제는 없다 (§3.3).
 *
 * 다시 올릴 때 승인 절차를 타지 않는다 — 내린 주체가 본인이고,
 * 이미 한 번 승인된 맵이기 때문이다.
 */
export async function setMyMapVisibility(mapId: string, hide: boolean): Promise<Result> {
  try {
    const { db, userId } = await requireCurator();

    const { data: m } = await db.from('maps')
      .select('curator_id,status').eq('id', mapId).maybeSingle();
    if (!m || m.curator_id !== userId) return { ok: false, error: 'Not your map.' };
    if (!['published', 'hidden'].includes(m.status)) {
      return { ok: false, error: 'Only a published map can be hidden.' };
    }

    const { error } = await db.from('maps')
      .update({ status: hide ? 'hidden' : 'published' }).eq('id', mapId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/curator');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
