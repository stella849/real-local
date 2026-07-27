/**
 * CSV -> data/maps.json
 *
 * Reads the two source CSVs and emits a single bundle the front-end consumes.
 * Re-run whenever the CSVs change:  node scripts/build-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const MAPS_CSV = resolve(root, 'data-source/maps_cleaned.csv');
const PLACES_CSV = resolve(root, 'data-source/places_cleaned_수정본.csv');
const OUT = resolve(root, 'data/maps.json');

/** Minimal RFC-4180 parser — handles quoted fields containing commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const slug = (s) =>
  s.toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Normalised pin coordinates for the cover minimap.
 * Cards have no photography, so each map is identified by the shape of its own
 * pin cluster. Returns points in a 0..1 box with a small inset so pins near the
 * bounding edge are not clipped by the card.
 */
function coverPins(places) {
  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1e-4;
  const spanLng = maxLng - minLng || 1e-4;
  const inset = 0.14;
  const fit = (v, min, span) => inset + ((v - min) / span) * (1 - inset * 2);

  return places.map((p) => ({
    x: +fit(p.lng, minLng, spanLng).toFixed(4),
    // screen y grows downward, latitude grows northward
    y: +(1 - fit(p.lat, minLat, spanLat)).toFixed(4),
  }));
}

const rawMaps = parseCsv(readFileSync(MAPS_CSV, 'utf8'));
const rawPlaces = parseCsv(readFileSync(PLACES_CSV, 'utf8'));

/* ------------------------------------------------------------
   주소 정규화 (Q5)

   원본 area 필드에 세 가지 순서가 섞여 있다.

     112-1 Eulji-ro, Jung District, Seoul, South Korea      100건 (정상)
     Jung District, Supyo-ro, 42-7, Seoul, South Korea       25건 (구가 앞)
     South Korea, Seoul, Seongdong-gu, Ttukseom-ro, 433       6건 (완전 역순)

   순서마다 규칙을 만들면 새 데이터가 들어올 때마다 규칙이 늘어난다.
   그래서 순서를 보지 않고 조각의 '종류'를 알아내 다시 조립한다 —
   어떤 순서로 들어와도 같은 결과가 나온다.

   구 표기도 -gu(79) 와 District(53) 로 갈려 있었다. -gu 로 통일한다:
   도로명주소 영문 표기의 공식 형태이고, 여행자가 표지판이나 지도
   검색에서 마주치는 쪽도 이쪽이다.

   원본 CSV 는 고치지 않는다. 클라이언트가 준 입력값이고, 다시 받아도
   여기를 지나면 같은 형태가 되어야 한다.
   ------------------------------------------------------------ */
const CITY = /^(Seoul|Busan|Incheon|Daegu|Daejeon|Gwangju|Ulsan|Sejong|Jeju)$/i;

// 지도의 city 는 동네 이름일 수 있다. 주소에 들어갈 것은 행정 도시다.
const CITY_OF = { Seoul: 'Seoul', Seongsu: 'Seoul', Busan: 'Busan' };

function normalizeAddress(raw, fallbackCity) {
  const parts = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const num = [], road = [], dong = [];
  let gu = null, city = null, unit = null;

  for (const s of parts) {
    if (/^south korea$/i.test(s)) continue;                 // 마지막에 다시 붙인다
    if (CITY.test(s)) { city ||= s; continue; }
    if (/(-gu|\s+District)$/i.test(s)) { gu ||= s.replace(/\s+District$/i, '-gu'); continue; }
    if (/^\d+[-\d]*ho$/i.test(s)) { unit ||= s; continue; } // 301ho 같은 호수
    if (/^\d+[-\d]*$/.test(s)) { num.push(s); continue; }   // 번지만 떨어져 나온 경우

    // '42-7 Supyo-ro' 처럼 번지가 붙어 있으면 쪼갠다. 쪼갠 뒤에도
    // '116-6 Jangsa-dong'(지번 주소)은 번지+이름으로 남아야 하므로
    // 동 판정은 앞에 숫자가 없는 조각에만 적용한다.
    const m = s.match(/^(\d+[-\d]*)\s+(.+)$/);
    if (m) { num.push(m[1]); road.push(m[2]); continue; }
    if (/-(dong|ga)$/i.test(s)) { dong.push(s); continue; }
    road.push(s);
  }

  let street = [num.shift(), road.shift()].filter(Boolean).join(' ');

  /* 도로가 없는 지번 주소 — 'Jongno District, Jongno 4(sa)-ga, 188' 처럼
     번지와 '가/동'만 있는 경우다. 그대로 두면 번지가 조각으로 떨어져
     '188, Jongno 4(sa)-ga' 가 된다. 번지는 그 이름에 붙어야 한다. */
  if (/^\d+[-\d]*$/.test(street) && dong.length) street = `${street} ${dong.shift()}`;

  // 예상 못 한 조각이 있어도 버리지 않는다
  const extra = [...num, ...road];

  return [unit, street, ...extra, ...dong, gu, city || fallbackCity, 'South Korea']
    .filter(Boolean).join(', ');
}

