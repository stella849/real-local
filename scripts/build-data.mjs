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

    return {
      id,
      n: i + 1,
      name: r.name,
      address: r.area,
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
