import { photoUrl, initial } from '@/lib/types';

/**
 * 맵 커버 — 소속 장소 사진 4장의 2×2 콜라주 (§6.4).
 *
 * 큐레이터 프로필 사진을 쓰면 같은 사람의 맵이 홈에서 전부 똑같아 보이고,
 * 한 장만 쓰면 23곳짜리 맵이 식당 한 곳처럼 읽힌다. 4장이 붙으면
 * '모음집'이라는 것이 설명 없이 전달된다.
 *
 * 구글 사진은 톤이 제각각인데 그것을 맞추지 않는다 — 오히려 스크랩북처럼
 * 읽혀 handmade 컨셉과 맞는다. 필터·톤 보정은 반려 항목이다 (§10.1).
 */
export function Collage({
  refs, title, cover, sizes = '(max-width: 520px) 100vw, 480px',
}: {
  refs: string[];
  title: string;
  /** 큐레이터·어드민이 한 장으로 덮어쓴 경우 (§6.4 cover_place_id) */
  cover?: string | null;
  sizes?: string;
}) {
  const list = cover ? [cover] : refs.slice(0, 4);
  const n = list.length;

  // 0장 — 베이지 + 맵 제목 이니셜. 깨진 이미지 아이콘은 금지 (§6.3)
  if (n === 0) {
    return <div className="collage" data-n="0" aria-hidden>{initial(title)}</div>;
  }

  return (
    <div className="collage" data-n={n}>
      {list.map((ref, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={ref}
          src={photoUrl(ref, n === 1 ? 800 : 400)}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          sizes={sizes}
        />
      ))}
    </div>
  );
}
