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

export const IconProfile = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}><g {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </g></svg>
);

export const IconStar = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z"
      fill="currentColor" stroke="none" />
  </svg>
);
