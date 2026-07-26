/* ============================================================
   Real Local — mobile web client
   Static data, hash routing, no build step (deploys as-is to Pages).
   ============================================================ */

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

let DATA = null;
let leafletMap = null;

/* ------------------------------------------------------------
   Saved state

   Browser-local for now. The client was explicit that a real
   service cannot keep this on the device only, so this is the
   frontend stand-in until auth lands — swapping the four
   functions below for Supabase calls is the whole migration.
   ------------------------------------------------------------ */
const store = {
  key: 'reallocal.saved.v1',
  read() {
    try {
      const v = JSON.parse(localStorage.getItem(this.key) || '{}');
      return { maps: v.maps ?? [], places: v.places ?? [] };
    } catch {
      return { maps: [], places: [] };
    }
  },
  write(v) {
    try { localStorage.setItem(this.key, JSON.stringify(v)); } catch { /* private mode */ }
  },
  has(kind, id) { return this.read()[kind].includes(id); },
  toggle(kind, id) {
    const v = this.read();
    const i = v[kind].indexOf(id);
    if (i === -1) v[kind].push(id); else v[kind].splice(i, 1);
    this.write(v);
    return i === -1;
  },
};

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const icon = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m7-7-7 7 7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  bookmarkOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  saved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
};

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

async function share(title, url) {
  const data = { title, text: title, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast(url);
  }
}

/* ------------------------------------------------------------
   Cover minimap

   The dataset ships no photography, so each card is identified by
   the shape of its own pin cluster — computed from lat/lng at
   build time, drawn here as SVG.
   ------------------------------------------------------------ */
function coverSvg(map) {
  const dot = (p, i, fill, dx, dy, r) =>
    `<circle cx="${(p.x * 100 + dx).toFixed(2)}" cy="${(p.y * 100 + dy).toFixed(2)}" r="${r}" fill="${fill}"/>`;

  // knocked-out-of-register underlay, then the ink pass on top
  const under = map.cover.map((p, i) => dot(p, i, '#e6d5a8', 1.6, 1.6, 4.4)).join('');
  const ink = map.cover.map((p, i) => {
    const o = 0.42 + (0.58 * (map.cover.length - i)) / map.cover.length;
    return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(p.y * 100).toFixed(2)}" r="${i === 0 ? 4.2 : 3.4}" fill="#1f1f1f" opacity="${o.toFixed(2)}"/>`;
  }).join('');

  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g>${under}</g><g>${ink}</g>
  </svg>`;
}

/* ------------------------------------------------------------
   Hero block print

   Carved-block vocabulary: ridgelines behind, hanok eaves in
   front, and a beige pass offset from the ink pass so the two
   colours sit slightly out of register.
   ------------------------------------------------------------ */
function heroArt() {
  const ridgeFar =
    'M0 72 C42 56 64 66 98 53 C134 39 152 59 188 53 C224 47 246 32 284 42 '
    + 'C318 51 352 38 390 46 L390 150 L0 150 Z';
  const ridgeNear =
    'M0 100 C34 84 54 90 80 77 C106 64 130 80 158 73 C188 65 208 84 238 79 '
    + 'C268 74 290 60 320 71 C346 80 368 70 390 75 L390 150 L0 150 Z';

  const EAVE = 124;   // lowest point of the eave, at the centre of the span
  const GROUND = 146;

  /* A giwa roof from the front. The defining move is that the eave line
     itself lifts at the corners — the tips sit ABOVE the centre of the
     eave, so the roof reads as a shallow crescent rather than a cap.
     Both edges are arcs: the ridge over the top, the eave underside
     dipping back down to EAVE at mid-span. */
  const roof = (x, w, h) => {
    const lift = h * 0.42;                 // how far the corners ride up
    const tip = (EAVE - lift).toFixed(1);
    const cx = x + w * 0.5;
    // control pulled below EAVE so the curve's midpoint lands exactly on
    // it — otherwise the underside stops short and the roof floats
    return `<path d="M${x} ${tip} `
      + `Q${cx} ${(EAVE - h * 1.35).toFixed(1)} ${x + w} ${tip} `
      + `Q${cx} ${(EAVE + lift).toFixed(1)} ${x} ${tip} Z" fill="#1f1f1f"/>`;
  };

  /* wall below the eave, with a doorway punched out of it */
  const wall = (cx, w) => {
    const x = cx - w / 2;
    const dw = Math.max(7, w * 0.26);
    const dh = 13;
    return `<rect x="${x}" y="${EAVE - 2}" width="${w}" height="${GROUND - EAVE + 2}" fill="#1f1f1f" opacity=".8"/>`
      + `<rect x="${(cx - dw / 2).toFixed(1)}" y="${GROUND - dh}" width="${dw.toFixed(1)}" height="${dh}" fill="#fff8e0" opacity=".92"/>`;
  };

  const village = [
    { x: -4, w: 80, wall: 48, r: 0.34 },
    { x: 84, w: 98, wall: 60, r: 0.3 },
    { x: 194, w: 66, wall: 40, r: 0.36 },
    { x: 272, w: 84, wall: 50, r: 0.31 },
    { x: 362, w: 60, wall: 36, r: 0.35 },
  ];

  const buildings = village
    .map((b) => wall(b.x + b.w / 2, b.wall) + roof(b.x, b.w, b.w * b.r))
    .join('');

  return `<svg viewBox="0 28 390 128" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <circle cx="318" cy="52" r="16" fill="#fff0c2"/>
    <path d="${ridgeFar}" fill="#e6d5a8" opacity=".45"/>
    <path d="${ridgeNear}" fill="#e6d5a8" opacity=".8"/>
    ${buildings}
    <rect x="0" y="${GROUND}" width="390" height="1.2" fill="#1f1f1f" opacity=".28"/>
  </svg>`;
}

