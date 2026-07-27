/* ============================================================
   Real Local — 전통 모티프 (손그림 드로잉)

   출처: docs/reference/브랜드_모티프_시트.png (클라이언트 제공)
     · 달항아리와 매화 — 여백의 미, 숨겨진 로컬 보석
     · 기와 지붕과 전통 구름 — 전통 골목의 숨결, 지도의 상징
     · 단순화된 모란꽃 — 환대의 꽃, 귀한 손님

   레퍼런스가 라벨 붙은 시안 시트라 그대로 쓸 수 없어 다시 그렸다.
   면으로 채우지 않고 펜 선으로 그리되, 색은 옅은 워시로만 깔아
   브랜드 색은 남기고 손으로 그린 인상을 준다. #pen 필터가 반듯한
   선을 흔들어 자로 잰 티를 지운다.
   ============================================================ */

export const C = {
  ink: '#2C2620',
  branch: '#6B4A3A',
  blossom: '#F2CBD3',
  blossomInk: '#C4788A',
  jar: '#F3EADD',
  cloud: '#DCEAF2',
  cloudInk: '#7FA3BC',
  tile: '#E8E4DC',
  peony: '#F4D2BC',
  peonyInk: '#C4633F',
  leaf: '#D9E3D4',
  leafInk: '#6F8A68',
};

/* 손으로 그은 선의 공통 성질. 획만 정의하고 fill은 매번 명시한다 —
   윤곽선과 옅은 워시가 섞여 있어 한쪽으로 기본값을 두면 헷갈린다. */
const PEN = `stroke-linecap="round" stroke-linejoin="round"`;
const LINE = `${PEN} fill="none"`;

const wrap = (inner, filter = 'pen') =>
  `<svg viewBox="0 0 200 200" filter="url(#${filter})" aria-hidden="true">${inner}</svg>`;

/* 전통 구름 — 머리가 말린 상서로운 구름, 윤곽선으로만 */
const cloudCurl = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M2 26 C-2 20 1 12 8 11 C9 4 16 0 23 3 C27 -1 35 0 37 6
             C44 6 48 13 45 19 C43 24 38 26 33 26 Z"
          fill="${C.cloud}" stroke="${C.cloudInk}" stroke-width="2.6" ${PEN}/>
    <path d="M8 11 C13 8 19 10 20 15 C21 19 18 22 15 21" stroke="${C.cloudInk}" stroke-width="2.4" ${LINE}/>
  </g>`;

/* ------------------------------------------------------------
   달항아리와 매화 — 여백의 미
   비어 있음을 말해야 하는 자리에 쓴다. 빈 그릇이 곧 주제다.
   ------------------------------------------------------------ */
export function moonJar() {
  const bloom = (cx, cy, r) => {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      p += `<circle cx="${(cx + Math.cos(a) * r * 0.9).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.9).toFixed(1)}"
             r="${(r * 0.62).toFixed(1)}" fill="${C.blossom}" stroke="${C.blossomInk}" stroke-width="1.8"/>`;
    }
    return p + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.3).toFixed(1)}" fill="${C.blossomInk}"/>`;
  };

  return wrap(`
    <path d="M124 96 C138 80 150 62 158 42" stroke="${C.branch}" stroke-width="3.2" ${LINE}/>
    <path d="M140 74 C147 70 153 69 160 70" stroke="${C.branch}" stroke-width="2.2" ${LINE}/>
    <path d="M132 84 C131 76 129 69 125 63" stroke="${C.branch}" stroke-width="2.2" ${LINE}/>

    <path d="M100 98 C126 98 145 119 145 143 C145 167 125 185 100 185
             C75 185 55 167 55 143 C55 119 74 98 100 98 Z"
          fill="${C.jar}" stroke="${C.ink}" stroke-width="3.4" ${PEN}/>
    <path d="M72 103 C80 108 90 111 100 111 C110 111 120 108 128 103"
          stroke="${C.ink}" stroke-width="2.6" ${LINE}/>
    <path d="M80 178 L120 178" stroke="${C.ink}" stroke-width="2.6" ${LINE}/>
    <path d="M70 132 C73 123 80 116 89 113" stroke="${C.ink}" stroke-width="2" opacity=".4" ${LINE}/>

    ${bloom(160, 68, 8)}
    ${bloom(126, 60, 7)}
    ${bloom(146, 58, 6)}
  `);
}

