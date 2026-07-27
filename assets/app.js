/* ============================================================
   Real Local — mobile web client
   Static data, hash routing, no build step (deploys as-is to Pages).
   ============================================================ */

import * as db from './data.js';

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

let DATA = null;
let leafletMap = null;
let gmap = null;

/* ------------------------------------------------------------
   저장 상태

   진짜 데이터는 Supabase에 있고, 여기서는 렌더 직전에 받아둔
   스냅샷만 들고 있는다. 화면 그리는 코드가 전부 비동기가 되는 것을
   막기 위해서다. 토글은 낙관적으로 화면을 먼저 바꾸고, 실패하면
   data.js가 되돌린 뒤 다시 그린다.
   ------------------------------------------------------------ */
let savedSnap = { maps: new Set(), places: new Set() };

async function refreshSaved() {
  if (!db.user()) { savedSnap = { maps: new Set(), places: new Set() }; return; }
  const [mm, pp] = await Promise.all([db.savedMaps(), db.savedPlaces()]);
  savedSnap = { maps: new Set(mm), places: new Set(pp) };
}

const isSaved = (kind, id) => savedSnap[kind].has(id);

/* 로그인이 필요한 동작 앞에 세우는 게이트.

   돌아갈 화면뿐 아니라 하려던 동작까지 들고 간다. 와이어프레임
   S-04 주석 ③이 짚었듯 로그인 후 그냥 화면만 돌려놓으면 사용자가
   저장을 다시 눌러야 하고, 그 지점이 이탈 구간이 된다. */
let returnTo = null;
let pendingAction = null;

function requireAuth(action = null) {
  if (db.user()) return true;
  returnTo = location.hash || '#/';
  pendingAction = action;
  location.hash = '#/signin';
  return false;
}

/** 로그인 직후 보류해 둔 동작을 한 번만 실행한다. */
async function runPendingAction() {
  const action = pendingAction;
  pendingAction = null;
  if (!action) return;
  try {
    await action();
  } catch (e) {
    console.warn('보류 동작 실패:', e.message);
  }
}

/** 저장 토글 공통 처리. 성공하면 스냅샷을 갱신한다. */
async function toggleSaved(kind, id, extra) {
  // 로그인 후 이 저장을 그대로 이어서 실행한다
  if (!requireAuth(() => db.toggleSaved(kind, id, extra))) return null;
  try {
    const on = await db.toggleSaved(kind, id, extra);
    if (on === null) return null;
    if (on) savedSnap[kind].add(id); else savedSnap[kind].delete(id);
    return on;
  } catch (e) {
    toast(e.message);
    return null;
  }
}

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

  const label = route.name === 'saved' ? 'Saved'
    : route.name === 'me' ? 'Account'
    : route.name === 'signin' ? 'Sign in' : null;
  topbar.innerHTML = label
    ? `<span class="wordmark">${label}</span>`
    : `<a class="wordmark" href="#/">Real Local</a>`;
}

function renderTabbar(route) {
  const tabs = [
    { id: 'home', href: '#/', label: 'Home', svg: icon.home },
    { id: 'saved', href: '#/saved', label: 'Saved', svg: icon.saved },
    { id: 'me', href: '#/me', label: 'Account', svg: icon.me },
  ];
  const active = route.name === 'map' ? 'home' : route.name === 'signin' ? 'me' : route.name;
  tabbar.innerHTML = tabs.map((t) => `
    <a class="tab" href="${t.href}"${t.id === active ? ' aria-current="page"' : ''}>
      ${t.svg}<span>${t.label}</span>
    </a>`).join('');
}

/* ------------------------------------------------------------
   Home
   ------------------------------------------------------------ */
let activeCity = 'all';

/* 첫 화면에 몇 개까지 보일지.

   9개를 한 번에 깔면 홈이 모바일 화면 여섯 장 분량이 된다. 목록을
   끝까지 훑는 화면이 아니라 "무엇을 파는 서비스인지" 파악하는
   화면이므로 3개만 보여주고 나머지는 요청할 때 편다. */
