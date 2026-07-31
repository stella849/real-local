'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';

/**
 * 어드민 동작 (F9 · F10 · F11 · F16).
 *
 * service_role 을 쓰지 않는다. 어드민의 자기 세션으로 실행하고 RLS 의
 * is_admin() 이 통과시킨다 — service_role 을 서버 액션에 들이면 정책이
 * 통째로 무력화되고, 버그 하나가 전 회원 데이터로 이어진다.
 */

async function requireAdmin() {
  const db = await createClient();
  const user = await getUser(db);
  if (!user) throw new Error('not signed in');

  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') throw new Error('not an admin');

  return { db, adminId: user.id };
}

type Result = { ok: true } | { ok: false; error: string };

/**
 * 회원의 역할·등급 변경 (F9).
 *
 * 큐레이터로 지정할 때는 프로필 URL(handle)이 반드시 있어야 한다 —
 * 없는 채로 두면 그 큐레이터가 맵을 발행해도 본인 페이지가 없어
 * 확인할 방법이 없다. handle 은 어드민만 지정하고 이후 고정이다
 * (curator/actions.ts saveMyProfile 주석 §9) — 큐레이터 본인이 나중에
 * 채우게 두지 않고 승격 시점에 여기서 강제한다.
 */
export async function setRole(
  userId: string,
  role: 'user' | 'curator' | 'admin',
  tier: 'resident' | 'guest' | null,
  handle?: string,
): Promise<Result> {
  try {
    const { db, adminId } = await requireAdmin();

    // 어드민은 자기 자신의 역할을 바꿀 수 없다 (§3.4).
    // 화면에서도 콤보박스를 잠그지만 서버에서 한 번 더 막는다 —
    // 실수로 자기를 강등하면 아무도 어드민에 접근할 수 없게 된다.
    if (userId === adminId) return { ok: false, error: 'You cannot change your own role.' };

    const { data: target } = await db.from('users')
      .select('auth_provider, role, handle').eq('id', userId).maybeSingle();
    if (!target) return { ok: false, error: 'Member not found.' };

    /* 큐레이터·어드민은 구글 전용이다 (§3.1). 같은 이메일로 이메일 가입과
       구글 로그인을 각각 하면 별개 계정이 생길 수 있고, 큐레이터 계정이
       갈리면 맵 소유권과 어드민 접근이 예전 계정에 남아 사고가 된다. */
    if (role !== 'user' && target.auth_provider !== 'google') {
      return { ok: false, error: 'Curators must sign in with Google.' };
    }

    const patch: Record<string, unknown> = { role };
    if (role === 'curator') {
      patch.curator_tier = tier ?? 'guest';

      const trimmed = (handle ?? '').trim().toLowerCase();
      const nextHandle = trimmed || target.handle;
      if (!nextHandle) {
        return { ok: false, error: 'Set a profile URL (handle) to make this member a curator.' };
      }
      if (trimmed) {
        if (!/^[a-z0-9-]{2,30}$/.test(trimmed)) {
          return { ok: false, error: 'Handle must be 2-30 characters: a-z, 0-9, hyphen.' };
        }
        patch.handle = trimmed;
      }
    } else {
      patch.curator_tier = null;
      // 강등 시 curator_listed 도 자동으로 false 가 된다 (§3.4).
      // 맵은 자동으로 내리지 않는다 — 자격을 회수한 것이지 콘텐츠가
      // 틀린 게 아니고, 내리면 사용자의 저장 목록에 구멍이 난다.
      if (role === 'user') patch.curator_listed = false;
    }

    const { error } = await db.from('users').update(patch).eq('id', userId);
    if (error) {
      return { ok: false, error: error.code === '23505' ? 'That handle is taken.' : error.message };
    }

    revalidatePath('/admin');
    revalidatePath('/');
    if (typeof patch.handle === 'string') revalidatePath(`/curators/${patch.handle}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 큐레이터 프로필 편집 + 은퇴 토글 (F16) */
export async function saveCuratorProfile(userId: string, form: {
  handle: string; display_name: string; byline: string; about: string; listed: boolean;
}): Promise<Result> {
  try {
    const { db } = await requireAdmin();

    const handle = form.handle.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(handle)) {
      return { ok: false, error: 'Handle must be 2-30 characters: a-z, 0-9, hyphen.' };
    }

    const { error } = await db.from('users').update({
      handle,
      display_name: form.display_name.trim() || null,
      byline: form.byline.trim() || null,
      about: form.about.trim() || null,
      curator_listed: form.listed,
    }).eq('id', userId);

    if (error) {
      return { ok: false, error: error.code === '23505' ? 'That handle is taken.' : error.message };
    }

    revalidatePath('/admin');
    revalidatePath(`/curators/${handle}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 승인 (F10) */
export async function approveMap(mapId: string): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from('maps')
      .update({ status: 'published', published_at: new Date().toISOString(), review_note: null })
      .eq('id', mapId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 반려 (F10). 사유는 필수다 — 없으면 큐레이터가 무엇을 고쳐야 할지 모른다. */
export async function rejectMap(mapId: string, note: string): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    if (!note.trim()) return { ok: false, error: 'A reason is required to reject.' };

    const { error } = await db.from('maps')
      .update({ status: 'rejected', review_note: note.trim() }).eq('id', mapId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 공개 / 비공개 전환 (F11).
 *
 * 삭제는 만들지 않는다. 삭제는 장소·저장 기록·후기를 함께 파괴하며
 * 되돌릴 수 없다. DB 에도 DELETE 정책이 없어 강제된다 (§3.3).
 *
 * hidden → published 복구는 승인 절차를 다시 타지 않는다. 내린 주체가
 * 어드민이기 때문이다.
 */
export async function setMapVisibility(mapId: string, hide: boolean): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from('maps')
      .update({ status: hide ? 'hidden' : 'published' }).eq('id', mapId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 지역 지정 (F17, PRD v1.4 §1). 어드민만 — 큐레이터가 오탈자·중복
 * 표기("성수"/"성수동")를 만들지 않도록. 빈 문자열은 null 로 저장해
 * 홈의 "Nationwide" 묶음으로 보낸다.
 */
export async function setMapRegion(mapId: string, region: string): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from('maps')
      .update({ region: region.trim() || null }).eq('id', mapId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 후기 삭제 (F19, PRD v1.4 §3).
 *
 * 등록 시점 키워드 필터(lib/moderation.ts)를 통과했더라도 문제가
 * 있으면 여기서 지운다 — 진짜 안전망은 이거다. "write own review" 등
 * 기존 정책은 본인만 지울 수 있게 했지 어드민에게는 권한을 준 적이
 * 없었다(신규 정책 필요, supabase/migrations 참조).
 */
export async function deleteReview(reviewId: string): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from('map_reviews').delete().eq('id', reviewId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 사진 교체 (F11) — photo_candidates 중에서 고른다 */
export async function setPlacePhoto(placeId: string, ref: string): Promise<Result> {
  try {
    const { db } = await requireAdmin();
    const { error } = await db.from('places').update({ photo_ref: ref }).eq('id', placeId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
