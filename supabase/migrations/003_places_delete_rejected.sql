-- ============================================================
-- Rejected 맵 재편집 — places DELETE 정책을 rejected 상태로 확장
--
-- 002 는 draft 만 허용했다. 반려된 맵을 고쳐 다시 낼 방법이 없어서
-- rejected 도 같은 조건(본인 소유)으로 추가한다. published 는 여전히
-- 삭제 불가.
--
-- schema.sql 전체를 다시 돌리지 말 것 — saved_maps/saved_places/
-- map_reviews 를 DROP 하는 파괴적인 파일이다. 이 조각만 Supabase
-- 대시보드 > SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전하다.
-- ============================================================

drop policy if exists places_delete_draft on public.places;
create policy places_delete_draft on public.places for delete using (
  exists (select 1 from public.maps m
          where m.id = places.map_id
            and m.curator_id = auth.uid()
            and m.status in ('draft', 'rejected'))
);
