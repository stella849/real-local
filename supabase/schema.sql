-- ============================================================
-- Real Local — 스키마 (PRD v1.3 §9)
--
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 실행할 것.
-- 여러 번 실행해도 안전하다.
--
-- ------------------------------------------------------------
-- ⚠️ 이 파일은 v1.0 스키마를 대체한다. 파괴적이다.
--
--    v1.0 은 맵·장소를 DB에 두지 않고 data/maps.json 으로 서빙했고,
--    saved_maps.map_id / saved_places.place_id 가 그 JSON의 슬러그(text)였다.
--    PRD v1.3 은 맵·장소를 DB로 옮기므로 이 세 테이블을 uuid FK로
--    재작성해야 한다. §8 정렬이 avg(rating) 을 쓰는데 v1.0 map_reviews 에는
--    rating 컬럼조차 없다.
--
--    따라서 아래 3번 섹션이 saved_maps / saved_places / map_reviews 를
--    DROP 한다. 기존 저장·후기 데이터는 사라진다.
--    개발용 데모 데이터이며 PRD §11.3 이 더미를 다시 심는다.
--    운영 데이터가 들어 있다면 실행 전에 덤프를 뜰 것.
-- ------------------------------------------------------------
--
-- PRD §9 에서 의도적으로 벗어난 곳이 두 군데 있다. 둘 다 보안 문제이며
-- 각 위치에 근거를 적어 두었다.
--   (1) RLS 정책의 users 서브쿼리 → 무한 재귀. is_admin() 로 대체
--   (2) map_cards 뷰가 비공개 맵을 노출 → published 로 한정
-- ============================================================


-- ============================================================
-- 0. 열거형
-- ============================================================

