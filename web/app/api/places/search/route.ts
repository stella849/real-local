import { createClient, getUser } from '@/lib/supabase/server';
import { hasHangul, romanize } from '@/lib/romanize';

type RawPhoto = { name: string; authorAttributions?: { displayName?: string }[] };
type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: RawPhoto[];
};

/**
 * 맵 에디터의 장소 검색 (§5 S9).
 *
 * 서버를 경유하는 이유는 두 가지다.
 *   1) 브라우저에서 Places 를 직접 부르면 서버 키가 노출된다
 *   2) 큐레이터가 아닌 사람이 우리 결제 계정으로 검색을 돌릴 수 없어야 한다
 *
 * 과금 규칙 (§5 S9 · §6.5):
 *   · 디바운스 300ms 는 클라이언트가 건다 — 매 타건마다 부르지 않는다
 *   · 세션 토큰으로 검색~선택을 한 세션으로 묶어 과금을 1회로 만든다
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

  const { query, sessionToken } = await req.json().catch(() => ({ query: '' }));
  const q = String(query ?? '').trim();
  if (q.length < 2) return Response.json({ places: [] });

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
      ...(sessionToken ? { 'X-Goog-Session-Token': String(sessionToken) } : {}),
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: 'en',
      regionCode: 'KR',
      maxResultCount: 5,          // 결과 5개까지 (§5 S9)
    }),
  });

  if (!res.ok) {
    return Response.json({ error: 'search failed' }, { status: 502 });
  }

  const j = await res.json() as { places?: RawPlace[] };
  const places = (j.places ?? []).map((p) => {
    const raw = p.displayName?.text ?? '';
    // languageCode=en 을 걸어도 그 장소에 영문 로컬라이즈가 없으면 구글이
    // 그냥 원래(한글) 이름을 돌려준다. 그대로 name_en 에 심으면 목록에
    // 한글 상호가 노출된다(R3 위반) — 로마자로 바꾸고, 원래 한글은
    // name_ko 로 살려 둔다. 검색 결과 자체가 이미 한글일 때만이다.
    const korean = hasHangul(raw);
    return {
      id: p.id,
      name: korean ? romanize(raw) : raw,
      name_ko: korean ? raw : null,
      address: p.formattedAddress ?? '',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      // 사진은 추가 시점에 자동 수집한다. 큐레이터가 고르지 않는다 (§5 S9)
      photo: p.photos?.[0]?.name ?? null,
      attribution: p.photos?.[0]?.authorAttributions?.[0]?.displayName ?? null,
      candidates: (p.photos ?? []).slice(0, 10).map((x) => ({
        name: x.name,
        attribution: x.authorAttributions?.[0]?.displayName ?? null,
      })),
    };
  });

  return Response.json({ places });
}
