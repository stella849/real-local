'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { deleteMyAccount } from '@/app/profile/actions';

/**
 * 회원 탈퇴. 되돌릴 수 없다는 것과, 이미 쓴 후기는 탈퇴 후엔 본인도
 * 못 고친다는 것(§ map_reviews.user_id → null, RLS 가 자동으로 잠근다)
 * 을 누르기 전에 먼저 보여준다 — confirm() 한 번으로는 이 두 가지가
 * 다 전달되지 않는다.
 */
export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirmDelete() {
    if (!confirm('Delete your account now? This cannot be undone.')) return;
    start(async () => {
      setErr(null);
      const r = await deleteMyAccount();
      if (!r.ok) { setErr(r.error); return; }
      await createClient().auth.signOut();
      router.push('/');
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn btn-secondary btn-block" onClick={() => setOpen(true)}>
        Delete account
      </button>
    );
  }

  return (
    <div className="notice">
      <p><b>This can’t be undone.</b> Your account, saved maps, and saved places will be permanently deleted.</p>
      <p>Reviews you’ve written will stay visible to others, but after this no one — including you — will be able to edit or delete them.</p>
      <div className="row-end" style={{ marginTop: 'var(--sp-xs)' }}>
        <button className="btn btn-secondary sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-dark sm" disabled={pending} onClick={confirmDelete}>
          {pending ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
      {err && <p className="form-error" style={{ minHeight: 0, marginTop: 4 }}>{err}</p>}
    </div>
  );
}
