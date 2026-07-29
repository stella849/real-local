/**
 * 구글 사진 프록시 — /api/photo/places/{placeId}/photos/{ref}?w=800
 *
 * 사진은 저장하지 않고 참조만 보관한다 (§6.1). 약관상 place_id 는 무기한
 * 보관할 수 있으나 사진 파일은 그렇지 않다.
 *
 * 이 라우트가 존재하는 이유는 두 가지다.
 *   1) Places 사진은 서버 전용 키가 필요하다. 브라우저에서 직접 부르면
 *      그 키가 노출되고, 노출된 키로 우리 결제 계정이 호출된다.
 *   2) 캐시. 실제 비용은 시드(일회성)가 아니라 렌더링에서 나온다.
 *      여기 Cache-Control 이 방어의 핵심이다 (§6.5).
 *
 * photo_ref 는 'places/{id}/photos/{ref}' 처럼 슬래시를 포함하므로
 * 캐치올 세그먼트로 받는다.
 */
export const revalidate = 86400;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ ref: string[] }> },
) {
  const { ref } = await ctx.params;
  const name = ref.join('/');

  if (!name.startsWith('places/') || !name.includes('/photos/')) {
    return new Response('bad photo reference', { status: 400 });
  }

  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!key) return new Response('photo proxy not configured', { status: 503 });

  const w = Number(new URL(req.url).searchParams.get('w') ?? 800);
  const width = Number.isFinite(w) ? Math.min(Math.max(w, 100), 1600) : 800;

  const upstream = await fetch(
    `https://places.googleapis.com/v1/${name}/media`
    + `?maxWidthPx=${width}&key=${key}&skipHttpRedirect=false`,
    { redirect: 'follow' },
  );

  // 실패해도 깨진 이미지 아이콘을 내보내지 않는다. 호출부가 폴백을 그린다 (§6.3).
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
    },
  });
}
