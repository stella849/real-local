-- ============================================================
-- 지역 그루핑 (PRD v1.4 §1) — maps.region 추가 + map_cards 뷰 갱신
--
-- v1.3 은 "맵은 지역 속성이 없다"(§2.2)가 결정이었다. v1.4 에서
-- 뒤집었다 — 단 §4.3 의 검색/필터 금지는 그대로다. region 은 홈 상단
-- 그루핑(브라우즈 보조) 전용이고 필터 UI 는 만들지 않는다. 어드민만
-- 지정한다(자유 텍스트). null 이면 홈에서 "Nationwide" 로 묶인다.
--
-- schema.sql 전체를 다시 돌리지 말 것 — 파괴적인 파일이다. 이 조각만
-- Supabase 대시보드 > SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전.
-- ============================================================

alter table public.maps add column if not exists region text;

create or replace view public.map_cards as
select
  m.id, m.slug, m.title, m.one_liner, m.concept_tag, m.region, m.status, m.created_at,
  u.id as curator_id, u.display_name as curator_name,
  u.avatar_url as curator_avatar, u.handle as curator_handle,
  u.curator_listed as curator_listed,
  m.cover_place_id,
  (select coalesce(json_agg(x.photo_ref order by x."order"), '[]'::json)
     from (select photo_ref, "order" from public.places
           where map_id = m.id and photo_ref is not null
           order by "order" limit 4) x)                            as cover_refs,
  (select count(*) from public.places p      where p.map_id = m.id) as place_count,
  (select count(*) from public.saved_maps s  where s.map_id = m.id) as save_count,
  (select count(*) from public.map_reviews r where r.map_id = m.id) as review_count,
  (select round(avg(r.rating)::numeric, 1) from public.map_reviews r
     where r.map_id = m.id)                                        as avg_rating
from public.maps m
join public.users u on u.id = m.curator_id
where m.status = 'published';

grant select on public.map_cards to anon, authenticated;
