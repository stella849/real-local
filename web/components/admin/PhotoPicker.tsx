'use client';

import { useState, useTransition } from 'react';
import { setPlacePhoto } from '@/app/admin/actions';
import { photoUrl } from '@/lib/types';

export type Candidate = { name: string; attribution: string | null };

/**
 * 사진 교체 (F11). photo_candidates 에 담아 둔 최대 10장 중에서 고른다.
 *
 * 시드가 구글에서 못 찾은 장소는 후보가 비어 있다. CSV 의 영문 상호가
 * 한글을 기계로 로마자 변환한 것이라 구글에 그런 이름이 없기 때문이다.
 * 그런 행은 여기서 고칠 수 없고 이니셜 폴백으로 남는다 — 사진을 틀리게
 * 붙이는 것보다 낫다.
 */
export function PhotoPicker({ placeId, current, candidates }: {
  placeId: string;
  current: string | null;
  candidates: Candidate[];
}) {
  const [ref, setRef] = useState(current);
  const [pending, start] = useTransition();

  if (!candidates.length) {
    return <p className="admin-hint">No candidates — this place was not matched on Google.</p>;
  }

  return (
    <div className="photo-strip">
      {candidates.map((c) => (
        <button
          key={c.name}
          className="photo-option"
          aria-pressed={ref === c.name}
          disabled={pending}
          title={c.attribution ?? undefined}
          onClick={() => start(async () => {
            const r = await setPlacePhoto(placeId, c.name);
            if (r.ok) setRef(c.name);
          })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(c.name, 160)} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}
