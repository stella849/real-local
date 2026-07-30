'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMap, updateMap, type DraftPlace } from '@/app/curator/maps/actions';

type Hit = {
  id: string; name: string; name_ko: string | null; address: string; lat: number; lng: number;
  photo: string | null; attribution: string | null;
  candidates: { name: string; attribution: string | null }[];
};

const MIN_TO_PUBLISH = 4;

type Initial = { title: string; one_liner: string; concept_tag: string; places: DraftPlace[] };

/** mapId 가 있으면 draft·rejected 재편집(F13 후속) — 없으면 신규 작성(S9). */
export function MapEditor({ tier, mapId, initial, rejectionNote }: {
  tier: 'resident' | 'guest' | null;
  mapId?: string;
  initial?: Initial;
  rejectionNote?: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [tip, setTip] = useState('');
  const [places, setPlaces] = useState<DraftPlace[]>(initial?.places ?? []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [oneLiner, setOneLiner] = useState(initial?.one_liner ?? '');
  const [tag, setTag] = useState(initial?.concept_tag ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // 검색~선택을 한 세션으로 묶어 과금을 1회로 만든다 (§5 S9)
  const session = useRef<string>(crypto.randomUUID());

  const dirty = places.length > 0 || title || oneLiner;

  /* 자동저장이 없으므로 이탈하면 작업이 사라진다. 경고를 띄운다 (§5 S9). */
  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saved]);

  /* 300ms 디바운스. 매 타건마다 호출하지 않는다 (§5 S9 API 비용 규칙). */
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sessionToken: session.current }),
      });
      if (!res.ok) { setHits([]); return; }
      const j = await res.json();
      setHits(j.places ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function add() {
    if (!picked) return;
    // tip 을 비우면 장소를 추가할 수 없다 — 이 앱의 상품 그 자체다
    if (!tip.trim()) { setErr('Write your tip first.'); return; }

    setPlaces([...places, {
      google_place_id: picked.id,
      name_en: picked.name,
      name_ko: picked.name_ko,
      address: picked.address,
      lat: picked.lat,
      lng: picked.lng,
      curator_note: tip.trim(),
      photo_ref: picked.photo,
      photo_attribution: picked.attribution,
      photo_candidates: picked.candidates,
    }]);

    setPicked(null); setTip(''); setQ(''); setHits([]); setErr(null);
    session.current = crypto.randomUUID();   // 선택이 끝나면 새 세션
  }

  function submit(publish: boolean) {
    start(async () => {
      setErr(null);
      const input = { title, one_liner: oneLiner, concept_tag: tag, places, publish };
      const r = mapId ? await updateMap({ mapId, ...input }) : await createMap(input);
      if (!r.ok) { setErr(r.error); return; }
      setSaved(true);
      router.push(publish ? `/maps/${r.slug}` : '/curator');
      router.refresh();
    });
  }

  const canPublish = places.length >= MIN_TO_PUBLISH && !!title.trim() && !!oneLiner.trim();

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-lg)' }}>
      {rejectionNote && (
        <p className="notice"><b>Rejected:</b> {rejectionNote}</p>
      )}

      {/* 1 — 장소 추가 */}
      <section>
        <p className="eyebrow">1 · Add places</p>
        <input className="field" placeholder="Search a place or address"
          value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} />

        {hits.length > 0 && !picked && (
          <div className="admin-list" style={{ padding: 0, gap: 4 }}>
            {hits.map((h) => (
              <button key={h.id} className="admin-row" style={{ textAlign: 'left' }}
                onClick={() => { setPicked(h); setHits([]); }}>
                {/* name_ko 는 구글이 영문 표기가 없어 한글을 그대로 준
                    경우에만 있다 — 로마자로 바꾼 이름이 맞는 곳인지
                    확인할 수 있게 원문을 옆에 남긴다 */}
                <b>{h.name}{h.name_ko && <span className="admin-hint"> · {h.name_ko}</span>}</b>
                <p className="admin-hint">{h.address}</p>
              </button>
            ))}
          </div>
        )}

        {picked && (
          <div className="admin-row" style={{ marginTop: 'var(--sp-xs)' }}>
            <b>{picked.name}{picked.name_ko && <span className="admin-hint"> · {picked.name_ko}</span>}</b>
            <p className="admin-hint">{picked.address}</p>
            <textarea className="field" rows={2} required
              style={{ marginTop: 'var(--sp-xs)' }}
              placeholder="Your tip * — what should someone order, when should they go?"
              value={tip} onChange={(e) => setTip(e.target.value)} />
            <div className="row-end">
              <button className="btn btn-secondary sm" onClick={() => { setPicked(null); setTip(''); }}>
                Cancel
              </button>
              <button className="btn btn-dark sm" onClick={add}>Add</button>
            </div>
          </div>
        )}
      </section>

      {/* 추가된 장소 — 순서는 등록순 고정, 삭제만 가능 */}
      {places.length > 0 && (
        <section>
          <p className="eyebrow">Added ({places.length})</p>
          <div style={{ display: 'grid', gap: 4 }}>
            {places.map((p, i) => (
              <div className="admin-row" key={`${p.google_place_id}-${i}`}>
                <div className="admin-row-main">
                  <span className="place-n">{i + 1}</span>
                  <b style={{ flex: 1 }}>{p.name_en}</b>
                  <button className="btn btn-secondary sm"
                    onClick={() => setPlaces(places.filter((_, k) => k !== i))}>
                    Remove
                  </button>
                </div>
                <p className="place-tip">{p.curator_note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2 — 제목 */}
      <section>
        <p className="eyebrow">2 · Title</p>
        <input className="field" placeholder="Everyday Euljiro"
          value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field" placeholder="One line — what is this map about?"
          value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} />
        <input className="field" placeholder="Concept tag (optional) — LATE-NIGHT"
          value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} />
      </section>

      <p className="form-error">{err}</p>

      <div style={{ display: 'grid', gap: 'var(--sp-xs)' }}>
        <button className="btn btn-secondary btn-block" disabled={pending}
          onClick={() => submit(false)}>
          Save draft
        </button>
        <button className="btn btn-dark btn-block" disabled={pending || !canPublish}
          onClick={() => submit(true)}>
          Publish
        </button>
        {places.length < MIN_TO_PUBLISH && (
          <p className="admin-hint" style={{ textAlign: 'center' }}>
            Add at least {MIN_TO_PUBLISH} places to publish.
          </p>
        )}
        {tier === 'guest' && canPublish && (
          <p className="admin-hint" style={{ textAlign: 'center' }}>
            Your map goes to an admin for review before it appears.
          </p>
        )}
      </div>
    </div>
  );
}
