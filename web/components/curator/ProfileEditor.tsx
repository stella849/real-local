'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveMyProfile, saveMyAvatar, setMyMapVisibility } from '@/app/curator/actions';
import { CuratorAvatar } from '@/components/CuratorLine';

const MAX_BYTES = 2 * 1024 * 1024;   // 2MB

export function AvatarUploader({ userId, name, url }: {
  userId: string; name: string; url: string | null;
}) {
  const router = useRouter();
  const [src, setSrc] = useState(url);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { setMsg('Pick an image file.'); return; }
    if (file.size > MAX_BYTES) {
      setMsg('That image is larger than 2MB. Pick a smaller one.');
      return;
    }

    setBusy(true); setMsg(null);
    const db = createClient();
    const path = `${userId}.jpg`;

    const { error } = await db.storage.from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setMsg(error.message); setBusy(false); return; }

    const { data } = db.storage.from('avatars').getPublicUrl(path);
    /* ?v= 를 붙이지 않으면 CDN 캐시 때문에 바꾼 사진이 안 보인다.
       경로가 {user_id}.jpg 로 고정이라 URL 자체는 변하지 않기 때문이다. */
    const busted = `${data.publicUrl}?v=${Date.now()}`;

    const r = await saveMyAvatar(busted);
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }

    setSrc(busted);
    setMsg('Photo updated.');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-md)', alignItems: 'center' }}>
      <CuratorAvatar name={name} url={src} className="curator-avatar" />
      <div>
        <label className="btn btn-secondary sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Uploading…' : 'Change photo'}
          <input type="file" accept="image/*" onChange={pick} disabled={busy} hidden />
        </label>
        <p className="admin-hint">JPG or PNG, up to 2MB.</p>
        {msg && <p className="admin-hint">{msg}</p>}
      </div>
    </div>
  );
}

export function ProfileFields({ initial }: {
  initial: { display_name: string; byline: string; about: string };
}) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-xs)' }}>
      <label className="admin-hint">Name
        <input className="field" value={f.display_name}
          onChange={(e) => setF({ ...f, display_name: e.target.value })} />
      </label>
      <label className="admin-hint">One line ({f.byline.length}/60)
        <input className="field" maxLength={60} value={f.byline}
          onChange={(e) => setF({ ...f, byline: e.target.value })} />
      </label>
      <label className="admin-hint">About ({f.about.length}/300)
        <textarea className="field" maxLength={300} rows={3} value={f.about}
          onChange={(e) => setF({ ...f, about: e.target.value })} />
      </label>
      <div className="row-end">
        {msg && <span className="admin-hint">{msg}</span>}
        <button className="btn btn-dark sm" disabled={pending}
          onClick={() => start(async () => {
            const r = await saveMyProfile(f);
            setMsg(r.ok ? 'Saved.' : r.error);
          })}>
          Save
        </button>
      </div>
    </div>
  );
}

export function MyMapRow({ id, title, slug, status, note }: {
  id: string; title: string; slug: string; status: string; note: string | null;
}) {
  const [s, setS] = useState(status);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canToggle = s === 'published' || s === 'hidden';

  return (
    <div className="admin-row">
      <div className="admin-row-main">
        {/* published 는 상세 페이지로, draft·rejected 는 재편집 화면으로
            연결한다. map_cards 뷰가 published 전용이라 그 외 슬러그로
            /maps/{slug} 에 들어가면 404 난다 (원래 버그였던 지점).
            pending/hidden 은 아직 편집 경로가 없어 일반 텍스트로 둔다. */}
        {s === 'published' && <a href={`/maps/${slug}`} style={{ fontWeight: 600 }}>{title}</a>}
        {(s === 'draft' || s === 'rejected') &&
          <a href={`/curator/maps/${id}/edit`} style={{ fontWeight: 600 }}>{title}</a>}
        {s !== 'published' && s !== 'draft' && s !== 'rejected' &&
          <span style={{ fontWeight: 600 }}>{title}</span>}
        <span className="badge quiet">{s.toUpperCase()}</span>
        {canToggle && (
          <button className="btn btn-secondary sm" disabled={pending}
            onClick={() => start(async () => {
              const hide = s === 'published';
              const r = await setMyMapVisibility(id, hide);
              if (r.ok) setS(hide ? 'hidden' : 'published');
              else setErr(r.error);
            })}>
            {s === 'published' ? 'Hide' : 'Publish'}
          </button>
        )}
        {/* 사진 갤러리·직접 업로드 (PRD v1.4 §4.2) */}
        <a className="btn btn-secondary sm" href={`/admin/photos/${slug}`}>Photos</a>
        {/* 삭제 버튼은 없다 (§3.3) */}
      </div>
      {/* 반려된 맵은 사유를 표시한다 — 없으면 무엇을 고칠지 모른다 */}
      {s === 'rejected' && note && <p className="admin-hint">Rejected: {note}</p>}
      {err && <p className="form-error" style={{ minHeight: 0 }}>{err}</p>}
    </div>
  );
}
