/**
 * @file 분류 목록 (categories.ts)
 * 읽는 순서: 2/84번째 · 1단계(블로그의 기본 값과 데이터 모양)
 *   앞: src/lib/site.ts → 다음: src/lib/review-schema.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰에 붙일 수 있는 분류(작품의 종류: 영화, 도서)를 정해 둡니다.
 *   리뷰 한 편에는 분류가 하나예요(한 작품은 영화이거나 도서니까요).
 *
 * 맡은 기능
 *   1. 원고 검사: 원고에 목록에 없는 분류(오타 포함)를 쓰면 빌드할 때 알려 줍니다(lib/review-schema.ts).
 *   2. 분류 필터: 처음 화면의 분류 버튼이 이 순서대로 놓입니다(lib/browse.ts).
 *      글쓰기 화면의 분류 고르기 칸도 이 순서예요(components/review-writer.tsx).
 *   3. 주소: 주소에는 분류를 영어 이름으로 적어요(?category=movie, CATEGORY_SLUGS). 없는 분류가 들어오면 무시합니다(categoryFromParam).
 *      한글 분류(?category=영화)가 와도 같은 분류로 받아요.
 *
 * 왜 분류를 미리 정해 둘까요?
 *   글쓴이가 어떤 글에는 "도서", 다른 글에는 "책"이라고 쓰면 분류 필터가 둘로 갈라지죠.
 *   쓸 수 있는 이름을 정해 두면 이런 실수를 빌드 단계에서 잡을 수 있어요.
 *
 * 새 분류가 필요하면?
 *   아래 배열에 이름을 더하고, CATEGORY_SLUGS에 영어 이름도 적어요(빠지면 타입 오류가 나요).
 *   글쓰기 화면(components/review-writer.tsx)의 분류 칸과 처음 화면의 분류 필터에도 저절로 나타나요.
 *
 * 누가 쓰나요?
 *   lib/review-schema.ts(원고 검사), lib/review-file.ts(원고 → 칸 값), lib/review-values.ts(칸 값 타입),
 *   lib/browse.ts(분류 필터·주소), components/review-writer.tsx(분류 고르기 칸)
 */

/**
 * 쓸 수 있는 분류 이름들. 분류 필터와 글쓰기 화면에도 이 순서대로 보입니다.
 *
 * `as const`를 붙이면 TypeScript가 이 배열을 "string 여러 개"가 아니라
 * "정확히 이 글자들만 들어 있는, 바뀌지 않는 목록"으로 기억해요.
 * 바로 아래의 Category 타입을 만들 수 있는 것도 이 덕분입니다.
 */
export const CATEGORIES = ["영화", "도서"] as const;

/**
 * 분류 하나를 나타내는 타입이에요.
 *
 * 읽는 법: `(typeof CATEGORIES)[number]`
 *   - `typeof CATEGORIES`는 "CATEGORIES 배열의 타입"
 *   - `[number]`는 "그 배열의 아무 칸에 들어 있는 값의 타입"
 *   → 결과는 "영화" | "도서"처럼 목록 안의 글자 중 하나만 허락하는 타입이 됩니다.
 */
export type Category = (typeof CATEGORIES)[number];

/**
 * 어떤 글자가 분류 목록에 있는지 확인합니다.
 *
 * 반환 타입의 `value is Category`는 "타입 가드"라고 불러요.
 * `if (isCategory(text)) { ... }` 안쪽에서는 TypeScript가 text를 그냥 string이 아니라 Category로 대해 줍니다.
 *
 * @param value 확인할 값 (예: 원고의 category 값)
 * @returns 목록에 있으면 true
 * @example
 * isCategory("영화"); // true
 * isCategory("책");   // false
 */
export function isCategory(value: unknown): value is Category {
  // CATEGORIES는 "정해진 글자만 든 배열" 타입이라 includes에 아무 값이나 넣으면 타입 오류가 나요.
  // 그래서 잠깐 "아무 값의 배열"로 바꿔(as readonly unknown[]) 비교합니다.
  return (CATEGORIES as readonly unknown[]).includes(value);
}

/**
 * 분류마다 주소(?category=)에 쓰는 영어 이름이에요.
 * 한글을 주소에 그대로 쓰면 주소창·복사한 링크에서 %EC%98%81%ED%99%94처럼 길게 바뀌어 보여서, 짧은 영어 이름으로 적어요.
 * `satisfies Record<Category, string>`: 분류를 더하면 여기에도 영어 이름을 꼭 적게(빠지면 타입 오류) 해요.
 *   - `Record<Category, string>`은 "모든 분류 이름을 항목으로 갖고, 값은 글자"인 객체 타입이에요.
 *   - satisfies는 맞는지 확인만 하고, 값의 타입("movie" 같은 정확한 글자)은 그대로 둬요.
 * 객체의 항목 이름에는 한글(영화)도 따옴표 없이 쓸 수 있어요.
 */
export const CATEGORY_SLUGS = {
  영화: "movie",
  도서: "book",
} as const satisfies Record<Category, string>;

/**
 * 분류를 주소에 쓸 영어 이름으로 바꿔요.
 * `CATEGORY_SLUGS[category]`: 대괄호에 변수를 넣어 그 이름의 항목 값을 꺼내요.
 *
 * @param category 분류 이름
 * @returns 영어 이름
 * @example categorySlug("영화"); // "movie"
 */
export function categorySlug(category: Category): string {
  return CATEGORY_SLUGS[category];
}

/**
 * 주소의 ?category= 값을 분류로 바꿔요. 영어 이름(movie, 대소문자는 가리지 않아요)을 받고,
 * 한글 분류 이름(영화)이 와도 받아요. 목록에 없으면 null이에요.
 *
 * @param value 주소에서 읽은 값. 주소에 ?category=가 없으면 null이 와요(URLSearchParams.get이 null을 돌려줘서요).
 * @returns 분류 이름, 또는 null
 * @example
 * categoryFromParam("movie"); // "영화"
 * categoryFromParam("영화");  // "영화"
 * categoryFromParam("music"); // null
 */
export function categoryFromParam(value: string | null): Category | null {
  // null이나 빈 글자는 바로 "없음"이에요.
  if (!value) return null;
  // 대문자로 와도(MOVIE) 맞게 소문자로 바꿔 비교해요.
  const slug = value.toLowerCase();
  // find: 조건에 맞는 첫 항목을 돌려줘요. 없으면 undefined예요.
  const found = CATEGORIES.find((category) => CATEGORY_SLUGS[category] === slug);
  if (found) return found;
  // 영어 이름이 아니면 한글 분류 이름인지 확인해요.
  return isCategory(value) ? value : null;
}
