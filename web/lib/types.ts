/** map_cards 뷰 (§9). published 만 담긴다. */
export type MapCard = {
  id: string;
  slug: string;
  title: string;
  one_liner: string;
  concept_tag: string | null;
  /** null 이면 홈에서 "Nationwide" 로 묶인다 (PRD v1.4 §1) */
  region: string | null;
  status: string;
  created_at: string;
  curator_id: string;
  curator_name: string | null;
  curator_avatar: string | null;
  curator_handle: string | null;
  /** false 면 이름을 링크 없는 텍스트로 그린다 (§3.4 은퇴·강등) */
  curator_listed: boolean;
  cover_place_id: string | null;
  /** 콜라주용 상위 4장. 없을 수 있다 */
  cover_refs: string[];
  place_count: number;
  save_count: number;
  review_count: number;
  avg_rating: number | null;
};

export type Place = {
  id: string;
  map_id: string;
  order: number;
  name_en: string;
  /** 없으면 그 행 자체를 렌더하지 않는다 (§5 S3) */
  name_ko: string | null;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id: string | null;
  category: string;
  /** 없으면 인용 블록 전체를 숨긴다 (§5 S3) */
  curator_note: string | null;
  photo_ref: string | null;
  photo_attribution: string | null;
  /** 상세 갤러리(PRD v1.4 §4.1). 구글 ref·큐레이터 업로드 URL 혼재 가능 */
  photo_refs: string[];
};

/** curator_profiles 뷰 (§9). email 도 curator_tier 도 없다. */
export type CuratorProfile = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  byline: string | null;
  about: string | null;
  map_count: number;
  place_count: number;
  save_count: number;
};

/** 사진 프록시 URL. photo_ref 는 슬래시를 포함한다 (§6.3) */
export const photoUrl = (ref: string, w = 800) => `/api/photo/${ref}?w=${w}`;

/**
 * 갤러리 항목용. 큐레이터가 직접 올린 사진은 이미 완전한 URL(Storage
 * 공개 주소)이라 그대로 쓰고, 구글 ref 는 프록시를 거친다 (PRD v1.4 §4.1).
 */
export const resolvePhotoUrl = (ref: string, w = 800) =>
  ref.startsWith('http') ? ref : photoUrl(ref, w);

export const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();

/** 'restaurant' -> 'RESTAURANT', 'street_food' -> 'STREET FOOD' */
export const categoryLabel = (c: string) => c.replace(/_/g, ' ').toUpperCase();