const PAGE = 3;
let shown = PAGE;

/* The UI is English — the audience is foreign visitors to Korea (PRD
   NFR-04). The dataset already ships city names, place names and
   curator tips in English, so nothing here needs translating at
   runtime; only the app's own copy does. */
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* One card component shared by the home feed and the Saved tab.
   The bookmark sits outside the <a> — nesting a button inside a link
   is invalid, and the click would navigate before it toggled. */
const cardHtml = (m) => {
  const on = isSaved('maps', m.id);
  return `
  <li class="feed-item">
    <a class="card" href="#/m/${m.id}">
      <div class="cover">${coverSvg(m)}</div>
      <div class="card-body">
        <h2 class="card-title">${esc(m.title)}</h2>
        <p class="card-summary">${esc(m.summary)}</p>
        <p class="card-meta">${esc(m.city)} · ${plural(m.placeCount, 'place')}</p>
      </div>
    </a>
    <button class="act card-save" data-savemap="${m.id}" aria-pressed="${on}"
            aria-label="${on ? 'Remove' : 'Save'} ${esc(m.title)}">
      ${on ? icon.bookmarkOn : icon.bookmark}
    </button>
  </li>`;
};

function renderHome() {
  const cities = [{ city: 'all', count: DATA.mapCount }, ...DATA.cities];
  const list = activeCity === 'all' ? DATA.maps : DATA.maps.filter((m) => m.city === activeCity);
  const page = list.slice(0, shown);
  const rest = list.length - page.length;

  view.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Picked by verified locals</p>
        <h1 class="lede">Korea, from the people who live there.</h1>
        <p class="lede-sub">${DATA.mapCount} maps · ${DATA.placeCount} places — the ones a local would actually take you to.</p>
      </div>
      <!-- 시안이 선택되기 전까지는 비어 있고, :empty 규칙으로 접힌다 -->
      <div class="hero-art" id="hero-art"></div>
    </section>
    <hr class="cut">

    <div class="filters" role="group" aria-label="Filter by city">
      ${cities.map((c) => `
        <button class="pill" data-city="${esc(c.city)}" aria-pressed="${c.city === activeCity}">
          ${c.city === 'all' ? 'All' : esc(c.city)}<span class="n">${c.count}</span>
        </button>`).join('')}
    </div>

    <ul class="feed">${page.map(cardHtml).join('')}</ul>

    ${rest > 0 ? `
      <div class="feed-more">
        <button class="btn btn-secondary btn-block" id="more">Show ${plural(rest, 'more map')}</button>
      </div>` : ''}`;

  // 시안(assets/theme.js)이 얹히면 여기에 메인 이미지를 그린다
  window.RL_ART?.hero?.(view.querySelector('#hero-art'), DATA);

  view.querySelectorAll('[data-city]').forEach((b) => {
    b.onclick = () => { activeCity = b.dataset.city; shown = PAGE; renderHome(); };
  });

  /* 펼친 뒤에는 새로 나온 첫 카드로 초점을 옮긴다. 버튼이 사라지면서
     화면이 위로 밀려 사용자가 자기 위치를 잃는 것을 막는다. */
  const more = view.querySelector('#more');
  if (more) more.onclick = () => {
    const from = shown;
    shown = Infinity;
    renderHome();
    view.querySelectorAll('.feed-item')[from]?.scrollIntoView({ block: 'nearest' });
  };

  bindCardSave(({ on }) => toast(on ? 'Saved to your maps' : 'Removed from your maps'));
}

/* The card stays put on the home feed, so swap the icon in place. The
   Saved tab passes its own handler, because there the row has to go. */
function bindCardSave(after) {
  view.querySelectorAll('[data-savemap]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.savemap;
      const on = await toggleSaved('maps', id);
      if (on === null) return;
      const title = DATA.maps.find((m) => m.id === id).title;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${title}`);
      b.innerHTML = on ? icon.bookmarkOn : icon.bookmark;
      after({ id, title, on });
    };
  });
}

