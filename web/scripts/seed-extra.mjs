/**
 * Real Local — 더미 데이터 확장 (PRD v1.4 §8)
 *
 *   node --env-file=.env.local scripts/seed-extra.mjs             전체
 *   node --env-file=.env.local scripts/seed-extra.mjs --limit 3   장소 3건만 (리허설)
 *   node --env-file=.env.local scripts/seed-extra.mjs --dry       아무것도 쓰지 않음
 *
 * scripts/seed.mjs 와 분리한 이유: 그쪽은 클라이언트가 준 원본 CSV
 * (data-source/*.csv) 전용이다. 이 스크립트가 심는 8개 맵·3명 큐레이터는
 * AI가 실제 존재하는 업체를 조사해 구성한 데모 확장분이라, 원본 데이터와
 * 출처를 섞지 않는다 — 인계 시 "이건 클라이언트 데이터, 이건 데모용"이
 * 갈려야 한다.
 *
 * 좌표를 모른다(원본 CSV는 클라이언트가 좌표까지 줬지만 이건 아니다).
 * 그래서 seed.mjs 의 locationRestriction 방식 대신, 이름 + 동네 + 도시를
 * 쿼리 텍스트에 넣어 찾는다 — 맵 에디터의 실시간 검색(app/api/places/search)
 * 과 같은 방식이다. 재실행 안전(upsert).
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const REPORT = resolve(here, 'seed-extra-report.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; };
const LIMIT = Number(val('--limit', 0)) || 0;
const DRY = has('--dry');

const { NEXT_PUBLIC_SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
        GOOGLE_PLACES_SERVER_KEY: G_KEY } = process.env;
if (!SB_URL || !SB_KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다');
if (!G_KEY) throw new Error('GOOGLE_PLACES_SERVER_KEY 가 없다');

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const slugify = (s) => s.toLowerCase().replace(/[’'"]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* ============================================================
   큐레이터 3명 (PRD v1.4 §8). pending 은 guest 큐레이터만 가능하다
   (§3.3 상태 머신) — Dahye 를 guest 로 둬서 3건이 pending 으로 남는다.
   ============================================================ */
const CURATORS = [
  {
    key: 'dahye', email: 'dahye@reallocal.dev', display_name: 'Dahye',
    handle: 'dahye', tier: 'guest',
    byline: 'Chases one dish across the whole country if she has to.',
    about: 'I don’t believe in "good enough nearby." If the best version of '
         + 'something is four hours away, I’m going.',
  },
  {
    key: 'yuna', email: 'yuna@reallocal.dev', display_name: 'Yuna',
    handle: 'yuna', tier: 'resident',
    byline: 'Seongsu, Yeonnam, Hongdae — walks all three on foot.',
    about: 'I map neighborhoods the way locals actually move through them, '
         + 'not the way a guidebook does.',
  },
  {
    key: 'minho', email: 'minho@reallocal.dev', display_name: 'Minho',
    handle: 'minho', tier: 'resident',
    byline: 'Weekends in Jeju, weeknights in Itaewon.',
    about: 'Half my life is spent getting to somewhere good to eat. '
         + 'The other half is telling people about it.',
  },
];

/* ============================================================
   맵 8개. region 은 PRD v1.4 §1 — null 이면 홈에서 Nationwide.
   ============================================================ */
