/**
 * @file 화면에 보일 글자 모양 맞추기 (format.ts)
 * 읽는 순서: 5/84번째 · 1단계(블로그의 기본 값과 데이터 모양)
 *   앞: src/lib/review.ts → 다음: src/lib/review-data.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   데이터(평점 숫자, 정보 줄 항목)를 화면에 보이기 좋은 글자로 바꾸는 작은 함수를 모아 둡니다.
 *
 * 왜 따로 둘까요?
 *   글자 모양을 정하는 규칙을 화면 코드와 떼어 두면, 모양을 바꾸고 싶을 때 이 파일만 고치면 됩니다.
 *   화면 없이 함수만으로 테스트하기도 쉬워요(lib/format.test.ts).
 *
 * 누가 쓰나요?
 *   components/rating.tsx(평점 글자: formatRating), components/review-list-item.tsx(목록 둘째 줄: joinFacts)
 */

/**
 * 평점을 소수 한 자리로 보입니다. 평점이 0.5 단위라 한 자리면 충분해요.
 *
 * @param value 평점 숫자 (0.5 ~ 5)
 * @returns 소수 한 자리 글자
 * @example
 * formatRating(4);   // "4.0"
 * formatRating(4.5); // "4.5"
 */
export function formatRating(value: number): string {
  // toFixed(1)은 숫자를 "소수 첫째 자리까지 쓴 글자"로 바꿉니다. 4 → "4.0"
  return value.toFixed(1);
}

/**
 * 줄바꿈되지 않는 빈칸(NBSP, non-breaking space). 이 빈칸 앞뒤 글자는 늘 같은 줄에 있어요.
 * "\u00a0"은 글자 번호(유니코드 00A0)로 적은 글자예요. 눈에는 보통 빈칸과 똑같이 보여서 이렇게 적어요.
 */
export const NBSP = "\u00a0";

/**
 * 정보 줄 항목 사이의 구분자 " · ".
 * 가운뎃점 앞 빈칸을 NBSP로 붙여서, 줄이 넘칠 때 "·"는 앞 항목 끝에 남고 다음 줄은 항목으로 시작해요.
 * (보통 빈칸이면 휴대폰에서 "· 2024"처럼 가운뎃점으로 시작하는 줄이 생겨요.)
 */
export const FACT_SEPARATOR = `${NBSP}· `;

/**
 * 정보 줄 항목들을 " · "(FACT_SEPARATOR)로 이어요. 없는 항목(undefined·null·빈 글자)은 빼요.
 * `ReadonlyArray<A | B>`: A나 B를 담은, 바꾸지 않을 배열이라는 타입이에요(읽기 전용 배열).
 *
 * @param parts 이을 항목들(글자, 숫자, 또는 없음)
 * @returns 항목을 이은 한 줄 글자. 항목이 하나도 없으면 ""
 * @example
 * joinFacts([2024, undefined, "한서윤"]); // "2024 · 한서윤"
 */
export function joinFacts(parts: ReadonlyArray<string | number | null | undefined>): string {
  // filter: undefined·null·빈 글자는 빼요(연도는 0이 될 일이 없어요).
  // join(구분자): 남은 항목을 구분자로 이어 한 글자로 만들어요. 숫자(2024)는 이을 때 저절로 글자가 돼요.
  return parts.filter((part) => part !== undefined && part !== null && part !== "").join(FACT_SEPARATOR);
}