/* ------------------------------------------------------------
   Map detail

   장소 목록과 리뷰를 탭으로 나눈다. 20곳이 넘는 지도가 9개 중 5개라,
   리뷰를 목록 아래 두면 4화면쯤 내려가야 나온다 — 있는지도 모른다.

   탭은 진짜 링크(#/m/:id, #/m/:id/reviews)다. 상태를 JS 변수로만
   들고 있으면 리뷰를 공유할 수 없고 뒤로가기가 홈으로 튄다.

   지도는 탭이 바뀌어도 다시 만들지 않는다. 아래 detail 이 지금 무엇이
   그려져 있는지 들고 있어서, 같은 지도면 패널만 갈아끼운다.
   ------------------------------------------------------------ */
const mapHash = (id, tab) => `#/m/${id}${tab === 'reviews' ? '/reviews' : ''}`;

let detail = { id: null, tab: null };

function renderMap(m, tab = 'places') {
  if (detail.id === m.id) {
    if (detail.tab !== tab) {         // 같은 지도, 탭만 바뀜 — 지도는 그대로 둔다
      detail.tab = tab;
      syncTabs(m);
      renderPanel(m);
      /* 탭은 진짜 링크라 브라우저가 해시 이동 뒤 알아서 맨 위로 올린다.
         탭 줄 위치로 맞추려 해봤자 그 스크롤에 덮여 결과가 들쭉날쭉해진다.
         브라우저와 싸우지 말고 같은 곳으로 보낸다. */
      window.scrollTo(0, 0);
    }
    return;
  }

  detail = { id: m.id, tab };
  const savedMap = isSaved('maps', m.id);

  view.innerHTML = `
    <div class="detail-head">
      <h1 class="detail-title">${esc(m.title)}</h1>
      <p class="detail-summary">${esc(m.summary)}</p>
      <div class="detail-meta">
        <span class="badge">${esc(m.city)}</span>
        <span class="badge quiet">${plural(m.placeCount, 'place')}</span>
      </div>

      <!-- 지도 위에 둔다. #map 이 sticky라 아래에 있으면 스크롤한 순간
           지도에 덮여 탭이 지도로 먹힌다. -->
      <button class="btn btn-dark btn-block" id="save-map" aria-pressed="${savedMap}"
              style="margin-top:var(--sp-sm)">
        ${savedMap ? icon.bookmarkOn : icon.bookmark}
        <span>${savedMap ? 'Saved' : 'Save this map'}</span>
      </button>
    </div>

    <div id="map" role="img" aria-label="Map of ${esc(m.title)}"></div>

    <div class="segmented detail-tabs" role="tablist">
      <a class="seg" role="tab" id="tab-places" href="${mapHash(m.id)}"
         aria-controls="panel">Places<span class="n">${m.placeCount}</span></a>
      <a class="seg" role="tab" id="tab-reviews" href="${mapHash(m.id, 'reviews')}"
         aria-controls="panel">Reviews<span class="n" id="tab-review-n"></span></a>
    </div>

    <div id="panel" role="tabpanel"></div>`;

  view.querySelector('#save-map').onclick = async (e) => {
    const btn = e.currentTarget;
    const on = await toggleSaved('maps', m.id);
    if (on === null) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = `${on ? icon.bookmarkOn : icon.bookmark}<span>${on ? 'Saved' : 'Save this map'}</span>`;
    toast(on ? 'Saved to your maps' : 'Removed from your maps');
  };

  syncTabs(m);
  renderPanel(m);
  mountMap(m);

  /* 리뷰 탭의 개수는 어느 탭에 있든 보여야 한다. 목록을 미리 받아
     캐시에 넣어두면 리뷰 탭으로 넘어갈 때 다시 부르지 않는다. */
  loadReviews(m.id).then(() => { if (detail.id === m.id) syncTabs(m); });
}