const MAPS = [
  {
    title: 'Tteokbokki, Anywhere in Korea',
    one_liner: 'The country’s best rice cakes, wherever they happen to be.',
    curator: 'dahye', tag: 'SPICY', region: null,
    places: [
      { name: 'Nanumi Tteokbokki', area: 'Jongno-gu, Seoul',
        tip: 'Order it mild first — the heat builds two bowls in, not one.' },
      { name: 'Cheoldgil Tteokbokki', area: 'Chungjeongno, Seoul',
        tip: 'Eat it sitting by the old rail line if the weather lets you. Half the point is where you eat it.' },
      { name: 'Neonezip', area: 'Itaewon, Seoul',
        tip: 'Gets a line after 7pm. Go right when they open instead.' },
      { name: 'Mabokrim Tteokbokki', area: 'Sindang-dong, Seoul',
        tip: 'This is where jeuk-tteok (hot-pot-style tteokbokki) started. Order it for two even if you’re one.' },
      { name: 'Namcheon Halmae Tteokbokki', area: 'Suyeong-gu, Busan',
        tip: 'Running since 1983. Ask for extra broth — it’s thinner than Seoul-style and better for dipping.' },
      { name: 'Dongseongno Halmae Tteokbokki', area: 'Jung-gu, Daegu',
        tip: 'Daegu heat is a different animal. Bring milk, not water.' },
    ],
  },
  {
    title: 'Korea’s Best Fried Chicken',
    one_liner: 'Five kitchens worth crossing the country for.',
    curator: 'dahye', tag: 'CHICKEN', region: null,
    places: [
      { name: 'Hansung Chicken', area: 'Gimpo, Gyeonggi',
        tip: 'Get the half-and-half. Their fried batter holds up even after it goes cold in the car.' },
      { name: 'Hamheung Tongdak', area: 'Ulsan',
        tip: 'Old-school whole-bird style. The garlic version is not for a first date.' },
      { name: 'Hyodo Chicken', area: 'Gwanghwamun, Seoul',
        tip: 'The soy-glazed anchovy-and-pepper one is the reason people call this the best soy chicken in Seoul.' },
      { name: 'Samgye Dakgangjeong', area: 'Gimhae, Gyeongnam',
        tip: 'Dakgangjeong, not fried chicken exactly — sweeter, stickier, and worth the distinction.' },
      { name: 'Wangcheon Padak', area: 'Sejong',
        tip: 'The green-onion pile on top isn’t garnish. Eat it with the chicken, not after.' },
    ],
  },
  {
    title: 'Busan Seafood Trail',
    one_liner: 'Raw, grilled, and stewed — a weekend of Busan’s catch.',
    curator: 'dahye', tag: 'SEAFOOD', region: 'Busan',
    places: [
      { name: 'Songjeong Haenyeojip', area: 'Haeundae-gu, Busan',
        tip: 'Ask what the haenyeo brought in that morning — the menu changes with the catch.' },
      { name: 'Jagalchi Hoetjip', area: 'Jung-gu, Busan',
        tip: 'Pick your fish from the tanks downstairs, eat it upstairs. Tip the staff who help you choose.' },
      { name: 'Haejeok Salon Junamro', area: 'Suyeong-gu, Busan',
        tip: 'Good for a group — the platters are built for four, not two.' },
      { name: 'Deungdae Hoetjip', area: 'Gijang-gun, Busan',
        tip: 'The mulhoe (cold raw fish soup) here is why people drive out to Gijang specifically.' },
      { name: 'Gungjung Haemultang Jossijip', area: 'Busan',
        tip: 'Running since 1959, second generation now. Order the haemultang for the table, always shared.' },
    ],
  },
  {
    title: 'Pretty Cafes of Seongsu',
    one_liner: 'Where Seongsu’s old factories became the city’s best-looking coffee.',
    curator: 'yuna', tag: 'CAFE', region: 'Seongsu',
    places: [
      { name: 'Cafe Pavane', area: 'Seongsu-dong, Seoul',
        tip: 'Sit by the window if you can — the light in the afternoon is the whole reason to come.' },
      { name: 'Onion Seongsu', area: 'Seongsu-dong, Seoul',
        tip: 'The pandoro (sweet bread) sells out by early afternoon on weekends. Go before noon.' },
      { name: 'Daelim Changgo', area: 'Seongsu-dong, Seoul',
        tip: 'A converted warehouse — walk the whole space before you sit, it’s worth the loop.' },
      { name: 'Myosa Seoul', area: 'Seongsu-dong, Seoul',
        tip: 'Try the soda latte. It sounds strange on the menu and it is worth ordering anyway.' },
      { name: 'Cafe 5to7', area: 'Seongsu-dong, Seoul',
        tip: 'Three floors plus a rooftop — go up, not just in. The ground floor gets crowded first.' },
    ],
  },
  {
    title: 'Hidden Bakeries of Yeonnam-dong',
    one_liner: 'The bread worth the detour, tucked into Yeonnam’s side streets.',
    curator: 'yuna', tag: 'BAKERY', region: 'Yeonnam-dong',
    places: [
      { name: 'Aoitori', area: 'Yeonnam-dong, Seoul',
        tip: 'The morning set with the matcha melon bread sells out — this is not an afternoon bakery.' },
      { name: 'Pave', area: 'Yeonnam-dong, Seoul',
        tip: 'Get a coffee with whatever’s fresh from the oven, not whatever looks nicest in the case.' },
      { name: 'Kate & Cake', area: 'Yeonnam-dong, Seoul',
        tip: 'The injeolmi (rice cake) bean-powder cake is the one to order, not the seasonal specials.' },
      { name: 'Sister Bread', area: 'Yeonnam-dong, Seoul',
        tip: 'Salt bread here is thinner and crisper than most — eat it within the hour, it softens fast.' },
      { name: 'Misosikppa', area: 'Yeonnam-dong, Seoul',
        tip: 'No preservatives means it goes stale by next day — buy only what you’ll eat today.' },
    ],
  },
  {
    title: 'Solo Dining in Hongdae',
    one_liner: 'Counter seats and quick bowls for eating alone, done right.',
    curator: 'yuna', tag: 'SOLO', region: 'Hongdae',
    places: [
      { name: 'Kanemaya Jemyeonso', area: 'Hongdae, Seoul',
        tip: 'The broth is the point — order it without asking for less salt, it’s balanced as-is.' },
      { name: 'Yeoneodang', area: 'Hongdae, Seoul',
        tip: 'Lunch special is the move — salmon rice bowl plus soup for a fraction of dinner price.' },
      { name: 'Katsup', area: 'Hongik Univ., Seoul',
        tip: 'Counter seating faces the kitchen — ask for the well-done cutlet if you like it crisp all through.' },
      { name: 'Donsoobaek', area: 'Hongik Univ., Seoul',
        tip: 'Gukbap here is built for solo eating — one bowl, no ceremony, done in fifteen minutes.' },
      { name: 'Sushi Jeong', area: 'Hongdae, Seoul',
        tip: 'Sit at the bar, not a table — you get the pieces as they’re cut, not plated ahead.' },
    ],
  },
  {
    title: 'Jeju Ocean-View Cafes',
    one_liner: 'Coffee with the coastline doing all the work.',
    curator: 'minho', tag: 'OCEAN-VIEW', region: 'Jeju',
    places: [
      { name: 'Seogwipian Bakery', area: 'Seogwipo, Jeju',
        tip: 'Time it for sunset on the Seopjikoji road — the bakery view is secondary to the drive there.' },
      { name: 'Cafe Costeño', area: 'Gujwa-eup, Jeju',
        tip: 'Two buildings — the main one for the ocean view, the gallery wing if it’s too crowded.' },
      { name: 'Cafe Lucia', area: 'Seogwipo, Jeju',
        tip: 'Baksu-gijeong cliff is visible from the upper seats only — ask before you sit downstairs.' },
      { name: 'Coffee Chi', area: 'Andeok-myeon, Jeju',
        tip: 'Mountain on one side, ocean on the other — pick a seat, you can’t face both.' },
      { name: 'Nimome', area: 'Jeju-si, Jeju',
        tip: 'Come right before sunset, not after — the glass walls are the whole draw and it’s wasted in the dark.' },
    ],
  },
  {
    title: 'Late-Night Eats in Itaewon',
    one_liner: 'Itaewon after midnight, mapped by what’s actually still open.',
    curator: 'minho', tag: 'LATE-NIGHT', region: 'Itaewon',
    places: [
      { name: 'Yasanghae', area: 'Itaewon, Seoul',
        tip: 'Dim sum kitchen stays sharp late — order the same as you would at 7pm, nothing’s cut back.' },
      { name: 'Byeokdol Happy Food', area: 'Itaewon, Seoul',
        tip: 'Mala xiang guo, build your own — go heavier on the broth than you think you want.' },
      { name: 'Jyanny Dumpling', area: 'Itaewon, Seoul',
        tip: 'Pan-fried over boiled, always — the bottoms are the reason people come back.' },
      { name: 'Sulkkoma', area: 'Itaewon, Seoul',
        tip: 'A late-dinner-and-drinks spot, not a bar — come hungry, not just thirsty.' },
      { name: 'Hannam Bugeoguk', area: 'Hannam-dong, Seoul',
        tip: 'The dried pollack soup is built for the morning after — order it even at midnight, it works either way.' },
    ],
  },
];

