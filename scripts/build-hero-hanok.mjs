/* C안(Hanok) 메인 이미지 가공
   ==========================
   입력:  docs/design-source/hero-hanok-original.png  (gitignore)
   출력:  assets/img/hero-hanok.webp

   실행 (레포 루트에서):
     npm i --no-save sharp
     node scripts/build-hero-hanok.mjs

   하는 일이 셋이다.

   1) 바탕의 붉은끼를 뺀다. 받은 원본은 위쪽이 분홍빛으로 돌았다.
      채도를 일괄로 낮추면 지붕과 능선의 구분까지 바래므로 **색상만** 옮긴다 —
      유채색의 73%가 20~30°(주홍)에 몰려 있고 베이지·황토는 36~44°다.

   2) 원본의 물방울 핀을 **지운다**.

   3) 그 자리에 핀을 **다시 그린다** — 팔레트의 단청 적색으로, 7개만.

      2)+3) 을 나눈 이유: 원본 픽셀에 색을 덧칠하면 원본의 번짐과 명암이
      그대로 남아 화면에서 뭉친 점으로 보인다. 지우고 벡터로 그리면 크기가
      일정하고 가장자리가 깨끗하다. 화면에서 이 그림은 1/3 로 줄어들므로
      (1200px → 390px) 물방울 하나가 4~6px 다. 그 크기에서 살아남는 것은
      정확한 실루엣뿐이다.

      핀을 좌표로 찍지 않고 조건으로 찾는다 — 크로마가 높고(55↑), 작고,
      세로가 길고, **그림의 아래쪽 절반에 있는** 덩어리.

      마지막 조건이 결정적이다. 처마에도 단청 붉은색이 칠해져 있고 그중에는
      4x7 · 5x9 처럼 핀과 똑같이 생긴 것이 있어 모양만으로는 갈라지지 않는다.
      다만 이 그림은 구도가 '위 처마 / 가운데 여백 / 아래 마을'로 정해져 있어
      핀은 전부 세로 69% 아래, 단청은 전부 24% 위에 있다. 가운데는 카피가
      앉는 빈 띠라 경계 근처에 아무것도 없다.

      처마의 단청은 남기지 않는다. 위쪽이 붉어 보인다는 지적을 받은 자리이고,
      핀을 붉게 칠하는 이유는 '앱의 지도 핀과 같은 것'을 가리키기 위해서지
      그림을 붉게 만들기 위해서가 아니다.
   ============================================================ */
import sharp from 'sharp';

// 레포 루트를 인자로 받는다 — sharp 는 이 스크립트에만 필요해서 임시 폴더에
// 깔고 돌리는 경우가 있다. 인자가 없으면 현재 폴더를 루트로 본다.
const ROOT = process.argv[2] || '.';
const SRC = `${ROOT}/docs/design-source/hero-hanok-original.png`;
const OUT = `${ROOT}/assets/img/hero-hanok.webp`;

const OUT_W  = 1200;
const TARGET = 38, PULL = 0.58;      // 바탕: 주홍 → 황토
const SAT_LO = 0.55, SAT_HI = 0.92, KNEE = 0.42;

const PIN_CHROMA = 55;               // 이 이상을 '진한 표식'으로 본다
const PIN_MIN = 12, PIN_MAX = 400;   // 핀 한 개의 면적 범위 (OUT_W 기준)
const PIN_AR  = 1.2;                 // 세로/가로 — 물방울은 세로로 길다
const PIN_TOP = 0.45;                // 이 아래에 있는 것만 핀으로 본다

const KEEP    = 7;                   // 다시 그릴 개수
const PIN_W   = 12;                  // 물방울 가로 (OUT_W 기준)
const ACCENT  = '#AA4649';           // 팔레트의 --accent 와 같은 값이어야 한다