/** 탭의 선택 상태와 리뷰 개수를 현재 상태에 맞춘다. */
function syncTabs(m) {
  const places = document.getElementById('tab-places');
  const reviews = document.getElementById('tab-reviews');
  if (!places || !reviews) return;

  const onReviews = detail.tab === 'reviews';
  places.setAttribute('aria-selected', String(!onReviews));
  reviews.setAttribute('aria-selected', String(onReviews));
  document.getElementById('panel')?.setAttribute(
    'aria-labelledby', onReviews ? 'tab-reviews' : 'tab-places');

  // 0건이면 숫자를 숨긴다. 'Reviews 0' 은 비어 있다는 사실만 강조한다
  const n = reviewCache.id === m.id && reviewCache.list ? reviewCache.list.length : null;
  document.getElementById('tab-review-n').textContent = n ? String(n) : '';
}

function renderPanel(m) {
  const panel = document.getElementById('panel');
  if (!panel) return;

  if (detail.tab === 'reviews') {
    panel.innerHTML = '';
    renderReviews(m);
    return;
  }

  panel.innerHTML = `
    <ul class="places">
      ${m.places.map((p) => {
        const on = isSaved('places', p.id);
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
    </ul>`;

  panel.querySelectorAll('[data-save]').forEach((b) => {
    b.onclick = async () => {
      const on = await toggleSaved('places', b.dataset.save, { map_id: m.id });
      if (on === null) return;
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = on ? icon.bookmarkOn : icon.bookmark;
      toast(on ? 'Saved to your places' : 'Removed from your places');
    };
  });

  // 목록이 새로 그려졌으므로 지도와 다시 묶고, 고르던 행이 있으면 되살린다
  bindRowsToMap(m);
  if (selectedId) document.getElementById(`p-${selectedId}`)?.classList.add('is-active');
}

/* 지도 핀을 눌렀는데 리뷰 탭이 열려 있으면 강조할 행이 DOM 에 없다.
   그냥 두면 핀이 죽은 것처럼 보이므로 목록 탭으로 돌려놓고 고른다.
   주소는 replaceState 로만 맞춘다 — hashchange 를 일으켜 다시 그리면
   바로 아래 selectPlace 가 사라진 행을 찾게 된다. */
function ensurePlacesTab(m) {
  if (detail.tab === 'places') return;
  detail.tab = 'places';
  syncTabs(m);
  renderPanel(m);
  history.replaceState(null, '', mapHash(m.id));
}

/* ------------------------------------------------------------
   리뷰 — 지도 단위. 읽기는 비로그인도 가능하고, 쓰기만 막는다.

   목록은 지도당 한 번만 받아 캐시한다. 탭 개수 표시와 리뷰 패널이
   같은 데이터를 쓰기 때문에, 캐시가 없으면 상세 화면을 열 때마다
   같은 요청을 두 번 보내게 된다. 쓰기·삭제 뒤에는 강제로 다시 받는다.
   ------------------------------------------------------------ */
let reviewCache = { id: null, list: null };

async function loadReviews(mapId, force = false) {
  if (!force && reviewCache.id === mapId && reviewCache.list) return reviewCache.list;
  const list = await db.reviews(mapId);
  reviewCache = { id: mapId, list };
  return list;
}

