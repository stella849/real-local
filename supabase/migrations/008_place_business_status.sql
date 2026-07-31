-- ============================================================
-- 장소 폐업/이전 월 1회 모니터링 — places 에 구글 businessStatus 캐시
--
-- 큐레이터가 등록한 장소가 나중에 폐업·이전해도 앱은 이를 자동으로
-- 모르므로, 월 1회 크론(web/app/api/cron/check-place-status)이 구글
-- Place Details 의 businessStatus(OPERATIONAL/CLOSED_TEMPORARILY/
-- CLOSED_PERMANENTLY) 를 물어와 여기 캐시한다. 삭제·자동 비공개는
-- 하지 않는다 — 어드민이 검토 후 판단한다(§3.3 삭제 금지 원칙과 같은
-- 이유: API 오탐일 수 있고, 큐레이터의 팁 자체는 여전히 유효할 수 있다).
--
-- schema.sql 전체를 다시 돌리지 말 것. 이 조각만 Supabase 대시보드 >
-- SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전.
-- ============================================================

alter table public.places add column if not exists google_business_status text;
alter table public.places add column if not exists business_status_checked_at timestamptz;
