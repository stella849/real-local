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
