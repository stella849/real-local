/**
 * Real Local — 시드 (PRD v1.3 §6.2 · §11)
 *
 *   node --env-file=.env.local scripts/seed.mjs            전체
 *   node --env-file=.env.local scripts/seed.mjs --limit 3  장소 3건만 (리허설)
 *   node --env-file=.env.local scripts/seed.mjs --no-google  구글 호출 없이 DB만
 *   node --env-file=.env.local scripts/seed.mjs --dry       아무것도 쓰지 않음
 *
 * 재실행 안전하다. maps 는 slug, places 는 (map_id, order) 로 upsert 한다.
 *
 * ------------------------------------------------------------
 * 구글 호출을 장소당 2회로 줄였다 (§6.5 는 3회를 가정했다).
 *   1) searchText  — 좌표 바이어스 + 영문 상호. id·주소·좌표·photos[] 를 한 번에
 *   2) details ko  — name_ko 만
 * searchText 가 photos 까지 주므로 Details(en) 를 따로 부를 이유가 없다.
 * 133건 × 2 = 266 호출.
 * ------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');            // 레포 루트 (web/ 의 부모)

const MAPS_CSV = resolve(root, 'data-source/maps_cleaned.csv');
const PLACES_CSV = resolve(root, 'data-source/places_cleaned_수정본.csv');
const REPORT = resolve(here, 'seed-report.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; };

const LIMIT = Number(val('--limit', 0)) || 0;
const NO_GOOGLE = has('--no-google');
const DRY = has('--dry');
const RETRY = has('--retry');   // google_place_id 가 비어 있는 행만 좌표로 다시 찾는다
const DEMO = has('--demo');     // 시연용 더미 저장·후기 (§11.3)

const { NEXT_PUBLIC_SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
        GOOGLE_PLACES_SERVER_KEY: G_KEY } = process.env;

if (!SB_URL || !SB_KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다');
if (!NO_GOOGLE && !G_KEY) throw new Error('GOOGLE_PLACES_SERVER_KEY 가 없다 (--no-google 로 건너뛸 수 있다)');

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });


/* ============================================================
   CSV — scripts/build-data.mjs 에서 이식. RFC-4180 최소 구현.
   ============================================================ */
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const slug = (s) => s.toLowerCase().replace(/[’'"]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* 주소 정규화 (Q5) — 원본에 세 가지 순서가 섞여 있어 순서를 보지 않고
   조각의 종류를 판별해 다시 조립한다. 133건 중 68건을 고쳤던 코드다. */
const CITY = /^(Seoul|Busan|Incheon|Daegu|Daejeon|Gwangju|Ulsan|Sejong|Jeju)$/i;
const CITY_OF = { Seoul: 'Seoul', Seongsu: 'Seoul', Busan: 'Busan' };

function normalizeAddress(raw, fallbackCity) {
  const parts = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const num = [], road = [], dong = [];
  let gu = null, city = null, unit = null;
  for (const s of parts) {
    if (/^south korea$/i.test(s)) continue;
    if (CITY.test(s)) { city ||= s; continue; }
    if (/(-gu|\s+District)$/i.test(s)) { gu ||= s.replace(/\s+District$/i, '-gu'); continue; }
    if (/^\d+[-\d]*ho$/i.test(s)) { unit ||= s; continue; }
    if (/^\d+[-\d]*$/.test(s)) { num.push(s); continue; }
    const m = s.match(/^(\d+[-\d]*)\s+(.+)$/);
    if (m) { num.push(m[1]); road.push(m[2]); continue; }
    if (/-(dong|ga)$/i.test(s)) { dong.push(s); continue; }
    road.push(s);
  }
  let street = [num.shift(), road.shift()].filter(Boolean).join(' ');
  if (/^\d+[-\d]*$/.test(street) && dong.length) street = `${street} ${dong.shift()}`;
  const extra = [...num, ...road];
  return [unit, street, ...extra, ...dong, gu, city || fallbackCity, 'South Korea']
    .filter(Boolean).join(', ');
}


/* ============================================================
   큐레이터 — D8 폴백
   CSV 에 큐레이터 컬럼이 없다. 맵 제목에서 이름이 나오는 것은
   'Mimyo’s Everyday Euljiro' 하나뿐이다.
   Mimyo 의 byline·about 과 게스트 큐레이터 'Sok' 은 PRD 본문의
   예시 문구를 그대로 쓴다 (§5 S10, §5 S8 목업).
   나머지는 맵 설명에서 발췌해 임시 작성했다. 어드민에서 교체한다.
   ============================================================ */
const CURATORS = [
  {
    key: 'mimyo', email: 'mimyo@reallocal.dev', display_name: 'Mimyo',
    handle: 'mimyo', tier: 'resident',
    byline: 'Lives in Euljiro. Eats out five nights a week.',
    about: "I've worked in the print alleys since 2016.",
  },
  {
    key: 'sora', email: 'sora@reallocal.dev', display_name: 'Sora',
    handle: 'sora', tier: 'resident',
    byline: 'Walks Yeonhui and Mangwon on her days off.',
    about: 'Quiet streets and thoughtfully designed cafés made for slowing down. '
         + 'I keep a list of the ones that stay quiet on weekends.',
  },
  {
    key: 'sok', email: 'sok@reallocal.dev', display_name: 'Sok',
    handle: 'sok', tier: 'guest',
    byline: 'Busan native. Ranks every bowl of noodles he eats.',
    about: 'Only the #1 spot for each style. I argue about this a lot.',
  },
];

/* 맵 → 큐레이터 · 상태 · 컨셉 태그
   §11.3: published 6 / pending 2 / hidden 1.
   pending 은 반드시 guest 큐레이터(Sok)의 것이어야 상태 머신(§3.3)과 맞는다 —
   resident 는 발행 즉시 published 라 pending 이 나올 수 없다. */
const MAP_PLAN = {
  'Mimyo’s Everyday Euljiro':          { curator: 'mimyo', status: 'published', tag: 'LATE-NIGHT' },
  'Gwangjang Market Essentials':       { curator: 'mimyo', status: 'published', tag: 'MARKET' },
  'Korean BBQ - Only #1':              { curator: 'mimyo', status: 'published', tag: 'BBQ' },
  'The Softer Side of Seoul: Yeonhui': { curator: 'sora',  status: 'published', tag: 'SLOW' },
  'Yeonhui-dong':                      { curator: 'sora',  status: 'published', tag: 'CAFE' },
  'Lost in Mangwon-Dong':              { curator: 'sora',  status: 'hidden',    tag: 'NEIGHBORHOOD' },
  'Inspiration seongsu':               { curator: 'sok',   status: 'published', tag: 'DESIGN' },
  'Busan with friends':                { curator: 'sok',   status: 'pending',   tag: 'WEEKEND' },
  'Noodle Goodness':                   { curator: 'sok',   status: 'pending',   tag: 'NOODLES' },
};

/* 카테고리 — tip 키워드 분류. 어드민이 사후 보정한다 (§11.2).
   비음식을 포용해야 한다 (§2.1). 순서가 우선순위다. */
const CATEGORY_RULES = [
  [/\b(bbq|galbi|samgyeopsal|grill|barbecue|pork belly)\b/i, 'bbq'],
  [/\b(ramen|noodle|naengmyeon|kalguksu|udon|soba|guksu)\b/i, 'noodles'],
  [/\b(bakery|bread|pastry|croissant|cake)\b/i, 'bakery'],
  [/\b(cafe|café|coffee|espresso|latte|roaster)\b/i, 'cafe'],
  [/\b(bar|cocktail|wine|beer|pub|makgeolli|soju|nogari)\b/i, 'bar'],
  [/\b(market|stall|alley food)\b/i, 'market'],
  [/\b(street food|tteokbokki|hotteok|gimbap)\b/i, 'street_food'],
  [/\b(shop|store|boutique|select|bookstore|books|vintage|flower)\b/i, 'shop'],
  [/\b(gallery|exhibition|museum|studio|park|walk|art|design)\b/i, 'culture'],
  [/\b(restaurant|dining|meal|lunch|dinner|chicken|samgyetang|stew|rice|steak|steakhouse|sushi|omakase|izakaya|gukbap|soup|jjigae|tang|hanwoo)\b/i, 'restaurant'],
];
const categorise = (tip, name) => {
  const s = `${tip} ${name}`;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(s)) return cat;
  return 'other';
};


/* ============================================================
   Google Places (New)
   ============================================================ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gfetch(url, init, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(500 * (i + 1)); continue; }
    throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error('재시도 소진');
}

/**
 * 좌표 제한 + 영문 상호.
 *
 * locationBias 가 아니라 locationRestriction 이다. bias 는 '이 근처를
 * 선호하라'일 뿐 강제가 아니라서, 못 찾으면 전 세계에서 비슷한 이름을
 * 집어온다 — 첫 실행에서 Padilla Bake Shop 이 10,867km 떨어진 곳에,
 * Yangmingsan 이 대만에 붙었다. restriction 은 사각형 밖을 아예 버린다.
 * 잘못 붙는 것보다 못 찾는 편이 낫다. 못 찾은 것은 --retry 가 줍는다.
 */
async function searchPlace(name, lat, lng) {
  const d = 0.005;   // 약 550m
  const body = {
    textQuery: name, languageCode: 'en', maxResultCount: 1,
    locationRestriction: { rectangle: {
      low:  { latitude: lat - d, longitude: lng - d },
      high: { latitude: lat + d, longitude: lng + d },
    } },
  };
  const j = await gfetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': G_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    },
    body: JSON.stringify(body),
  });
  return j.places?.[0] ?? null;
}

