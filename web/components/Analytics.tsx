import Script from 'next/script';

/** GA4 측정 ID. 브라우저로 나가는 것이 정상인 공개 값이라 코드에 둔다. */
const GA_ID = 'G-KYV2V0DG1R';

/**
 * GA4(gtag.js). 전역이라 layout 에 하나만 둔다.
 *
 * strategy 는 afterInteractive — 계측 때문에 홈 LCP 2.5s(§12 AC-NFR)를
 * 깎을 이유가 없다. beforeInteractive 로 올리면 first-party 코드보다 먼저
 * 받아 오므로 쓰지 않는다.
 *
 * 로컬 개발 트래픽이 실서비스 리포트에 섞이지 않도록 프로덕션 빌드에서만
 * 심는다. 로컬에서 태그 자체를 확인해야 하면 .env.local 에
 * NEXT_PUBLIC_GA_DEBUG=1 을 넣는다.
 *
 * 라우트 이동 시 page_view 는 따로 쏘지 않는다. App Router 의 클라이언트
 * 내비게이션은 History API 를 쓰고, GA4 향상된 측정의 "브라우저 기록
 * 이벤트 기반 페이지 변경"이 이를 잡는다. 직접 쏘면 중복 집계된다.
 */
export function Analytics() {
  const enabled =
    process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_GA_DEBUG === '1';

  if (!enabled) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
