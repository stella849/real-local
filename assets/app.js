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
let gmap = null;

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
    const r = i === 0 ? 3.6 : 2.8;
    return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(p.y * 100).toFixed(2)}" r="${r}" fill="#52525b"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${dots}</svg>`;
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
      <h3>아직 리뷰가 없어요</h3>
      <p>리뷰는 개별 장소가 아니라 지도 전체에 대해 남깁니다. 로그인하고 첫 리뷰를 남겨보세요.</p>
      <button class="btn btn-secondary" id="review-cta">리뷰 쓰기</button>
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

  mountMap(m);
}

/* ------------------------------------------------------------
   Map

   Two backends. Leaflet + CARTO needs no key and is what ships by
   default; Google Maps takes over as soon as a key is present in
   assets/config.js. Q6 decides which one we keep — until then the
   app must run correctly with no key at all, so any failure on the
   Google path falls back rather than leaving a blank panel.
   ------------------------------------------------------------ */
function mountMap(m) {
  const key = window.RL_CONFIG?.googleMapsApiKey?.trim();
  if (!key) return mountLeaflet(m);

  loadGoogleMaps(key)
    .then(() => mountGoogle(m))
    .catch((e) => {
      console.warn('Google Maps unavailable, falling back to Leaflet:', e.message);
      mountLeaflet(m);
    });
}

let googleLoader = null;
function loadGoogleMaps(key) {
  if (window.google?.maps) return Promise.resolve();
  if (googleLoader) return googleLoader;

  googleLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&loading=async&v=weekly`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script failed to load'));
    document.head.appendChild(s);
  });
  return googleLoader;
}

function mountGoogle(m) {
  const el = document.getElementById('map');
  if (!el || !m.places.length) return;
  teardownMap();

  const mapId = window.RL_CONFIG?.googleMapsMapId?.trim();
  gmap = new google.maps.Map(el, {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    scrollwheel: false,
    ...(mapId ? { mapId } : {}),
  });

  const bounds = new google.maps.LatLngBounds();
  const markers = new Map();

  for (const p of m.places) {
    const pos = { lat: p.lat, lng: p.lng };
    bounds.extend(pos);

    // AdvancedMarkerElement needs a Map ID; without one, fall back to
    // the classic marker so the map still works on a bare key
    let marker;
    if (mapId && google.maps.marker?.AdvancedMarkerElement) {
      const node = document.createElement('span');
      node.className = 'pin-marker';
      node.textContent = String(p.n);
      marker = new google.maps.marker.AdvancedMarkerElement({
        map: gmap, position: pos, title: p.name, content: node,
      });
      marker.rlNode = node;
      marker.addListener('click', () => selectPlace(p, { scroll: true }));
    } else {
      marker = new google.maps.Marker({
        map: gmap, position: pos, title: p.name,
        label: { text: String(p.n), color: '#ffffff', fontSize: '12px', fontWeight: '600' },
      });
      marker.addListener('click', () => selectPlace(p, { scroll: true }));
    }
    marker.rlNumber = p.n;
    markers.set(p.id, marker);
  }

  markerIndex = markers;
  selectedId = null;
  gmap.fitBounds(bounds, 34);
  bindRowsToMap(m);
}

function mountLeaflet(m) {
  const el = document.getElementById('map');
  if (!el || !window.L || !m.places.length) return;
  teardownMap();

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

  bindRowsToMap(m);
}

function teardownMap() {
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  gmap = null;
  markerIndex = new Map();
}

/* tapping a row drives the map, mirroring the pin -> row direction */
function bindRowsToMap(m) {
  view.querySelectorAll('.place-main').forEach((el) => {
    const row = el.closest('.place');
    const p = m.places.find((x) => `p-${x.id}` === row.id);
    if (p) el.onclick = () => selectPlace(p, { scroll: false, pan: true });
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

/* Marker highlighting differs per backend: Leaflet swaps a divIcon,
   AdvancedMarkerElement owns a DOM node we can just toggle a class on,
   and the classic google Marker only has a label to recolour. */
function markMarker(marker, n, active) {
  if (!marker) return;
  if (typeof marker.setIcon === 'function' && !marker.rlNode && window.L && marker instanceof L.Marker) {
    marker.setIcon(pinIcon(n, active));
  } else if (marker.rlNode) {
    marker.rlNode.classList.toggle('is-active', active);
  } else if (typeof marker.setLabel === 'function') {
    marker.setLabel({
      text: String(n), fontSize: '12px', fontWeight: '600',
      color: active ? '#18181b' : '#ffffff',
    });
    if (typeof marker.setZIndex === 'function') marker.setZIndex(active ? 999 : n);
  }
}

function selectPlace(p, { scroll = false, pan = false } = {}) {
  const prev = selectedId && markerIndex.get(selectedId);
  if (prev) markMarker(prev, prev.rlNumber, false);
  document.querySelectorAll('.place.is-active').forEach((n) => n.classList.remove('is-active'));

  selectedId = p.id;
  markMarker(markerIndex.get(p.id), p.n, true);

  if (pan) {
    if (leafletMap) leafletMap.panTo([p.lat, p.lng], { animate: true });
    else if (gmap) gmap.panTo({ lat: p.lat, lng: p.lng });
  }

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
      <h3>아직 저장한 지도가 없어요</h3>
      <p>지도에서 북마크를 누르면 여행 때 볼 수 있게 여기에 모여요.</p>
      <a class="btn btn-secondary" href="#/">지도 둘러보기</a>
    </div>`;
  }
  return `<ul class="feed" style="padding-top:var(--sp-md)">${maps.map(cardHtml).join('')}</ul>`;
}

function savedPlacesHtml(places) {
  if (!places.length) {
    return `<div class="empty">
      <h3>저장한 장소가 없어요</h3>
      <p>지도 안에서 장소를 하나씩 저장할 수 있어요. 저장한 지도와는 별개로 여기에 모입니다.</p>
      <a class="btn btn-secondary" href="#/">지도 둘러보기</a>
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
