/**
 * 후기 등록 시 명백한 욕설·비방만 거른다 (PRD v1.4 §3). 문맥 기반
 * 판단은 스코프 밖이라 완전하지 않다는 걸 전제로 한다 — 여기를
 * 통과해도 문제가 있으면 어드민이 개별 삭제한다(그게 진짜 안전망).
 *
 * 클라이언트에서만 검사한다. map_reviews 는 서버 액션을 거치지 않고
 * RLS 로 직접 쓰는 구조라(ReviewForm.tsx) DB 단 강제까지는 하지 않았다
 * — 이 정도 규모에서 우회 위험보다 유지보수 이중화 비용이 더 크다.
 */
const BLOCKLIST = [
  '씨발', '씨팔', 'ㅅㅂ', 'ㅆㅂ', '개새끼', '개색기', '병신', 'ㅂㅅ', '지랄',
  '좆', '미친놈', '미친년', '창녀', '걸레같', '샹년', '개년', '느금마', '닥쳐',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'bastard',
];

export function containsProfanity(text: string): boolean {
  const t = text.toLowerCase();
  return BLOCKLIST.some((w) => t.includes(w.toLowerCase()));
}
