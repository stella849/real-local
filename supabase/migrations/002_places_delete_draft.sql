-- ============================================================
-- Draft 재편집(F13 후속) — places DELETE 정책 추가
--
-- schema.sql 전체를 다시 돌리지 말 것. saved_maps/saved_places/
-- map_reviews 를 DROP 하는 파괴적인 파일이고, 지금은 운영 데이터가
-- 있다. 이 조각만 Supabase 대시보드 > SQL Editor 에 붙여넣는다.
-- 여러 번 실행해도 안전하다.
--
-- schema.sql 에도 동일 내용을 반영해 뒀다 (신규 설치 시 자동 포함).
-- ============================================================

drop policy if exists places_delete_draft on public.places;
create policy places_delete_draft on public.places for delete using (
  exists (select 1 from public.maps m
          where m.id = places.map_id
            and m.curator_id = auth.uid()
            and m.status = 'draft')
);
