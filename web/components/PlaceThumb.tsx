import { photoUrl } from '@/lib/types';
import { IconMeal } from './Icons';

/**
 * 장소 목록 썸네일. 사진이 없으면 빈 회색 박스 대신 아이콘을 그린다
 * (PRD v1.4 §4.3). 4곳(맵 상세·저장·어드민 미리보기·어드민 사진)에서
 * 똑같은 분기가 반복돼 컴포넌트로 뺐다.
 */
export function PlaceThumb({ photoRef, size = 200 }: { photoRef: string | null; size?: number }) {
  if (photoRef) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="place-thumb" src={photoUrl(photoRef, size)} alt="" loading="lazy" />;
  }
  return (
    <span className="place-thumb place-thumb-empty" aria-hidden>
      <IconMeal />
    </span>
  );
}
