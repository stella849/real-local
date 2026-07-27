/* ============================================================
   Real Local — mobile web client
   Static data, hash routing, no build step (deploys as-is to Pages).
   ============================================================ */

import { moonJar, giwa, peony, tigerImg } from './motifs.js';

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
    toast('링크를 복사했어요');
  } catch {
    toast(url);
  }
}

/* ------------------------------------------------------------
   Cover minimap

   The dataset ships no photography, so each card is identified by
   the shape of its own pin cluster — computed from lat/lng at
   build time, drawn here as SVG.

   Structure is fixed by the client, so only the rendering changed:
   the pins are pen circles now rather than two offset print passes.
   ------------------------------------------------------------ */
function coverSvg(map) {
  const dots = map.cover.map((p, i) => {
    const o = 0.5 + (0.5 * (map.cover.length - i)) / map.cover.length;
    const r = i === 0 ? 4.2 : 3.2;
    return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(p.y * 100).toFixed(2)}" r="${r}"
             fill="#F3EADD" stroke="#2C2620" stroke-width="2" opacity="${o.toFixed(2)}"/>`;
  }).join('');

  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
               filter="url(#pen-soft)" aria-hidden="true">${dots}</svg>`;
}

/* ------------------------------------------------------------
   Hero block print

   Carved-block vocabulary: ridgelines behind, hanok eaves in
   front, and a beige pass offset from the ink pass so the two
   colours sit slightly out of register.
   ------------------------------------------------------------ */
function heroArt() {
  const INK = '#2C2620';
  const EAVE = 124;   // lowest point of the eave, at the centre of the span
  const GROUND = 146;

  // ridgelines are drawn as open strokes now, not filled masses
  const ridgeFar =
    'M0 72 C42 56 64 66 98 53 C134 39 152 59 188 53 C224 47 246 32 284 42 C318 51 352 38 390 46';
  const ridgeNear =
    'M0 100 C34 84 54 90 80 77 C106 64 130 80 158 73 C188 65 208 84 238 79 '
    + 'C268 74 290 60 320 71 C346 80 368 70 390 75';

  /* A giwa roof from the front. The eave line lifts at the corners —
     the tips sit ABOVE the centre of the eave — so it reads as a shallow
     crescent rather than a cap. Outlined rather than filled: the pen
     line is what carries the texture now. */
  const roof = (x, w, h) => {
    const lift = h * 0.42;
    const tip = (EAVE - lift).toFixed(1);
    const cx = x + w * 0.5;
    return `<path d="M${x} ${tip} `
      + `Q${cx} ${(EAVE - h * 1.35).toFixed(1)} ${x + w} ${tip} `
      + `Q${cx} ${(EAVE + lift).toFixed(1)} ${x} ${tip} Z"
      fill="#E8E4DC" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
  };

  /* wall below the eave, drawn as posts and a doorway rather than a slab */
  const wall = (cx, w) => {
    const x = cx - w / 2;
    const dw = Math.max(8, w * 0.3);
    return `<path d="M${x} ${EAVE} L${x} ${GROUND} M${x + w} ${EAVE} L${x + w} ${GROUND}"
              stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <path d="M${(cx - dw / 2).toFixed(1)} ${GROUND} L${(cx - dw / 2).toFixed(1)} ${GROUND - 14}
                     L${(cx + dw / 2).toFixed(1)} ${GROUND - 14} L${(cx + dw / 2).toFixed(1)} ${GROUND}"
              stroke="${INK}" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
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

  /* 전통 구름 — the motif sheet pairs giwa with these curls and calls
     the pair "지도의 상징", so the hero carries both */
  const cloud = (x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M2 26 C-2 20 1 12 8 11 C9 4 16 0 23 3 C27 -1 35 0 37 6
               C44 6 48 13 45 19 C43 24 38 26 33 26 Z"
            fill="#DCEAF2" stroke="#7FA3BC" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M8 11 C13 8 19 10 20 15 C21 19 18 22 15 21"
            fill="none" stroke="#7FA3BC" stroke-width="2.2" stroke-linecap="round"/>
    </g>`;

  return `<svg viewBox="0 28 390 128" preserveAspectRatio="xMidYMid meet"
               filter="url(#pen-soft)" aria-hidden="true">
    <circle cx="318" cy="52" r="15" fill="none" stroke="#C9BEA9" stroke-width="2.2"/>
    ${cloud(14, 36, 1.0)}
    ${cloud(206, 30, 0.76)}
    ${cloud(288, 70, 0.54)}
    <path d="${ridgeFar}" fill="none" stroke="#C9BEA9" stroke-width="2.2" stroke-linecap="round"/>
    <path d="${ridgeNear}" fill="none" stroke="#B3A794" stroke-width="2.4" stroke-linecap="round"/>
    ${buildings}
  </svg>`;
  /* no ground rule — a full-width 2px line is exactly what the
     displacement filter shreds, and the posts already sit the
     village on a baseline without it */
}

/* ------------------------------------------------------------
   Chrome
   ------------------------------------------------------------ */
function renderTopbar(route) {
  if (route.name === 'map') {
    const m = route.map;
    topbar.innerHTML = `
      <button class="iconbtn" id="nav-back" aria-label="뒤로">${icon.back}</button>
      <span class="topbar-title">${esc(m.title)}</span>
      <span class="topbar-spacer"></span>
      <button class="iconbtn" id="nav-share" aria-label="이 지도 공유하기">${icon.share}</button>`;
    topbar.querySelector('#nav-back').onclick = () => {
      if (history.length > 1) history.back(); else location.hash = '#/';
    };
    topbar.querySelector('#nav-share').onclick = () => share(m.title, mapUrl(m.id));
    return;
  }

  const label = route.name === 'saved' ? '저장' : route.name === 'me' ? '내 정보' : null;
  topbar.innerHTML = label
    ? `<span class="wordmark">${label}</span>`
    : `<a class="wordmark" href="#/">Real Local</a>`;
}

function renderTabbar(route) {
  const tabs = [
    { id: 'home', href: '#/', label: '홈', svg: icon.home },
    { id: 'saved', href: '#/saved', label: '저장', svg: icon.saved },
    { id: 'me', href: '#/me', label: '내 정보', svg: icon.me },
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

// the dataset ships city names in English; label them in Korean for this build
const CITY_KO = { Seoul: '서울', Seongsu: '성수', Busan: '부산' };
const cityLabel = (c) => CITY_KO[c] ?? c;

/* One card component shared by the home feed and the Saved tab.
   The bookmark sits outside the <a> — nesting a button inside a link
   is invalid, and the click would navigate before it toggled. */
const cardHtml = (m) => {
  const on = store.has('maps', m.id);
  return `
  <li class="feed-item">
    <a class="card" href="#/m/${m.id}">
      <div class="cover">${coverSvg(m)}</div>
      <div class="card-body">
        <h2 class="card-title">${esc(m.title)}</h2>
        <p class="card-summary">${esc(m.summary)}</p>
        <p class="card-meta">${esc(cityLabel(m.city))} · ${m.placeCount}곳</p>
      </div>
    </a>
    <button class="act card-save" data-savemap="${m.id}" aria-pressed="${on}"
            aria-label="${esc(m.title)} ${on ? '저장 해제' : '저장'}">
      ${on ? icon.bookmarkOn : icon.bookmark}
    </button>
  </li>`;
};

function renderHome() {
  const cities = [{ city: 'all', count: DATA.mapCount }, ...DATA.cities];
  const list = activeCity === 'all' ? DATA.maps : DATA.maps.filter((m) => m.city === activeCity);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-art">${heroArt()}</div>
      <div class="hero-copy">
        <p class="eyebrow">인증된 로컬이 직접 골랐어요</p>
        <h1 class="lede">그곳에 사는 사람들이 소개하는 한국.</h1>
        <p class="lede-sub">지도 ${DATA.mapCount}개 · 장소 ${DATA.placeCount}곳 — 로컬이라면 직접 데려가 줄 곳들.</p>
      </div>
    </section>
    <hr class="cut">

    <div class="filters" role="group" aria-label="도시로 거르기">
      ${cities.map((c) => `
        <button class="pill" data-city="${esc(c.city)}" aria-pressed="${c.city === activeCity}">
          ${c.city === 'all' ? '전체' : esc(cityLabel(c.city))}<span class="n">${c.count}</span>
        </button>`).join('')}
    </div>

    <ul class="feed">${list.map(cardHtml).join('')}</ul>`;

  view.querySelectorAll('[data-city]').forEach((b) => {
    b.onclick = () => { activeCity = b.dataset.city; renderHome(); };
  });

  bindCardSave(({ title, on }) => toast(on ? '내 지도에 저장했어요' : '내 지도에서 뺐어요'));
}

/* The card stays put on the home feed, so swap the icon in place. The
   Saved tab passes its own handler, because there the row has to go. */
function bindCardSave(after) {
  view.querySelectorAll('[data-savemap]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.savemap;
      const on = store.toggle('maps', id);
      const title = DATA.maps.find((m) => m.id === id).title;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${title} ${on ? '저장 해제' : '저장'}`);
      b.innerHTML = on ? icon.bookmarkOn : icon.bookmark;
      after({ id, title, on });
    };
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
        <span class="badge">${esc(cityLabel(m.city))}</span>
        <span class="badge quiet">${m.placeCount}곳</span>
      </div>
    </div>

    <div id="map" role="img" aria-label="${esc(m.title)} 지도"></div>

    <div class="pad" style="padding-bottom:0">
      <button class="btn btn-dark btn-block" id="save-map" aria-pressed="${savedMap}">
        ${savedMap ? icon.bookmarkOn : icon.bookmark}
        <span>${savedMap ? '저장됨' : '이 지도 저장하기'}</span>
      </button>
    </div>

    <div class="section-head">
      <h2>장소</h2><span class="count">${m.placeCount}</span>
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
                    aria-label="${esc(p.name)} ${on ? '저장 해제' : '저장'}">
              ${on ? icon.bookmarkOn : icon.bookmark}
            </button>
            <a class="act" href="${esc(p.gmaps)}" target="_blank" rel="noopener noreferrer"
               aria-label="구글 지도에서 ${esc(p.name)} 열기">${icon.external}</a>
          </div>
        </li>`;
      }).join('')}
    </ul>

    <div class="section-head"><h2>리뷰</h2><span class="count">0</span></div>
    <div class="empty">
      <div class="motif">${peony()}</div>
      <h3>아직 리뷰가 없어요</h3>
      <p>리뷰는 개별 장소가 아니라 지도 전체에 대해 남깁니다. 로그인하고 첫 리뷰를 남겨보세요.</p>
      <button class="btn btn-secondary" id="review-cta">리뷰 쓰기</button>
      <p class="motif-cap">모란 · 환대의 꽃</p>
    </div>`;

  view.querySelector('#save-map').onclick = (e) => {
    const on = store.toggle('maps', m.id);
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = `${on ? icon.bookmarkOn : icon.bookmark}<span>${on ? '저장됨' : '이 지도 저장하기'}</span>`;
    toast(on ? '내 지도에 저장했어요' : '내 지도에서 뺐어요');
  };

  view.querySelectorAll('[data-save]').forEach((b) => {
    b.onclick = () => {
      const on = store.toggle('places', b.dataset.save);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = on ? icon.bookmarkOn : icon.bookmark;
      toast(on ? '내 장소에 저장했어요' : '내 장소에서 뺐어요');
    };
  });

  view.querySelector('#review-cta').onclick = () => toast('로그인은 백엔드 빌드와 함께 열려요');

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
        지도<span class="n">${maps.length}</span>
      </button>
      <button class="seg" role="tab" data-tab="places" aria-selected="${savedTab === 'places'}">
        장소<span class="n">${places.length}</span>
      </button>
    </div>
    ${body}
    <div class="notice">
      <b>지금은 이 기기에만 저장돼요.</b> 로그인과 클라우드 동기화는 백엔드 빌드와 함께 들어옵니다. 그때부터는 이 목록이 계정을 따라다녀요.
    </div>`;

  view.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { savedTab = b.dataset.tab; renderSaved(); };
  });

  // unsaving here drops the row, so re-render rather than swap the icon
  view.querySelectorAll('[data-unsave]').forEach((b) => {
    b.onclick = () => {
      store.toggle('places', b.dataset.unsave);
      toast('내 장소에서 뺐어요');
      renderSaved();
    };
  });

  bindCardSave(({ on }) => {
    toast(on ? '내 지도에 저장했어요' : '내 지도에서 뺐어요');
    renderSaved();
  });
}

