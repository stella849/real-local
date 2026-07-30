'use client';

import { useEffect, useState } from 'react';
import { IconUp } from './Icons';

/**
 * 긴 페이지 맨 위로 버튼 (PRD v1.4 §6). 일정 스크롤 이후에만 뜬다 —
 * 짧은 페이지에서는 아예 안 보인다. 전역(layout)에 하나만 둔다.
 */
export function ScrollTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button className="scroll-top" aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <IconUp />
    </button>
  );
}
