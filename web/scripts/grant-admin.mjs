/**
 * 어드민 지정 — node --env-file=.env.local scripts/grant-admin.mjs you@example.com
 *
 * 어드민은 화면에서 만들 수 없다 (§3.1). 첫 어드민을 화면으로 만들 수
 * 있으면 아무나 어드민이 될 수 있기 때문이고, 두 번째부터는 기존
 * 어드민이 /admin 에서 지정한다.
 *
 * 이 스크립트는 service_role 을 쓰므로 앱 런타임에 절대 포함되지 않는다.
 */
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('사용법: node --env-file=.env.local scripts/grant-admin.mjs <email>');
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: list, error: e1 } = await db.auth.admin.listUsers({ perPage: 1000 });
if (e1) { console.error(e1.message); process.exit(1); }

const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`계정을 찾을 수 없다: ${email}`);
  console.error('먼저 앱에서 한 번 로그인해 계정을 만들 것.');
  process.exit(1);
}

const provider = user.app_metadata?.provider ?? 'email';

const { error: e2 } = await db.from('users').update({
  role: 'admin',
  auth_provider: provider,
  // 어드민도 curator_profiles 뷰의 대상이라 handle 이 없으면 소개
  // 페이지가 뜨지 않는다. 필요하면 /admin 에서 채운다.
}).eq('id', user.id);

if (e2) { console.error(e2.message); process.exit(1); }

console.log(`${email} → admin (provider: ${provider})`);
if (provider !== 'google') {
  console.log('⚠ 이 계정은 구글 로그인이 아니다. §3.1 은 어드민을 구글 전용으로');
  console.log('  두라고 정했다 — 같은 이메일로 계정이 갈리면 어드민 접근이');
  console.log('  예전 계정에 남는다. 운영 전에 구글 계정으로 옮길 것.');
}
