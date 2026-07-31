'use client';

import { useState, useTransition } from 'react';
import {
  setRole, saveCuratorProfile, approveMap, rejectMap, setMapVisibility, setMapRegion,
  deleteReview,
} from '@/app/admin/actions';
import {
  IconGoogle, IconMail, IconStar, IconKebab, IconEdit, IconTrash, IconCheck, IconEye,
} from '@/components/Icons';

export type Member = {
  id: string; email: string | null; display_name: string | null;
  role: 'user' | 'curator' | 'admin';
  curator_tier: 'resident' | 'guest' | null;
  handle: string | null; byline: string | null; about: string | null;
  curator_listed: boolean; auth_provider: string | null;
};

export type AdminMap = {
  id: string; slug: string; title: string; region: string | null; status: string;
  review_note: string | null; curator_id: string; curator_name: string; place_count: number;
};

export type AdminReview = {
  id: string; body: string; rating: number; author_name: string;
  map_title: string; map_slug: string;
};

/* 역할 콤보박스는 4지선다다. 큐레이터 등급은 어드민 화면에서만
   전문으로 보인다 (§3.2) — 일반 사용자에게는 어디에도 노출하지 않는다. */
/* 라벨을 짧게 둔 이유는 콤보박스 폭이다 — 행 안에 이메일·이름과 함께
   한 줄로 들어가야 한다. 어느 등급인지는 이 select 자체가 말해 준다. */
const ROLES = [
  { v: 'user', label: 'User' },
  { v: 'curator:resident', label: 'Resident' },
  { v: 'curator:guest', label: 'Guest' },
  { v: 'admin', label: 'Admin' },
] as const;

const roleValue = (m: Member) =>
  m.role === 'curator' ? `curator:${m.curator_tier ?? 'guest'}` : m.role;

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="form-error" style={{ minHeight: 0 }}>{msg}</p> : null;
}

/* ---------------------------------------------------------- Members */
type MemberGroup = { key: string; label: string; items: Member[] };

