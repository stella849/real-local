-- ============================================================
-- Real Local — Storage 정책 (아바타)
--
-- SQL Editor 에 붙여넣고 실행. 여러 번 실행해도 안전하다.
--
-- ⚠️ schema.sql 과 분리한 이유: 그쪽은 테이블을 DROP 하는 파괴적
--    스크립트다. 정책만 고치려고 그 파일을 다시 돌리면 저장·후기가
--    날아간다.
--
-- 사진 파이프라인의 예외다 — 구글 사진은 참조만 보관하지만(§6.1)
-- 아바타는 우리가 받은 파일이라 Storage 에 저장한다 (§6.1 예외).
-- ============================================================

-- 버킷이 없으면 만든다. 있으면 공개 읽기로 맞춘다.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ---------- 읽기 ----------
-- 큐레이터 아바타는 맵 카드마다 뜬다. 비로그인 방문자도 봐야 한다.
drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- ---------- 쓰기 ----------
-- 경로는 avatars/{user_id}.jpg 로 고정한다 (§5 S11). 파일 이름이 곧
-- 소유자이므로 남의 아바타를 덮어쓸 수 없다.
--
-- storage.foldername() 을 쓰지 않는 이유: 경로에 폴더가 없고 파일명
-- 하나뿐이라 name 을 직접 비교하는 편이 규칙이 눈에 보인다.
drop policy if exists "own avatar insert" on storage.objects;
create policy "own avatar insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '.%'
  );

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '.%'
  );

-- 삭제 정책은 만들지 않는다. 아바타 교체는 upsert 로 덮어쓰며,
-- 지울 일이 있으면 어드민이 대시보드에서 처리한다.

-- ============================================================
-- place-photos 버킷 — 큐레이터 직접 업로드 (PRD v1.4 §4.2)
--
-- 구글 사진은 참조만 보관하지만(§6.1) 이건 우리가 받은 파일이라
-- 아바타와 같은 예외 취급이다. 경로: place-photos/{place_id}/{ts}.jpg
-- ============================================================
insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "place photos are public" on storage.objects;
create policy "place photos are public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'place-photos');

-- 업로드는 그 장소가 속한 맵의 큐레이터 본인 또는 어드민만 — places 에
-- curator_id 가 없어 maps 를 거쳐 확인한다.
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
