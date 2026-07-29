import { createClient } from './supabase/server';

/**
 * 현재 사용자가 저장한 맵·장소 id 집합.
 *
 * 비로그인이면 빈 집합을 준다 — 저장 버튼은 그대로 그리되 누르는 순간
 * 로그인으로 보낸다. 버튼을 숨기면 저장이 가능한 서비스라는 것 자체를
 * 알 수 없다.
 *
 * RLS 가 본인 행만 돌려주므로 user_id 조건을 따로 걸지 않는다.
 */
export async function getSaved() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { maps: new Set<string>(), places: new Set<string>(), user: null };

  const [{ data: m }, { data: p }] = await Promise.all([
    db.from('saved_maps').select('map_id'),
    db.from('saved_places').select('place_id'),
  ]);

  return {
    maps: new Set((m ?? []).map((r) => r.map_id as string)),
    places: new Set((p ?? []).map((r) => r.place_id as string)),
    user,
  };
}
