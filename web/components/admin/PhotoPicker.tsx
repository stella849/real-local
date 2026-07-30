'use client';

import { useState, useTransition } from 'react';
import { setPlacePhoto } from '@/app/admin/actions';
import { setPlacePhotos } from '@/app/curator/maps/actions';
import { createClient } from '@/lib/supabase/client';
import { photoUrl, resolvePhotoUrl } from '@/lib/types';
import { IconCheck } from '@/components/Icons';

export type Candidate = { name: string; attribution: string | null };

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * 사진 교체(F11) + 갤러리 + 큐레이터 업로드 (PRD v1.4 §4).
 *
 * 세 구역이다.
 *   1) Cover — 목록 썸네일 대표 1장(photo_ref). canPickCover(어드민)만.
 *      클릭 즉시 저장 — 후보가 최대 10장이라 별도 저장 버튼은 단계만
 *      늘린다. 대신 체크 배지 + "Saved." 로 저장을 눈에 보이게 한다.
 *   2) Gallery — 상세 페이지용 여러 장(photo_refs). 어드민·큐레이터
 *      본인 둘 다. 구글 후보 다중 선택 + 직접 업로드가 같은 배열에
 *      섞여 들어간다.
 *   3) 업로드 — 구글이 후보를 못 찾은 장소(이름이 로마자 변환이라 매칭
 *      자체가 안 된 경우)도 이 경로로는 사진을 넣을 수 있다 — 그래서
 *      candidates 가 비어도 업로드 버튼은 항상 보인다.
 */
export function PhotoPicker({ placeId, current, candidates, gallery, canPickCover }: {
  placeId: string;
  current: string | null;
  candidates: Candidate[];
  gallery: string[];
  canPickCover: boolean;
}) {
  const [ref, setRef] = useState(current);
  const [selected, setSelected] = useState<string[]>(gallery);
  const [justSaved, setJustSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function saveGallery(next: string[]) {
    setErr(null);
    const r = await setPlacePhotos(placeId, next);
    if (r.ok) setSelected(next);
    else setErr(r.error);
  }

  const toggleCandidate = (name: string) => saveGallery(
    selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name],
  );

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Pick an image file.'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setErr('That image is larger than 2MB. Pick a smaller one.'); return; }

    setBusy(true); setErr(null);
    const db = createClient();
    const path = `${placeId}/${Date.now()}.jpg`;
    const { error: upErr } = await db.storage.from('place-photos')
      .upload(path, file, { contentType: file.type });
    if (upErr) { setBusy(false); setErr(upErr.message); return; }

    const { data } = db.storage.from('place-photos').getPublicUrl(path);
    await saveGallery([...selected, data.publicUrl]);
    setBusy(false);
  }

  const uploaded = selected.filter((s) => s.startsWith('http'));

  return (
    <div>
      {canPickCover && candidates.length > 0 && (
        <>
          <p className="admin-hint">Cover (list thumbnail)</p>
          <div className="photo-strip">
            {candidates.map((c) => (
              <button
                key={c.name}
                className="photo-option"
                aria-pressed={ref === c.name}
                disabled={pending}
                title={c.attribution ?? undefined}
                onClick={() => start(async () => {
                  setErr(null);
                  const r = await setPlacePhoto(placeId, c.name);
                  if (r.ok) {
                    setRef(c.name);
                    setJustSaved(true);
                    setTimeout(() => setJustSaved(false), 2000);
                  } else {
                    setErr(r.error);
                  }
                })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(c.name, 160)} alt="" loading="lazy" />
                {ref === c.name && <IconCheck className="photo-check" />}
              </button>
            ))}
          </div>
          {justSaved && <p className="admin-hint">Saved.</p>}
        </>
      )}

      {candidates.length > 0 && (
        <>
          <p className="admin-hint">Gallery (detail page, pick any number)</p>
          <div className="photo-strip">
            {candidates.map((c) => (
              <button key={c.name} className="photo-option" aria-pressed={selected.includes(c.name)}
                title={c.attribution ?? undefined} onClick={() => toggleCandidate(c.name)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(c.name, 160)} alt="" loading="lazy" />
                {selected.includes(c.name) && <IconCheck className="photo-check" />}
              </button>
            ))}
          </div>
        </>
      )}

      {uploaded.length > 0 && (
        <>
          <p className="admin-hint">Your uploads (tap to remove)</p>
          <div className="photo-strip">
            {uploaded.map((url) => (
              <button key={url} className="photo-option" aria-pressed="true"
                onClick={() => saveGallery(selected.filter((s) => s !== url))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolvePhotoUrl(url, 160)} alt="" loading="lazy" />
                <IconCheck className="photo-check" />
              </button>
            ))}
          </div>
        </>
      )}

      {candidates.length === 0 && (
        <p className="admin-hint">No Google candidates — this place was not matched on Google. Upload your own instead.</p>
      )}

      <label className="btn btn-secondary sm"
        style={{ marginTop: 'var(--sp-xs)', display: 'inline-block', cursor: 'pointer' }}>
        {busy ? 'Uploading…' : 'Upload your own photo'}
        <input type="file" accept="image/*" onChange={upload} disabled={busy} hidden />
      </label>

      {err && <p className="form-error" style={{ minHeight: 0 }}>{err}</p>}
    </div>
  );
}
