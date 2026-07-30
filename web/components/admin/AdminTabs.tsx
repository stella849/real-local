'use client';

import { useState, useTransition } from 'react';
import {
  setRole, saveCuratorProfile, approveMap, rejectMap, setMapVisibility,
} from '@/app/admin/actions';
import { IconGoogle, IconMail } from '@/components/Icons';

export type Member = {
  id: string; email: string | null; display_name: string | null;
  role: 'user' | 'curator' | 'admin';
  curator_tier: 'resident' | 'guest' | null;
  handle: string | null; byline: string | null; about: string | null;
  curator_listed: boolean; auth_provider: string | null;
};

export type AdminMap = {
  id: string; slug: string; title: string; status: string;
  review_note: string | null; curator_name: string; place_count: number;
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
      <div className="admin-row-main">
        <span className="admin-email">
          {m.email}
          <span className="provider-mark" title={emailOnly ? 'Email' : 'Google'}>
            {emailOnly ? <IconMail /> : <IconGoogle />}
          </span>
        </span>
        <span className="admin-name">{m.display_name}</span>

        <select
          className="field admin-select"
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

        {m.role !== 'user' && (
          <button className="btn btn-secondary sm" onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Edit'}
          </button>
        )}
      </div>

      {/* 자기 자신은 강등할 수 없다. 실수로 하면 아무도 어드민에 못 들어간다 */}
      {isMe && <p className="admin-hint">This is you — role cannot be changed here.</p>}
      {emailOnly && !isMe && <p className="admin-hint">Curators must sign in with Google.</p>}
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
        <a className="btn btn-secondary sm" href={`/maps/${m.slug}`} target="_blank" rel="noreferrer">
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
        <button className="btn btn-secondary sm" disabled={pending}
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
export function MapsTab({ maps }: { maps: AdminMap[] }) {
  return (
    <div className="admin-list">
      {maps.map((m) => <MapRow key={m.id} m={m} />)}
    </div>
  );
}

function MapRow({ m }: { m: AdminMap }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hidden = m.status === 'hidden';

  return (
    <div className="admin-row">
      <div className="admin-row-main">
        <b>{m.title}</b>
        <span className="badge quiet">{m.status.toUpperCase()}</span>
        <span className="admin-hint">{m.curator_name} · {m.place_count} places</span>
        <a className="btn btn-secondary sm" href={`/maps/${m.slug}`} target="_blank" rel="noreferrer">
          Open
        </a>
        {(m.status === 'published' || hidden) && (
          <button className="btn btn-secondary sm" disabled={pending}
            onClick={() => start(async () => {
              const r = await setMapVisibility(m.id, !hidden);
              setErr(r.ok ? null : r.error);
            })}>
            {hidden ? 'Publish' : 'Hide'}
          </button>
        )}
        <a className="btn btn-secondary sm" href={`/admin/photos/${m.slug}`}>Photos</a>
        {/* 삭제 버튼은 어디에도 없다 (§3.3) */}
      </div>
      {m.review_note && <p className="admin-hint">Rejected: {m.review_note}</p>}
      <Err msg={err} />
    </div>
  );
}
