import { photoUrl } from '@/lib/types';
import {
  IconMeal, IconCatBbq, IconCatNoodles, IconCatCafe, IconCatBakery, IconCatBar,
  IconCatStreetFood, IconCatMarket, IconCatShop, IconCatCulture, IconCatOther,
} from './Icons';

// supabase/schema.sql 의 place_category 11종과 1:1. 없는 값(스키마 변경
// 등)이 오면 IconMeal(레스토랑 겸 최종 폴백)로 떨어진다.
const CATEGORY_ICON: Record<string, typeof IconMeal> = {
  restaurant: IconMeal,
  bbq: IconCatBbq,
  noodles: IconCatNoodles,
  cafe: IconCatCafe,
  bakery: IconCatBakery,
  bar: IconCatBar,
  street_food: IconCatStreetFood,
  market: IconCatMarket,
  shop: IconCatShop,
  culture: IconCatCulture,
  other: IconCatOther,
};

/**
 * 장소 목록 썸네일. 사진이 없으면 빈 회색 박스 대신 카테고리별 아이콘을
 * 그린다 (PRD v1.4 §4.3, 카테고리 아이콘 세트 요청으로 확장). 4곳(맵
 * 상세·저장·어드민 미리보기·어드민 사진)에서 똑같은 분기가 반복돼
 * 컴포넌트로 뺐다.
 */
export function PlaceThumb({ photoRef, category, size = 200 }: {
  photoRef: string | null; category?: string; size?: number;
}) {
  if (photoRef) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="place-thumb" src={photoUrl(photoRef, size)} alt="" loading="lazy" />;
  }
  const Icon = CATEGORY_ICON[category ?? ''] ?? IconMeal;
  return (
    <span className="place-thumb place-thumb-empty" aria-hidden>
      <Icon />
    </span>
  );
}