async function detailsKo(placeId) {
  const j = await gfetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=ko`,
    { headers: { 'X-Goog-Api-Key': G_KEY, 'X-Goog-FieldMask': 'displayName' } });
  return j.displayName?.text ?? null;
}

/**
 * 상호명을 쓰지 않고 좌표만으로 찾는다.
 *
 * CSV 의 영문 상호는 한글을 기계로 로마자 변환한 것이라 구글에 그런
 * 이름이 존재하지 않는다 — Seusisora Euljirojeom(스시소라 을지로점),
 * Domasorigimbab(도마소리김밥), Galrikboi(갈릭보이). 이름으로는 영영
 * 못 찾는다.
 *
 * 반면 좌표는 클라이언트가 직접 준 값이고 정확하다. 그 지점에 있는
 * 업소를 구글에 물어보는 편이 이름을 맞히려 애쓰는 것보다 확실하다.
 * 여러 업소가 한 건물에 있으면 틀릴 수 있으나, 어드민 Maps 탭에서
 * 사진을 교체할 수 있다 (§5 S8).
 */
async function searchNearby(lat, lng, radius = 60) {
  const j = await gfetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': G_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    },
    body: JSON.stringify({
      languageCode: 'en', maxResultCount: 5,
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }),
  });
  return j.places ?? [];
}

/** 두 좌표 사이 거리(m). 반환 좌표가 CSV 좌표에서 멀면 잘못 붙은 것이다. */
function metres(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const MATCH_RADIUS_M = 200;   // 이보다 멀면 --fix 대상으로 뺀다


/* ============================================================
   실행
   ============================================================ */
const rawMaps = parseCsv(readFileSync(MAPS_CSV, 'utf8'));
const rawPlaces = parseCsv(readFileSync(PLACES_CSV, 'utf8'));

const byTitle = new Map();
for (const p of rawPlaces) {
  if (!byTitle.has(p.map_title)) byTitle.set(p.map_title, []);
  byTitle.get(p.map_title).push(p);
}

const report = { startedAt: new Date().toISOString(), injected: 0, skipped: 0, failed: 0, issues: [] };
const note = (kind, name, detail) => { report.issues.push({ kind, name, detail }); };

/* ---------- 1. 큐레이터 계정 ---------- */
const curatorId = {};
for (const c of CURATORS) {
  if (DRY) { curatorId[c.key] = '00000000-0000-0000-0000-000000000000'; continue; }

  // 이미 있으면 재사용한다 (재실행 안전)
  const { data: found } = await db.from('users').select('id').eq('handle', c.handle).maybeSingle();
  let id = found?.id;

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: c.email, password: crypto.randomUUID(), email_confirm: true,
      user_metadata: { full_name: c.display_name },
    });
    if (error) {
      // 계정은 있는데 handle 이 아직 안 붙은 경우
      const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
      id = list?.users?.find((u) => u.email === c.email)?.id;
      if (!id) { report.failed++; note('curator', c.key, error.message); continue; }
    } else id = data.user.id;
  }

  // 시드 계정은 구글 전용 규칙(§3.1)의 검증을 우회한다.
  const { error: upErr } = await db.from('users').update({
    display_name: c.display_name, role: 'curator', curator_tier: c.tier,
    handle: c.handle, byline: c.byline, about: c.about,
    curator_listed: true, auth_provider: 'google',
  }).eq('id', id);
  if (upErr) { report.failed++; note('curator', c.key, upErr.message); continue; }

  curatorId[c.key] = id;
  console.log(`curator  ${c.display_name} (${c.tier})`);
}

/* ---------- 2. 맵 ---------- */
const mapId = {};
for (const m of rawMaps) {
  const plan = MAP_PLAN[m.title];
  if (!plan) { report.skipped++; note('map', m.title, 'MAP_PLAN 에 없음'); continue; }
  const cid = curatorId[plan.curator];
  if (!cid) { report.skipped++; note('map', m.title, `큐레이터 없음: ${plan.curator}`); continue; }

  const row = {
    slug: slug(m.title), curator_id: cid, title: m.title, one_liner: m.subtitle,
    concept_tag: plan.tag, status: plan.status,
    published_at: plan.status === 'published' ? new Date().toISOString() : null,
  };
  if (DRY) { mapId[m.title] = 'dry'; continue; }

  const { data, error } = await db.from('maps').upsert(row, { onConflict: 'slug' })
    .select('id').single();
  if (error) { report.failed++; note('map', m.title, error.message); continue; }
  mapId[m.title] = data.id;
  console.log(`map      ${m.title}  [${plan.status}]`);
}

/* ---------- 3-D. 시연용 더미 (--demo) ----------
   시드 직후에는 저장·후기가 전부 0 이라 §8 정렬이 무의미하다. 홈에서
   순서가 실제로 갈리는 것을 보여주려면 맵마다 수치가 달라야 한다 (§11.3).

   PRD 는 '사용자 5명 · 맵별 저장 3~40건'이라고 적었지만 둘은 동시에
   성립하지 않는다 — saved_maps 의 PK 가 (user_id, map_id) 라 한 사람이
   같은 맵을 두 번 저장할 수 없어서, 40건을 만들려면 40명이 필요하다.

   사용자 5명 쪽을 지킨다. 실제 계정이 늘어나는 것은 인계 후에도 남는
   부작용이지만 저장 숫자는 시연용 장식이기 때문이다. 대신 5·4·4·2·1·0 로
   깔아 3순위 정렬(§8)이 전부 드러나게 한다 —
   4 로 동점인 두 맵은 후기수가 갈라 주고, 0 인 맵은 'New' 배지를 태운다. */
if (DEMO) {
  const N = 5;
  const ADJ = ['Ari','Ben','Chae','Dana','Eun','Finn','Gia','Hana','Ivy','Jun',
               'Kai','Lena','Mina','Noa','Oli','Pia','Rae','Sena','Tae','Uma'];
  const ids = [];

  const { data: existing } = await db.auth.admin.listUsers({ perPage: 200 });
  const byEmail = new Map((existing?.users ?? []).map((u) => [u.email, u.id]));

  for (let i = 0; i < N; i++) {
    const email = `demo${i + 1}@reallocal.dev`;
    let id = byEmail.get(email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email, password: crypto.randomUUID(), email_confirm: true,
        user_metadata: { full_name: `${ADJ[i % ADJ.length]} ${String.fromCharCode(65 + (i % 26))}.` },
      });
      if (error) { note('demo-user', email, error.message); continue; }
      id = data.user.id;
    }
    ids.push(id);
  }
  console.log(`더미 사용자 ${ids.length}명`);

  const { data: maps } = await db.from('maps').select('id,title,status').eq('status', 'published');

  /* 저장 5·4·4·2·1·0 / 후기 5·4·2·1·3·0.
     3번째와 2번째 맵이 저장 4 로 동점이라 후기수(4 vs 2)가 순서를 가른다.
     마지막 맵은 저장·후기가 0 이라 'New' 배지가 뜬다 (§5 S1). */
  const SAVES   = [5, 4, 4, 2, 1, 0, 3, 2, 1];
  const REVIEWS = [5, 4, 2, 1, 3, 0, 2, 1, 0];
  const BODIES = [
    'Followed this for a whole afternoon. Every stop was worth it.',
    'Took my parents here. They still talk about the second place.',
    'Two of these were closed on a Monday — check before you go.',
    'The notes are what make this. Felt like a friend showing me around.',
    'Good list. I would add one more bakery but that is just me.',
    'Went on a rainy weekday and had most places to myself.',
    'Saved this before my trip and used it three days straight.',
    'Honest picks, no tourist traps.',
  ];

  let s = 0, rv = 0;
  for (const [i, m] of maps.entries()) {
    const nSave = Math.min(SAVES[i % SAVES.length], ids.length);
    const rows = ids.slice(0, nSave).map((uid) => ({ user_id: uid, map_id: m.id }));
    const { error: e1 } = await db.from('saved_maps').upsert(rows, { onConflict: 'user_id,map_id' });
    if (e1) note('demo-save', m.title, e1.message); else s += rows.length;

    const nRev = REVIEWS[i % REVIEWS.length];
    const revs = ids.slice(0, nRev).map((uid, k) => ({
      user_id: uid, map_id: m.id,
      author_name: `${ADJ[k % ADJ.length]} ${String.fromCharCode(65 + (k % 26))}.`,
      rating: 3 + (k % 3),                       // 3~5
      body: BODIES[k % BODIES.length],
    }));
    if (revs.length) {
      const { error: e2 } = await db.from('map_reviews').upsert(revs, { onConflict: 'user_id,map_id' });
      if (e2) note('demo-review', m.title, e2.message); else rv += revs.length;
    }
  }

  console.log(`저장 ${s}건 · 후기 ${rv}건`);
  writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  process.exit(0);
}

/* ---------- 3-R. 재시도 (--retry) ----------
   이름으로 못 찾은 행만 좌표로 다시 찾는다. 나머지는 건드리지 않는다. */
if (RETRY) {
  const { data: orphans, error } = await db.from('places')
    .select('id,name_en,lat,lng').is('google_place_id', null).order('id');
  if (error) throw error;

  console.log(`좌표로 재시도: ${orphans.length}건\n`);
  let fixed = 0;

  for (const p of orphans) {
    try {
      const hits = await searchNearby(p.lat, p.lng, 40);
      if (!hits.length) { note('retry-none', p.name_en, '좌표 40m 안에 업소 없음'); continue; }

      const best = hits
        .map((h) => ({ h, d: metres({ lat: p.lat, lng: p.lng },
          { lat: h.location.latitude, lng: h.location.longitude }) }))
        .sort((a, b) => a.d - b.d)[0];

      /* 그 지점에 업소가 하나뿐일 때만 받아들인다.
         서울 밀집 건물은 같은 좌표에 여러 업소가 있어서 '가장 가까운 것'이
         곧 '그 가게'가 아니다 — 첫 시도에서 HBAF Almond Store 와
         KIRSH 가 둘 다 같은 횟집에 붙었다. 틀린 사진은 사진 없는 것보다
         나쁘다. 애매하면 비워 두고 어드민 Maps 탭에서 고른다 (§5 S8). */
      if (hits.length > 1 || best.d > 30) {
        note('retry-ambiguous', p.name_en,
          `후보 ${hits.length}곳 · 최근접 ${Math.round(best.d)}m · 어드민 보정 필요`);
        continue;
      }

      const patch = { google_place_id: best.h.id };
      const photos = best.h.photos ?? [];
      if (photos.length) {
        patch.photo_ref = photos[0].name;
        patch.photo_candidates = photos.slice(0, 10).map((x) => ({
          name: x.name, attribution: x.authorAttributions?.[0]?.displayName ?? null,
        }));
        patch.photo_attribution = photos[0].authorAttributions?.[0]?.displayName ?? null;
      }
      try { patch.name_ko = await detailsKo(best.h.id); } catch { /* 한글명은 없어도 된다 */ }

      const { error: e2 } = await db.from('places').update(patch).eq('id', p.id);
      if (e2) { report.failed++; note('retry-write', p.name_en, e2.message); continue; }

      fixed++;
      note('retry-ok', p.name_en,
        `${best.h.displayName?.text ?? '?'} · ${Math.round(best.d)}m · 사진 ${photos.length}장`);
    } catch (e) {
      report.failed++; note('retry', p.name_en, String(e.message).slice(0, 160));
    }
  }

  report.injected = fixed;
  report.finishedAt = new Date().toISOString();
  writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n복구 ${fixed} / 남음 ${orphans.length - fixed} / 실패 ${report.failed}`);
  console.log(`자세한 내용은 ${REPORT}`);
  process.exit(0);
}