function rgb2hsl(R,G,B){
  R/=255;G/=255;B/=255;
  const mx=Math.max(R,G,B),mn=Math.min(R,G,B),d=mx-mn,l=(mx+mn)/2;
  if(!d) return [0,0,l];
  const s=d/(1-Math.abs(2*l-1));
  let h; if(mx===R)h=60*(((G-B)/d)%6); else if(mx===G)h=60*((B-R)/d+2); else h=60*((R-G)/d+4);
  return [h<0?h+360:h,s,l];
}
function hsl2rgb(h,s,l){
  h=((h%360)+360)%360;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r,g,b;
  if(h<60)[r,g,b]=[c,x,0]; else if(h<120)[r,g,b]=[x,c,0]; else if(h<180)[r,g,b]=[0,c,x];
  else if(h<240)[r,g,b]=[0,x,c]; else if(h<300)[r,g,b]=[x,0,c]; else [r,g,b]=[c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
}

/* 원본(2808px)이 아니라 출력 크기에서 처리한다. 핀을 면적으로 골라내므로
   기준 크기가 달라지면 같은 숫자가 다른 것을 가리킨다. */
const {data,info}=await sharp(SRC).resize({width:OUT_W,withoutEnlargement:true})
  .raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,ch=info.channels;

/* ---- 1. 핀 찾기 ---- */
const strong=new Uint8Array(W*H);
for(let p=0;p<W*H;p++){
  const i=p*ch;
  if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>=PIN_CHROMA) strong[p]=1;
}
const seen=new Uint8Array(W*H);
const pins=[];
for(let s=0;s<W*H;s++){
  if(!strong[s]||seen[s]) continue;
  const q=[s],cells=[]; seen[s]=1;
  let minx=1e9,maxx=-1,miny=1e9,maxy=-1;
  while(q.length){
    const p=q.pop(); cells.push(p);
    const x=p%W,y=(p-x)/W;
    if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const np=ny*W+nx; if(strong[np]&&!seen[np]){seen[np]=1;q.push(np);}
    }
  }
  const w=maxx-minx+1,h=maxy-miny+1;
  if(cells.length>=PIN_MIN && cells.length<=PIN_MAX && h/w>=PIN_AR && miny/H>=PIN_TOP)
    pins.push({minx,maxx,miny,maxy,w,h,cx:(minx+maxx)/2,by:maxy});
}

/* ---- 2. 지우기 ----
   핀 자리를 둘레의 색으로 덮는다. 마을 바닥은 옅은 베이지에 가는 선뿐이라
   둘레 중앙값 하나로 채워도 이음매가 보이지 않는다. */
const out=Buffer.from(data);
for(const p of pins){
  const pad=3, x0=Math.max(0,p.minx-pad), x1=Math.min(W-1,p.maxx+pad);
  const y0=Math.max(0,p.miny-pad), y1=Math.min(H-1,p.maxy+pad);
  const ring=[[],[],[]];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(x>x0+1&&x<x1-1&&y>y0+1&&y<y1-1) continue;   // 테두리만
    const i=(y*W+x)*ch; ring[0].push(data[i]);ring[1].push(data[i+1]);ring[2].push(data[i+2]);
  }
  const med=ring.map(a=>{a.sort((m,n)=>m-n);return a[a.length>>1];});
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=(y*W+x)*ch;
    out[i]=med[0]; out[i+1]=med[1]; out[i+2]=med[2];
  }
}

/* ---- 3. 바탕 색 옮기기 ---- */
for(let y=0;y<H;y++){
  const extra = 1 - 0.12*Math.max(0, 1-y/(H*0.35));   // 위쪽만 조금 더
  for(let x=0;x<W;x++){
    const i=(y*W+x)*ch;
    let [h,s,l]=rgb2hsl(out[i],out[i+1],out[i+2]);
    if(s>0.02){
      if(h<90) h += (TARGET-h)*PULL;
      const t=Math.min(1,s/KNEE);
      s *= (SAT_LO+(SAT_HI-SAT_LO)*t)*extra;
    }
    const [R,G,B]=hsl2rgb(h,s,l);
    out[i]=Math.round(R); out[i+1]=Math.round(G); out[i+2]=Math.round(B);
  }
}

/* ---- 4. 핀 다시 그리기 ----
   가로로 고르게 KEEP 개를 남긴다. 큰 것부터 남기면 한쪽에 몰려 그림이
   기울어 보인다 — 폭을 KEEP 칸으로 나누고 칸마다 가장 큰 것을 하나씩 뽑는다. */
pins.sort((a,b)=>a.cx-b.cx);
const picked=[];
for(let k=0;k<KEEP;k++){
  const lo=W*k/KEEP, hi=W*(k+1)/KEEP;
  const band=pins.filter(p=>p.cx>=lo&&p.cx<hi);
  if(band.length) picked.push(band.sort((a,b)=>b.w*b.h-a.w*a.h)[0]);
}

/* 물방울: 위는 원, 아래는 뾰족하게. 원본 핀의 '바닥 끝'을 그대로 쓰므로
   다시 그려도 마을 위 같은 자리에 선다. */
const pw=PIN_W, ph=Math.round(PIN_W*1.4), r=pw/2;
const shapes = picked.map(p=>{
  const cx=Math.round(p.cx), by=Math.round(p.by), ty=by-ph;
  return `<path d="M${cx} ${by} C${cx-r} ${by-ph*0.55} ${cx-r} ${ty+r*0.5} ${cx} ${ty+r*0.5}`
       + ` C${cx+r} ${ty+r*0.5} ${cx+r} ${by-ph*0.55} ${cx} ${by} Z"/>`;
}).join('');
const overlay = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" fill="${ACCENT}">${shapes}</svg>`);

await sharp(out,{raw:{width:W,height:H,channels:ch}})
  .composite([{input:overlay,top:0,left:0}])
  .webp({quality:82})
  .toFile(OUT);
console.log(`찾은 핀 ${pins.length}개 → ${picked.length}개만 다시 그림 · ${W}x${H}`);
