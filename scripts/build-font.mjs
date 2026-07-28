/* B안(Sketch) 표제 서체 만들기
   ============================
   입력:  Font/<이름>/<파일>.ttf   (gitignore — 배포본에 넣지 않는다)
   출력:  assets/font/<이름>-Latin.woff2

   실행 (레포 루트에서):
     npm i --no-save subset-font
     node scripts/build-font.mjs

   받은 파일이 TTF 뿐이라 두 가지를 한다.

   1) 라틴만 남긴다. Pacifico 원본에는 키릴·베트남어 글리프가 들어 있는데
      이 앱의 UI 는 전부 영어라 한 글자도 쓰지 않는다.
   2) woff2 로 압축한다. TTF 를 그대로 <link> 하는 브라우저는 없다.

      Pacifico 는 308KB ttf → 100KB woff2 → 라틴만 남겨 38KB 였다.
      표제 서체는 첫 화면에서 바로 필요하므로 이 차이가 그대로 체감된다.

   서브셋은 OFL 상 '수정본'이다. 다만 지금까지 쓴 두 후보(Pacifico,
   Shadows Into Light) 모두 Reserved Font Name 을 선언하지 않았으므로
   (저작권 줄에 "with Reserved Font Name" 이 없다) 이름을 그대로 써도 된다.
   **다른 폰트로 갈아끼울 때는 이걸 먼저 확인할 것.**
   라이선스 전문은 assets/font/OFL-<이름>.txt 로 함께 싣는다.

   남기는 문자: 기본 라틴 + Latin-1 + 일반 구두점.
   마지막 것을 빼면 안 된다 — 데이터에 곱은따옴표(Mimyo's)와 en dash 가 있다. */
import { readFileSync, writeFileSync, statSync } from 'fs';
import subsetFont from 'subset-font';

const ROOT = process.argv[2] || '.';
const SRC = `${ROOT}/Font/Shadows_Into_Light/ShadowsIntoLight-Regular.ttf`;
const OUT = `${ROOT}/assets/font/ShadowsIntoLight-Latin.woff2`;

const ranges = [
  [0x0020, 0x007e],   // 기본 라틴
  [0x00a0, 0x00ff],   // Latin-1 보충 (é, ü …)
  [0x2010, 0x2027],   // 대시·따옴표·말줄임표
  [0x20a0, 0x20bf],   // 통화 기호
];
const chars = ranges
  .flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)))
  .join('') + '·—…';

const buf = await subsetFont(readFileSync(SRC), chars, { targetFormat: 'woff2' });
writeFileSync(OUT, buf);
console.log(
  `${(statSync(SRC).size / 1024).toFixed(0)}KB ttf → ${(buf.length / 1024).toFixed(1)}KB woff2 (라틴만)`
);
