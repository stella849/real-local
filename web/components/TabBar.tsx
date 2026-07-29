import Link from 'next/link';
import { IconExplore, IconCurators, IconSaved, IconProfile } from './Icons';

/* Curators 를 Explore 바로 옆에 둔다. 이 제품이 파는 것은 장소가 아니라
   사람의 취향이므로(§1), 사람 목록이 탐색과 같은 층위여야 한다. */
const TABS = [
  { href: '/', label: 'Explore', Icon: IconExplore },
  { href: '/curators', label: 'Curators', Icon: IconCurators },
  { href: '/saved', label: 'Saved', Icon: IconSaved },
  { href: '/profile', label: 'Profile', Icon: IconProfile },
];

/** fixed + env(safe-area-inset-bottom). 탭 화면에만 붙고 상세에는 없다. */
export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="tab"
          aria-current={href === current ? 'page' : undefined}
        >
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
