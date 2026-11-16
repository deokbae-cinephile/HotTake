/**
 * @file 리뷰 데이터의 모양과 정렬 규칙 (review.ts)
 * 읽는 순서: 4/84번째 · 1단계(블로그의 기본 값과 데이터 모양)
 *   앞: src/lib/review-schema.ts → 다음: src/lib/format.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   1. 리뷰 한 편이 어떤 정보를 갖는지 "타입"으로 정합니다(Review).
 *   2. 리뷰를 어떤 순서로 늘어놓을지 정렬 규칙을 정합니다(compareLatest, compareRating).
 *   3. 글 쓴 날 글자를 견줄 수 있는 숫자로 바꿔요(publishedTime).
 *   4. 이미지 파일 이름을 화면에서 쓰는 주소로 바꿔요(imageSrc).
 *
 * 타입이 왜 필요할까요?
 *   리뷰 데이터는 원고 읽기(lib/review-data.ts) → 목록 화면 → 검색·정렬로 여기저기 전달돼요.
 *   모양을 타입으로 정해 두면, 예를 들어 `review.raiting`처럼 이름을 잘못 쓴 순간 편집기가 바로 알려 줍니다.
 *
 * 타입(type)이란?
 *   "이 값은 이런 항목을 이런 모양으로 가진다"는 약속이에요. TypeScript가 코드를 쓰는 동안 검사하고,
 *   실제로 실행되는 JavaScript에서는 지워져요(브라우저로 가는 코드 크기에 영향이 없어요).
 *
 * 누가 쓰나요?
 *   - lib/review-data.ts(원고 읽기), lib/browse.ts(검색·정렬)
 *   - components/review-browser.tsx(목록 화면), components/review-list-item.tsx(목록 한 줄)
 *   - src/test/review-mocks.ts(테스트용 가짜 리뷰)
 */

// `import type`은 "타입만 가져온다"는 뜻이에요. 실행할 때는 사라지므로 화면 코드 크기에 영향이 없습니다.
import type { ReviewFields } from "./review-schema";

/**
 * 리뷰 한 편이에요. 원고에 적힌 값(ReviewFields)에 파일 이름(slug)을 더한 모양이에요.
 *
 * `A & { ... }`는 "A의 모든 항목에 { } 안의 항목을 더한 타입"이라는 뜻이에요(교차 타입).
 * 파일 이름은 원고 "안"이 아니라 원고 "파일 이름"에 있어서(winter-stop.json → winter-stop) 따로 더해요.
 * (slug는 "주소나 파일 이름에 쓰는 짧은 영어 이름"을 부르는 개발 용어예요.)
 * 항목 하나하나의 뜻은 lib/review-schema.ts의 ReviewFields에 적어 두었어요.
 */
export type Review = ReviewFields & {
  /** 원고 파일 이름(확장자 제외). 예: winter-stop.json → "winter-stop". 수정 화면 주소(/write/winter-stop)에도 써요. */
  slug: string;
};

/**
 * public/images 폴더의 그림은 사이트 주소 /images/ 아래에서 보여요.
 * Next.js는 public 폴더 안의 파일을 사이트 맨 위(/)에 그대로 놓아 줘서,
 * public/images/winter-stop.jpg는 /images/winter-stop.jpg로 열려요.
 */
export const IMAGE_DIR = "/images/";

/**
 * 원고의 이미지 파일 이름을 화면에서 쓰는 주소로 바꿔요. 이미지가 없으면 undefined예요.
 *
 * `string | undefined`는 "글자이거나, 값이 없음(undefined)"이라는 뜻이에요(유니언 타입).
 * 이미지는 선택 항목이라 원고에 없을 수 있어서 이렇게 적어요.
 *
 * @param file 원고의 image 값(예: "winter-stop.jpg"). 없으면 undefined
 * @returns 화면에서 쓰는 주소(예: "/images/winter-stop.jpg"). 이미지가 없으면 undefined
 * @example imageSrc("winter-stop.jpg") // "/images/winter-stop.jpg"
 */
export function imageSrc(file: string | undefined): string | undefined {
  // `조건 ? A : B`(삼항 연산자): 조건이 참이면 A, 거짓이면 B예요. 빈 글자("")와 undefined는 거짓으로 쳐요.
  // `${...}`(템플릿 리터럴): 백틱(`) 글자 안에 값을 끼워 넣어요. "/images/" + file과 같아요.
  return file ? `${IMAGE_DIR}${file}` : undefined;
}