/* ------------------------------------------------------------
   Chrome
   ------------------------------------------------------------ */
function renderTopbar(route) {
  if (route.name === 'map') {
    const m = route.map;
    topbar.innerHTML = `
      <button class="iconbtn" id="nav-back" aria-label="Back">${icon.back}</button>
      <span class="topbar-title">${esc(m.title)}</span>
      <span class="topbar-spacer"></span>
      <button class="iconbtn" id="nav-share" aria-label="Share this map">${icon.share}</button>`;
    topbar.querySelector('#nav-back').onclick = () => {
      if (history.length > 1) history.back(); else location.hash = '#/';
    };
    topbar.querySelector('#nav-share').onclick = () => share(m.title, mapUrl(m.id));
    return;
  }

  const label = route.name === 'saved' ? 'Saved' : route.name === 'me' ? 'Me' : null;
  topbar.innerHTML = label
    ? `<span class="wordmark">${label}</span>`
    : `<a class="wordmark" href="#/">Real Local</a>`;
}

function renderTabbar(route) {
  const tabs = [
    { id: 'home', href: '#/', label: 'Home', svg: icon.home },
    { id: 'saved', href: '#/saved', label: 'Saved', svg: icon.saved },
    { id: 'me', href: '#/me', label: 'Me', svg: icon.me },
  ];
  const active = route.name === 'map' ? 'home' : route.name;
  tabbar.innerHTML = tabs.map((t) => `
    <a class="tab" href="${t.href}"${t.id === active ? ' aria-current="page"' : ''}>
      ${t.svg}<span>${t.label}</span>
    </a>`).join('');
}

/* ------------------------------------------------------------
   Home
   ------------------------------------------------------------ */
let activeCity = 'all';

const cardHtml = (m) => `
  <li>
    <a class="card" href="#/m/${m.id}">
      <div class="cover">${coverSvg(m)}</div>
      <div class="card-body">
        <h2 class="card-title">${esc(m.title)}</h2>
        <p class="card-summary">${esc(m.summary)}</p>
        <p class="card-meta">${esc(m.city)} · ${m.placeCount} places</p>
      </div>
    </a>
  </li>`;

