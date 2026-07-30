-- ============================================================
-- 후기 관리 (PRD v1.4 §3) — 어드민도 후기를 지울 수 있게
--
-- 지금까지 "delete own review" 정책이 본인만 허용해서, 어드민 화면에
-- 삭제 버튼을 달아도 RLS 가 막아 0행이 지워졌다. is_admin() 조건을
-- 더한다.
--
-- schema.sql 전체를 다시 돌리지 말 것 — 파괴적인 파일이다. 이 조각만
-- Supabase 대시보드 > SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전.
-- ============================================================

drop policy if exists "delete own review" on public.map_reviews;
create policy "delete own review" on public.map_reviews
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());
