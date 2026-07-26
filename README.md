# Real Local

Curated food and neighbourhood maps of Korea, made by approved locals — for visitors who want the spots a local would actually walk them to.

**Live:** https://stella849.github.io/real-local/

---

## What this build is

The Tuesday milestone: the full front end running on the real dataset. Nine maps and 133 places are loaded from the curators' own lists, every place is on the map, and every place carries the curator's own note.

| | |
|---|---|
| Maps | 9 |
| Places | 133 |
| Cities | Seoul 7 · Seongsu 1 · Busan 1 |
| Stack | Static HTML/CSS/JS, no build step |
| Deploy | GitHub Pages from `main` |

### Working

- **Home** — map feed with city filter
- **Map detail** — interactive map with numbered pins, tapping a pin highlights its row and vice versa
- **Place list** — name, address, and the curator's note, plus a link straight into Google Maps
- **Saving** — maps and places save independently, and the Saved tab keeps them apart
- **Sharing** — native share sheet where available, clipboard elsewhere

### Not in this build

- Sign-in, cloud sync, and map reviews — these need the backend (see below)
- Curator authoring tools — see the open question in `docs/`

---

## Design

Built from `DESIGN-mistral.ai.md` with the saturated-orange family removed at the client's direction — `primary #fa520f`, `primary-deep`, `sunshine-300..900`, `yellow-saturated`, and `block-5/6/7` are all excluded.

Everything that carried orange was reassigned to a component the source system already documents, so nothing was invented:

| Was | Now |
|---|---|
| `button-primary` (orange) | `button-dark` (ink `#1f1f1f`) |
| `segmented-tab-active` (orange underline) | ink underline |
| `sunset-stripe-band` (red→orange→yellow) | rebuilt from the cream/beige stops only |
| `link` (= primary orange) | ink |

What remains is the system's cream and beige warm surfaces over white, which is also what the client asked for in the first interview — beige to white, handmade. Typography keeps the source's editorial pairing: a high-contrast serif for display, Inter for everything else. `PP Editorial Old` is a licensed face, so **Instrument Serif** stands in for it.

The dataset has no photography, so map covers are drawn from each map's own pin cluster — a shape unique to that curation. In the place list, the curator's note takes the space a photo would normally hold.

---

## Data

Source CSVs live in `data-source/`. They are the input, not the runtime data.

```bash
node scripts/build-data.mjs   # data-source/*.csv -> data/maps.json
```

The importer resolves `map_title` to map ids, generates stable place ids (one duplicate name exists in the source), precomputes cover geometry, and falls back to a coordinate query for the 18 places with no Google Maps link. It prints a warning for anything incomplete — currently one place with no note.

### Known data gaps

| Gap | Effect | Status |
|---|---|---|
| No photography | Covers use generated pin maps | Resolved by design |
| No curator names | Curator attribution is not shown anywhere | Open — needs the client |
| No categories | Category filters were dropped | Open |
| `area` formatting inconsistent | Some addresses read in reverse order | Open |

---

## Backend

Saving currently writes to `localStorage`, which the client was explicit is not acceptable for the real service. It is a front-end stand-in so the flow can be reviewed on Tuesday, and it is confined to the `store` object at the top of `assets/app.js` — swapping those four functions for Supabase calls is the whole migration.

Thursday's build needs Supabase for auth, saved maps and places, and map reviews.

---

## Running locally

Any static server works, because there is no build step.

```bash
npx serve .
```