function renderHome() {
  const cities = [{ city: 'all', count: DATA.mapCount }, ...DATA.cities];
  const list = activeCity === 'all' ? DATA.maps : DATA.maps.filter((m) => m.city === activeCity);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-art">${heroArt()}</div>
      <div class="hero-copy">
        <p class="eyebrow">Curated by approved locals</p>
        <h1 class="lede">Korea, by the people who live there.</h1>
        <p class="lede-sub">${DATA.mapCount} maps · ${DATA.placeCount} places — the spots a local would walk you to.</p>
      </div>
    </section>
    <hr class="cut">

    <div class="filters" role="group" aria-label="Filter by city">
      ${cities.map((c) => `
        <button class="pill" data-city="${esc(c.city)}" aria-pressed="${c.city === activeCity}">
          ${c.city === 'all' ? 'All' : esc(c.city)}<span class="n">${c.count}</span>
        </button>`).join('')}
    </div>

    <ul class="feed">${list.map(cardHtml).join('')}</ul>`;

  view.querySelectorAll('[data-city]').forEach((b) => {
    b.onclick = () => { activeCity = b.dataset.city; renderHome(); };
  });
}

/* ------------------------------------------------------------
   Map detail
   ------------------------------------------------------------ */
function renderMap(m) {
  const savedMap = store.has('maps', m.id);

  view.innerHTML = `
    <div class="detail-head">
      <h1 class="detail-title">${esc(m.title)}</h1>
      <p class="detail-summary">${esc(m.summary)}</p>
      <div class="detail-meta">
        <span class="badge">${esc(m.city)}</span>
        <span class="badge quiet">${m.placeCount} places</span>
      </div>
    </div>

    <div id="map" role="img" aria-label="Map of ${esc(m.title)}"></div>

    <div class="pad" style="padding-bottom:0">
      <button class="btn btn-dark btn-block" id="save-map" aria-pressed="${savedMap}">
        ${savedMap ? icon.bookmarkOn : icon.bookmark}
        <span>${savedMap ? 'Saved' : 'Save this map'}</span>
      </button>
    </div>

    <div class="section-head">
      <h2>Places</h2><span class="count">${m.placeCount}</span>
    </div>

    <ul class="places">
      ${m.places.map((p) => {
        const on = store.has('places', p.id);
        return `
        <li class="place" id="p-${p.id}" data-n="${p.n}">
          <span class="place-n">${p.n}</span>
          <div class="place-main">
            <h3 class="place-name">${esc(p.name)}</h3>
            <p class="place-addr">${esc(p.address)}</p>
            ${p.tip ? `<p class="place-tip">${esc(p.tip)}</p>` : ''}
          </div>
          <div class="place-actions">
            <button class="act" data-save="${p.id}" aria-pressed="${on}"
                    aria-label="${on ? 'Remove' : 'Save'} ${esc(p.name)}">
              ${on ? icon.bookmarkOn : icon.bookmark}
            </button>
            <a class="act" href="${esc(p.gmaps)}" target="_blank" rel="noopener noreferrer"
               aria-label="Open ${esc(p.name)} in Google Maps">${icon.external}</a>
          </div>
        </li>`;
      }).join('')}
    </ul>

    <div class="section-head"><h2>Reviews</h2><span class="count">0</span></div>
    <div class="empty">
      <h3>No reviews yet</h3>
      <p>Reviews are written about the map as a whole, not individual places. Sign in to be the first.</p>
      <button class="btn btn-secondary" id="review-cta">Write a review</button>
    </div>`;

  view.querySelector('#save-map').onclick = (e) => {
    const on = store.toggle('maps', m.id);
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = `${on ? icon.bookmarkOn : icon.bookmark}<span>${on ? 'Saved' : 'Save this map'}</span>`;
    toast(on ? 'Saved to your maps' : 'Removed from your maps');
  };

  view.querySelectorAll('[data-save]').forEach((b) => {
    b.onclick = () => {
      const on = store.toggle('places', b.dataset.save);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = on ? icon.bookmarkOn : icon.bookmark;
      toast(on ? 'Saved to your places' : 'Removed from your places');
    };
  });

  view.querySelector('#review-cta').onclick = () => toast('Sign-in arrives with the backend build');

  mountLeaflet(m);
}

function mountLeaflet(m) {
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  const el = document.getElementById('map');
  if (!el || !window.L || !m.places.length) return;

  leafletMap = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  }).addTo(leafletMap);

  const markers = new Map();
  for (const p of m.places) {
    const marker = L.marker([p.lat, p.lng], {
      title: p.name,
      icon: pinIcon(p.n, false),
    }).addTo(leafletMap);
    marker.rlNumber = p.n;
    marker.on('click', () => selectPlace(p, { scroll: true }));
    markers.set(p.id, marker);
  }
  markerIndex = markers;
  selectedId = null;

  leafletMap.fitBounds(L.latLngBounds(m.places.map((p) => [p.lat, p.lng])), {
    padding: [34, 34],
    maxZoom: 16,
  });

  // tapping a row drives the map, mirroring the pin -> row direction
  view.querySelectorAll('.place-main').forEach((el) => {
    const row = el.closest('.place');
    const p = m.places.find((x) => `p-${x.id}` === row.id);
    el.onclick = () => selectPlace(p, { scroll: false, pan: true });
  });
}

const pinIcon = (n, active) => L.divIcon({
  className: '',
  html: `<span class="pin-marker${active ? ' is-active' : ''}">${n}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

let markerIndex = new Map();
let selectedId = null;

function selectPlace(p, { scroll = false, pan = false } = {}) {
  const prev = selectedId && markerIndex.get(selectedId);
  if (prev) prev.setIcon(pinIcon(prev.rlNumber, false));
  document.querySelectorAll('.place.is-active').forEach((n) => n.classList.remove('is-active'));

  selectedId = p.id;
  const marker = markerIndex.get(p.id);
  if (marker) marker.setIcon(pinIcon(p.n, true));
  if (pan && leafletMap) leafletMap.panTo([p.lat, p.lng], { animate: true });

  const row = document.getElementById(`p-${p.id}`);
  if (!row) return;
  row.classList.add('is-active');
  if (scroll) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ------------------------------------------------------------
   Saved
   ------------------------------------------------------------ */
let savedTab = 'maps';

function renderSaved() {
  const saved = store.read();
  const maps = DATA.maps.filter((m) => saved.maps.includes(m.id));
  const places = DATA.maps.flatMap((m) =>
    m.places.filter((p) => saved.places.includes(p.id)).map((p) => ({ ...p, from: m.title, mapId: m.id })));

  const body = savedTab === 'maps' ? savedMapsHtml(maps) : savedPlacesHtml(places);

  view.innerHTML = `
    <div class="segmented" role="tablist">
      <button class="seg" role="tab" data-tab="maps" aria-selected="${savedTab === 'maps'}">
        Maps<span class="n">${maps.length}</span>
      </button>
      <button class="seg" role="tab" data-tab="places" aria-selected="${savedTab === 'places'}">
        Places<span class="n">${places.length}</span>
      </button>
    </div>
    ${body}
    <div class="notice">
      <b>Saved on this device for now.</b> Sign-in and cloud sync arrive with the backend build, so this list will follow your account instead.
    </div>`;

  view.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { savedTab = b.dataset.tab; renderSaved(); };
  });
}

