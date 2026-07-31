'use client';

import { useEffect, useRef, useState } from 'react';
import { resolvePhotoUrl, type PlacePhoto } from '@/lib/types';

/**
 * 상세 페이지 사진 캐러셀 (PRD v1.4 §4.1). 여러 장을 옆으로 스와이프해
 * 보는데, 출처 표기는 의무라(§6.1) 사진마다 값이 다를 수 있는 attribution
 * 을 스와이프에 맞춰 갱신해야 한다 — 대표 사진 출처 하나만 고정으로
 * 보여주면 다른 사진으로 넘어갔을 때 틀린 출처가 남는다.
 *
 * IntersectionObserver 로 현재 보이는 사진을 추적한다. 이 캐러셀은
 * 가운데 사진이 좌우로 살짝 옆 사진을 보여주는 'peek' 레이아웃(각 항목이
 * 컨테이너 폭의 92%)이라 scrollLeft 를 clientWidth 로 나누는 방식은
 * 인덱스가 어긋난다 — 각 이미지 자체를 관찰하는 편이 레이아웃 폭에
 * 관계없이 정확하다.
 */
export function PlaceCarousel({ photos }: { photos: PlacePhoto[] }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const root = trackRef.current;
    if (!root || photos.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.intersectionRatio > 0);
        if (visible.length === 0) return;
        const best = visible.reduce((a, b) => (b.intersectionRatio > a.intersectionRatio ? b : a));
        const idx = Number((best.target as HTMLElement).dataset.idx);
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );
    imgRefs.current.forEach((img) => img && observer.observe(img));
    return () => observer.disconnect();
  }, [photos.length]);

  if (photos.length === 0) return null;

  const current = photos[active];
  const single = photos.length === 1;

  return (
    <>
      <div className={`photo-carousel${single ? ' single' : ''}`} ref={trackRef}>
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.ref}
            ref={(el) => { imgRefs.current[i] = el; }}
            data-idx={i}
            src={resolvePhotoUrl(p.ref, 900)}
            alt=""
            loading={i === 0 ? undefined : 'lazy'}
          />
        ))}
      </div>
      {/* 큐레이터 직접 업로드(http URL)는 구글 사진이 아니라 출처 줄을
          아예 숨긴다 — attribution 이 null 이라고 "Photo: Google" 만
          남기면 없는 출처를 있는 것처럼 보여주게 된다. */}
      {!current.ref.startsWith('http') && (
        <p className="photo-credit">
          Photo: Google{current.attribution ? ` / ${current.attribution}` : ''}
        </p>
      )}
    </>
  );
}