export function MembersTab({ groups, meId }: { groups: MemberGroup[]; meId: string }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-md)' }}>
      {groups.map((g) => (
        <section key={g.key}>
          {/* provider 아이콘은 행마다 넣지 않고 섹션 제목 앞에 하나만 —
              그룹으로 이미 나뉘어 있어 행마다 반복할 필요가 없다. */}
          <div className="section-head">
            <span className="provider-mark">{g.key === 'google' ? <IconGoogle /> : <IconMail />}</span>
            <h2>{g.label}</h2>
            <span className="count">{g.items.length}</span>
          </div>
          {/* Maps 탭과 같은 패턴 — 8개까지만 보이고 나머지는 이 안에서만
              세로 스크롤한다. 정렬 기준(§ page.tsx sortMembers)은 그룹으로
              나누기 전과 동일하게 유지된다. */}
          <div className="admin-list admin-list-scroll-members">
            {g.items.map((m) => <MemberRow key={m.id} m={m} isMe={m.id === meId} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function MemberRow({ m, isMe }: { m: Member; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 이메일 가입 계정은 큐레이터·어드민이 될 수 없다 (§3.1)
  const emailOnly = m.auth_provider !== 'google';
  const showEdit = m.role !== 'user';

  function change(v: string) {
    const [role, tier] = v.split(':') as ['user' | 'curator' | 'admin', 'resident' | 'guest'];
    const label = ROLES.find((r) => r.v === v)?.label ?? v;

    // 큐레이터로 처음 지정할 때는 프로필 URL이 없으면 여기서 바로
    // 받는다 — 승격 이후로 미루면 handle 없는 채로 발행하다 404를
    // 만난다(실제로 있었던 버그). handle 이 이미 있으면 다시 묻지 않는다.
    let handle: string | undefined;
    if (role === 'curator' && !m.handle) {
      const input = window.prompt(
        `Profile URL for ${m.display_name ?? m.email} — becomes /curators/<this>\n`
        + '(a-z, 0-9, hyphen, 2-30 chars):',
      );
      if (!input || !input.trim()) return;
      handle = input.trim();
    }

    if (!confirm(
      `Change ${m.display_name ?? m.email} to ${label}?\n\n`
      + 'Their published maps stay visible either way.',
    )) return;

    start(async () => {
      const r = await setRole(m.id, role, tier ?? null, handle);
      setErr(r.ok ? null : r.error);
    });
  }

  return (
    <div className="admin-row admin-row-tight">
      <div className="admin-row-main member-row-main">
        <span className="admin-email">
          <span className="truncate">{m.email}</span>
        </span>
        <span className="admin-name">
          <span className="truncate">{m.display_name}</span>
          {/* 자기 자신은 강등할 수 없다 — 아래 줄 대신 이름 옆에 배지로 표시 */}
          {isMe && <span className="admin-you" title="This is you — role cannot be changed here">You</span>}
        </span>

        {/* select+Edit 을 한 grid 셀로 묶어야 행마다 폭이 똑같이 잡힌다 —
            둘을 따로 두면 Edit 유무에 따라 열 경계 자체가 흔들린다. */}
        <span className="admin-controls">
          <select
            className={`field admin-select${showEdit ? '' : ' admin-select-wide'}`}
            value={roleValue(m)}
            disabled={isMe || pending}
            onChange={(e) => change(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}
                // email 계정은 큐레이터·어드민 선택지가 비활성이다
                disabled={emailOnly && r.v !== 'user'}>
                {r.label}
              </option>
            ))}
          </select>

          {/* 텍스트 Edit 대신 연필 아이콘 — 좁은 행에서 공간을 아낀다 */}
          {showEdit && (
            <button className="btn btn-ghost sm icon" onClick={() => setOpen(!open)}
              aria-label={open ? 'Close editor' : 'Edit curator profile'} aria-expanded={open}>
              <IconEdit />
            </button>
          )}
        </span>
      </div>

      <Err msg={err} />

      {open && <CuratorFields m={m} />}
    </div>
  );
}

function CuratorFields({ m }: { m: Member }) {
  const [f, setF] = useState({
    handle: m.handle ?? '', display_name: m.display_name ?? '',
    byline: m.byline ?? '', about: m.about ?? '', listed: m.curator_listed,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await saveCuratorProfile(m.id, f);
      setMsg(r.ok ? 'Saved.' : r.error);
    });
  }

  return (
    <div className="admin-edit">
      <label>profile url
        <input className="field field-flat" value={f.handle}
          onChange={(e) => setF({ ...f, handle: e.target.value })} />
      </label>
      <label>name
        <input className="field field-flat" value={f.display_name}
          onChange={(e) => setF({ ...f, display_name: e.target.value })} />
      </label>
      <label>byline (short tagline shown under the name, max 60 chars)
        <input className="field field-flat" maxLength={60} value={f.byline}
          onChange={(e) => setF({ ...f, byline: e.target.value })} />
      </label>
      <label>about (longer bio on the profile page, optional)
        <textarea className="field field-flat" maxLength={300} rows={2} value={f.about}
          onChange={(e) => setF({ ...f, about: e.target.value })} />
      </label>
      <label className="admin-toggle">
        <input type="checkbox" checked={!f.listed}
          onChange={(e) => setF({ ...f, listed: !e.target.checked })} />
        Retired — hides the profile page, keeps the maps
      </label>
      <div className="row-end">
        {msg && <span className="admin-hint">{msg}</span>}
        {/* 텍스트 Save 대신 체크 아이콘 — Maps 탭 Region 저장과 같은 패턴 */}
        <button className="btn btn-dark sm icon" onClick={save} disabled={pending} aria-label="Save profile">
          <IconCheck />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Pending */
export function PendingTab({ maps }: { maps: AdminMap[] }) {
  if (!maps.length) return <p className="admin-hint admin-empty">Nothing waiting for review.</p>;
  return <div className="admin-list">{maps.map((m) => <PendingRow key={m.id} m={m} />)}</div>;
}

function PendingRow({ m }: { m: AdminMap }) {
  const [note, setNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <b style={{ flex: 1 }}>{m.title}</b>
        <span className="admin-hint">by {m.curator_name} · {m.place_count} places</span>
        {/* /maps/{slug} 는 map_cards(published 전용) 를 읽어 pending 은
            거기서 404 난다 — 원본 테이블을 직접 읽는 어드민 전용 경로로 */}
        <a className="btn btn-ghost sm icon" href={`/admin/preview/${m.slug}`} target="_blank" rel="noreferrer"
          aria-label="Preview">
          <IconEye />
        </a>
        {/* Approve·Reject 를 붙여 묶는다 — 멀리 떨어져 있으면 둘을 비교하며
            고르는 게 아니라 각자 발견해야 하는 액션처럼 읽힌다.
            Reject 는 먼저 사유 입력창을 펼치기만 한다 — 즉시 반려하지 않는다. */}
        <span className="admin-controls">
          <button className="btn btn-ghost danger sm" disabled={pending}
            aria-expanded={showReject} onClick={() => setShowReject((v) => !v)}>
            Reject
          </button>
          <button className="btn btn-dark sm" disabled={pending}
            onClick={() => start(async () => {
              const r = await approveMap(m.id);
              setErr(r.ok ? null : r.error);
            })}>
            Approve
          </button>
        </span>
      </div>

      {/* 반려 사유는 필수다 — 없으면 큐레이터가 무엇을 고칠지 모른다.
          기본은 숨겨 두고 Reject 를 눌렀을 때만 편다 — 대부분의 맵은
          승인되므로 이 입력창이 항상 떠 있을 이유가 없다. */}
      {showReject && (
        <div className="admin-row-main">
          <input className="field field-flat" placeholder="Reason (required to reject)"
            value={note} autoFocus
            onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-ghost danger sm" disabled={pending || !note.trim()}
            onClick={() => start(async () => {
              const r = await rejectMap(m.id, note);
              setErr(r.ok ? null : r.error);
            })}>
            Confirm reject
          </button>
        </div>
      )}
      <Err msg={err} />
    </div>
  );
}

/* ---------------------------------------------------------- Maps */
// 순서 고정: Published → Pending → Hidden → Rejected (요청한 흐름 —
// "지금 살아있는 것부터, 그다음 처리할 것, 내려간 것, 반려된 것" 순).
// draft 는 요청에 없었지만 실제 존재하는 맵이라 빼면 어드민이 그 맵을
// 아예 못 본다 — 이름 없는 나머지 뒤에 붙였다.
const MAP_GROUPS: { status: string; label: string }[] = [
  { status: 'published', label: 'Published' },
  { status: 'pending', label: 'Pending' },
  { status: 'hidden', label: 'Hidden' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'draft', label: 'Draft' },
];

export function MapsTab({ maps, meId }: { maps: AdminMap[]; meId: string }) {
  const groups = MAP_GROUPS
    .map((g) => ({ ...g, items: maps.filter((m) => m.status === g.status) }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-md)' }}>
      {groups.map((g) => (
        <section key={g.status}>
          <div className="section-head"><h2>{g.label}</h2><span className="count">{g.items.length}</span></div>
          {/* 상태별로 이미 묶여 있어 행마다 상태를 또 안 적는다(닷도
              생략). 5개까지만 보이고 나머지는 세로 스크롤 — 목록이
              길어져도 탭 하나가 끝없이 늘어지지 않는다. */}
          <div className="admin-list admin-list-scroll">
            {g.items.map((m) => <MapRow key={m.id} m={m} meId={meId} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function MapRow({ m, meId }: { m: AdminMap; meId: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [region, setRegion] = useState(m.region ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();
  const hidden = m.status === 'hidden';
  const isMine = m.curator_id === meId;
  const canEdit = isMine && (m.status === 'draft' || m.status === 'rejected');
  // 발행 전이거나(draft·pending·rejected) 내려간(hidden) 맵은
  // map_cards(published 전용) 에 없어 실제 페이지가 없다 — 어드민
  // 전용 미리보기로 보낸다. published 만 진짜 페이지를 연다.
  const openHref = m.status === 'published' ? `/maps/${m.slug}` : `/admin/preview/${m.slug}`;

  return (
    <div className="admin-row">
      {/* 1줄 — 제목만. 상태는 이제 그룹 헤더가 말해줘서 컬러 닷도
          텍스트도 행마다 또 안 넣는다 (그룹핑 도입으로 생략). */}
      <div className="admin-row-main">
        <b>{m.title}</b>
      </div>

      {/* 2줄 — 누구·얼마나 + 동작. 상태를 바꾸는 액션(Hide/Publish,
          Continue editing)만 눈에 보이게 두고, 나머지(Open·Photos)는
          케밥으로 묶었다 — 이 행이 액션이 가장 많아서 케밥이 맞다. */}
      <div className="admin-row-main">
        <span className="admin-hint">{m.curator_name} · {m.place_count} places</span>
        {/* 발행은 본인 draft·rejected 에서만 — tip 필수·최소 4곳 검증이
            그 편집 화면에만 있다. 어드민이 남의 미완성 초안을 검증 없이
            강제로 내보내면 §5 S9 규칙이 깨진다. */}
        {canEdit && (
          <a className="btn btn-ghost sm" href={`/curator/maps/${m.id}/edit`}>
            Continue editing
          </a>
        )}
        {(m.status === 'published' || hidden) && (
          <button className="btn btn-ghost sm" disabled={pending}
            onClick={() => start(async () => {
              const r = await setMapVisibility(m.id, !hidden);
              setErr(r.ok ? null : r.error);
            })}>
            {hidden ? 'Publish' : 'Hide'}
          </button>
        )}
        <div className="kebab">
          <button className="kebab-trigger" onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions" aria-expanded={menuOpen}>
            <IconKebab />
          </button>
          {menuOpen && (
            <>
              {/* 배경 클릭으로 닫는다. Open·Photos 는 이동이라 메뉴가
                  저절로 닫힐 필요가 없다(새 탭/새 페이지). */}
              <div className="kebab-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="kebab-menu">
                <a href={openHref} target="_blank" rel="noreferrer">Open</a>
                <a href={`/admin/photos/${m.slug}`}>Photos</a>
              </div>
            </>
          )}
        </div>
        {/* 삭제 버튼은 어디에도 없다 (§3.3) */}
      </div>

      {/* 3줄 — 지역(PRD v1.4 §1). 필터 아님, 홈 상단 그루핑 전용.
          비우면 Nationwide 로 간다. 입력창을 줄이고 Save 를 체크
          아이콘으로 바로 옆에 붙였다 — 이 행에서 값은 지역명 하나뿐이라
          넓은 입력창이 필요 없다. */}
      <div className="admin-row-main">
        <input className="field field-flat" style={{ flex: '0 1 12rem', minWidth: 0 }}
          title="Region — blank = Nationwide"
          placeholder="Region (optional)"
          value={region} onChange={(e) => setRegion(e.target.value)} />
        <button className="btn btn-ghost sm icon" disabled={pending} aria-label="Save region"
          onClick={() => start(async () => {
            const r = await setMapRegion(m.id, region);
            setErr(r.ok ? null : r.error);
          })}>
          <IconCheck />
        </button>
      </div>
      {m.review_note && <p className="admin-hint">Rejected: {m.review_note}</p>}
      <Err msg={err} />
    </div>
  );
}

/* ---------------------------------------------------------- Reviews */
export function ReviewsTab({ reviews }: { reviews: AdminReview[] }) {
  if (!reviews.length) return <p className="admin-hint admin-empty">No reviews yet.</p>;
  return <div className="admin-list">{reviews.map((r) => <ReviewRow key={r.id} r={r} />)}</div>;
}

function ReviewRow({ r }: { r: AdminReview }) {
  const [gone, setGone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (gone) return null;

  return (
    <div className="admin-row review-row">
      {/* 어드민은 악성 후기를 찾으러 온다 — 본문이 주인공이라 크고
          진하게, 작성자·별점은 참고 정보라 작고 흐리게 내렸다. */}
      <p className="review-body">{r.body}</p>
      <p className="admin-hint review-meta">
        <IconStar /> {r.rating.toFixed(1)} · {r.author_name} ·{' '}
        <a href={`/maps/${r.map_slug}`} target="_blank" rel="noreferrer">{r.map_title}</a>
      </p>
      {/* 오터치 방지 — 본문을 읽다가 실수로 누르지 않게 카드 모서리로 뗀다 */}
      <button className="btn btn-ghost danger sm icon review-delete" disabled={pending}
        aria-label="Delete review"
        onClick={() => {
          if (!confirm('Delete this review? This cannot be undone.')) return;
          start(async () => {
            const res = await deleteReview(r.id);
            if (res.ok) setGone(true);
            else setErr(res.error);
          });
        }}>
        <IconTrash />
      </button>
      <Err msg={err} />
    </div>
  );
}