function savedMapsHtml(maps) {
  if (!maps.length) {
    return `<div class="empty">
      <h3>Nothing saved yet</h3>
      <p>Tap the bookmark on any map to keep it here for your trip.</p>
      <a class="btn btn-cream" href="#/">Browse maps</a>
    </div>`;
  }
  return `<ul class="feed" style="padding-top:var(--sp-md)">${maps.map(cardHtml).join('')}</ul>`;
}

function savedPlacesHtml(places) {
  if (!places.length) {
    return `<div class="empty">
      <h3>No places saved</h3>
      <p>Save individual spots from inside any map. They collect here, separately from saved maps.</p>
      <a class="btn btn-cream" href="#/">Browse maps</a>
    </div>`;
  }
  return `<ul class="places" style="padding-top:var(--sp-xs)">
    ${places.map((p) => `
      <li class="saved-place">
        <div class="place-main">
          <h3 class="place-name">${esc(p.name)}</h3>
          <p class="place-addr">${esc(p.address)}</p>
          ${p.tip ? `<p class="place-tip">${esc(p.tip)}</p>` : ''}
          <p class="saved-from">from <a href="#/m/${p.mapId}">${esc(p.from)}</a></p>
        </div>
        <div class="place-actions">
          <button class="act" data-unsave="${p.id}" aria-pressed="true" aria-label="Remove ${esc(p.name)}">${icon.bookmarkOn}</button>
          <a class="act" href="${esc(p.gmaps)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(p.name)} in Google Maps">${icon.external}</a>
        </div>
      </li>`).join('')}
  </ul>`;
}

