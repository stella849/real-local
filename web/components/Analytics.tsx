import Script from 'next/script';

/** GA4 측정 ID. 브라우저로 나가는 것이 정상인 공개 값이라 코드에 둔다. */
const GA_ID = 'G-KYV2V0DG1R';

/** GTM 컨테이너 ID. GA_ID 와 마찬가지로 공개 값이다. */
const GTM_ID = 'GTM-56K3JLJ8';

/** Microsoft Clarity 프로젝트 ID. 역시 공개 값이다. */
const CLARITY_ID = 'xx4cbgitk7';

/**
 * GA4(gtag.js) + GTM + Clarity. 셋 다 전역이라 layout 에 하나만 둔다.
 *
 * ─ GA4 와 GTM 의 역할 분담 ─────────────────────────────────
 * GA4 는 아래 gtag.js 로 직접 계측한다. GTM 은 GA4 이외의 태그(광고
 * 픽셀, 히트맵 등)를 배포 없이 붙이는 용도로만 쓴다.
 *
 * ⚠️ GTM 관리화면에서 "GA4 구성" 태그를 만들면 안 된다. 같은 GA_ID 로
 * gtag.js 와 GTM 이 각각 page_view 를 쏘게 되어 조회수가 2배로 집계된다.
 * 나중에 GTM 으로 GA4 를 이관한다면, 그때 아래 gtag.js 블록을 제거하는
 * 것이 선행되어야 한다.
 * ──────────────────────────────────────────────────────────
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

      {/*
        GTM 은 구글이 주는 스니펫을 그대로 쓴다. dataLayer 초기화와 gtm.js
        로딩을 한 블록에 담고 있어서, 위 GA4 스크립트와의 실행 순서에
        영향을 받지 않는다 — 둘 다 dataLayer 를 `|| []` 로 방어한다.

        구글 안내는 <head> 최상단이라고 하지만 afterInteractive 를 쓴다.
        GTM 을 head 최상단에 동기로 박으면 홈 LCP 2.5s(§12 AC-NFR)를
        그대로 깎아먹는다. 계측이 렌더보다 먼저일 이유는 없다.
      */}
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>

      {/*
        Microsoft Clarity — 히트맵/세션 리코딩. GA4·GTM 과 독립이라 dataLayer
        를 건드리지 않는다.

        GTM 관리화면에 Clarity 태그를 또 붙이면 안 된다. 스크립트가 두 번
        로드되면 같은 세션이 중복 기록된다. 여기 코드로 심는 쪽 하나만 둔다.

        마이크로소프트 안내도 <head> 지만 GTM 과 같은 이유로 afterInteractive
        를 쓴다. 리코딩은 렌더보다 먼저일 이유가 없다.
      */}
      <Script id="clarity-init" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");`}
      </Script>

      {/*
        JS 를 끈 브라우저용 폴백. 구글 안내는 <body> 바로 뒤지만, 숨겨진
        iframe 이라 문서 어디에 있든 동작이 같다. 프로덕션 게이팅을 GTM
        스크립트와 공유하려고 이 컴포넌트 안에 함께 둔다.
      */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}