/** 정렬에 필요한 항목만 골라 둔 타입. `Pick<T, "a" | "b">`는 T에서 a, b만 뽑아 만든 타입이에요. */
type Sortable = Pick<Review, "publishedAt" | "title" | "rating">;

/**
 * 글 쓴 날 글자를 견줄 수 있는 시각(1970년 1월 1일부터 지난 밀리초, ms)으로 바꿔요.
 * 원고에는 날짜만 적을 수도 있어요(lib/review-schema.ts). 날짜만 있으면 그날 한국 시간 0시로 봐요.
 * 그래서 같은 날 시각까지 적힌 글보다 뒤(더 오래된 쪽)로 가요.
 *
 * @param publishedAt 원고의 글 쓴 날. 예: "2026-11-14" 또는 "2026-11-14T19:35:48+09:00"
 * @returns 밀리초 숫자. 클수록 최근이에요.
 * @example publishedTime("2026-11-14T19:35:48+09:00") > publishedTime("2026-11-14T17:12:40+09:00"); // true
 */
export function publishedTime(publishedAt: string): number {
  // "2026-11-14"처럼 10글자면 날짜만 있는 값이에요. 뒤에 "T00:00:00+09:00"(한국 시간 0시)을 붙여 순간을 정해요.
  // 시간대(+09:00)를 붙이지 않으면 읽는 컴퓨터의 시간대에 따라 다른 순간이 돼요.
  // Date.parse는 날짜 글자를 밀리초 숫자로 바꿔 주는 JavaScript 기본 함수예요.
  return Date.parse(publishedAt.length === 10 ? `${publishedAt}T00:00:00+09:00` : publishedAt);
}

/**
 * "최신순" 정렬 규칙: 최근에 쓴 글이 앞에 옵니다. 같은 날 쓴 글은 시각으로 가르고(글쓰기 화면은 시각까지 적어요),
 * 시각까지 같으면(날짜만 적힌 원고끼리) 제목 가나다순이에요.
 *
 * 정렬 규칙 함수(비교 함수)를 읽는 법
 *   배열의 `.sort(규칙)`은 두 항목 a, b를 규칙에 넣어 보고, 돌아온 숫자로 순서를 정해요.
 *   - 음수가 나오면 a를 앞에
 *   - 양수가 나오면 b를 앞에
 *   - 0이면 순서를 그대로 둡니다
 *
 * @param a 견줄 리뷰 하나
 * @param b 견줄 다른 리뷰
 * @returns 음수면 a가 앞, 양수면 b가 앞, 0이면 그대로
 * @example
 * reviews.sort(compareLatest); // 2026-11-14 19:35 글 → 2026-11-14 17:12 글 → 2026-10-30 글 → ...
 */
export function compareLatest(a: Sortable, b: Sortable): number {
  // 1) 쓴 시각을 숫자(ms)로 바꿔 b − a: 큰 값, 즉 최근에 쓴 글이 앞에 옵니다(내림차순).
  //    (글자로 견주면 "2026-11-14"와 "2026-11-14T…"처럼 모양이 다른 값을 바르게 가르지 못해요.)
  // 2) `||`는 왼쪽이 0(=같음)일 때만 오른쪽을 계산해요. 시각까지 같을 때만 제목으로 한 번 더 비교하는 거죠.
  //    "ko"는 한국어 규칙(가나다순)으로 비교하라는 뜻입니다.
  return publishedTime(b.publishedAt) - publishedTime(a.publishedAt) || a.title.localeCompare(b.title, "ko");
}

/**
 * "평점순" 정렬 규칙: 평점이 높은 글이 앞에 와요. 평점이 같으면 최신순으로 정합니다.
 *
 * @param a 견줄 리뷰 하나
 * @param b 견줄 다른 리뷰
 * @returns 음수면 a가 앞, 양수면 b가 앞, 0이면 그대로
 * @example
 * reviews.sort(compareRating); // 5점 → 4.5점(최근 글) → 4.5점(오래된 글) → 4점 → ...
 */
export function compareRating(a: Sortable, b: Sortable): number {
  // b.rating - a.rating: b가 더 크면 양수 → b가 앞으로. 즉 평점이 높은 쪽이 앞에 옵니다.
  // 평점이 같으면(0) `||` 오른쪽의 최신순 규칙으로 넘어가요.
  return b.rating - a.rating || compareLatest(a, b);
}