async function renderReviews(m, force = false) {
  const box = document.getElementById('panel');
  if (!box || detail.tab !== 'reviews') return;

  const list = await loadReviews(m.id, force);
  // 화면을 벗어났거나 탭이 바뀐 뒤 응답이 오면 버린다
  if (detail.id !== m.id || detail.tab !== 'reviews') return;

  syncTabs(m);

  const mine = db.user() ? list.find((r) => r.user_id === db.user().id) : null;

  const composer = `
    <div class="pad" style="padding-top:0">
      <textarea class="field" id="review-body" rows="3" maxlength="1000"
        placeholder="${mine ? 'Edit your review' : 'How was this map?'}">${mine ? esc(mine.body) : ''}</textarea>
      <div class="row-end">
        ${mine ? '<button class="btn btn-secondary sm" id="review-del">Delete</button>' : ''}
        <button class="btn btn-dark sm" id="review-save">${mine ? 'Update' : 'Post review'}</button>
      </div>
    </div>`;

  const items = list.map((r) => `
    <li class="review">
      <div class="review-head">
        <b>${esc(r.author_name)}</b>
        <time>${reviewDate(r.created_at)}</time>
      </div>
      <p>${esc(r.body)}</p>
    </li>`).join('');

  box.innerHTML = list.length
    ? `<ul class="reviews">${items}</ul>${db.user() ? composer : signinPrompt()}`
    : `<div class="empty">
         <h3>No reviews yet</h3>
         <p>Reviews are left on the map as a whole, not on individual places.
            Be the first to leave one.</p>
       </div>${db.user() ? composer : signinPrompt()}`;

  const saveBtn = box.querySelector('#review-save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const body = box.querySelector('#review-body').value.trim();
      if (!body) return toast('Write something first');
      saveBtn.disabled = true;
      try {
        await db.writeReview(m.id, body);
        toast(mine ? 'Review updated' : 'Review posted');
        renderReviews(m, true);
      } catch (e) { toast(e.message); saveBtn.disabled = false; }
    };
  }

  const delBtn = box.querySelector('#review-del');
  if (delBtn) {
    delBtn.onclick = async () => {
      await db.deleteReview(m.id);
      toast('Review deleted');
      renderReviews(m, true);
    };
  }

  const cta = box.querySelector('#review-signin');
  if (cta) cta.onclick = () => requireAuth();   // 리뷰는 본문이 필요해 화면 복귀만 한다
}

const signinPrompt = () => `
  <div class="pad" style="padding-top:0">
    <button class="btn btn-secondary btn-block" id="review-signin">Sign in to write a review</button>
  </div>`;

/* Day-month-year spelled out. The audience is international, so 07/08
   would read as two different dates depending on where they're from. */
const reviewDate = (iso) => new Date(iso).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
});

/* ------------------------------------------------------------
   Map

   Two backends. Leaflet + CARTO needs no key and is what ships by
   default; Google Maps takes over as soon as a key is present in
   assets/config.js. Q6 decides which one we keep — until then the
   app must run correctly with no key at all, so any failure on the
   Google path falls back rather than leaving a blank panel.
   ------------------------------------------------------------ */
let googleAuthFailed = false;
let currentMapData = null;

/* 지도를 한 번 띄우는 동안 마운트는 한 번만 일어나야 한다.

   구글 인증이 거부되면 gm_authFailure 가 Leaflet 으로 갈아끼우는데,
   그 사이 loadGoogleMaps 의 then 이 뒤늦게 도착해 같은 자리에 Leaflet 을
   한 번 더 올린다. 두 번째 마운트가 컨테이너에 포커스를 주면서 sticky
   지도가 화면 위로 당겨져, 제목과 지도 사이에 빈 띠가 생겼다. */
let mountToken = 0;

/* Auth errors — a wrong key, or a referrer outside the allow-list —
   are not thrown. Google paints its own grey "Something went wrong" panel
   over the map and calls this hook instead, so this is the only place
   the failure can be caught. Without it a misconfigured key leaves the
   demo showing an error panel where the map should be. */
window.gm_authFailure = () => {
  googleAuthFailed = true;
  console.warn('Google Maps auth rejected (check the API key referrer list); using Leaflet');
  if (!currentMapData) return;
  mountToken++;                       // 뒤늦게 도착할 then 을 무효화한다
  mountLeaflet(currentMapData);
};

function mountMap(m) {
  currentMapData = m;

  const key = window.RL_CONFIG?.googleMapsApiKey?.trim();
  if (!key || googleAuthFailed) return mountLeaflet(m);

  const token = ++mountToken;
  loadGoogleMaps(key)
    .then(() => {
      if (token !== mountToken) return;          // 이미 다른 쪽이 처리했다
      if (googleAuthFailed) mountLeaflet(m); else mountGoogle(m);
    })
    .catch((e) => {
      if (token !== mountToken) return;
      console.warn('Google Maps unavailable, falling back to Leaflet:', e.message);
      mountLeaflet(m);
    });
}

