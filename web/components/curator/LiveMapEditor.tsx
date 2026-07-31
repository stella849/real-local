'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateLiveMap, type DraftPlace } from '@/app/curator/maps/actions';

type Hit = {
  id: string; name: string; name_ko: string | null; address: string; lat: number; lng: number;
  photo: string | null; attribution: string | null;
  candidates: { name: string; attribution: string | null }[];
};

type ExistingPlace = { id: string; name_en: string; curator_note: string };

/**
 * Published·pending·hidden 맵 재편집.
 *
 * MapEditor(draft·rejected 전용)와 별개 컴포넌트다 — 그쪽은 제출마다
 * 장소를 통째로 지웠다 다시 넣지만, 이미 나간 장소는 DB 정책상 삭제가
 * 막혀 있다(§3.3). 여기서는 기존 장소의 팁만 고치고, 새 장소는 추가만
 * 할 수 있다 — 빼거나 순서를 바꿀 수는 없다.
 */
export function LiveMapEditor({ mapId, initial, places }: {
  mapId: string;
  initial: { title: string; one_liner: string; concept_tag: string };
  places: ExistingPlace[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [oneLiner, setOneLiner] = useState(initial.one_liner);
  const [tag, setTag] = useState(initial.concept_tag);
  const [tips, setTips] = useState<Record<string, string>>(
    Object.fromEntries(places.map((p) => [p.id, p.curator_note])),
  );
  const [newPlaces, setNewPlaces] = useState<DraftPlace[]>([]);

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [tip, setTip] = useState('');
  const session = useRef<string>(crypto.randomUUID());

  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
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

  async function addPlace() {
    if (!picked) return;
    if (!tip.trim()) { setErr('Write your tip first.'); return; }

    // 검색(languageCode=en)은 구글에 영문 표기가 있는 곳은 한글 이름을
    // 안 준다 — 실제로 담기로 고른 이 1곳에 대해서만 한국어로 한 번 더
    // 물어 채운다. 검색 결과마다 물으면 과금이 배로 늘어난다(§5 S9).
    let nameKo = picked.name_ko;
    if (!nameKo) {
      setAdding(true);
      try {
        const res = await fetch('/api/places/korean-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: picked.id }),
        });
        if (res.ok) nameKo = (await res.json()).name_ko ?? null;
      } catch { /* 조회가 실패해도 장소 추가 자체는 막지 않는다 */ }
      setAdding(false);
    }

    setNewPlaces([...newPlaces, {
      google_place_id: picked.id,
      name_en: picked.name,
      name_ko: nameKo,
      address: picked.address,
      lat: picked.lat,
      lng: picked.lng,
      curator_note: tip.trim(),
      photo_ref: picked.photo,
      photo_attribution: picked.attribution,
      photo_candidates: picked.candidates,
    }]);

    setPicked(null); setTip(''); setQ(''); setHits([]); setErr(null);
    session.current = crypto.randomUUID();
  }

  function save() {
    setErr(null);
    start(async () => {
      const r = await updateLiveMap({
        mapId,
        title,
        one_liner: oneLiner,
        concept_tag: tag,
        tips: Object.entries(tips).map(([id, curator_note]) => ({ id, curator_note })),
        newPlaces,
      });
      if (!r.ok) { setErr(r.error); return; }
      // 저장하고 이 화면에 머무르지 않는다 — 편집이 끝났는데 같은 폼이
      // 그대로 떠 있으면 저장이 됐는지 알기 어렵다. 상단 Back 이
      // 가리키는 곳(맵 목록)과 같은 자리로 돌려보낸다 (요청).
      router.push('/curator');
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-lg)' }}>
      <p className="notice">
        This map is already live — places already on it can be <b>edited</b> but not removed.
        You can still fix a tip or add more places below.
      </p>

      <section>
        <p className="eyebrow">Title</p>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field" placeholder="One line — what is this map about?"
          value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} />
        <input className="field" placeholder="Concept tag (optional) — LATE-NIGHT"
          value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} />
      </section>

      <section>
        <p className="eyebrow">Places ({places.length + newPlaces.length})</p>
        <div style={{ display: 'grid', gap: 4 }}>
          {places.map((p) => (
            <div className="admin-row" key={p.id}>
              <b>{p.name_en}</b>
              <textarea className="field field-flat" rows={2}
                value={tips[p.id] ?? ''}
                onChange={(e) => setTips({ ...tips, [p.id]: e.target.value })} />
            </div>
          ))}
          {newPlaces.map((p, i) => (
            <div className="admin-row" key={`${p.google_place_id}-${i}`}>
              <div className="admin-row-main">
                <b style={{ flex: 1 }}>{p.name_en}</b>
                <span className="badge quiet">New</span>
                <button className="btn btn-secondary sm"
                  onClick={() => setNewPlaces(newPlaces.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </div>
              <p className="place-tip">{p.curator_note}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow">Add a place</p>
        <input className="field" placeholder="Search a place or address"
          value={q} onChange={(e) => {
            setQ(e.target.value); setPicked(null);
            if (e.target.value.trim().length < 2) setHits([]);
          }} />

        {hits.length > 0 && !picked && (
          <div className="admin-list" style={{ padding: 0, gap: 4 }}>
            {hits.map((h) => (
              <button key={h.id} className="admin-row" style={{ textAlign: 'left' }}
                onClick={() => { setPicked(h); setHits([]); }}>
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
              <button className="btn btn-secondary sm" disabled={adding}
                onClick={() => { setPicked(null); setTip(''); }}>
                Cancel
              </button>
              <button className="btn btn-dark sm" disabled={adding} onClick={addPlace}>
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="form-error">{err}</p>

      <div className="row-end">
        <button className="btn btn-dark btn-block" disabled={pending} onClick={save}>
          Save changes
        </button>
      </div>
    </div>
  );
}