/* ------------------------------------------------------------
   Me
   ------------------------------------------------------------ */
function renderMe() {
  const saved = store.read();
  view.innerHTML = `
    <div class="pad">
      <p class="eyebrow">Account</p>
      <h1 class="lede">Not signed in</h1>
      <p class="lede-sub">Sign-in unlocks saving across devices and writing map reviews. It ships with the backend build.</p>
      <button class="btn btn-dark btn-block" id="signin">Sign in</button>
    </div>

    <div class="section-head"><h2>On this device</h2></div>
    <div class="pad" style="padding-top:0">
      <p class="card-summary">${saved.maps.length} maps · ${saved.places.length} places saved locally.</p>
      <button class="btn btn-secondary btn-block" id="clear" style="margin-top:var(--sp-sm)">Clear saved items</button>
    </div>

    <div class="notice">
      <b>Curator tools are not in this build.</b> The nine maps here were imported from the curators' own lists. Whether curators get an in-app editor is the open question for Tuesday.
    </div>`;

  view.querySelector('#signin').onclick = () => toast('Sign-in arrives with the backend build');
  view.querySelector('#clear').onclick = () => {
    store.write({ maps: [], places: [] });
    toast('Cleared');
    renderMe();
  };
}

/* ------------------------------------------------------------
   Router
   ------------------------------------------------------------ */
const mapUrl = (id) => `${location.origin}${location.pathname}#/m/${id}`;

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const m = h.match(/^\/m\/(.+)$/);
  if (m) {
    const found = DATA.maps.find((x) => x.id === m[1]);
    return found ? { name: 'map', map: found } : { name: 'home' };
  }
  if (h === '/saved') return { name: 'saved' };
  if (h === '/me') return { name: 'me' };
  return { name: 'home' };
}

function render() {
  const route = parse();
  renderTopbar(route);
  renderTabbar(route);

  if (route.name === 'map') renderMap(route.map);
  else if (route.name === 'saved') renderSaved();
  else if (route.name === 'me') renderMe();
  else renderHome();

  document.title = route.name === 'map'
    ? `${route.map.title} — Real Local`
    : 'Real Local — Korea, by the people who live there';

  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
(async function boot() {
  try {
    const res = await fetch('data/maps.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (e) {
    view.innerHTML = `<div class="empty">
      <h3>Couldn't load the maps</h3>
      <p>${esc(e.message)}</p>
    </div>`;
    return;
  }

  document.getElementById('footer-stats').textContent =
    `${DATA.mapCount} maps · ${DATA.placeCount} places · data ${DATA.generatedAt}`;

  window.addEventListener('hashchange', render);
  render();
})();
