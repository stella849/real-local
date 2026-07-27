/* ============================================================
   Real Local — 계정 · 저장 목록 · 리뷰

   Supabase가 여기 전부 들어있다. app.js 는 이 모듈만 호출하고
   supabase 클라이언트를 직접 만지지 않는다.

   저장은 로그인을 요구한다. 클라이언트가 기기 저장만으로는
   서비스가 안 된다고 못박았고, PRD FR-30·31 도 로그인 유저 기준이다.
   ============================================================ */

const CDN = 'https://esm.sh/@supabase/supabase-js@2';

let sb = null;
let ready = null;
let session = null;
const listeners = new Set();

/** 로그인 상태가 바뀔 때마다 호출된다. */
export function onAuth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn(session));

/** Supabase 클라이언트를 처음 필요할 때 한 번만 만든다. */
export function init() {
  if (ready) return ready;

  const url = window.RL_CONFIG?.supabaseUrl?.trim();
  const key = window.RL_CONFIG?.supabaseKey?.trim();
  if (!url || !key) {
    ready = Promise.resolve(null);
    return ready;
  }

  ready = import(/* @vite-ignore */ CDN)
    .then(({ createClient }) => {
      sb = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      sb.auth.onAuthStateChange((_e, s) => { session = s; emit(); });
      return sb.auth.getSession();
    })
    .then((res) => {
      session = res?.data?.session ?? null;
      emit();
      return sb;
    })
    .catch((e) => {
      console.warn('Supabase unavailable:', e.message);
      sb = null;
      return null;
    });

  return ready;
}

export const user = () => session?.user ?? null;
export const isReady = () => Boolean(sb);

/** 리뷰 작성자 표기. 이메일 아이디 부분만 쓴다. */
export function displayName(u = user()) {
  if (!u) return '';
  return (u.user_metadata?.name || u.email || '').split('@')[0] || '여행자';
}

/* ------------------------------------------------------------
   Auth
   ------------------------------------------------------------ */
export async function signIn(email, password) {
  await init();
  if (!sb) throw new Error('연결할 수 없어요');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error));
}

/** 가입. 이메일 확인이 켜져 있으면 needsConfirm 을 돌려준다. */
export async function signUp(email, password) {
  await init();
  if (!sb) throw new Error('연결할 수 없어요');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(authMessage(error));
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await init();
  if (sb) await sb.auth.signOut();
}

/** Supabase 오류를 사람이 읽을 수 있는 한국어로. */
function authMessage(error) {
  const m = (error?.message || '').toLowerCase();
  const code = (error?.code || '').toLowerCase();
  if (m.includes('invalid login')) return '이메일 또는 비밀번호가 맞지 않아요';
  if (m.includes('already registered') || m.includes('already been registered')) return '이미 가입된 이메일이에요';
  if (m.includes('password') && m.includes('6')) return '비밀번호는 6자 이상이어야 해요';
  if (m.includes('not confirmed') || (m.includes('email') && m.includes('confirm'))) {
    return '이메일 확인이 아직 안 됐어요. 받은 메일함을 확인해주세요';
  }
  // Supabase 기본 메일 발송은 시간당 한도가 매우 낮다. 확인 메일을 끄면
  // 가입 즉시 로그인되고 이 한도에 걸리지 않는다.
  if (code.includes('email_send_rate') || m.includes('rate limit')) {
    return '가입 요청이 너무 많아요. 잠시 후 다시 시도해주세요';
  }
  if (m.includes('is invalid') && m.includes('email')) return '사용할 수 없는 이메일 주소예요';
  return error?.message || '문제가 생겼어요';
}

/* ------------------------------------------------------------
   저장 목록

   화면이 매번 서버를 때리지 않도록 로그인 세션 동안 메모리에
   캐시한다. 토글은 캐시를 먼저 바꾸고 서버로 보내되, 실패하면
   되돌린다 — 북마크가 눌린 채로 저장이 안 되는 상태를 만들지 않기
   위해서다.
   ------------------------------------------------------------ */
let cache = { maps: null, places: null };

export function resetCache() { cache = { maps: null, places: null }; }
onAuth(() => resetCache());

async function loadSaved(kind) {
  if (cache[kind]) return cache[kind];
  await init();
  if (!sb || !user()) return (cache[kind] = new Map());

  const table = kind === 'maps' ? 'saved_maps' : 'saved_places';
  const idCol = kind === 'maps' ? 'map_id' : 'place_id';
  const { data, error } = await sb.from(table).select('*').eq('user_id', user().id);
  if (error) { console.warn(`${table} 조회 실패:`, error.message); return new Map(); }

  cache[kind] = new Map(data.map((r) => [r[idCol], r]));
  return cache[kind];
}

export async function savedMaps() { return [...(await loadSaved('maps')).keys()]; }
export async function savedPlaces() { return [...(await loadSaved('places')).keys()]; }

export async function isSaved(kind, id) {
  return (await loadSaved(kind)).has(id);
}

/** 저장 토글. 로그인 안 돼 있으면 null 을 돌려주고 호출자가 게이트를 띄운다. */
export async function toggleSaved(kind, id, extra = {}) {
  await init();
  if (!sb || !user()) return null;

  const map = await loadSaved(kind);
  const table = kind === 'maps' ? 'saved_maps' : 'saved_places';
  const idCol = kind === 'maps' ? 'map_id' : 'place_id';
  const had = map.has(id);
  const prev = map.get(id);

  // 화면을 먼저 바꾸고 서버에 보낸다
  if (had) map.delete(id); else map.set(id, { [idCol]: id, ...extra });

  const row = { user_id: user().id, [idCol]: id, ...extra };
  const { error } = had
    ? await sb.from(table).delete().eq('user_id', user().id).eq(idCol, id)
    : await sb.from(table).insert(row);

  if (error) {
    if (had) map.set(id, prev); else map.delete(id);   // 되돌린다
    throw new Error('저장에 실패했어요');
  }
  return !had;
}

/* ------------------------------------------------------------
   리뷰 — 지도 단위. 비로그인도 읽을 수 있어야 한다.
   ------------------------------------------------------------ */
export async function reviews(mapId) {
  await init();
  if (!sb) return [];
  const { data, error } = await sb
    .from('map_reviews')
    .select('id,user_id,author_name,body,created_at')
    .eq('map_id', mapId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('리뷰 조회 실패:', error.message); return []; }
  return data;
}

/** 한 사람이 한 지도에 하나. 다시 쓰면 기존 리뷰를 갱신한다. */
export async function writeReview(mapId, body) {
  await init();
  if (!sb || !user()) return null;
  const { error } = await sb.from('map_reviews').upsert({
    user_id: user().id,
    map_id: mapId,
    author_name: displayName(),
    body: body.trim(),
  }, { onConflict: 'user_id,map_id' });
  if (error) throw new Error(reviewMessage(error));
  return true;
}

export async function deleteReview(mapId) {
  await init();
  if (!sb || !user()) return;
  await sb.from('map_reviews').delete().eq('user_id', user().id).eq('map_id', mapId);
}

function reviewMessage(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('violates check constraint')) return '리뷰 내용을 확인해주세요';
  if (m.includes('could not find the table')) return '데이터베이스가 아직 준비되지 않았어요';
  return '리뷰를 저장하지 못했어요';
}