let googleLoader = null;
function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleLoader) return googleLoader;

  googleLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    /* language=en pins Google's own labels and controls to English.
       Without it Google follows the browser locale, so a visitor on a
       Korean phone gets Hangul street names — the one thing this app
       exists to spare them. region=KR keeps Korean address formatting. */
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=en&region=KR&callback=__rlGmapsReady`;
    s.async = true;
    // loading=async defers everything behind importLibrary(), so the
    // bootstrap only signals that the loader itself is ready
    window.__rlGmapsReady = () => resolve();
    s.onerror = () => reject(new Error('script failed to load'));
    setTimeout(() => reject(new Error('timed out')), 10000);
    document.head.appendChild(s);
  });
  return googleLoader;
}

async function mountGoogle(m) {
  const el = document.getElementById('map');
  if (!el || !m.places.length) return;

  /* Under loading=async nothing hangs off google.maps directly —
     each library has to be imported before use. */
  const [{ Map: GMap }, { LatLngBounds }, markerLib] = await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('core'),
    google.maps.importLibrary('marker').catch(() => ({})),
  ]);

  teardownMap();

  const mapId = window.RL_CONFIG?.googleMapsMapId?.trim();
  gmap = new GMap(el, {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    scrollwheel: false,
    ...(mapId ? { mapId } : {}),
  });

  const bounds = new LatLngBounds();
  const markers = new Map();
  // AdvancedMarkerElement needs a Map ID; without one fall back to the
  // classic marker so a bare key still renders numbered pins
  const useAdvanced = Boolean(mapId && markerLib.AdvancedMarkerElement);

  for (const p of m.places) {
    const pos = { lat: p.lat, lng: p.lng };
    bounds.extend(pos);

    let marker;
    if (useAdvanced) {
      const node = document.createElement('span');
      node.className = 'pin-marker';
      node.textContent = String(p.n);
      marker = new markerLib.AdvancedMarkerElement({
        map: gmap, position: pos, title: p.name, content: node,
      });
      marker.rlNode = node;
    } else {
      marker = new markerLib.Marker({
        map: gmap, position: pos, title: p.name, zIndex: p.n,
        label: { text: String(p.n), color: '#ffffff', fontSize: '12px', fontWeight: '600' },
      });
    }
    marker.addListener('click', () => { ensurePlacesTab(m); selectPlace(p, { scroll: true }); });
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
    marker.on('click', () => { ensurePlacesTab(m); selectPlace(p, { scroll: true }); });
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
  // remove() first — it also clears Leaflet's marker on the element
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  if (gmap) {
    const el = document.getElementById('map');
    if (el) {
      // Google leaves its DOM behind, including the grey auth-error panel,
      // so falling back would otherwise draw Leaflet on top of the error
      el.innerHTML = '';
      /* It also writes position:relative inline on the container. That
         outranks our sticky rule, and the leftover top:56px then shoves
         the map down 56px — a gap under the header, the map overlapping
         the list below. Leaflet honours whatever position it finds, so
         the damage outlives Google. Strip it. */
      el.removeAttribute('style');
    }
    gmap = null;
  }
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
  if (!db.user()) {
    view.innerHTML = `<div class="empty">
      <h3>Sign in to save places</h3>
      <p>Saved maps and places stay with your account, so they're there on any device.</p>
      <button class="btn btn-dark" id="go-signin">Sign in</button>
    </div>`;
    view.querySelector('#go-signin').onclick = () => requireAuth();
    return;
  }

  const maps = DATA.maps.filter((m) => savedSnap.maps.has(m.id));
  const places = DATA.maps.flatMap((m) =>
    m.places.filter((p) => savedSnap.places.has(p.id)).map((p) => ({ ...p, from: m.title, mapId: m.id })));

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
    ${body}`;

  view.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { savedTab = b.dataset.tab; renderSaved(); };
  });

  // unsaving here drops the row, so re-render rather than swap the icon
  view.querySelectorAll('[data-unsave]').forEach((b) => {
    b.onclick = async () => {
      const on = await toggleSaved('places', b.dataset.unsave);
      if (on === null) return;
      toast('Removed from your places');
      renderSaved();
    };
  });

  bindCardSave(({ on }) => {
    toast(on ? 'Saved to your maps' : 'Removed from your maps');
    renderSaved();
  });
}