/* ---------- 3. 장소 ---------- */
let queue = [];
for (const m of rawMaps) {
  const rows = byTitle.get(m.title) ?? [];
  rows.forEach((r, i) => queue.push({ ...r, _map: m.title, _city: m.city, _order: i + 1 }));
}
if (LIMIT) queue = queue.slice(0, LIMIT);

console.log(`\n장소 ${queue.length}건 처리 시작${NO_GOOGLE ? ' (구글 호출 없음)' : ''}\n`);

const CONCURRENCY = 4;
let cursor = 0;

async function worker() {
  while (cursor < queue.length) {
    const r = queue[cursor++];
    const mid = mapId[r._map];
    if (!mid) { report.skipped++; continue; }

    const lat = Number(r.lat), lng = Number(r.lng);
    const row = {
      map_id: mid, order: r._order, name_en: r.name,
      address: normalizeAddress(r.area, CITY_OF[r._city] ?? r._city),
      lat, lng,
      curator_note: r.tip || null,          // 없으면 인용 블록이 숨는다 (§5 S3)
      category: categorise(r.tip, r.name),

      /* 구글에서 못 찾으면 명시적으로 비운다.
         키를 빼면 supabase-js 가 JSON 에서 통째로 생략하고, PostgREST 는
         '그 컬럼은 건드리지 말라'로 읽어 이전 값을 남긴다. 재실행으로
         잘못된 매칭을 고칠 수 없게 되므로 반드시 null 을 적어 보낸다. */
      google_place_id: null, name_ko: null,
      photo_ref: null, photo_candidates: null, photo_attribution: null,
    };

    if (!NO_GOOGLE) {
      try {
        const hit = await searchPlace(r.name, lat, lng);
        if (!hit) {
          note('nomatch', r.name, '검색 결과 없음 → --fix 대상');
        } else {
          const d = metres({ lat, lng }, { lat: hit.location.latitude, lng: hit.location.longitude });
          if (d > MATCH_RADIUS_M) {
            note('faraway', r.name, `반환 좌표가 ${Math.round(d)}m 떨어짐 → --fix 대상`);
          } else {
            row.google_place_id = hit.id;
            const photos = hit.photos ?? [];
            if (photos.length) {
              row.photo_ref = photos[0].name;
              row.photo_candidates = photos.slice(0, 10).map((p) => ({
                name: p.name,
                attribution: p.authorAttributions?.[0]?.displayName ?? null,
              }));
              row.photo_attribution = photos[0].authorAttributions?.[0]?.displayName ?? null;
            } else note('nophoto', r.name, '사진 없음 → 이니셜 폴백');

            try { row.name_ko = await detailsKo(hit.id); }
            catch (e) { note('noko', r.name, String(e.message).slice(0, 120)); }
          }
        }
      } catch (e) {
        report.failed++; note('google', r.name, String(e.message).slice(0, 160));
      }
    }

    if (DRY) { report.injected++; continue; }
    const { error } = await db.from('places').upsert(row, { onConflict: 'map_id,order' });
    if (error) { report.failed++; note('insert', r.name, error.message); }
    else { report.injected++; if (report.injected % 20 === 0) console.log(`  ...${report.injected}건`); }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

/* ---------- 4. 리포트 ---------- */
report.finishedAt = new Date().toISOString();
writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

const kinds = report.issues.reduce((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {});
console.log(`\n주입 ${report.injected} / 스킵 ${report.skipped} / 실패 ${report.failed}`);
if (Object.keys(kinds).length) {
  console.log('이슈:', Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(' · '));
  console.log(`자세한 내용은 ${REPORT}`);
}