/* 카테고리 분류 — seed.mjs 와 같은 방식(키워드 규칙), 이 배치용으로 축약 */
const CATEGORY_RULES = [
  [/\b(tteokbokki|hotteok|gimbap|street food)\b/i, 'street_food'],
  [/\bchicken|tongdak|dakgangjeong|padak\b/i, 'restaurant'],
  [/\bseafood|hoetjip|haemultang|mulhoe|hoe\b/i, 'restaurant'],
  [/\bcafe|coffee|latte|bakery|bread\b/i, 'cafe'],
  [/\bbread|bakery|pandoro\b/i, 'bakery'],
  [/\bnoodle|jemyeonso|gukbap\b/i, 'noodles'],
  [/\bsushi|katsu|cutlet|dumpling|xiang guo\b/i, 'restaurant'],
  [/\bdrink|bar|sulkkoma\b/i, 'bar'],
];
const categorise = (tip, name) => {
  const s = `${name} ${tip}`;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(s)) return cat;
  return 'other';
};

/* ============================================================
   Google Places (New) — 텍스트 쿼리(이름+동네+도시)로 찾는다.
   좌표를 모르니 locationRestriction 대신 쿼리 텍스트에 지역을 녹인다
   (app/api/places/search 와 같은 방식).
   ============================================================ */
