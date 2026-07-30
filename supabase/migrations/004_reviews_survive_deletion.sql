-- ============================================================
-- 회원 탈퇴 — map_reviews.user_id 를 nullable + ON DELETE SET NULL 로
--
-- 지금은 user_id 가 not null + on delete cascade 라, 계정을 지우면
-- 그 사람이 쓴 후기까지 통째로 사라진다. 요구사항은 "탈퇴해도 후기는
-- 남되, 이후로는 아무도(본인도) 수정·삭제 못 한다" 이므로 SET NULL 로
-- 바꾼다 — author_name 은 이미 별도 컬럼에 복제돼 있어(§9) 표시는
-- 그대로 되고, RLS 의 "auth.uid() = user_id" 는 user_id 가 null 이면
-- 누구와도 매치되지 않아 자동으로 잠긴다. 정책은 안 건드려도 된다.
--
-- schema.sql 전체를 다시 돌리지 말 것 — 파괴적인 파일이다. 이 조각만
-- Supabase 대시보드 > SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전
-- (drop constraint if exists 사용).
-- ============================================================

alter table public.map_reviews alter column user_id drop not null;

alter table public.map_reviews drop constraint if exists map_reviews_user_id_fkey;
alter table public.map_reviews
  add constraint map_reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
