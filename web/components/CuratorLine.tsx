import Link from 'next/link';
import { initial } from '@/lib/types';

/**
 * 큐레이터 이름 + 아바타. 모든 맵 카드와 상세에 붙는다 — 이 넷이 화면에
 * 없으면 이 제품은 구글맵의 열화판이다 (§1).
 *
 * 은퇴(curator_listed=false)·강등된 큐레이터는 이름을 **표시하되 링크를
 * 뗀다** (§3.4). 맵을 자동으로 내리지 않는 이유와 같다 — 자격을 회수한
 * 것이지 콘텐츠가 틀린 게 아니고, 지우면 사용자의 저장 목록에 구멍이 난다.
 */
export function CuratorAvatar({
  name, url, className = 'avatar',
}: { name: string; url?: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={url} alt="" />;
  }
  // 이메일 가입 계정은 사진이 없다. 이니셜 원형이 기본값이다 (§5 S11).
  return <span className={`${className} avatar-initial`} aria-hidden>{initial(name)}</span>;
}

export function CuratorName({
  name, handle, listed,
}: { name: string; handle: string | null; listed: boolean }) {
  if (listed && handle) {
    return <Link className="curator-name" href={`/curators/${handle}`}>{name}</Link>;
  }
  return <span className="curator-name">{name}</span>;
}