function savedMapsHtml(maps) {
  if (!maps.length) {
    return `<div class="empty">
      <div class="motif">${moonJar()}</div>
      <h3>아직 저장한 지도가 없어요</h3>
      <p>지도에서 북마크를 누르면 여행 때 볼 수 있게 여기에 모여요.</p>
      <a class="btn btn-cream" href="#/">지도 둘러보기</a>
      <p class="motif-cap">달항아리 · 여백의 미</p>
    </div>`;
  }
  return `<ul class="feed" style="padding-top:var(--sp-md)">${maps.map(cardHtml).join('')}</ul>`;
}

function savedPlacesHtml(places) {
  if (!places.length) {
    return `<div class="empty">
      <div class="motif sm">${giwa({ clouds: true })}</div>
      <h3>저장한 장소가 없어요</h3>
      <p>지도 안에서 장소를 하나씩 저장할 수 있어요. 저장한 지도와는 별개로 여기에 모입니다.</p>
      <a class="btn btn-cream" href="#/">지도 둘러보기</a>
      <p class="motif-cap">기와와 구름 · 골목의 숨결</p>
    </div>`;
  }
  return `<ul class="places" style="padding-top:var(--sp-xs)">
    ${places.map((p) => `
      <li class="saved-place">
        <div class="place-main">
          <h3 class="place-name">${esc(p.name)}</h3>
          <p class="place-addr">${esc(p.address)}</p>
          ${p.tip ? `<p class="place-tip">${esc(p.tip)}</p>` : ''}
          <p class="saved-from"><a href="#/m/${p.mapId}">${esc(p.from)}</a>에서</p>
        </div>
        <div class="place-actions">
          <button class="act" data-unsave="${p.id}" aria-pressed="true" aria-label="${esc(p.name)} 저장 해제">${icon.bookmarkOn}</button>
          <a class="act" href="${esc(p.gmaps)}" target="_blank" rel="noopener noreferrer" aria-label="구글 지도에서 ${esc(p.name)} 열기">${icon.external}</a>
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
      <p class="eyebrow">계정</p>
      <h1 class="lede">로그인하지 않았어요</h1>
      <p class="lede-sub">로그인하면 여러 기기에서 저장 목록을 쓰고 지도 리뷰도 남길 수 있어요. 백엔드 빌드와 함께 제공됩니다.</p>
      <button class="btn btn-dark btn-block" id="signin">로그인</button>
    </div>

    <div class="section-head"><h2>이 기기에 저장됨</h2></div>
    <div class="pad" style="padding-top:0">
      <p class="card-summary">이 기기에 지도 ${saved.maps.length}개 · 장소 ${saved.places.length}곳이 저장돼 있어요.</p>
      <button class="btn btn-secondary btn-block" id="clear" style="margin-top:var(--sp-sm)">저장 항목 모두 지우기</button>
    </div>

    <div class="pad" style="padding-top:0">
      <div class="tiger-plate">
        ${tigerImg('민화 호랑이')}
        <div class="plate-copy">
          <h3>한국인이 소개하는 진짜 한국</h3>
          <p>인증된 로컬이 직접 걸어보고 고른 곳만 담습니다.</p>
        </div>
      </div>
    </div>

    <div class="notice">
      <b>큐레이터 도구는 이번 빌드에 없어요.</b> 여기 있는 지도 9개는 큐레이터가 직접 정리한 목록을 그대로 가져온 것입니다. 큐레이터에게 앱 안의 편집기를 줄지는 화요일에 정할 문제예요.
    </div>`;

  view.querySelector('#signin').onclick = () => toast('로그인은 백엔드 빌드와 함께 열려요');
  view.querySelector('#clear').onclick = () => {
    store.write({ maps: [], places: [] });
    toast('모두 지웠어요');
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
    : 'Real Local — 그곳에 사는 사람들이 소개하는 한국';

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
      <h3>지도를 불러오지 못했어요</h3>
      <p>${esc(e.message)}</p>
    </div>`;
    return;
  }

  document.getElementById('footer-stats').textContent =
    `지도 ${DATA.mapCount}개 · 장소 ${DATA.placeCount}곳 · 데이터 ${DATA.generatedAt}`;

  window.addEventListener('hashchange', render);
  render();
})();
