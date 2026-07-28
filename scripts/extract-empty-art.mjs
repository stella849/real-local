import sharp from 'sharp';

/* B안(Sketch) 빈 화면 일러스트 추출
   ================================
   입력:  docs/design-source/empty-*-3094.png  (gitignore — 손그림 목업 원본)
   출력:  assets/img/empty-*.webp

   실행 (레포 루트에서):
     npm i --no-save sharp
     node scripts/extract-empty-art.mjs

   sharp 는 이 스크립트에만 필요하다. 앱은 빌드 단계가 없는 정적 사이트이므로
   package.json 을 두지 않는다 — 그림을 새로 받을 때만 한 번 깔고 쓴다.

   받는 것은 폰 목업 한 장이고, 필요한 것은 그 안의 일러스트뿐이다.
   캡션·탭 구분선·폰 프레임은 앱이 이미 그리므로 들어가면 겹쳐 보인다.

   자르는 좌표를 손으로 박지 않는다. 어두운 픽셀을 덩어리로 묶고 '가장 큰
   덩어리'만 남긴다 — 그림은 획이 이어진 한 덩어리고, 점선과 캡션 글자는
   따로 논다. 같은 형식으로 다시 받으면 이 스크립트가 그대로 동작한다.

   네 번째 컷("Sign in to save places")을 받으면 아래 JOBS 에 줄만 추가하면 된다. */
const SRC = 'docs/design-source';
const JOBS = [
  { src:`${SRC}/empty-maps-3094.png`,    win:[.12,.28,.47,.72],  out:'empty-maps'    },
  /* 보드 아래 압정 그림자와 캡션 사이가 붙어 한 덩어리로 잡힌다.
     행별 잉크량을 재보니 보드+압정은 .735 에서 끝나고 캡션은 .740 부터다. */
  { src:`${SRC}/empty-places-3094.png`,  win:[.12,.33,.47,.735], out:'empty-places'  },
  /* 이 목업만 폰이 둘이라 오른쪽(깨끗한 쪽)에서 가져온다 */
  { src:`${SRC}/empty-reviews-3094.png`, win:[.62,.30,.88,.78],  out:'empty-reviews' },
];

const DARK = 200;
const GAP  = 14;    // 이만큼 떨어진 획은 같은 그림으로 본다 (점선은 이보다 멀다)
const PAD  = 0.04;

for (const j of JOBS) {
  const { data, info } = await sharp(j.src).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const W=info.width, H=info.height, ch=info.channels;
  const wx0=Math.round(j.win[0]*W), wy0=Math.round(j.win[1]*H);
  const ww=Math.round(j.win[2]*W)-wx0, wh=Math.round(j.win[3]*H)-wy0;

  // 창 안을 GAP 격자로 줄여 '잉크가 있는 칸' 지도를 만든다. 격자에서 이어붙이면
  // 획 사이 흰 틈 때문에 그림이 조각나는 일이 없다.
  const gw=Math.ceil(ww/GAP), gh=Math.ceil(wh/GAP);
  const ink=new Uint8Array(gw*gh);
  for(let y=0;y<wh;y++)for(let x=0;x<ww;x++){
    const i=((wy0+y)*W+(wx0+x))*ch;
    if((data[i]+data[i+1]+data[i+2])/3 < DARK) ink[((y/GAP)|0)*gw+((x/GAP)|0)]=1;
  }

  // 가장 큰 덩어리 찾기
  const lab=new Int32Array(gw*gh).fill(-1);
  let best=null;
  for(let s=0;s<gw*gh;s++){
    if(!ink[s]||lab[s]>=0) continue;
    const q=[s]; lab[s]=s; const cells=[];
    while(q.length){
      const p=q.pop(); cells.push(p);
      const x=p%gw, y=(p-x)/gw;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=gw||ny>=gh) continue;
        const n=ny*gw+nx;
        if(ink[n]&&lab[n]<0){ lab[n]=s; q.push(n); }
      }
    }
    if(!best||cells.length>best.length) best=cells;
  }

  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(const p of best){ const x=p%gw, y=(p-x)/gw;
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  x0=wx0+x0*GAP; x1=wx0+(x1+1)*GAP; y0=wy0+y0*GAP; y1=wy0+(y1+1)*GAP;
  /* 여백은 창 밖으로 넘기지 않는다 — 창 경계가 곧 '여기부터는 캡션'이라는 선이다 */
  const pw=Math.round((x1-x0)*PAD), ph=Math.round((y1-y0)*PAD);
  const L=Math.max(wx0,x0-pw), T=Math.max(wy0,y0-ph);
  const R=Math.min(wx0+ww,x1+pw), B=Math.min(wy0+wh,y1+ph);
  const box={ left:L, top:T, width:R-L, height:B-T };

  /* 잘라낸 조각의 바깥 배경(종이 사각형)을 투명하게 뺀다. 가장자리에서
     이어진 영역만 지우므로 그림 안쪽의 밝은 면(책 표지, 보드 바닥)은 남는다.
     multiply 로 녹이는 방법은 바탕색이 조금만 달라도 사각형이 드러난다. */
  const cropped = await sharp(j.src).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const d=cropped.data, cw=cropped.info.width, chh=cropped.info.height;
  const bg=[0,1,2].map(k=>Math.round(([[0,0],[cw-1,0],[0,chh-1],[cw-1,chh-1]]
    .reduce((a,[x,y])=>a+d[(y*cw+x)*4+k],0))/4));
  const FAR=30;
  const seen=new Uint8Array(cw*chh), q=[];
  const near=(i,t)=>Math.abs(d[i]-bg[0])<t && Math.abs(d[i+1]-bg[1])<t && Math.abs(d[i+2]-bg[2])<t;
  for(let x=0;x<cw;x++){ q.push(x, (chh-1)*cw+x); }
  for(let y=0;y<chh;y++){ q.push(y*cw, y*cw+cw-1); }
  while(q.length){
    const p=q.pop(); if(seen[p]) continue; seen[p]=1;
    const i=p*4; if(!near(i,FAR)) continue;
    d[i+3]=0;
    const x=p%cw, y=(p-x)/cw;
    if(x>0)q.push(p-1); if(x<cw-1)q.push(p+1);
    if(y>0)q.push(p-cw); if(y<chh-1)q.push(p+cw);
  }

  await sharp(d,{raw:{width:cw,height:chh,channels:4}})
    .resize({height:Math.min(300,chh),withoutEnlargement:true})   // 96px 표시 × 3배 화면
    .webp({quality:78,alphaQuality:80})
    .toFile(`assets/img/${j.out}.webp`);
  console.log(j.out.padEnd(14), `잘라낸 원본 ${cw}x${chh}`);
}
