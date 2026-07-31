'use client';

import { useState, useTransition } from 'react';
import {
  setRole, saveCuratorProfile, approveMap, rejectMap, setMapVisibility, setMapRegion,
  deleteReview,
} from '@/app/admin/actions';
import { IconGoogle, IconMail, IconStar, IconKebab } from '@/components/Icons';

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
export function MembersTab({ members, meId }: { members: Member[]; meId: string }) {
  return (
    <div className="admin-list">
      {members.map((m) => <MemberRow key={m.id} m={m} isMe={m.id === meId} />)}
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
    if (!confirm(
      `Change ${m.display_name ?? m.email} to ${label}?\n\n`
      + 'Their published maps stay visible either way.',
    )) return;

    start(async () => {
      const r = await setRole(m.id, role, tier ?? null);
      setErr(r.ok ? null : r.error);
    });
  }

  return (
    <div className="admin-row">
      <div className="admin-row-main member-row-main">
        <span className="admin-email">
          {m.email}
          {/* 반복 문구 대신 아이콘 툴팁 하나로 대체 — 목록이 길어질수록 반복 텍스트는 소음이다 */}
          <span className="provider-mark" title={emailOnly ? 'Email sign-in — cannot become curator/admin' : 'Google sign-in'}>
            {emailOnly ? <IconMail /> : <IconGoogle />}
          </span>
        </span>
        <span className="admin-name">
          {m.display_name}
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

          {showEdit && (
            <button className="btn btn-ghost sm" onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Edit'}
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
      <label>handle
        <input className="field" value={f.handle}
          onChange={(e) => setF({ ...f, handle: e.target.value })} />
      </label>
      <label>name
        <input className="field" value={f.display_name}
          onChange={(e) => setF({ ...f, display_name: e.target.value })} />
      </label>
      <label>byline
        <input className="field" maxLength={60} value={f.byline}
          onChange={(e) => setF({ ...f, byline: e.target.value })} />
      </label>
      <label>about
        <textarea className="field" maxLength={300} rows={2} value={f.about}
          onChange={(e) => setF({ ...f, about: e.target.value })} />
      </label>
      <label className="admin-toggle">
        <input type="checkbox" checked={!f.listed}
          onChange={(e) => setF({ ...f, listed: !e.target.checked })} />
        Retired — hides the profile page, keeps the maps
      </label>
      <div className="row-end">
        {msg && <span className="admin-hint">{msg}</span>}
        <button className="btn btn-dark sm" onClick={save} disabled={pending}>Save</button>
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
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <b>{m.title}</b>
        <span className="admin-hint">by {m.curator_name} · {m.place_count} places</span>
        {/* /maps/{slug} 는 map_cards(published 전용) 를 읽어 pending 은
            거기서 404 난다 — 원본 테이블을 직접 읽는 어드민 전용 경로로 */}
        <a className="btn btn-ghost sm" href={`/admin/preview/${m.slug}`} target="_blank" rel="noreferrer">
          Preview
        </a>
        <button className="btn btn-dark sm" disabled={pending}
          onClick={() => start(async () => {
            const r = await approveMap(m.id);
            setErr(r.ok ? null : r.error);
          })}>
          Approve
        </button>
      </div>
      <div className="admin-row-main">
        {/* 반려 사유는 필수다. 없으면 큐레이터가 무엇을 고칠지 모른다 */}
        <input className="field" placeholder="Reason (required to reject)"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-ghost danger sm" disabled={pending}
          onClick={() => start(async () => {
            const r = await rejectMap(m.id, note);
            setErr(r.ok ? null : r.error);
          })}>
          Reject
        </button>
      </div>
      <Err msg={err} />
    </div>
  );
}

/* ---------------------------------------------------------- Maps */
export function MapsTab({ maps, meId }: { maps: AdminMap[]; meId: string }) {
  return (
    <div className="admin-list">
      {maps.map((m) => <MapRow key={m.id} m={m} meId={meId} />)}
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
      {/* 1줄 — 무엇인지: 제목 + 상태(컬러 닷). 캡슐 배지 대신이다 —
          어드민 화면 전체에서 알약이 볼륨 커 보인다는 요청으로 바꿨다. */}
      <div className="admin-row-main">
        <b>{m.title}</b>
        <span className={`status ${m.status}`}>{m.status.toUpperCase()}</span>
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
          비우면 Nationwide 로 간다. */}
      <div className="admin-row-main">
        <input className="field" placeholder="Region (optional) — e.g. Seongsu. Blank = Nationwide"
          value={region} onChange={(e) => setRegion(e.target.value)} />
        <button className="btn btn-ghost sm" disabled={pending}
          onClick={() => start(async () => {
            const r = await setMapRegion(m.id, region);
            setErr(r.ok ? null : r.error);
          })}>
          Save
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
    <div className="admin-row">
      <div className="admin-row-main">
        <span className="meta-count"><IconStar /> {r.rating}</span>
        <b>{r.author_name}</b>
        <a className="admin-hint" href={`/maps/${r.map_slug}`} target="_blank" rel="noreferrer">
          {r.map_title}
        </a>
        <button className="btn btn-ghost danger sm" disabled={pending}
          onClick={() => {
            if (!confirm('Delete this review? This cannot be undone.')) return;
            start(async () => {
              const res = await deleteReview(r.id);
              if (res.ok) setGone(true);
              else setErr(res.error);
            });
          }}>
          Delete
        </button>
      </div>
      <p className="admin-hint">{r.body}</p>
      <Err msg={err} />
    </div>
  );
}
