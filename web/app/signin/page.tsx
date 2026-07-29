import Link from 'next/link';
import { SignInForm } from '@/components/SignInForm';
import { IconBack } from '@/components/Icons';

type Params = { searchParams: Promise<{ next?: string; error?: string }> };

/**
 * 로그인 · 가입 (F1).
 *
 * next 를 서버에서 searchParams 로 받아 폼에 내려준다. 클라이언트에서
 * useSearchParams() 로 읽으면 그 서브트리가 정적 셸에서 통째로 빠져
 * (BAILOUT_TO_CLIENT_SIDE_RENDERING) 로그인 화면이 빈 채로 왔다가
 * JS 가 붙어야 그려진다.
 *
 * 일반 회원은 이메일과 구글 둘 다 쓸 수 있다. 큐레이터·어드민은 구글
 * 전용이지만(§3.1) 그 강제는 여기가 아니라 어드민 화면에서 한다 —
 * 여기서 막으면 아직 큐레이터가 아닌 사람의 정상 가입까지 막힌다.
 */
export default async function SignIn({ searchParams }: Params) {
  const sp = await searchParams;

  // 열린 리디렉션 방지 — 내부 경로만 허용한다
  const raw = sp.next ?? '/';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  return (
    <>
      <header className="topbar">
        <Link className="iconbtn" href="/" aria-label="Back"><IconBack /></Link>
        <span className="topbar-title">Sign in</span>
      </header>

      <SignInForm next={next} hadError={Boolean(sp.error)} />
    </>
  );
}
