'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import type { PlacePhoto } from '@/lib/types';

export type DraftPlace = {
  google_place_id: string;
  name_en: string;
  name_ko: string | null;
  address: string;
  lat: number;
  lng: number;
  curator_note: string;
  photo_ref: string | null;
  photo_attribution: string | null;
  photo_candidates: { name: string; attribution: string | null }[];
};

type Result = { ok: true; slug: string; status: string } | { ok: false; error: string };

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
    name_ko: p.name_ko,
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
    const user = await getUser(db);
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
    return { ok: true, slug: map.slug, status };
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
    const user = await getUser(db);
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
    return { ok: true, slug: existing.slug, status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * 이미 나간(published·pending·hidden) 맵 수정.
 *
 * draft·rejected 재편집(updateMap)과 방식이 다르다 — 그쪽은 장소를
 * 통째로 지웠다 다시 넣지만, places_delete_draft 정책이 이 세 상태의
 * 장소는 삭제를 막는다(§3.3과 같은 원칙: 한 번 나간 콘텐츠는 지우지
 * 않는다). 그래서 기존 장소는 UPDATE(팁 수정)만 하고, 새 장소는
 * INSERT로 뒤에 덧붙인다. 순서 재배치·삭제는 여기서 다루지 않는다.
 */
export async function updateLiveMap(input: {
  mapId: string;
  title: string;
  one_liner: string;
  concept_tag: string;
  tips: { id: string; curator_note: string }[];
  newPlaces: DraftPlace[];
}): Promise<Result> {
  try {
    const db = await createClient();
    const user = await getUser(db);
    if (!user) return { ok: false, error: 'Sign in first.' };

    const { data: existing } = await db.from('maps')
      .select('id,slug,curator_id,status').eq('id', input.mapId).maybeSingle();
    if (!existing || existing.curator_id !== user.id) {
      return { ok: false, error: 'Not your map.' };
    }
    if (!['published', 'pending', 'hidden'].includes(existing.status)) {
      return { ok: false, error: 'Use the draft editor for this map.' };
    }

    const title = input.title.trim();
    const one_liner = input.one_liner.trim();
    if (!title) return { ok: false, error: 'A title is required.' };
    if (!one_liner) return { ok: false, error: 'A one-line description is required.' };
    if (input.tips.some((t) => !t.curator_note.trim())) {
      return { ok: false, error: 'Every place needs your tip.' };
    }
    if (input.newPlaces.some((p) => !p.curator_note.trim())) {
      return { ok: false, error: 'Every place needs your tip.' };
    }

    const { error: e1 } = await db.from('maps').update({
      title, one_liner, concept_tag: input.concept_tag.trim() || null,
    }).eq('id', input.mapId);
    if (e1) return { ok: false, error: e1.message };

    for (const t of input.tips) {
      const { error } = await db.from('places')
        .update({ curator_note: t.curator_note.trim() })
        .eq('id', t.id).eq('map_id', input.mapId);
      if (error) return { ok: false, error: error.message };
    }

    if (input.newPlaces.length) {
      const { count } = await db.from('places')
        .select('id', { count: 'exact', head: true }).eq('map_id', input.mapId);
      const rows = placeRows(input.mapId, input.newPlaces)
        .map((r, i) => ({ ...r, order: (count ?? 0) + i + 1 }));
      const { error: e2 } = await db.from('places').insert(rows);
      if (e2) return { ok: false, error: e2.message };
    }

    revalidatePath('/curator');
    revalidatePath('/');
    revalidatePath(`/maps/${existing.slug}`);
    revalidatePath(`/admin/preview/${existing.slug}`);
    return { ok: true, slug: existing.slug, status: existing.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type SimpleResult = { ok: true } | { ok: false; error: string };

/**
 * 장소 사진 갤러리 설정 (F20.1, PRD v1.4 §4). admin/actions.ts 의
 * 어드민 전용 액션들과 달리 그 맵의 큐레이터 본인도 쓸 수 있어야 해서
 * 여기 둔다 — 소유자 확인이 필요하다. places_update RLS 정책이 이미
 * "본인 맵의 장소 또는 어드민"을 허용하므로 여기서는 같은 조건을
 * 앱에서도 확인해 더 친절한 에러 메시지를 준다.
 */
export async function setPlacePhotos(placeId: string, refs: PlacePhoto[]): Promise<SimpleResult> {
  try {
    const db = await createClient();
    const user = await getUser(db);
    if (!user) return { ok: false, error: 'Sign in first.' };

    const { data: place } = await db.from('places').select('map_id').eq('id', placeId).maybeSingle();
    if (!place) return { ok: false, error: 'Place not found.' };

    const { data: map } = await db.from('maps').select('curator_id').eq('id', place.map_id).maybeSingle();
    const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
    const isAdmin = me?.role === 'admin';
    if (!isAdmin && map?.curator_id !== user.id) return { ok: false, error: 'Not your place.' };

    const { error } = await db.from('places').update({ photo_refs: refs }).eq('id', placeId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
