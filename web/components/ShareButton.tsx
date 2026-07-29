'use client';

import { useState } from 'react';
import { IconShare } from './Icons';

/**
 * 네이티브 공유 시트. 미지원 환경에서는 클립보드로 떨어진다.
 * 링크를 받은 사람이 비로그인이어도 맵·장소를 그대로 볼 수 있어야 하므로
 * (공개 RLS) 공유는 인증과 무관하다.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [toast, setToast] = useState<string | null>(null);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Link copied.');
    } catch {
      // 사용자가 공유 시트를 닫은 경우도 여기로 온다. 조용히 넘어간다.
      return;
    } finally {
      window.setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <>
      <button className="iconbtn" onClick={share} aria-label="Share"><IconShare /></button>
      {toast && <div className="toast is-on" role="status">{toast}</div>}
    </>
  );
}