function savedMapsHtml(maps) {
  if (!maps.length) {
    return `<div class="empty">
      <h3>No saved maps yet</h3>
      <p>Tap the bookmark on any map and it lands here, ready for your trip.</p>
      <a class="btn btn-secondary" href="#/">Browse maps</a>
    </div>`;
  }
  return `<ul class="feed" style="padding-top:var(--sp-md)">${maps.map(cardHtml).join('')}</ul>`;
}

function savedPlacesHtml(places) {
  if (!places.length) {
    return `<div class="empty">
      <h3>No saved places yet</h3>
      <p>Save places one by one from inside a map. They collect here on their own, separately from saved maps.</p>
      <a class="btn btn-secondary" href="#/">Browse maps</a>
    </div>`;
  }
  return `<ul class="places" style="padding-top:var(--sp-xs)">
    ${places.map((p) => `
      <li class="saved-place">
        <div class="place-main">
          <h3 class="place-name">${esc(p.name)}</h3>
          <p class="place-addr">${esc(p.address)}</p>
          ${p.tip ? `<p class="place-tip">${esc(p.tip)}</p>` : ''}
          <p class="saved-from">From <a href="#/m/${p.mapId}">${esc(p.from)}</a></p>
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
  const u = db.user();

  if (!u) {
    view.innerHTML = `
      <div class="pad">
        <p class="eyebrow">Account</p>
        <h1 class="lede">You're not signed in</h1>
        <p class="lede-sub">Sign in to keep your saved list with your account and to review maps.</p>
        <button class="btn btn-dark btn-block" id="signin">Sign in / Sign up</button>
      </div>
      <div class="notice">
        <b>Curator tools aren't in this build.</b> The ${DATA.mapCount} maps here come straight from lists the curators put together themselves.
      </div>`;
    view.querySelector('#signin').onclick = () => requireAuth();
    return;
  }

  view.innerHTML = `
    <div class="pad">
      <p class="eyebrow">Account</p>
      <h1 class="lede">${esc(db.displayName())}</h1>
      <p class="lede-sub">${esc(u.email)}</p>
    </div>

    <div class="section-head"><h2>Saved</h2></div>
    <div class="pad" style="padding-top:0">
      <p class="card-summary">${plural(savedSnap.maps.size, 'map')} · ${plural(savedSnap.places.size, 'place')}</p>
      <a class="btn btn-secondary btn-block" href="#/saved" style="margin-top:var(--sp-sm)">View saved list</a>
      <button class="btn btn-secondary btn-block" id="signout" style="margin-top:var(--sp-xs)">Sign out</button>
    </div>

    <div class="notice">
      <b>Curator tools aren't in this build.</b> The ${DATA.mapCount} maps here come straight from lists the curators put together themselves.
    </div>`;

  view.querySelector('#signout').onclick = async () => {
    await db.signOut();
    await refreshSaved();
    toast('Signed out');
    location.hash = '#/';
  };
}

/* ------------------------------------------------------------
   Sign in — 게이트에서 넘어오므로 성공하면 원래 자리로 돌려보낸다
   ------------------------------------------------------------ */
let signinMode = 'in';   // 'in' | 'up'

