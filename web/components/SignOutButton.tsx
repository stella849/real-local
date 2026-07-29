'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function out() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button className="btn btn-secondary btn-block" onClick={out}>Sign out</button>
  );
}
