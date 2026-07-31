/**
 * 아이콘은 여기 모아 둔다. 아이콘 라이브러리를 붙이지 않는 이유는
 * §10.1 이 '의미 없는 아이콘 남발'을 반려 항목으로 두었기 때문이다 —
 * 쓸 것만 직접 그리면 늘어날 일이 없다. 이모지는 UI 요소로 쓰지 않는다.
 */
type P = { className?: string };

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconBack = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M15 19 8 12l7-7" />
  </g></svg>
);

export const IconShare = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M12 15V4M8.5 7.5 12 4l3.5 3.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </g></svg>
);

export const IconBookmark = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path {...base} d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"
      fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

export const IconCompass = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15 9-2.2 4.8L8 16l2.2-4.8L15 9Z" />
  </g></svg>
);

export const IconExplore = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M9.5 4.5 4 6.8v12.7l5.5-2.3 5 2.3 5.5-2.3V4.5l-5.5 2.3-5-2.3Z" />
    <path d="M9.5 4.5v12.7M14.5 6.8v12.7" />
  </g></svg>
);

export const IconSaved = (p: P) => <IconBookmark {...p} />;

/**
 * 낙관(도장) 마크. app/icon.svg 와 같은 도형이다.
 *
 * 인라인으로 두는 이유: 파일을 참조하면 요청이 하나 늘고, Next 가
 * icon.svg 를 해시 붙은 주소로 서빙해서 경로를 직접 쓰기도 어렵다.
 * 인라인이면 currentColor 로 색을 물려받을 수도 있으나, 이 마크는
 * 단청 적색이 곧 정체성이라 색을 고정한다.
 */
export const Logo = (p: P) => (
  <svg viewBox="0 0 32 32" aria-hidden {...p}>
    <rect width="32" height="32" rx="7" fill="#AA4649" />
    <path fill="#FAF5EA" fillRule="evenodd" d="M16 6.5c-4.14 0-7.5 3.36-7.5 7.5 0 5.6 7.5 11.5 7.5 11.5S23.5 19.6 23.5 14c0-4.14-3.36-7.5-7.5-7.5z M16 11.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" />
  </svg>
);

/** 어드민 행 액션을 묶는 케밥 메뉴 트리거 */
export const IconKebab = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

/** 긴 페이지의 '맨 위로' 버튼 (PRD v1.4 §6) */
export const IconUp = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M5 14.5 12 7.5l7 7" />
  </g></svg>
);

export const IconHome = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-8.5Z" />
  </g></svg>
);

/** 큐레이터 탭 — 사람이 여럿이라는 것이 한눈에 보여야 한다 */
export const IconCurators = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 6.2a3 3 0 0 1 0 4.6M17.5 19a5.5 5.5 0 0 0-2-4.2" />
  </g></svg>
);

export const IconProfile = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </g></svg>
);

/**
 * 저장 개수 옆에 붙는 작은 표식.
 *
 * 저장 버튼과 같은 북마크 모양이어야 한다 — 버튼은 북마크인데 개수는
 * 하트로 두면 같은 개념에 기호가 둘이 된다. `♡` 글리프를 쓰지 않는
 * 이유이기도 하다: 이모지를 UI 요소로 쓰는 것은 반려 항목이다 (§10.1).
 */
export const IconSaveCount = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"
      fill="currentColor" stroke="none" />
  </svg>
);

export const IconStar = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z"
      fill="currentColor" stroke="none" />
  </svg>
);

/**
 * 사진 없는 장소의 폴백 (PRD v1.4 §4.3). 빈 회색 박스 대신 쓴다.
 * 카테고리 11종(supabase/schema.sql place_category)마다 다르게 그린다
 * (요청) — PlaceThumb.tsx 의 CATEGORY_ICON 이 category 값으로 이
 * 아래 아이콘들 중 하나를 고른다. 이 하나(포크+나이프)는 'restaurant'
 * 전용이자, 알 수 없는 값이 오면 쓰는 최종 폴백이다.
 */
export const IconMeal = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v7M8 10v11M18 3c-1.4 0-2.5 1.6-2.5 4.5S16.6 12 18 12v9M18 3v18" />
  </g></svg>
);

/** 'bbq' — 꼬치 3덩이 */
export const IconCatBbq = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4 20 20 4" />
    <circle cx="8" cy="16" r="2.1" />
    <circle cx="12" cy="12" r="2.1" />
    <circle cx="16" cy="8" r="2.1" />
  </g></svg>
);

/** 'noodles' — 면 그릇 + 김 */
export const IconCatNoodles = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M3.5 10.5h17" />
    <path d="M4.5 10.5c0 4.4 3.4 8 7.5 8s7.5-3.6 7.5-8" />
    <path d="M9 6.5c.5-1 .5-1.8-.3-2.8M12.3 6.5c.3-1.1 0-2-.7-2.8M15.6 6.5c.5-1 .5-1.8-.2-2.8" />
  </g></svg>
);

