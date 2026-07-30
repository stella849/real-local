'use client';

import { useState, useTransition } from 'react';
import { setPlacePhoto } from '@/app/admin/actions';
import { photoUrl } from '@/lib/types';
import { IconCheck } from '@/components/Icons';

export type Candidate = { name: string; attribution: string | null };

/**
 * 사진 교체 (F11). photo_candidates 에 담아 둔 최대 10장 중에서 고른다.
 *
 * 시드가 구글에서 못 찾은 장소는 후보가 비어 있다. CSV 의 영문 상호가
 * 한글을 기계로 로마자 변환한 것이라 구글에 그런 이름이 없기 때문이다.
 * 그런 행은 여기서 고칠 수 없고 이니셜 폴백으로 남는다 — 사진을 틀리게
 * 붙이는 것보다 낫다.
 */
/**
 * 클릭 즉시 저장한다 — 별도 저장 버튼을 두지 않는다. 후보가 최대
 * 10장이라 "고르고 → 저장 버튼 찾기"가 오히려 단계를 늘린다. 대신
 * 저장이 실제로 일어났다는 걸 눈에 보이게 한다 — 선택된 사진에 체크
 * 배지를 얹고, 방금 바뀐 직후에는 "Saved" 문구를 잠깐 띄운다.
 */
export function PhotoPicker({ placeId, current, candidates }: {
  placeId: string;
  current: string | null;
  candidates: Candidate[];
}) {
  const [ref, setRef] = useState(current);
  const [justSaved, setJustSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!candidates.length) {
    return <p className="admin-hint">No candidates — this place was not matched on Google.</p>;
  }

  return (
    <div>
      <div className="photo-strip">
        {candidates.map((c) => (
          <button
            key={c.name}
            className="photo-option"
            aria-pressed={ref === c.name}
            disabled={pending}
            title={c.attribution ?? undefined}
            onClick={() => start(async () => {
              setErr(null);
              const r = await setPlacePhoto(placeId, c.name);
              if (r.ok) {
                setRef(c.name);
                setJustSaved(true);
                setTimeout(() => setJustSaved(false), 2000);
              } else {
                setErr(r.error);
              }
            })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(c.name, 160)} alt="" loading="lazy" />
            {ref === c.name && <IconCheck className="photo-check" />}
          </button>
        ))}
      </div>
      {justSaved && <p className="admin-hint">Saved.</p>}
      {err && <p className="form-error" style={{ minHeight: 0 }}>{err}</p>}
    </div>
  );
}
