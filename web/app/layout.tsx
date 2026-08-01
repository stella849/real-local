import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ScrollTop } from '@/components/ScrollTop';
import { Analytics } from '@/components/Analytics';

export const metadata: Metadata = {
  title: 'REAL LOCAL',
  description: 'Eat where Korea actually eats. Maps made by approved local curators.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',      // 하단 탭바가 env(safe-area-inset-bottom) 을 쓴다
};

/**
 * 셸은 480px 로 묶는다. 모바일 웹 가이드북이라 데스크톱에서도 폭이
 * 늘어나면 안 된다 — 어드민(S8)만 운영자용이라 자기 화면에서 푼다.
 *
 * 웹폰트를 불러오지 않는다. 시안 C(Hanok)는 가는 산세리프 + 넓은 자간으로
 * 판형을 만들고, 시스템 폰트로 그 판형이 이미 선다. 외부 요청을 늘리면
 * 홈 LCP 2.5s(§12 AC-NFR)만 위태로워진다.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
        <ScrollTop />
        <Analytics />
      </body>
    </html>
  );
}
