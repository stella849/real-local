-- ============================================================
-- 장소 사진 갤러리 + 큐레이터 업로드 (PRD v1.4 §4)
--
-- photo_ref(단수) 는 그대로 목록 썸네일 대표값이다. photo_refs(복수,
-- 배열) 를 추가해 상세 페이지에서 여러 장을 보여준다. 값은 구글
-- photo name 또는(큐레이터가 직접 올린 경우) Supabase Storage 의
-- 완전한 URL 둘 다 들어갈 수 있다 — 렌더링 쪽에서 http 로 시작하면
-- URL 그대로, 아니면 구글 프록시(/api/photo/...)로 돌린다
-- (web/lib/types.ts 의 resolvePhotoUrl 참조).
--
-- 업로드 저장 경로는 place-photos 버킷, place_id 로 소유권을 구분한다.
--
-- schema.sql 전체를 다시 돌리지 말 것 — 파괴적인 파일이다. 이 조각만
-- Supabase 대시보드 > SQL Editor 에 붙여넣는다. 여러 번 실행해도 안전.
-- ============================================================

alter table public.places add column if not exists photo_refs jsonb not null default '[]'::jsonb;

-- ---------- Storage: place-photos 버킷 ----------
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "place photos are public" on storage.objects;
create policy "place photos are public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'place-photos');

-- 경로 규칙: place-photos/{place_id}/{timestamp}.jpg. 업로드는 그
-- 장소가 속한 맵의 큐레이터 본인 또는 어드민만 — places 에 curator_id
-- 가 없어 maps 를 거쳐 확인한다.
drop policy if exists "curator upload own place photo" on storage.objects;
create policy "curator upload own place photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and exists (
      select 1 from public.places p
      join public.maps m on m.id = p.map_id
      where p.id::text = (storage.foldername(name))[1]
        and (m.curator_id = auth.uid() or public.is_admin())
    )
  );
