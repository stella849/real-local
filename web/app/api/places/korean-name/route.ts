import { createClient, getUser } from '@/lib/supabase/server';
import { hasHangul } from '@/lib/romanize';

/**
 * 실제로 담기로 고른 장소 1건에 대해서만 한글 상호를 추가 조회한다.
 *
 * /api/places/search 는 languageCode=en 으로 부르므로, 구글에 그
 * 장소의 영문 표기가 있으면 name_ko 가 비어 있다(로마자 폴백은 표기가
 * 없을 때만 동작). 검색 결과 5개마다 한국어로 한 번씩 더 물으면 과금이
 * 배로 늘어나므로, Add 를 누른 이 장소 하나에 대해서만 여기서 묻는다
 * (장소 상세 페이지에 한글 상호가 항상 뜨게 해달라는 요청).
 */
export async function POST(req: Request) {
  const db = await createClient();
  const user = await getUser(db);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'curator' && me?.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!key) return Response.json({ error: 'search not configured' }, { status: 503 });

  const { placeId } = await req.json().catch(() => ({ placeId: '' }));
  const id = String(placeId ?? '').trim();
  if (!id) return Response.json({ name_ko: null });

  const res = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=ko`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'displayName',
    },
  });
  if (!res.ok) return Response.json({ name_ko: null });

  const j = await res.json() as { displayName?: { text?: string } };
  const raw = j.displayName?.text ?? '';
  return Response.json({ name_ko: hasHangul(raw) ? raw : null });
}
