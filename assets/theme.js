/* ============================================================
   Real Local — 디자인 시안 A/B

   시안을 PNG 목업이 아니라 실제 앱에 얹는다. 클라이언트가 자기
   폰에서 진짜 데이터 133곳을 넘겨보며 고르고, 고른 쪽이 그 자리에서
   그대로 배포본이 된다.

     ?theme=paper    A안만 (깨끗한 단일 화면 — 클라이언트 공유용)
     ?theme=sketch   B안만
     ?compare=1      화면 아래 A/B 스위처가 붙는다

   아무 것도 안 붙이면 지금까지의 무채색 빌드 그대로다. 이 파일은
   app.js보다 먼저, 동기로 실행돼야 첫 페인트 전에 시안이 걸린다.
   ============================================================ */
(function () {
  /* 두 안 모두 PRD 6장의 '베이지 → 화이트, handmade' 안에 있다.
     갈라지는 축은 색이 아니라 무엇이 손맛을 만드느냐다 —
     A는 활자와 판형, B는 손으로 그은 선. */
  const THEMES = {
    paper:  { label: 'A · Paper',  css: 'assets/theme-paper.css',  themeColor: '#FBF7EF' },
    sketch: { label: 'B · Sketch', css: 'assets/theme-sketch.css', themeColor: '#FDFAF3' },
  };

  const q = new URLSearchParams(location.search);
  const name = THEMES[q.get('theme')] ? q.get('theme') : null;
  const theme = name ? THEMES[name] : null;

  if (theme) {
    document.documentElement.dataset.theme = name;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = theme.css;
    document.head.appendChild(link);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.themeColor;
  }

  /* 커버 미니맵 9장은 133곳 좌표에서 생성된다 — 손으로 그릴 수 없고,
     지도가 추가되면 자동으로 생겨야 한다. 그래서 그림 대신 '손'을
     맞춘다: app.js 가 뽑아낸 SVG 에 손떨림 필터를 걸어, 생성된 것이
     손그림 히어로와 같은 사람이 그린 것처럼 보이게 한다.

     필터는 문서에 하나만 두고 CSS 에서 참조한다. app.js 의 출력(카드
     구조)은 건드리지 않는다 — 클라이언트가 고정한 부분이다. */
  if (name === 'sketch') {
    addEventListener('DOMContentLoaded', () => {
      const defs = document.createElement('div');
      defs.hidden = true;
      defs.innerHTML = `
        <svg width="0" height="0" aria-hidden="true"><defs>
          <filter id="rl-hand">
            <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="4" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5"
                               xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs></svg>`;
      document.body.appendChild(defs);
    });
  }

  /* app.js가 읽는다. 시안이 없으면 undefined라 기존 동작 그대로다. */
  window.RL_THEME = theme ? { name } : null;
  window.RL_ART = theme ? { hero: (el, data) => hero(el, data, name) } : null;

  /* ----------------------------------------------------------
     A/B 스위처 — ?compare=1 일 때만
     ---------------------------------------------------------- */
  if (!q.has('compare')) return;

  addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'ab-switch';
    bar.innerHTML = Object.entries(THEMES).map(([k, t]) =>
      `<a href="?theme=${k}&compare=1${location.hash}"${k === name ? ' aria-current="true"' : ''}>${t.label}</a>`
    ).join('') +
      `<a href="?compare=1${location.hash}"${name ? '' : ' aria-current="true"'}>None</a>`;
    document.body.appendChild(bar);
  });

  /* ============================================================
     메인 이미지

     두 안이 서로 다른 그림이어야 한다 — 색만 바꾼 같은 그림은
     클라이언트가 취향으로 고르고 왜 골랐는지 설명하지 못한다.

       A안  실제 좌표 133곳을 찍은 편집 지도. 자로 그은 선, 정확한 위치.
            데이터 그 자체가 그림이라 제작비가 없고, 장소가 늘면 그림도
            같이 자란다.
       B안  손으로 그린 동네 지도. 같은 '지도'를 정반대로 다룬다 —
            정확하지 않고, 대신 사람이 그려준 것으로 보인다.
            데이터와 무관한 장식이라 따로 관리해야 한다.
     ============================================================ */
  function hero(el, data, which) {
    if (!el) return;
    el.innerHTML = which === 'paper' ? paperHero(data) : sketchHero();
  }

  /* ---------- A안: 좌표를 그대로 찍은 편집 지도 ---------- */
  function paperHero(data) {
    const all = data.maps.flatMap((m) => m.places.map((p) => ({ ...p, city: m.city })));
    // 성수는 행정구역상 서울 안이라 같은 판에 놓는다. 부산은 300km
    // 밖이라 한 판에 그리면 서울이 점 하나로 뭉개진다 — 인셋으로 뺀다.
    const seoul = all.filter((p) => p.city !== 'Busan');
    const busan = all.filter((p) => p.city === 'Busan');

    const dots = (pts, box) => project(pts, box)
      .map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="2.5"/>`).join('');

    const seoulBox = { x: 18, y: 14, w: 268, h: 116 };
    const busanBox = { x: 312, y: 14, w: 60, h: 116 };

    return `
    <svg viewBox="0 0 390 156" role="img" aria-label="All ${all.length} places plotted by coordinate">
      <g class="art-frame">
        <rect x="${seoulBox.x - 8}" y="${seoulBox.y - 8}" width="${seoulBox.w + 16}" height="${seoulBox.h + 16}"/>
        <rect x="${busanBox.x - 8}" y="${busanBox.y - 8}" width="${busanBox.w + 16}" height="${busanBox.h + 16}"/>
      </g>
      <g class="art-dot">${dots(seoul, seoulBox)}${dots(busan, busanBox)}</g>
      <g class="art-label">
        <text x="${seoulBox.x - 8}" y="150">SEOUL — ${seoul.length} PLACES</text>
        <text x="${busanBox.x - 8}" y="150">BUSAN — ${busan.length}</text>
      </g>
    </svg>`;
  }

  /* 위도가 높아질수록 경도 1도의 실거리가 짧아진다. 보정하지 않으면
     서울이 옆으로 늘어나 실제 동네 배치와 다른 모양이 된다. */
  function project(pts, box) {
    const lat = pts.map((p) => p.lat), lng = pts.map((p) => p.lng);
    const la0 = Math.min(...lat), la1 = Math.max(...lat);
    const ln0 = Math.min(...lng), ln1 = Math.max(...lng);
    const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180);

    const spanX = Math.max((ln1 - ln0) * k, 1e-6);
    const spanY = Math.max(la1 - la0, 1e-6);
    const s = Math.min(box.w / spanX, box.h / spanY);
    const ox = box.x + (box.w - spanX * s) / 2;
    const oy = box.y + (box.h - spanY * s) / 2;

    return pts.map((p) => ({
      x: ox + (p.lng - ln0) * k * s,
      y: oy + (la1 - p.lat) * s,          // 위도는 위로 갈수록 크므로 뒤집는다
    }));
  }

  /* ---------- B안: 손으로 그린 동네 지도 ----------

     실제 손그림 이미지다. 아래 sketchHeroSvg() 가 이 그림의 원안이고,
     그것을 바탕으로 그린 결과물을 여기서 쓴다.

     width/height 를 박아두는 이유: 비율을 미리 알려주지 않으면 그림이
     늦게 도착하는 동안 아래 목록이 위로 올라왔다가 밀려 내려온다.

     5.2MB PNG 원본 → 1200px WebP 25KB. 원본은 docs/design-source/ 에
     있다(레포에 넣지 않는다 — public 이고 화면에는 1200px 이면 충분하다).

     마크업을 상수로 빼지 않는 이유: 이 아래는 ?compare=1 이 없으면
     도달하지 않는 구간이라, const 로 두면 스위처를 안 켠 상태에서
     초기화 전 접근이 된다. 함수 선언은 끌어올려지므로 안전하다. */
  function sketchHero() {
    return `
      <img src="assets/img/hero-sketch.webp" width="1200" height="521"
           alt="Hand-drawn illustration of a neighbourhood map">`;
  }

  /* 손그림 이미지의 원안. 지금은 쓰지 않지만, 그림을 다시 그리거나
     다른 동네를 추가할 때 이 배치가 출발점이 된다. */
  function sketchHeroSvg() {   // eslint-disable-line no-unused-vars
    /* 손으로 그린 지도는 '길이 흰색, 그 사이가 땅'으로 읽힌다. 격자를
       선으로 긋는 대신, 굵은 흰 획으로 길을 내고 가장자리만 얇게 딴다.
       길이 조금씩 휘어야 자로 잰 도면으로 보이지 않는다.
       손으로 맞춘 값이다 — 난수를 쓰면 새로고침마다 동네가 달라져
       브랜드 이미지가 되지 못한다. */
    const roads = [
      'M2 30 L140 34 L268 25 L388 31',
      'M2 82 L120 78 L252 88 L388 83',
      'M2 133 L150 129 L292 137 L388 131',
      'M74 2 L80 82 L72 154',
      'M188 2 L182 80 L192 154',
      'M298 2 L304 84 L296 154',
    ];
    const stroke = (cls) => roads.map((d) => `<path class="${cls}" d="${d}"/>`).join('');

    // 땅 위에 앉은 집들. 크기를 조금씩 어긋나게 둔다
    const houses = [
      [16, 44, 22, 16], [42, 46, 16, 14], [98, 42, 26, 18], [130, 46, 18, 14],
      [210, 40, 20, 16], [236, 44, 24, 14], [318, 42, 22, 16], [348, 45, 16, 13],
      [18, 96, 24, 16], [46, 99, 15, 13], [102, 95, 20, 18], [128, 99, 24, 14],
      [212, 97, 18, 15], [238, 94, 25, 18], [320, 96, 20, 16], [346, 99, 18, 13],
      [20, 8, 20, 12], [110, 6, 24, 13], [232, 7, 20, 12], [330, 6, 22, 13],
    ].map(([x, y, w, h]) =>
      `<rect class="art-bldg" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>`).join('');

    /* 걸어간 자국. 이 그림을 '누가 나를 데리고 다닌 경로'로 만드는 건
       사실 이 점선 하나다 — 없으면 그냥 동네 도면이 된다.
       길 한가운데가 아니라 살짝 비켜 그어야 길 자체와 구분된다. */
    const route = `<path class="art-route"
      d="M24 136 L78 133 L79 85 L120 81 L186 79 L184 37 L268 28 L301 31 L303 86 L360 84"/>`;

    // 경로 위에 찍힌 곳들
    const pins = [[79, 85], [186, 79], [184, 37], [301, 31], [303, 86]]
      .map(([x, y]) => `
        <path class="art-pin" d="M${x} ${y}c-4.6-5.4-7.4-8.6-7.4-12.3a7.4 7.4 0 1 1 14.8 0c0 3.7-2.8 6.9-7.4 12.3z"/>
        <circle class="art-pin-eye" cx="${x}" cy="${y - 12.3}" r="2.7"/>`).join('');

    return `
    <svg viewBox="0 0 390 156" role="img" aria-label="Hand-drawn illustration of a neighbourhood map">
      <defs>
        <!-- 직선을 미세하게 떨리게 해서 손으로 그은 선으로 만든다.
             seed를 고정해야 새로고침해도 같은 그림이 나온다. -->
        <filter id="rl-rough" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="7" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"
                             xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>

      <rect class="art-paper" x="0" y="0" width="390" height="156" rx="6"/>

      <g filter="url(#rl-rough)">
        ${stroke('art-road-edge')}
        ${stroke('art-road')}
        ${houses}
        ${route}
        ${pins}
      </g>
      <rect class="art-edge" x="4" y="4" width="382" height="148" rx="7"/>
    </svg>`;
  }
})();