/* ------------------------------------------------------------
   기와 지붕과 전통 구름 — 지도의 상징
   레퍼런스가 이 모티프를 지도의 상징이라 못박았으므로 히어로 계열에 쓴다.
   ------------------------------------------------------------ */
export function giwa({ clouds = true } = {}) {
  const ribs = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    ribs.push(`<path d="M${(76 + t * 48).toFixed(1)} 100 L${(50 + t * 100).toFixed(1)} 143"
      stroke="${C.ink}" stroke-width="2" opacity=".45" ${LINE}/>`);
  }

  return wrap(`
    ${clouds ? cloudCurl(4, 40, 0.8) : ''}
    ${clouds ? cloudCurl(136, 22, 0.62) : ''}

    <path d="M100 86 C112 86 122 92 126 100 L74 100 C78 92 88 86 100 86 Z"
          fill="${C.tile}" stroke="${C.ink}" stroke-width="3" ${PEN}/>
    <path d="M42 150 C46 128 57 108 74 100 L126 100 C143 108 154 128 158 150
             C138 140 119 135 100 135 C81 135 62 140 42 150 Z"
          fill="${C.tile}" stroke="${C.ink}" stroke-width="3.4" ${PEN}/>
    ${ribs.join('')}
    <path d="M94 150 L94 190 M106 150 L106 190" stroke="${C.ink}" stroke-width="3" ${LINE}/>
    <path d="M78 162 L122 162" stroke="${C.ink}" stroke-width="2.6" ${LINE}/>
  `);
}

/* ------------------------------------------------------------
   단순화된 모란꽃 — 환대의 꽃, 귀한 손님
   손님을 맞는 자리(첫 리뷰를 기다리는 화면 등)에 쓴다.
   ------------------------------------------------------------ */
export function peony() {
  const ring = (n, r, pr, rot) => {
    let p = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const cx = 100 + Math.cos(a) * r;
      const cy = 94 + Math.sin(a) * r;
      p += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${pr}" ry="${(pr * 0.84).toFixed(1)}"
             fill="${C.peony}" stroke="${C.peonyInk}" stroke-width="2.2"
             transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    }
    return p;
  };

  const leaf = (x, y, rot) => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M0 0 C15 -12 38 -12 52 0 C38 12 15 12 0 0 Z"
            fill="${C.leaf}" stroke="${C.leafInk}" stroke-width="2.2"
            stroke-linejoin="round"/>
      <path d="M5 0 L47 0" stroke="${C.leafInk}" stroke-width="1.8" opacity=".8" ${LINE}/>
    </g>`;

  return wrap(`
    ${leaf(28, 150, -18)}
    ${leaf(172, 150, 198)}
    ${ring(8, 40, 20, 0)}
    ${ring(6, 22, 16, 0.42)}
    <circle cx="100" cy="94" r="13" fill="${C.peony}" stroke="${C.peonyInk}" stroke-width="2.2"/>
    <g stroke="${C.leafInk}" stroke-width="2.2" ${LINE}>
      <path d="M94 96 L92 84"/><path d="M100 97 L100 83"/><path d="M106 96 L108 84"/>
    </g>
  `);
}

/* 브랜드 호랑이 — 클라이언트 제공 원화. 이미 굵은 잉크 선으로 그려져
   있어 선화 방향과 그대로 맞는다. */
export const tigerImg = (alt = '민화 호랑이') =>
  `<img class="motif-img" src="assets/img/tiger.png" alt="${alt}" loading="lazy" decoding="async" width="900" height="558">`;
