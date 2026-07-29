'use client';

import { useEffect, useRef, useState } from 'react';

export type Pin = { id: string; n: number; name: string; lat: number; lng: number };

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { google?: any; __rlGmapsReady?: () => void } }

let loader: Promise<void> | null = null;

function loadMaps(key: string) {
  if (typeof window !== 'undefined' && window.google?.maps?.importLibrary) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    /* language=en 은 구글 자체 라벨을 영어로 고정한다. 없으면 브라우저
       로케일을 따라가서 한국 폰으로 보는 방문자에게 한글 도로명이 뜨는데,
       그건 이 앱이 없애려는 바로 그 문제다. region=KR 은 주소 형식을 유지한다. */
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + `?key=${encodeURIComponent(key)}&v=weekly&loading=async`
      + '&language=en&region=KR&callback=__rlGmapsReady';
    s.async = true;
    window.__rlGmapsReady = () => resolve();
    s.onerror = () => reject(new Error('script failed'));
    setTimeout(() => reject(new Error('timed out')), 10000);
    document.head.appendChild(s);
  });
  return loader;
}

/** 채도를 낮추고 POI 라벨을 억제한다. 지도가 주인공이 아니라 배경이다 (§5 S2). */
const STYLE = [
  { elementType: 'geometry', stylers: [{ saturation: -60 }, { lightness: 8 }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/**
 * 지도 ↔ 리스트 연동 (P0, §5 S2).
 *
 * 리스트는 서버 컴포넌트가 그대로 렌더하고, 여기서는 [data-place-id] 를
 * 찾아 핸들러만 붙인다. 리스트까지 클라이언트로 끌어오면 23개짜리 맵의
 * 본문 전체가 자바스크립트로 넘어간다.
 *
 * API 키가 실패하면 지도 영역만 접고 리스트는 그대로 둔다 — 전체 화면이
 * 죽으면 안 된다.
 */
export function MapCanvas({ pins, apiKey, mapId }: {
  pins: Pin[]; apiKey?: string; mapId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dead, setDead] = useState(!apiKey || pins.length === 0);

  useEffect(() => {
    if (!apiKey || !ref.current || pins.length === 0) return;
    let cancelled = false;
    const markers = new Map<string, any>();
    let active: string | null = null;

    const rows = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-place-id]'));

    function highlight(id: string | null) {
      active = id;
      for (const el of rows()) el.classList.toggle('is-active', el.dataset.placeId === id);
      for (const [pid, mk] of markers) {
        const node = mk.rlNode as HTMLElement | undefined;
        if (node) node.classList.toggle('is-active', pid === id);
      }
    }

    (async () => {
      try {
        await loadMaps(apiKey);
        if (cancelled || !ref.current) return;

        const g = window.google;
        const [{ Map: GMap }, { LatLngBounds }, markerLib] = await Promise.all([
          g.maps.importLibrary('maps'),
          g.maps.importLibrary('core'),
          g.maps.importLibrary('marker').catch(() => ({})),
        ]);
        if (cancelled || !ref.current) return;

        const map = new GMap(ref.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: false,
          gestureHandling: 'greedy',
          ...(mapId ? { mapId } : { styles: STYLE }),
        });

        const bounds = new LatLngBounds();
        // 기본 빨강 마커는 금지다. Map ID 가 있으면 우리 핀을, 없으면
        // 최소한 번호 라벨이라도 얹는다.
        const advanced = Boolean(mapId && markerLib.AdvancedMarkerElement);

        for (const p of pins) {
          const pos = { lat: p.lat, lng: p.lng };
          bounds.extend(pos);

          let mk: any;
          if (advanced) {
            const node = document.createElement('span');
            node.className = 'pin-marker';
            node.textContent = String(p.n);
            mk = new markerLib.AdvancedMarkerElement({ map, position: pos, title: p.name, content: node });
            mk.rlNode = node;
          } else {
            mk = new markerLib.Marker({
              map, position: pos, title: p.name, zIndex: p.n,
              label: { text: String(p.n), color: '#FAF5EA', fontSize: '12px', fontWeight: '600' },
            });
          }

          mk.addListener('click', () => {
            highlight(p.id);
            const row = document.querySelector<HTMLElement>(`[data-place-id="${p.id}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 400ms 하이라이트 — 어디로 갔는지 눈이 따라가야 한다
            window.setTimeout(() => { if (active === p.id) highlight(null); }, 400 + 900);
          });

          markers.set(p.id, mk);
        }

        map.fitBounds(bounds, 40);
        // 한 곳짜리 맵에서 최대로 당겨지는 것을 막는다
        const once = g.maps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > 17) map.setZoom(17);
        });
        void once;

        for (const el of rows()) {
          el.addEventListener('click', () => {
            const id = el.dataset.placeId!;
            const mk = markers.get(id);
            if (!mk) return;
            highlight(id);
            map.panTo(mk.position ?? { lat: 0, lng: 0 });
          });
        }
      } catch {
        // 키가 없거나 거부되면 지도만 접는다. 리스트는 살아 있어야 한다.
        if (!cancelled) setDead(true);
      }
    })();

    return () => { cancelled = true; };
  }, [pins, apiKey, mapId]);

  if (dead) return null;
  return <div id="map" ref={ref} />;
}
