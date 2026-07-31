'use client';

import { useState } from 'react';
import { MapCard } from './MapCard';
import type { MapCard as Card } from '@/lib/types';

/**
 * 지역 알약 필터 (재결정 — 이 대화에서 클라이언트가 명시적으로 확인).
 *
 * §4.3 은 검색/필터를 스코프 밖으로 뒀고 PRD v1.4 §1 도 처음엔 "필터가
 * 아니라 그루핑"이라고 못박았다. 이 컴포넌트는 그 결정을 뒤집는
 * 예외다 — 알약을 누르면 실제로 목록이 걸러진다. docs/03_PRD_v1.4.md
 * §1 개정판 참조.
 *
 * 알약 없이(비선택) 기본 상태는 §8 정렬(저장수→후기수→최신순) 그대로인
 * 전체 목록이다. 데이터가 20개 미만이라 서버 왕복 없이 클라이언트에서
 * 필터링한다 — 이미 다 받아온 목록을 감추고 보이고만 한다.
 */
export function RegionFilter({ maps }: { maps: (Card & { saved: boolean })[] }) {
  const regions = Array.from(
    new Set(maps.map((m) => m.region?.trim()).filter((r): r is string => Boolean(r))),
  ).sort((a, b) => a.localeCompare(b));

  const [active, setActive] = useState<string | null>(null);

  if (regions.length === 0) {
    return (
      <ul className="feed">
        {maps.map((m) => <MapCard key={m.id} m={m} saved={m.saved} />)}
      </ul>
    );
  }

  const visible = active ? maps.filter((m) => m.region?.trim() === active) : maps;

  // 누른 알약을 가로 목록 한가운데로 스크롤한다. block:'nearest' 로
  // 페이지 전체가 세로로 딸려 스크롤되는 걸 막는다 — 가로만 움직인다.
  function pick(r: string | null, e: React.MouseEvent<HTMLButtonElement>) {
    setActive(r);
    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  return (
    <>
      <div className="region-pills">
        <button className={`pill${active === null ? ' active' : ''}`} onClick={(e) => pick(null, e)}>
          All
        </button>
        {regions.map((r) => (
          <button key={r} className={`pill${active === r ? ' active' : ''}`}
            onClick={(e) => pick(active === r ? null : r, e)}>
            {r}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h3>No maps here yet</h3>
          <p>Nothing published in {active} right now.</p>
        </div>
      ) : (
        <ul className="feed">
          {visible.map((m) => <MapCard key={m.id} m={m} saved={m.saved} />)}
        </ul>
      )}
    </>
  );
}
