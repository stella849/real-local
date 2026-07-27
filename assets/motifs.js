/* ============================================================
   Real Local — 전통 모티프

   출처: docs/reference/브랜드_모티프_시트.png (클라이언트 제공)
     · 달항아리와 매화 — 여백의 미, 숨겨진 로컬 보석
     · 기와 지붕과 전통 구름 — 전통 골목의 숨결, 지도의 상징
     · 단순화된 모란꽃 — 환대의 꽃, 귀한 손님

   레퍼런스가 라벨이 붙은 시안 시트라 이미지를 그대로 쓸 수 없어
   SVG로 다시 그렸다. 판형에 관계없이 선명하고, 색을 토큰으로
   받으므로 팔레트가 바뀌어도 따라온다.
   ============================================================ */

export const C = {
  ink: '#2C2620',
  inkSoft: '#6B6055',
  jar: '#E9DAC9',
  jarShade: '#DCC9B4',
  branch: '#6B4A3A',
  blossom: '#EBA9B4',
  blossomDeep: '#DE8E9E',
  cloud: '#AFCBDD',
  cloudDeep: '#93B6CC',
  tile: '#CAC5BC',
  tileDeep: '#B3ADA2',
  peony: '#E39A6E',
  peonyDeep: '#D07F52',
  leaf: '#95AD8D',
  leafDeep: '#7D9676',
};

/* 전통 구름 — 머리가 말린 상서로운 구름 */
const cloudCurl = (x, y, s, fill, op = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="${fill}" opacity="${op}">
    <path d="M0 12 C0 5 6 0 13 0 C19 0 24 4 25 9 C30 7 36 10 37 15
             C43 15 47 19 47 24 C47 29 43 33 38 33 L8 33 C3 33 0 29 0 24 Z"/>
    <circle cx="13" cy="11" r="7" fill="none" stroke="${fill}" stroke-width="3"/>
    <circle cx="13" cy="11" r="2.4"/>
  </g>`;

/* ------------------------------------------------------------
   달항아리와 매화 — 여백의 미
   비어 있음을 말해야 하는 자리에 쓴다. 빈 그릇이 곧 주제다.
   ------------------------------------------------------------ */
export function moonJar() {
  const petal = (cx, cy, r, fill) => {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      p += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="${fill}"/>`;
    }
    return p + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.44).toFixed(1)}" fill="${C.blossomDeep}"/>`;
  };

  return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <path d="M126 92 C140 78 152 62 160 44" stroke="${C.branch}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M141 76 C148 72 154 71 161 72" stroke="${C.branch}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M133 84 C132 76 130 70 126 64" stroke="${C.branch}" stroke-width="2.2" stroke-linecap="round"/>
    ${petal(162, 70, 7, C.blossom)}
    ${petal(127, 61, 6, C.blossom)}
    ${petal(146, 60, 5.4, C.blossom)}
    ${petal(158, 44, 6.2, C.blossom)}

    <path d="M100 96 C126 96 146 118 146 143 C146 168 126 186 100 186
             C74 186 54 168 54 143 C54 118 74 96 100 96 Z" fill="${C.jar}"/>
    <path d="M100 96 C112 96 122 98 130 102 C120 108 110 110 100 110
             C90 110 80 108 70 102 C78 98 88 96 100 96 Z" fill="${C.jarShade}"/>
    <path d="M78 176 L122 176" stroke="${C.jarShade}" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 128 C74 120 82 114 92 112" stroke="#FFFFFF" stroke-width="4"
          stroke-linecap="round" opacity=".55"/>
  </svg>`;
}

/* ------------------------------------------------------------
   기와 지붕과 전통 구름 — 지도의 상징
   레퍼런스가 이 모티프를 지도의 상징이라 못박았으므로 히어로에 쓴다.
   ------------------------------------------------------------ */
export function giwa({ clouds = true } = {}) {
  // 기와 골: 처마를 따라 부채꼴로 벌어진다
  const ribs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const topX = 74 + t * 52;
    const botX = 46 + t * 108;
    ribs.push(`<path d="M${topX.toFixed(1)} 96 L${botX.toFixed(1)} 146"
      stroke="${C.tileDeep}" stroke-width="2.6" stroke-linecap="round" opacity=".62"/>`);
  }

  return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
    ${clouds ? cloudCurl(6, 44, 0.78, C.cloud, 0.95) : ''}
    ${clouds ? cloudCurl(128, 26, 0.62, C.cloud, 0.8) : ''}
    ${clouds ? cloudCurl(150, 122, 0.52, C.cloud, 0.62) : ''}

    <path d="M100 84 C112 84 122 88 126 96 L74 96 C78 88 88 84 100 84 Z" fill="${C.tileDeep}"/>
    <path d="M40 152 C42 130 54 106 74 96 L126 96 C146 106 158 130 160 152
             C140 142 120 137 100 137 C80 137 60 142 40 152 Z" fill="${C.tile}"/>
    ${ribs.join('')}
    <rect x="94" y="152" width="12" height="40" fill="${C.tileDeep}"/>
    <rect x="76" y="160" width="48" height="9" rx="2" fill="${C.tile}"/>
  </svg>`;
}

/* ------------------------------------------------------------
   단순화된 모란꽃 — 환대의 꽃, 귀한 손님
   손님을 맞는 자리(저장한 장소가 없을 때 등)에 쓴다.
   ------------------------------------------------------------ */
export function peony() {
  const ring = (n, r, pr, fill, rot = 0) => {
    let p = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const cx = 100 + Math.cos(a) * r;
      const cy = 96 + Math.sin(a) * r;
      p += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${pr}" ry="${(pr * 0.86).toFixed(1)}"
             fill="${fill}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    }
    return p;
  };

  const leaf = (x, y, rot) => `
    <path d="M0 0 C16 -12 40 -12 54 0 C40 12 16 12 0 0 Z"
          fill="${C.leaf}" transform="translate(${x} ${y}) rotate(${rot})"/>
    <path d="M4 0 L50 0" stroke="${C.leafDeep}" stroke-width="1.8"
          transform="translate(${x} ${y}) rotate(${rot})" opacity=".7"/>`;

  return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
    ${leaf(30, 150, -18)}
    ${leaf(170, 150, 198)}
    ${ring(8, 42, 21, C.peony)}
    ${ring(6, 24, 17, C.peonyDeep, 0.4)}
    <circle cx="100" cy="96" r="15" fill="${C.peony}"/>
    <g stroke="${C.leafDeep}" stroke-width="2.4" stroke-linecap="round">
      <path d="M94 98 L92 86"/><path d="M100 99 L100 85"/><path d="M106 98 L108 86"/>
    </g>
  </svg>`;
}

/* 브랜드 호랑이 — 클라이언트 제공 원화 */
export const tigerImg = (alt = '민화 호랑이') =>
  `<img class="motif-img" src="assets/img/tiger.png" alt="${alt}" loading="lazy" decoding="async" width="900" height="558">`;