const byTitle = new Map();
for (const p of rawPlaces) {
  if (!byTitle.has(p.map_title)) byTitle.set(p.map_title, []);
  byTitle.get(p.map_title).push(p);
}

const warnings = [];
const maps = rawMaps.map((m) => {
  const rows = byTitle.get(m.title) ?? [];
  if (!rows.length) warnings.push(`map has no places: ${m.title}`);

  const seen = new Map();
  const places = rows.map((r, i) => {
    // one duplicate name exists in the source data, so ids get a suffix
    let id = slug(r.name);
    if (seen.has(id)) { const n = seen.get(id) + 1; seen.set(id, n); id = `${id}-${n}`; }
    else seen.set(id, 1);

    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) warnings.push(`bad coords: ${r.name}`);
    if (!r.tip) warnings.push(`missing tip: ${r.name}`);

    /* 정규화는 순서를 바로잡을 뿐, 없는 조각을 지어내지는 않는다.
       구나 번지가 빠진 원본은 눈에 보이게 남겨 둔다. */
    const address = normalizeAddress(r.area, CITY_OF[m.city] ?? m.city);
    if (!/-gu,/.test(address)) warnings.push(`address has no district: ${r.name}`);
    else if (!/^(?:\d+[-\d]*ho, )?\d/.test(address)) warnings.push(`address has no street number: ${r.name}`);

    return {
      id,
      n: i + 1,
      name: r.name,
      address,
      tip: r.tip || '',
      lat,
      lng,
      // 18 rows have no link — fall back to a coordinate query so every place is navigable
      gmaps: r.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      hasLink: Boolean(r.google_maps_link),
    };
  });

  return {
    id: slug(m.title),
    title: m.title,
    summary: m.subtitle,
    city: m.city,
    placeCount: places.length,
    cover: coverPins(places),
    center: places.length
      ? {
          lat: +(places.reduce((s, p) => s + p.lat, 0) / places.length).toFixed(6),
          lng: +(places.reduce((s, p) => s + p.lng, 0) / places.length).toFixed(6),
        }
      : null,
    places,
  };
});

// widest maps first so the feed opens on the richest curation
maps.sort((a, b) => b.placeCount - a.placeCount);

const cities = [...new Set(maps.map((m) => m.city))].map((city) => ({
  city,
  count: maps.filter((m) => m.city === city).length,
}));

const bundle = {
  generatedAt: new Date().toISOString().slice(0, 10),
  mapCount: maps.length,
  placeCount: maps.reduce((s, m) => s + m.placeCount, 0),
  cities,
  maps,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(bundle, null, 2), 'utf8');

console.log(`maps  : ${bundle.mapCount}`);
console.log(`places: ${bundle.placeCount}`);
console.log(`cities: ${cities.map((c) => `${c.city} ${c.count}`).join(' · ')}`);
console.log(`links : ${maps.flatMap((m) => m.places).filter((p) => p.hasLink).length} with source url`);
if (warnings.length) console.log(`\nwarnings (${warnings.length}):\n  ${warnings.join('\n  ')}`);
console.log(`\nwrote ${OUT}`);
