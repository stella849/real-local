-- ============================================================
-- Real Local — 스키마
--
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 실행할 것.
-- 여러 번 실행해도 안전하다.
--
-- 지도 9개와 장소 133곳은 DB에 넣지 않는다. 큐레이터가 확정한
-- 읽기 전용 참조 데이터라 data/maps.json 으로 그대로 서빙하는 편이
-- 빠르고, 큐레이터 편집 UI(Q2)가 확정되기 전까지는 DB에 둘 이유가
-- 없다. 여기 담기는 것은 사용자가 만든 데이터뿐이다.
--
-- map_id / place_id 는 maps.json 의 슬러그(text)다. auth.users 외에는
-- 외래키를 걸지 않는다.
-- ============================================================

-- ---------- 저장한 지도 ----------
create table if not exists public.saved_maps (
  user_id    uuid        not null references auth.users on delete cascade,
  map_id     text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, map_id)
);

-- ---------- 저장한 장소 ----------
-- 지도 저장과 완전히 독립이다. 장소를 저장해도 그 지도가 저장되지 않는다.
create table if not exists public.saved_places (
  user_id    uuid        not null references auth.users on delete cascade,
  place_id   text        not null,
  map_id     text        not null,          -- '이 지도에서 저장함' 표기용
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ---------- 지도 리뷰 ----------
-- 리뷰는 개별 장소가 아니라 지도 단위다(1차 인터뷰에서 확정).
-- author_name 을 행에 복제해 둔다 — 클라이언트는 auth.users 를 읽을 수
-- 없으므로 작성자 표시를 위해 조인할 방법이 없다.
create table if not exists public.map_reviews (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  map_id     text        not null,
  author_name text       not null,
  body       text        not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (user_id, map_id)                  -- 한 사람이 한 지도에 하나
);

create index if not exists map_reviews_map_id_idx on public.map_reviews (map_id, created_at desc);

-- ============================================================
-- Row Level Security
--
-- publishable 키는 브라우저에 노출되므로 접근 제어는 전적으로 아래
-- 정책이 담당한다. RLS 없이는 누구나 모든 행을 읽고 쓸 수 있다.
-- ============================================================

alter table public.saved_maps   enable row level security;
alter table public.saved_places enable row level security;
alter table public.map_reviews  enable row level security;

-- 저장 목록은 본인만 읽고 쓴다
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

-- 리뷰는 누구나 읽을 수 있어야 한다. 공유 링크로 들어온 비로그인
-- 방문자도 지도 상세를 그대로 볼 수 있어야 하기 때문이다.
drop policy if exists "reviews are public" on public.map_reviews;
create policy "reviews are public" on public.map_reviews
  for select to anon, authenticated
  using (true);

-- 쓰기는 본인 것만
drop policy if exists "write own review" on public.map_reviews;
create policy "write own review" on public.map_reviews
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own review" on public.map_reviews;
create policy "update own review" on public.map_reviews
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own review" on public.map_reviews;
create policy "delete own review" on public.map_reviews
  for delete to authenticated
  using (auth.uid() = user_id);
