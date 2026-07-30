'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type DraftPlace = {
  google_place_id: string;
  name_en: string;
  address: string;
  lat: number;
  lng: number;
  curator_note: string;
  photo_ref: string | null;
  photo_attribution: string | null;
  photo_candidates: { name: string; attribution: string | null }[];
};

type Result = { ok: true; slug: string } | { ok: false; error: string };

const slugify = (s: string) =>
  s.toLowerCase().replace(/[’'"]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60);

type Validated =
  | { ok: true; title: string; one_liner: string }
  | { ok: false; error: string };

function validateDraft(input: { title: string; one_liner: string; places: DraftPlace[]; publish: boolean }): Validated {
  const title = input.title.trim();
  const one_liner = input.one_liner.trim();
  if (!title) return { ok: false, error: 'A title is required.' };
  if (!one_liner) return { ok: false, error: 'A one-line description is required.' };

  // tip 은 필수다 — 이 앱의 상품 그 자체다 (§5 S9)
  if (input.places.some((p) => !p.curator_note.trim())) {
    return { ok: false, error: 'Every place needs your tip.' };
  }

  /* 발행에는 장소 최소 4개. 임시저장은 개수 제한이 없다 (§5 S9).
     4개인 이유는 커버가 2×2 콜라주이기 때문만은 아니다 — 3곳짜리
     '모음집'은 모음집으로 읽히지 않는다. */
  if (input.publish && input.places.length < 4) {
    return { ok: false, error: 'Add at least 4 places to publish.' };
  }

  return { ok: true, title, one_liner };
}

function placeRows(mapId: string, places: DraftPlace[]) {
  // 순서 = 등록순. 편집 UI 는 없고 삭제만 가능하다 (§5 S9)
  return places.map((p, i) => ({
    map_id: mapId,
    order: i + 1,
    name_en: p.name_en,
    address: p.address || null,
    lat: p.lat,
    lng: p.lng,
    google_place_id: p.google_place_id,
    curator_note: p.curator_note.trim(),
    photo_ref: p.photo_ref,
    photo_attribution: p.photo_attribution,
    photo_candidates: p.photo_candidates,
    category: 'other',        // 어드민이 사후 보정한다 (§11.2)
  }));
}

/**
 * 맵 생성 (F13, §5 S9).
 *
 * 발행 시 상태 결정은 트리거가 아니라 여기서 한다 — curator_tier 를 읽어
 * 분기한다. 로직이 보이는 곳에 있어야 디버깅된다 (§9 설계 노트).
 */
export async function createMap(input: {
  title: string;
  one_liner: string;
  concept_tag: string;
  places: DraftPlace[];
  publish: boolean;
}): Promise<Result> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, error: 'Sign in first.' };

    const { data: me } = await db.from('users')
      .select('role,curator_tier').eq('id', user.id).maybeSingle();
    if (me?.role !== 'curator' && me?.role !== 'admin') {
      return { ok: false, error: 'Only curators can make maps.' };
    }

    const v = validateDraft(input);
    if (!v.ok) return v;

    /* resident 는 발행 즉시 published, guest 는 pending → 어드민 승인.
       등급 차이는 신뢰도가 아니라 업무 절차다 (§3.2). */
    const status = !input.publish
      ? 'draft'
      : (me.curator_tier === 'resident' || me.role === 'admin') ? 'published' : 'pending';

    // slug 충돌은 뒤에 숫자를 붙여 피한다. 공개 주소라 나중에 못 바꾼다.
    const base = slugify(v.title) || 'map';
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { data: taken } = await db.from('maps').select('id').eq('slug', slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${i}`;
    }

    const { data: map, error: e1 } = await db.from('maps').insert({
      slug,
      curator_id: user.id,
      title: v.title,
      one_liner: v.one_liner,
      concept_tag: input.concept_tag.trim() || null,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    }).select('id,slug').single();

    if (e1 || !map) return { ok: false, error: e1?.message ?? 'Could not create the map.' };

    if (input.places.length) {
      const { error: e2 } = await db.from('places').insert(placeRows(map.id, input.places));
      if (e2) return { ok: false, error: e2.message };
    }

    revalidatePath('/curator');
    revalidatePath('/');
    return { ok: true, slug: map.slug };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Draft·rejected 재편집 저장 (F13 후속).
 *
 * status 가 draft 또는 rejected 인 본인 맵만 대상이다 — pending·published·
 * hidden 은 이 경로로 건드리지 않는다(재승인·재공개 규칙이 달라 별도 스코프).
 * rejected 를 고쳐 다시 내면 review_note(반려 사유)를 지운다 — 옛 사유가
 * 새 내용에 대한 것처럼 남아있으면 안 된다.
 *
 * 장소는 통째로 지웠다 다시 넣는다. draft·rejected 상태에서만 걸리는
 * DELETE RLS 정책(`places_delete_draft`, supabase/schema.sql)이 있어
 * 가능하다 — 발행된 장소는 여전히 삭제할 수 없다. id 단위로 diff 하는
 * 것보다 훨씬 단순하고, 어차피 순서는 매번 배열 인덱스로 다시 매긴다.
 */
export async function updateMap(input: {
  mapId: string;
  title: string;
  one_liner: string;
  concept_tag: string;
  places: DraftPlace[];
  publish: boolean;
}): Promise<Result> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, error: 'Sign in first.' };

    const { data: me } = await db.from('users')
      .select('role,curator_tier').eq('id', user.id).maybeSingle();
    if (me?.role !== 'curator' && me?.role !== 'admin') {
      return { ok: false, error: 'Only curators can make maps.' };
    }

    const { data: existing } = await db.from('maps')
      .select('id,slug,curator_id,status').eq('id', input.mapId).maybeSingle();
    if (!existing || existing.curator_id !== user.id) {
      return { ok: false, error: 'Not your map.' };
    }
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return { ok: false, error: 'This map can no longer be edited here.' };
    }

    const v = validateDraft(input);
    if (!v.ok) return v;

    const status = !input.publish
      ? 'draft'
      : (me.curator_tier === 'resident' || me.role === 'admin') ? 'published' : 'pending';

    // 맵 상태를 바꾸기 전에 지웠다 넣는다 — DELETE 정책이 draft 에만
    // 걸려 있으므로 순서를 바꾸면 publish 시 삭제가 막힌다.
    const { error: eDel } = await db.from('places').delete().eq('map_id', input.mapId);
    if (eDel) return { ok: false, error: eDel.message };

    if (input.places.length) {
      const { error: e2 } = await db.from('places').insert(placeRows(input.mapId, input.places));
      if (e2) return { ok: false, error: e2.message };
    }

    const { error: e1 } = await db.from('maps').update({
      title: v.title,
      one_liner: v.one_liner,
      concept_tag: input.concept_tag.trim() || null,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      review_note: null,   // 반려 사유는 옛 내용에 대한 것이라 재제출 시 지운다
    }).eq('id', input.mapId);
    if (e1) return { ok: false, error: e1.message };

    revalidatePath('/curator');
    revalidatePath('/');
    return { ok: true, slug: existing.slug };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