function renderSignIn() {
  const isUp = signinMode === 'up';
  view.innerHTML = `
    <div class="pad" style="padding-top:var(--sp-xl)">
      <p class="eyebrow">Real Local</p>
      <h1 class="lede">${isUp ? 'Create an account' : 'Sign in'}</h1>
      <p class="lede-sub">${isUp
        ? 'Your saved list and reviews live in your account.'
        : 'Pick up your saved places wherever you are.'}</p>

      <form id="auth-form" novalidate>
        <input class="field" id="email" type="email" inputmode="email"
               autocomplete="email" placeholder="Email" required>
        <input class="field" id="password" type="password"
               autocomplete="${isUp ? 'new-password' : 'current-password'}"
               placeholder="Password${isUp ? ' (6 characters or more)' : ''}" required>
        <p class="form-error" id="auth-error" role="alert"></p>
        <button class="btn btn-dark btn-block" id="auth-submit" type="submit">
          ${isUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button class="btn btn-secondary btn-block" id="auth-switch" style="margin-top:var(--sp-xs)">
        ${isUp ? 'I already have an account' : 'No account yet? Sign up'}
      </button>
    </div>`;

  const err = view.querySelector('#auth-error');
  const btn = view.querySelector('#auth-submit');

  view.querySelector('#auth-switch').onclick = () => {
    signinMode = isUp ? 'in' : 'up';
    renderSignIn();
  };

  view.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = view.querySelector('#email').value.trim();
    const password = view.querySelector('#password').value;
    if (!email || !password) { err.textContent = 'Enter your email and password'; return; }

    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'One moment…';

    try {
      if (isUp) {
        const { needsConfirm } = await db.signUp(email, password);
        if (needsConfirm) {
          view.innerHTML = `<div class="empty">
            <h3>Check your inbox</h3>
            <p>We sent a confirmation email to <b>${esc(email)}</b>. Tap the link and you're in.</p>
          </div>`;
          return;
        }
      } else {
        await db.signIn(email, password);
      }
      await runPendingAction();
      db.resetCache();
      await refreshSaved();
      const back = returnTo && returnTo !== '#/signin' ? returnTo : '#/';
      returnTo = null;
      if (location.hash === back) render(); else location.hash = back;
    } catch (e2) {
      err.textContent = e2.message;
      btn.disabled = false;
      btn.textContent = isUp ? 'Create account' : 'Sign in';
    }
  };
}

/* ------------------------------------------------------------
   Router
   ------------------------------------------------------------ */
const mapUrl = (id) => `${location.origin}${location.pathname}#/m/${id}`;

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  // 슬러그에는 / 가 없으므로 마지막 조각으로 탭을 가른다
  const m = h.match(/^\/m\/([^/]+)(?:\/(reviews))?$/);
  if (m) {
    const found = DATA.maps.find((x) => x.id === m[1]);
    return found ? { name: 'map', map: found, tab: m[2] ? 'reviews' : 'places' } : { name: 'home' };
  }
  if (h === '/saved') return { name: 'saved' };
  if (h === '/me') return { name: 'me' };
  if (h === '/signin') return { name: 'signin' };
  return { name: 'home' };
}

function render() {
  const route = parse();
  const staying = route.name === 'map' && detail.id === route.map.id;

  renderTopbar(route);
  renderTabbar(route);

  if (route.name === 'map') {
    renderMap(route.map, route.tab);
  } else {
    detail = { id: null, tab: null };   // 상세를 떠났다
    if (route.name === 'saved') renderSaved();
    else if (route.name === 'me') renderMe();
    else if (route.name === 'signin') renderSignIn();
    else renderHome();
  }

  document.title = route.name === 'map'
    ? `${route.map.title} — Real Local`
    : 'Real Local — Korea, from the people who live there';

  // 탭만 바꾼 것이라면 renderMap 이 탭 줄 위치로 옮긴다. 여기서 0으로
  // 올려버리면 지도부터 다시 스크롤해 내려와야 한다.
  if (!staying) window.scrollTo(0, 0);
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

  // 세션 복구와 저장 목록을 먼저 받아온다. 실패해도 앱은 뜬다 —
  // 지도 탐색은 로그인과 무관하게 동작해야 한다.
  await db.init();
  await refreshSaved().catch((e) => console.warn('저장 목록 조회 실패:', e.message));

  let lastUid = db.user()?.id ?? null;
  db.onAuth(async (sess) => {
    const uid = sess?.user?.id ?? null;
    if (uid === lastUid) return;      // 토큰 갱신만으로는 다시 그리지 않는다
    lastUid = uid;
    db.resetCache();
    await refreshSaved();
    render();
  });

  window.addEventListener('hashchange', render);
  render();
})();
