/**
 * 한글 → 로마자 (표준 로마자 표기법, 음절 단위 간이 변환).
 *
 * 큐레이터가 장소를 검색했을 때 구글이 영문 표기를 못 찾으면
 * displayName 자체가 한글로 온다 — languageCode=en 을 걸어도 그
 * 장소에 영문 로컬라이즈가 없으면 그냥 원래 이름이 나온다. 그 결과가
 * 그대로 name_en 에 들어가면 §5 S2 의 "목록에는 한글 상호를 안 보여준다"
 * 규칙이 깨진다(한글이 name_en 자리를 차지하므로).
 *
 * 음절 간 연음 규칙(ㄹㄹ→ll 등)은 반영하지 않는다 — 원본 CSV의 영문
 * 상호도 기계 변환 그대로였고(§11.6 인계문서), 사람이 읽을 수 있는
 * 수준이면 충분하다는 게 이미 이 프로젝트의 기준이다.
 */
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

const romanizeSyllable = (code: number) => {
  const offset = code - HANGUL_BASE;
  const cho = Math.floor(offset / (21 * 28));
  const jung = Math.floor((offset % (21 * 28)) / 28);
  const jong = offset % 28;
  return CHO[cho] + JUNG[jung] + JONG[jong];
};

export const hasHangul = (s: string) => /[가-힣]/.test(s);

export function romanize(text: string): string {
  const converted = Array.from(text).map((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code >= HANGUL_BASE && code <= HANGUL_LAST ? romanizeSyllable(code) : ch;
  }).join('');

  // 업소명다운 Title Case — 단어 첫 글자만 올린다
  return converted.replace(/\b\w/g, (c) => c.toUpperCase());
}
