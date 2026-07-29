import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm } from '@/components/ReviewForm';
import { IconBack, IconHome, IconStar } from '@/components/Icons';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** 열람은 로그인이 필요 없다 — 공유 링크로 들어온 방문자도 그대로 본다. */
export default async function Reviews({ params }: Params) {
  const { slug } = await params;
  const db = await createClient();

  const { data: m } = await db.from('map_cards')
    .select('id,slug,title,avg_rating,review_count').eq('slug', slug).maybeSingle();
  if (!m) notFound();

  const { data: reviews } = await db.from('map_reviews')
    .select('id,author_name,rating,body,created_at,user_id')
    .eq('map_id', m.id).order('created_at', { ascending: false });

  const { data: { user } } = await db.auth.getUser();
  const mine = user ? (reviews ?? []).find((r) => r.user_id === user.id) ?? null : null;

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href={`/maps/${slug}`} aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">Reviews</span>
        <span className="topbar-spacer" />
        <Link className="iconbtn" href="/" aria-label="Home"><IconHome /></Link>
      </header>

      <main className="view">
        <section className="detail-head">
          <h1 className="detail-title">{m.title}</h1>
          <p className="card-meta">
            {m.review_count > 0
              ? (
                <span className="meta-count">
                  <IconStar /> {m.avg_rating} · {m.review_count} reviews
                </span>
              )
              : <span>No reviews yet</span>}
          </p>
        </section>

        {user ? (
          <ReviewForm mapId={m.id} mine={mine ? { rating: mine.rating, body: mine.body } : null} />
        ) : (
          <div className="notice">
            <b>Sign in to leave a review.</b>{' '}
            <Link href={`/signin?next=${encodeURIComponent(`/maps/${slug}/reviews`)}`}>Sign in</Link>
          </div>
        )}

        {(reviews?.length ?? 0) === 0 ? (
          <div className="empty">
            <h3>No reviews yet</h3>
            <p>Be the first to say how this map went.</p>
          </div>
        ) : (
          <ul className="reviews">
            {(reviews ?? []).map((r) => (
              <li className="review" key={r.id}>
                <p className="review-head">
                  <b>{r.author_name}</b>
                  <span className="meta-count"><IconStar /> {r.rating}</span>
                  <span>{when(r.created_at)}</span>
                </p>
                <p>{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