/** 'cafe' — 손잡이 있는 컵 + 김 */
export const IconCatCafe = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M5 8h11v6.5A4.5 4.5 0 0 1 11.5 19H10a4.5 4.5 0 0 1-4.5-4.5V8Z" />
    <path d="M16 9.2h1.2a2.3 2.3 0 0 1 0 4.6H16" />
    <path d="M8.2 4.3c.4-.7.4-1.3-.2-2M11.4 4.3c.4-.7.4-1.3-.2-2" />
  </g></svg>
);

/** 'bakery' — 식빵 한 덩이(칼집 두 줄) */
export const IconCatBakery = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4 12.5c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5-3.4 6-8 6-8-1.6-8-6Z" />
    <path d="M9.3 7.8v9M14.7 7.8v9" />
  </g></svg>
);

/** 'bar' — 마티니 잔 */
export const IconCatBar = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4.5 5h15L12 13.5 4.5 5Z" />
    <path d="M12 13.5V20M8.2 20h7.6" />
  </g></svg>
);

/** 'street_food' — 테이크아웃 박스 */
export const IconCatStreetFood = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4.2 9h15.6l-1.4 9.7a1.6 1.6 0 0 1-1.6 1.4H7.2a1.6 1.6 0 0 1-1.6-1.4L4.2 9Z" />
    <path d="M4.2 9 6.3 5h11.4l2.1 4" />
    <path d="M10 5V3h4v2" />
  </g></svg>
);

/** 'market' — 나무 상자(슬랫) */
export const IconCatMarket = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4 9h16v10H4V9Z" />
    <path d="M4 9 7 4h10l3 5" />
    <path d="M4 13.5h16M9 9v10M15 9v10" />
  </g></svg>
);

/** 'shop' — 손잡이 있는 쇼핑백 */
export const IconCatShop = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M6 8h12l1 12H5L6 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </g></svg>
);

/** 'culture' — 기둥 있는 건물(박물관) */
export const IconCatCulture = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M3 10 12 4l9 6" />
    <path d="M4.5 20V10.5M9 20V10.5M15 20V10.5M19.5 20V10.5" />
    <path d="M3 20h18" />
  </g></svg>
);

/** 'other' — 지도 핀 */
export const IconCatOther = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M12 3.2a6.8 6.8 0 0 1 6.8 6.8c0 4.8-6.8 10.8-6.8 10.8S5.2 14.8 5.2 10A6.8 6.8 0 0 1 12 3.2Z" />
    <circle cx="12" cy="10" r="2.2" />
  </g></svg>
);

/** 폐업 의심 경고 (어드민 Maps, 월 1회 businessStatus 크론 결과). */
export const IconWarning = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" strokeWidth="2.4" />
  </g></svg>
);

/** 선택 표시 (어드민 사진 고르기). `✓` 글리프는 안 쓴다 — R15 와 같은 이유. */
export const IconCheck = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </g></svg>
);

/** 편집 진입점 (어드민 Members Edit). 텍스트 버튼 대신 아이콘 버튼으로 쓴다. */
export const IconEdit = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </g></svg>
);

/** 미리보기 진입점 (어드민 Pending). 텍스트 Preview 대신 아이콘 버튼으로 쓴다. */
export const IconEye = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </g></svg>
);

/** 삭제(어드민 Reviews). 유일하게 진짜 삭제가 있는 화면이라 — 후기는
    맵·장소와 달리 DB 에 delete 정책이 있다(§3.3 은 맵·장소에만 해당). */
export const IconTrash = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <path d="M4 7h16" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    <path d="M10 11v6M14 11v6" />
  </g></svg>
);

/**
 * 로그인 방식 표식 (어드민 Members, §8). 구글은 브랜드 마크라 고정
 * 4색을 쓴다 — Logo 컴포넌트와 같은 이유(§10.1, currentColor 로는
 * '구글'로 안 읽힌다). 이메일 쪽은 톤을 맞추려고 같은 크기의 단색
 * 채움 아이콘으로 짝을 지었다 — 옆에 나란히 두면 하나는 선 굵기,
 * 하나는 색으로만 다르면 짝으로 안 읽힌다.
 */
export const IconGoogle = (p: P) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p}>
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.66-6.08 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20c0-1.34-.14-2.65-.4-3.92Z" />
    <path fill="#FF3D00" d="M6.31 14.69 12.88 19.5C14.66 15.1 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69Z" />
    <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24C29.21 35.09 26.72 36 24 36c-5.2 0-9.62-3.32-11.28-7.95l-6.52 5.03C9.5 39.56 16.23 44 24 44Z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.79 2.24-2.23 4.17-4.09 5.57l6.19 5.24C40.97 39.21 44 34 44 24c0-1.34-.14-2.65-.4-3.9Z" />
  </svg>
);

export const IconMail = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path fill="var(--accent)" d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
    <path fill="none" stroke="var(--canvas)" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" d="m4 6 8 6.5L20 6" />
  </svg>
);