async function searchPlace(name, area) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': G_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    },
    body: JSON.stringify({
      textQuery: `${name}, ${area}`, languageCode: 'en', regionCode: 'KR', maxResultCount: 1,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.places?.[0] ?? null;
}

async function detailsKo(placeId) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=ko`,
    { headers: { 'X-Goog-Api-Key': G_KEY, 'X-Goog-FieldMask': 'displayName' } });
  if (!res.ok) return null;
  const j = await res.json();
  return j.displayName?.text ?? null;
}

const report = { startedAt: new Date().toISOString(), injected: 0, skipped: 0, failed: 0, issues: [] };
const note = (kind, name, detail) => { report.issues.push({ kind, name, detail }); };

/* ---------- 1. 큐레이터 ---------- */
const curatorId = {};
for (const c of CURATORS) {
  if (DRY) { curatorId[c.key] = '00000000-0000-0000-0000-000000000000'; continue; }

  const { data: found } = await db.from('users').select('id').eq('handle', c.handle).maybeSingle();
  let id = found?.id;

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: c.email, password: crypto.randomUUID(), email_confirm: true,
      user_metadata: { full_name: c.display_name },
    });
    if (error) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
      id = list?.users?.find((u) => u.email === c.email)?.id;
      if (!id) { report.failed++; note('curator', c.key, error.message); continue; }
    } else id = data.user.id;
  }

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
for (const m of MAPS) {
  const cid = curatorId[m.curator];
  if (!cid) { report.skipped++; note('map', m.title, `큐레이터 없음: ${m.curator}`); continue; }

  // guest 는 pending, resident 는 published (§3.3 상태 머신)
  const tier = CURATORS.find((c) => c.key === m.curator).tier;
  const status = tier === 'guest' ? 'pending' : 'published';

  const row = {
    slug: slugify(m.title), curator_id: cid, title: m.title, one_liner: m.one_liner,
    concept_tag: m.tag, region: m.region, status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  };
  if (DRY) { mapId[m.title] = 'dry'; continue; }

  const { data, error } = await db.from('maps').upsert(row, { onConflict: 'slug' }).select('id').single();
  if (error) { report.failed++; note('map', m.title, error.message); continue; }
  mapId[m.title] = data.id;
  console.log(`map      ${m.title}  [${status}]${m.region ? ` · ${m.region}` : ' · Nationwide'}`);
}

/* ---------- 3. 장소 ---------- */
let queue = [];
for (const m of MAPS) {
  m.places.forEach((p, i) => queue.push({ ...p, _map: m.title, _order: i + 1 }));
}
if (LIMIT) queue = queue.slice(0, LIMIT);

console.log(`\n장소 ${queue.length}건 처리 시작\n`);

for (const r of queue) {
  const mid = mapId[r._map];
  if (!mid) { report.skipped++; continue; }

  const row = {
    map_id: mid, order: r._order, name_en: r.name, address: r.area,
    curator_note: r.tip, category: categorise(r.tip, r.name),
    google_place_id: null, name_ko: null,
    photo_ref: null, photo_candidates: null, photo_attribution: null, photo_refs: [],
    lat: 0, lng: 0,
  };

  try {
    const hit = await searchPlace(r.name, r.area);
    if (!hit) {
      note('nomatch', r.name, `검색 결과 없음 (${r.area}) → 어드민 Photos 탭에서 수동 보정 필요`);
    } else {
      row.lat = hit.location.latitude;
      row.lng = hit.location.longitude;
      row.google_place_id = hit.id;
      row.address = hit.formattedAddress ?? r.area;

      const photos = hit.photos ?? [];
      if (photos.length) {
        row.photo_ref = photos[0].name;
        row.photo_candidates = photos.slice(0, 10).map((p) => ({
          name: p.name, attribution: p.authorAttributions?.[0]?.displayName ?? null,
        }));
        row.photo_attribution = photos[0].authorAttributions?.[0]?.displayName ?? null;
      } else note('nophoto', r.name, '사진 없음 → 아이콘 폴백');

      try { row.name_ko = await detailsKo(hit.id); } catch { /* 한글명 없어도 된다 */ }
    }
  } catch (e) {
    report.failed++; note('google', r.name, String(e.message).slice(0, 160));
  }

  // 좌표를 못 찾은 행은 지도 위에 못 찍는다 — 저장은 하되 표시해 둔다
  if (!row.google_place_id) note('no-coords', r.name, '좌표 없음 — 지도에 안 찍힘, 수동 보정 필요');

  if (DRY) { report.injected++; continue; }
  const { error } = await db.from('places').upsert(row, { onConflict: 'map_id,order' });
  if (error) { report.failed++; note('insert', r.name, error.message); }
  else report.injected++;
}

report.finishedAt = new Date().toISOString();
writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

const kinds = report.issues.reduce((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {});
console.log(`\n주입 ${report.injected} / 스킵 ${report.skipped} / 실패 ${report.failed}`);
if (Object.keys(kinds).length) {
  console.log('이슈:', Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(' · '));
  console.log(`자세한 내용은 ${REPORT}`);
}
