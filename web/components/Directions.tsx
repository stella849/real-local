'use client';

import { useState } from 'react';
import { IconCompass } from './Icons';

/**
 * 길찾기 — 구글맵 딥링크 (§7). 앱 안에서 경로를 그리지 않는다.
 *
 * 위치는 **버튼을 누른 뒤에만** 요청한다. 페이지 로드 시 자동 요청은
 * 금지다 — 들어오자마자 권한 팝업이 뜨면 대부분 거부하고, 한 번 거부되면
 * 되돌리기 어렵다.
 *
 * 받은 좌표는 링크를 만드는 데만 쓰고 버린다. 어디에도 저장하지 않는다.
 */
export function Directions({ lat, lng, placeId }: {
  lat: number; lng: number; placeId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const link = (origin?: GeolocationCoordinates) => {
    const u = new URL('https://www.google.com/maps/dir/');
    u.searchParams.set('api', '1');
    if (origin) u.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
    u.searchParams.set('destination', `${lat},${lng}`);
    if (placeId) u.searchParams.set('destination_place_id', placeId);
    u.searchParams.set('travelmode', 'transit');
    return u.toString();
  };

  function go() {
    if (busy) return;
    setBusy(true);

    if (!navigator.geolocation) { window.open(link(), '_blank'); setBusy(false); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => { window.open(link(pos.coords), '_blank'); setBusy(false); },
      () => {
        // 거부해도 기능을 막지 않는다. 목적지만으로 연다.
        setToast('Showing directions without your location.');
        window.open(link(), '_blank');
        setBusy(false);
        window.setTimeout(() => setToast(null), 2600);
      },
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false },
    );
  }

  return (
    <>
      <button className="btn btn-dark btn-block" onClick={go} disabled={busy}>
        <IconCompass /> Directions
      </button>
      {toast && <div className="toast is-on" role="status">{toast}</div>}
    </>
  );
}
