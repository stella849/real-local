import Link from 'next/link';
import { IconExplore, IconSaved, IconProfile } from './Icons';

const TABS = [
  { href: '/', label: 'Explore', Icon: IconExplore },
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