do $$ begin
  create type public.user_role as enum ('user', 'curator', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.curator_tier as enum ('resident', 'guest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.map_status as enum
    ('draft', 'pending', 'published', 'rejected', 'hidden');
exception when duplicate_object then null; end $$;

-- 비음식을 포용해야 한다 (§2.1). 샘플 133건에 편집숍·서점·전시공간·산책로가
-- 섞여 있고, 걸러내면 Inspiration Seongsu 가 20곳 중 5곳만 남는다.
do $$ begin
  create type public.place_category as enum
    ('restaurant','bbq','noodles','cafe','bakery','bar','street_food',
     'market','shop','culture','other');
exception when duplicate_object then null; end $$;


-- ============================================================
-- 1. users — auth.users 미러
--
-- auth 스키마는 클라이언트가 직접 읽을 수 없어 표시용 정보를 조인할
-- 방법이 없다. public 쪽에 미러를 두고 트리거로 채운다.
-- ============================================================

create table if not exists public.users (
  id             uuid primary key references auth.users on delete cascade,
  email          text,
  display_name   text,
  avatar_url     text,
  role           public.user_role   not null default 'user',

  -- 큐레이터 전용. 일반 회원은 전부 null 이다.
  curator_tier   public.curator_tier,
  handle         text unique,          -- 공개 주소 조각. 어드민만 지정 (§9 설계 노트)
  byline         text,                 -- 60자 제한은 앱에서 강제
  about          text,                 -- 300자 제한은 앱에서 강제
  curator_listed boolean not null default true,   -- false = 은퇴 (§3.4)

  -- 'google' | 'email'. 큐레이터·어드민은 구글 전용이며(§3.1) 어드민
  -- 화면이 이 값으로 콤보박스를 잠근다.
  auth_provider  text,

  created_at     timestamptz not null default now()
);

-- 가입 시 미러 행을 만든다. provider 는 raw_app_meta_data 에 들어온다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 2. 권한 판별 함수
--
-- ⚠️ PRD §9 는 정책마다 `exists (select 1 from public.users where
--    id = auth.uid() and role = 'admin')` 을 인라인으로 쓴다.
--    그대로 쓰면 public.users 의 SELECT 정책 안에서 public.users 를
--    다시 조회하게 되어 무한 재귀로 죽는다 (42P17).
--    maps 정책도 users 를 읽으므로 users 정책을 타고 같은 곳에 걸린다.
--
--    security definer 함수는 호출자의 RLS 를 우회하므로 재귀가 끊긴다.
--    반환값이 boolean 하나뿐이라 정보 노출도 없다.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_curator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('curator', 'admin')
  );
$$;

revoke all on function public.is_admin()   from public;
revoke all on function public.is_curator() from public;
grant execute on function public.is_admin()   to anon, authenticated;
grant execute on function public.is_curator() to anon, authenticated;


-- ============================================================
-- 3. maps / places
--
-- v1.0 의 is_published(참/거짓)를 status(5지선다)로 바꾼 것이 핵심이다.
-- 승인 대기·반려·어드민이 내림은 참/거짓으로 표현할 수 없다.
-- ============================================================

create table if not exists public.maps (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,          -- /maps/[slug]
  curator_id   uuid not null references public.users(id) on delete restrict,
  title        text not null,
  one_liner    text not null,
  concept_tag  text,                          -- 맵당 1개 (§1)
  status       public.map_status not null default 'draft',
  review_note  text,                          -- 반려 사유. Reject 시 필수 (§5 S8)
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- 지역 속성을 갖지 않는다 (§2.2). city 컬럼을 두지 않는 것이 결정 사항이며
-- 지역명이 필요하면 title 에 이미 들어 있는 문자열을 쓴다.

create table if not exists public.places (
  id                uuid primary key default gen_random_uuid(),
  map_id            uuid not null references public.maps(id) on delete cascade,
  "order"           int  not null,            -- 핀 번호 = 리스트 번호
  name_en           text not null,
  name_ko           text,                     -- 없으면 그 행 자체를 렌더하지 않는다 (§5 S3)
  address           text,
  lat               double precision not null,
  lng               double precision not null,
  google_place_id   text,                     -- §9.1 저장 탭 중복 제거 키
  category          public.place_category not null default 'other',

  -- 큐레이터가 직접 쓴 한 줄. 이 앱의 상품 그 자체다 (§1).
  -- 없으면 인용 블록 전체를 숨긴다.
  curator_note      text,

  -- 사진은 저장하지 않고 참조만 보관한다 (§6.1 약관).
  photo_ref         text,
  photo_candidates  jsonb,                    -- 최대 10장. 어드민 사진 교체용
  photo_attribution text,                     -- 출처 표기 의무

  created_at        timestamptz not null default now(),

  unique (map_id, "order")                    -- 시드 upsert 키 (§11.4)
);

-- maps → places 순환 참조라 테이블 생성 후에 건다.
-- 큐레이터/어드민이 콜라주 대신 한 장으로 덮어쓸 때만 채워진다 (§6.4).
do $$ begin
  alter table public.maps
    add column cover_place_id uuid references public.places(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists maps_status_idx      on public.maps (status);
create index if not exists maps_curator_idx     on public.maps (curator_id);
create index if not exists places_map_id_idx    on public.places (map_id, "order");
create index if not exists places_gplace_idx    on public.places (google_place_id);


-- ============================================================
-- 4. 사용자 생성 데이터 — 재작성
--
-- ⚠️ 파괴적. 파일 상단의 경고 참조.
--    v1.0 은 map_id / place_id 가 maps.json 슬러그(text)였다.
--    이제 실제 행이 DB에 있으므로 uuid FK 로 바꾼다. FK 가 걸리면
--    맵이 사라졌는데 저장 목록에 남는 상태가 원천적으로 불가능해진다.
-- ============================================================

drop table if exists public.saved_maps   cascade;
drop table if exists public.saved_places cascade;
drop table if exists public.map_reviews  cascade;

create table public.saved_maps (
  user_id    uuid not null references auth.users on delete cascade,
  map_id     uuid not null references public.maps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, map_id)
);

-- 맵 저장과 완전히 독립이다. 장소를 저장해도 그 맵이 저장되지 않는다.
create table public.saved_places (
  user_id    uuid not null references auth.users on delete cascade,
  place_id   uuid not null references public.places(id) on delete cascade,
  map_id     uuid not null references public.maps(id)   on delete cascade,  -- '이 맵에서 저장함' 문맥
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- 후기는 개별 장소가 아니라 맵 단위다 (1차 인터뷰에서 확정).
-- author_name 을 행에 복제해 둔다 — users 에 본인 행만 보이는 정책이
-- 걸려 있어(§9) 다른 사람의 표시 이름을 조인으로 가져올 수 없다.
create table public.map_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  map_id      uuid not null references public.maps(id) on delete cascade,
  author_name text not null,
  rating      int  not null check (rating between 1 and 5),   -- §8 정렬이 avg 를 쓴다
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now(),
  unique (user_id, map_id)                    -- 한 사람이 한 맵에 하나
);

create index if not exists saved_maps_user_idx    on public.saved_maps   (user_id, created_at desc);
create index if not exists saved_places_user_idx  on public.saved_places (user_id, created_at desc);
create index if not exists map_reviews_map_id_idx on public.map_reviews  (map_id, created_at desc);


-- ============================================================
-- 5. 공개 뷰
--
-- 뷰는 기본적으로 소유자 권한으로 실행된다. users 에 제한 정책을 걸어도
-- 아래 뷰는 계속 동작한다는 뜻이며, 동시에 **어느 뷰에도 email 을 넣으면
-- 안 된다**는 뜻이다. 넣는 순간 RLS 를 우회해 전 회원 이메일이 열린다.
-- ============================================================

create or replace view public.curator_profiles as
select
  u.id, u.handle, u.display_name, u.avatar_url,
  u.byline, u.about,
  (select count(*) from public.maps m
     where m.curator_id = u.id and m.status = 'published')        as map_count,
  (select count(*) from public.places p
     join public.maps m on m.id = p.map_id
     where m.curator_id = u.id and m.status = 'published')        as place_count,
  (select count(*) from public.saved_maps s
     join public.maps m on m.id = s.map_id
     where m.curator_id = u.id and m.status = 'published')        as save_count
from public.users u
where u.role in ('curator', 'admin')
  and u.handle is not null
  and u.curator_listed = true;
-- email 없음. curator_tier 없음 (§3.2 등급은 일반 사용자에게 노출하지 않는다).
-- curator_listed 필터가 은퇴 큐레이터의 소개 페이지를 404 로 만든다 (§3.4).

-- ------------------------------------------------------------
-- map_cards — 홈(S1)과 큐레이터 소개(S10) 공용
--
-- ⚠️ PRD §9 의 map_cards 는 status 필터가 없다. 뷰가 소유자 권한으로
--    실행되므로 maps 의 RLS 를 우회하고, 결과적으로 비로그인 사용자가
--    draft·pending·hidden 맵을 전부 조회할 수 있다.
--    "비로그인으로 pending·hidden 맵 URL 직접 접근 시 404"(§12 AC-F11)와
--    정면으로 어긋난다.
--
--    → 이 뷰를 published 로 한정한다. 공개 카드 전용이다.
--    S11 의 YOUR MAPS 와 S8 의 Maps 탭은 maps 를 직접 조회한다.
--    그쪽은 RLS 가 이미 '본인 것 + 어드민은 전부'로 정확히 열어 준다.
-- ------------------------------------------------------------
create or replace view public.map_cards as
select
  m.id, m.slug, m.title, m.one_liner, m.concept_tag, m.status, m.created_at,
  u.id as curator_id, u.display_name as curator_name,
  u.avatar_url as curator_avatar, u.handle as curator_handle,
  u.curator_listed as curator_listed,        -- false 면 이름을 링크 없는 텍스트로 (§3.4)
  m.cover_place_id,
  -- 2×2 콜라주용 상위 4장. 사진 3장 이하도 깨지지 않아야 한다 (§6.4)
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

grant select on public.curator_profiles to anon, authenticated;
grant select on public.map_cards        to anon, authenticated;


-- ============================================================
-- 6. Row Level Security
--
-- publishable 키는 브라우저에 그대로 노출되므로 접근 제어는 전적으로
-- 아래 정책이 담당한다.
-- ============================================================

alter table public.users        enable row level security;
alter table public.maps         enable row level security;
alter table public.places       enable row level security;
alter table public.saved_maps   enable row level security;
alter table public.saved_places enable row level security;
alter table public.map_reviews  enable row level security;

-- ---------- users ----------
-- v1.0 의 `using (true)` 는 users 전체를 공개했다. Supabase 는 테이블마다
-- REST 엔드포인트를 자동 생성하므로 누구나 전 회원 email 을 조회할 수
-- 있었다 (R5). 본인 행 + 어드민으로 좁힌다. 공개 프로필은 curator_profiles
-- 뷰가 유일한 소스다.
drop policy if exists users_read       on public.users;
drop policy if exists users_read_self  on public.users;
create policy users_read_self on public.users for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update
  using (id = auth.uid());
-- handle / role / curator_tier 는 본인이 못 바꾼다. 컬럼 단위 제한은
-- RLS 로 표현할 수 없으므로 앱(Server Action)에서 강제한다 (§5 S11).

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users for update
  using (public.is_admin());

-- ---------- maps ----------
drop policy if exists maps_read on public.maps;
create policy maps_read on public.maps for select using (
  status = 'published'
  or curator_id = auth.uid()
  or public.is_admin()
);

drop policy if exists maps_insert on public.maps;
create policy maps_insert on public.maps for insert with check (
  curator_id = auth.uid() and public.is_curator()
);

drop policy if exists maps_update on public.maps;
create policy maps_update on public.maps for update using (
  curator_id = auth.uid() or public.is_admin()
);

-- DELETE 정책 없음 → 삭제 불가를 DB로 강제한다 (§3.3).
-- 내릴 필요가 있으면 status = 'hidden' 이다. 삭제는 장소·저장 기록·후기를
-- 함께 파괴하며 되돌릴 수 없다.

-- ---------- places ----------
drop policy if exists places_read on public.places;
create policy places_read on public.places for select using (
  exists (select 1 from public.maps m
          where m.id = places.map_id
            and (m.status = 'published'
                 or m.curator_id = auth.uid()
                 or public.is_admin()))
);

drop policy if exists places_write on public.places;
create policy places_write on public.places for insert with check (
  exists (select 1 from public.maps m
          where m.id = places.map_id and m.curator_id = auth.uid())
);

drop policy if exists places_update on public.places;
create policy places_update on public.places for update using (
  exists (select 1 from public.maps m
          where m.id = places.map_id
            and (m.curator_id = auth.uid() or public.is_admin()))
);

-- published·pending·hidden 장소는 여전히 삭제 불가 (maps 와 동일 원칙).
-- draft 재편집(F13 후속)만 예외 — curator 본인 소유 + 맵이 draft 상태일
-- 때만 삭제할 수 있다. 맵이 발행되는 순간 이 정책은 더 이상 적용되지 않는다.
drop policy if exists places_delete_draft on public.places;
create policy places_delete_draft on public.places for delete using (
  exists (select 1 from public.maps m
          where m.id = places.map_id
            and m.curator_id = auth.uid()
            and m.status = 'draft')
);

-- ---------- 저장 목록 ----------
drop policy if exists "own saved maps" on public.saved_maps;
create policy "own saved maps" on public.saved_maps
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own saved places" on public.saved_places;
create policy "own saved places" on public.saved_places
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 후기 ----------
-- 공유 링크로 들어온 비로그인 방문자도 맵 상세를 그대로 볼 수 있어야 한다.
drop policy if exists "reviews are public" on public.map_reviews;
create policy "reviews are public" on public.map_reviews
  for select to anon, authenticated using (true);

drop policy if exists "write own review" on public.map_reviews;
create policy "write own review" on public.map_reviews
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own review" on public.map_reviews;
create policy "update own review" on public.map_reviews
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own review" on public.map_reviews;
create policy "delete own review" on public.map_reviews
  for delete to authenticated using (auth.uid() = user_id);
