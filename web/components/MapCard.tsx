import Link from 'next/link';
import { Collage } from './Collage';
import { CuratorAvatar, CuratorName } from './CuratorLine';
import { SaveButton } from './SaveButton';
import { IconSaveCount, IconStar } from './Icons';
import type { MapCard as Card } from '@/lib/types';

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * 홈(S1)·큐레이터 소개(S10)·저장 탭(S4)이 같은 컴포넌트를 쓴다.
 *
 * 저장수를 카드에 노출한다 — 정렬 기준(§8)이 보이지 않으면 사용자가
 * 순서를 이해할 수 없다.
 *
 * ---------------------------------------------------------------
 * 카드 전체를 <Link> 로 감싸지 않는다.
 *
 * 카드 안에는 이미 두 개의 다른 목적지가 있다 — 큐레이터 이름은 S10 으로
 * 가야 하고(§5 S1), 저장 버튼은 아무 데도 가지 않아야 한다. <a> 안에
 * <a> 를 넣으면 유효하지 않은 마크업이고 hydration 이 깨진다.
 *
 * 그래서 제목에만 링크를 걸고 ::after 로 카드 전체를 덮는다.
 * 큐레이터 링크와 저장 버튼은 z-index 로 그 위에 올린다 — 카드 어디를
 * 눌러도 맵으로 가되, 이름과 저장은 자기 동작을 한다.
 * ---------------------------------------------------------------
 */
export function MapCard({ m, saved = false }: { m: Card; saved?: boolean }) {
  return (
    <li className="feed-item card">
      <Collage refs={m.cover_refs} title={m.title} cover={null} />

      <div className="card-body">
        {m.concept_tag && <p className="concept-tag">{m.concept_tag}</p>}
        <h3 className="card-title">
          <Link className="card-link" href={`/maps/${m.slug}`}>{m.title}</Link>
        </h3>
        <p className="card-summary">{m.one_liner}</p>
        <p className="card-meta">
          <CuratorAvatar name={m.curator_name ?? '?'} url={m.curator_avatar} />
          <CuratorName
            name={m.curator_name ?? 'Unknown'}
            handle={m.curator_handle}
            listed={m.curator_listed}
          />
          <span>·</span>
          <span>{plural(m.place_count, 'place')}</span>
          <span>·</span>
          {/* 저장수를 별점보다 왼쪽에 둔다 — §8 정렬이 저장수 → 후기수
              순이므로 읽는 순서가 정렬 순서와 같아야 목록의 차례가 이해된다.
              저장 버튼과 같은 북마크 모양을 쓴다. 버튼은 북마크인데 개수만
              하트로 두면 같은 개념에 기호가 둘이 된다. */}
          <span className="meta-count">
            <IconSaveCount /> {m.save_count}
          </span>
          <span>·</span>
          {/* 후기 0건이면 별점 대신 New 배지 (§5 S1) */}
          {m.review_count > 0
            ? <span className="meta-count"><IconStar /> {m.avg_rating}</span>
            : <span>New</span>}
        </p>
      </div>

      <span className="card-save">
        <SaveButton kind="map" id={m.id} saved={saved} />
      </span>
    </li>
  );
}
