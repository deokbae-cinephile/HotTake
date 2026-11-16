/**
 * @file 리뷰 원고 검사 규칙 (review-schema.ts)
 * 읽는 순서: 3/84번째 · 1단계(블로그의 기본 값과 데이터 모양)
 *   앞: src/lib/categories.ts → 다음: src/lib/review.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰 원고(content/reviews/<파일 이름>.json)에 적힌 값이 올바른지 검사하는 "규칙"을 한곳에 모아 둡니다.
 *
 * 맡은 기능
 *   1. 원고에 쓸 수 있는 항목 이름 목록(REVIEW_KEYS)
 *   2. 원고 파일 이름의 모양 규칙(SLUG)과 이미지 파일 이름의 모양 규칙(IMAGE_FILE)
 *   3. 원고 검사(checkReview): 빠진 항목, 틀린 모양, 모르는 항목을 찾아 "어떻게 고치는지"까지 알려 줘요.
 *   4. 검사를 통과한 원고 값의 타입(ReviewFields)과 평점 확인(isRating), 객체 확인(isRecord)
 *
 * 왜 직접 검사하나요?
 *   TypeScript의 타입은 "코드를 쓰는 동안"에만 검사해요. 프로그램이 실제로 돌 때 파일에서 읽어 온 값은
 *   타입이 지켜 주지 못해서, 이렇게 값을 하나하나 확인하는 함수가 따로 있어야 해요.
 *   검사 라이브러리(zod 등)를 쓰는 방법도 있지만, 항목이 열 개뿐이라 짧은 함수로 직접 짜서 의존성을 줄였어요.
 *
 * 누가 쓰나요?
 *   - lib/review-data.ts: 빌드할 때 원고를 읽으며 검사해요. 실패하면 빌드가 멈춰서 잘못된 원고는 배포되지 않아요.
 *   - lib/review-form.ts: 글쓰기 화면의 입력값을 같은 규칙으로 검사해요(브라우저와 서버 모두).
 *     규칙이 한곳에 있어서 "화면에서 통과한 리뷰는 빌드에서도 통과"해요.
 *   - lib/review-file.ts(원고 ↔ 칸 값 바꾸기), lib/review-store.ts(저장), lib/review.ts(Review 타입),
 *     components/review-writer.tsx(글쓰기 화면)
 */

// 분류 목록(영화·도서)과 "분류 이름이 맞는지" 확인하는 함수를 가져와요.
// `type Category`처럼 앞에 type을 붙이면 "타입만" 가져온다는 뜻이라, 실행 코드에는 남지 않아요.
import { CATEGORIES, type Category, isCategory } from "./categories";

/**
 * 원고에 쓸 수 있는 항목 이름들이에요.
 *
 * `as const`는 "이 배열은 바뀌지 않는 이 글자들 그대로"라고 TypeScript에 알려 주는 표시예요.
 * 덕분에 타입이 그냥 string[]이 아니라 "title" | "year" | ... 처럼 정확한 글자들로 잡혀요.
 * 오타(예: ratting)를 쓰면 이 목록을 보여 주며 "쓸 수 있는 항목"을 알려 줘요.
 */
export const REVIEW_KEYS = [
  "title",
  "year",
  "creator",
  "category",
  "rating",
  "oneLiner",
  "publishedAt",
  "image",
] as const;

/**
 * 검사에 실패했을 때 보여 줄 문구예요(원고를 직접 고치는 사람에게 보여 줘요).
 *
 * 좋은 오류 문구는 "무엇이 틀렸는지"와 "어떻게 고치는지(예시)"를 함께 알려 줘요.
 * 예시는 JSON 모양 그대로("항목": 값) 적어서, 보이는 대로 따라 쓰면 되게 했어요.
 *
 * 문구 안에 큰따옴표(")가 들어가서 바깥은 작은따옴표(')로 감쌌어요.
 * category만 백틱(`)을 써서 `${...}`로 분류 목록을 끼워 넣어요. 분류가 늘어도 문구를 고칠 필요가 없어요.
 * 끝의 `as const`는 이 객체를 바꾸지 않겠다는 표시예요(항목 이름도 정확한 글자 타입으로 잡혀요).
 */
const MESSAGE = {
  title: '"title"(한국어 제목)을 적어 주세요. 예: "title": "겨울 정류장"',
  year: '"year"(연도)는 따옴표 없이 숫자 네 자리로 적습니다. 영화는 개봉한 해, 도서는 펴낸 해예요. 예: "year": 2024',
  creator: '"creator"(감독 또는 작가)를 적어 주세요. 여러 명이면 쉼표로 나눕니다. 예: "creator": "한서윤, 김도윤"',
  category: `"category"(분류)는 ${CATEGORIES.join(", ")} 가운데 하나를 적습니다. 예: "category": "영화"`,
  rating: '"rating"(평점)은 따옴표 없이 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: "rating": 4.5',
  oneLiner: '"oneLiner"(한 줄 평)를 적어 주세요. 예: "oneLiner": "눈이 그친 뒤에야 들리는 이야기"',
  publishedAt:
    '"publishedAt"(글 쓴 날)은 YYYY-MM-DD 모양으로 적고, 시각까지 적으려면 YYYY-MM-DDTHH:mm:ss+09:00 모양으로 적습니다. 예: "publishedAt": "2026-10-05T21:30:00+09:00"',
  image:
    '"image"(이미지)에는 public/images 폴더에 넣은 파일 이름만 적습니다. 영어 소문자·숫자·하이픈과 확장자(jpg, jpeg, png, webp, avif)만 씁니다. 예: "image": "winter-stop.jpg"',
} as const;

/**
 * 원고 파일 이름(slug)이 따라야 하는 모양이에요(정규식). 수정 화면 주소(/write/<파일 이름>)에도 그대로 들어가요.
 *
 * 정규식(정규 표현식)은 "글자의 모양"을 적는 작은 언어예요. 읽는 법: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 *   ^                처음부터
 *   [a-z0-9]+        영어 소문자나 숫자가 한 글자 이상
 *   (?:-[a-z0-9]+)*  "하이픈 + 소문자·숫자 묶음"이 0번 이상 되풀이
 *   $                끝까지
 *   → "winter-stop", "3am-store"는 통과, "Winter Stop", "겨울", "a--b", "-a"는 실패
 *
 * 리뷰 데이터 읽기(lib/review-data.ts)와 글쓰기 화면·저장 API(lib/review-form.ts)가 함께 써요.
 */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 이미지 파일 이름의 모양이에요(정규식).
 *   [a-z0-9]+(?:-[a-z0-9]+)*  : 원고 파일 이름(SLUG)과 같은 규칙의 이름
 *   \.                       : 점(.) 글자 그대로. 정규식에서 그냥 .은 "아무 글자 하나"라서 \를 앞에 붙여요.
 *   \.(?:jpe?g|png|webp|avif) : 점(.) 뒤에 jpg, jpeg, png, webp, avif 가운데 하나 (e?는 "e가 있어도 없어도")
 *
 * 슬래시(/)나 점 두 개(..)를 쓸 수 없어서, public/images 폴더 밖의 파일을 가리킬 수 없어요(안전).
 */
export const IMAGE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp|avif)$/;

/**
 * 검사를 통과한 원고 값이에요.
 * 이름 뒤에 ?가 붙은 항목(선택 항목)은 원고에 적었을 때만 들어 있어요.
 */
export type ReviewFields = {
  /** 한국어 제목 */
  title: string;
  /** 연도(영화는 개봉한 해, 도서는 펴낸 해) */
  year: number;
  /** 감독 또는 작가. 여러 명이면 "한서윤, 김도윤"처럼 쉼표로 이은 글자 하나예요. */
  creator: string;
  /** 분류(영화, 도서). 리뷰 한 편에 하나예요. */
  category: Category;
  /** 평점(0.5~5, 0.5 단위) */
  rating: number;
  /** 한 줄 평 */
  oneLiner: string;
  /** 글 쓴 날(예: "2026-11-14T19:35:48+09:00") */
  publishedAt: string;
  /** 이미지 파일 이름(public/images 안). 예: "winter-stop.jpg" */
  image?: string;
};

/**
 * 검사에서 찾은 문제 하나: 어느 항목인지(key, 예: "year")와 고치는 방법(message). 모르는 항목 문제는 key가 ""예요.
 * 글쓰기 화면은 key를 보고 그 칸 아래에 문구를 달아요(lib/review-form.ts).
 */
export type ReviewIssue = { key: string; message: string };

/**
 * 검사 결과예요. 둘 가운데 하나의 모양이에요(유니언 타입, `A | B`).
 *   - 통과: { ok: true, value: 정리된 값 }
 *   - 실패: { ok: false, issues: 문제 목록(항목 순서대로) }
 * ok를 먼저 확인하면 TypeScript가 나머지 항목(value 또는 issues)이 있는 쪽으로 타입을 좁혀 줘요.
 */
export type ReviewCheck = { ok: true; value: ReviewFields } | { ok: false; issues: ReviewIssue[] };

/**
 * 앞뒤 빈칸을 지운 글자가 한 글자 이상이면 그 글자, 아니면 null을 돌려줘요.
 * `unknown`은 "무엇이 올지 모르는 값"이라는 타입이에요. 쓰기 전에 typeof로 확인해야 해서 안전해요.
 *
 * @param value 원고에서 읽은 값(무엇이든)
 * @returns 앞뒤 빈칸을 지운 글자, 또는 null(글자가 아니거나 빈칸뿐일 때)
 * @example filledText("  겨울  ") // "겨울"
 * @example filledText("   ")     // null
 */
function filledText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * 평점이 0.5부터 5까지 0.5 단위 숫자인지 확인해요(0점은 없어요).
 * 2를 곱해 정수가 되면 0.5 단위예요(4.5 × 2 = 9 → 정수, 4.3 × 2 = 8.6 → 정수 아님).
 *
 * 돌려주는 타입 `value is number`는 "true가 나오면 value는 숫자"라고 TypeScript에 알려 주는 표시예요(타입 가드).
 *
 * @param value 확인할 값
 * @returns 올바른 평점이면 true
 * @example isRating(4.5) // true
 * @example isRating(4.3) // false
 */
export function isRating(value: unknown): value is number {
  return typeof value === "number" && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

/**
 * 글 쓴 날의 모양이에요(정규식).
 *   (\d{4})-(\d{2})-(\d{2})          날짜(괄호로 묶은 부분은 나중에 꺼내 쓸 수 있어요: 년·월·일)
 *   (?:T 시:분(:초)? (Z|±시:분))?    시각과 시간대(없어도 돼요). 시간대가 있어야 어디서 읽어도 같은 순간이에요.
 */
const PUBLISHED_AT = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/;

/**
 * 글 쓴 날이 달력에 정말 있는 날짜면 true예요(2026-02-30처럼 없는 날은 false).
 *
 * 년·월·일로 날짜를 만들어 다시 읽었을 때 같은 날이면 있는 날짜예요.
 * (Date는 2월 30일을 받으면 조용히 3월 2일로 넘겨 버려서, 값이 달라지는지로 알아낼 수 있어요.)
 *
 * @param value 원고의 publishedAt 값
 * @returns 모양이 맞고 달력에 있는 날짜면 true
 */
function isPublishedAt(value: unknown): value is string {
  // exec는 정규식에 맞으면 [전체, 괄호1, 괄호2, ...] 배열을, 맞지 않으면 null을 돌려줘요.
  const match = typeof value === "string" ? PUBLISHED_AT.exec(value) : null;
  if (!match) return false;
  // match[1]~[3]: 정규식에서 괄호로 묶은 년·월·일 글자. Number(...)로 숫자로 바꿔요.
  // `const [a, b, c] = [...]`는 배열 구조 분해예요. 배열의 첫째·둘째·셋째 값을 각각 이름에 담아요.
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date.UTC의 월은 0부터 세요(0 = 1월). 그래서 month - 1을 넣어요.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * 값이 { "항목": 값 } 모양의 객체인지 확인해요. null과 배열도 typeof가 "object"라서 따로 빼요.
 * `Record<string, unknown>`은 "글자 이름 → 아무 값"으로 된 객체 타입이에요(제네릭: <> 안에 타입을 넣어 모양을 정해요).
 *
 * @param value 확인할 값
 * @returns 보통 객체면 true
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 리뷰 원고 값을 검사해요.
 *
 * - 꼭 있어야 하는 항목이 빠졌거나 모양이 틀리면, 문제를 항목 순서대로 모두 모아 돌려줘요(한 번에 고칠 수 있게).
 * - 목록에 없는 항목(오타 등)이 있으면 맨 끝에 "알 수 없는 항목"으로 알려 줘요(조용히 무시하지 않아요).
 *
 * @param input 원고 파일을 JSON.parse로 읽은 값(무엇이든 올 수 있어요)
 * @returns 통과하면 { ok: true, value }, 아니면 { ok: false, issues }
 * @example
 * checkReview({ title: "겨울 정류장" });
 * // → { ok: false, issues: [{ key: "year", message: '"year"(연도)는 ...' }, ...] }
 */
export function checkReview(input: unknown): ReviewCheck {
  // 객체가 아니면(빈 파일, 배열 등) 아무 항목도 없는 것으로 보고, 빠진 항목을 모두 알려 줘요.
  const data = isRecord(input) ? input : {};
  // 찾은 문제를 모아 둘 배열. const여도 배열 "안"에는 넣을 수 있어요(배열 자체를 바꾸지 않으니까요).
  const issues: ReviewIssue[] = [];
  // 문제 하나를 더하는 짧은 함수(화살표 함수). 아래에서 같은 모양을 되풀이하지 않게 묶었어요.
  // `keyof typeof MESSAGE`: MESSAGE 객체의 항목 이름들("title" | "year" | ...)만 받는 타입이에요. 오타를 막아요.
  const fail = (key: keyof typeof MESSAGE) => issues.push({ key, message: MESSAGE[key] });
  // 선택 항목은 원고에 적었을 때(undefined가 아닐 때)만 검사해요. data[key]는 이름을 글자로 받아 값을 꺼내는 방법이에요.
  const has = (key: string) => data[key] !== undefined;

  // ── 필수 항목 ──────────────────────────────────────────────
  // 값이 올바르면 정리된 값, 틀리면 null을 담고, null이면 문제를 기록해요. 아래 항목도 모두 같은 모양이에요.
  const title = filledText(data.title);
  if (title === null) fail("title");

  // 연도: 1000~2100 사이의 정수. 따옴표로 감싼 "2024"는 글자라서 통과하지 못해요.
  const year = typeof data.year === "number" && Number.isInteger(data.year) && data.year >= 1000 && data.year <= 2100 ? data.year : null;
  if (year === null) fail("year");

  const creator = filledText(data.creator);
  if (creator === null) fail("creator");

  // 분류: lib/categories.ts의 목록(영화, 도서) 안의 이름이어야 해요.
  const category = isCategory(data.category) ? data.category : null;
  if (category === null) fail("category");

  const rating = isRating(data.rating) ? data.rating : null;
  if (rating === null) fail("rating");

  const oneLiner = filledText(data.oneLiner);
  if (oneLiner === null) fail("oneLiner");

  const publishedAt = isPublishedAt(data.publishedAt) ? data.publishedAt : null;
  if (publishedAt === null) fail("publishedAt");

  // ── 선택 항목: 적었다면 모양이 맞아야 해요 ─────────────────────
  // `undefined`: 적지 않음 / `null`: 적었는데 틀림 / 글자: 통과
  // 이미지: 파일 이름 모양만 봐요. 파일이 정말 있는지는 원고를 읽는 쪽이 확인해요(lib/review-data.ts).
  // 삼항 연산자가 두 겹이에요: 적지 않았으면 undefined, 적었으면 (모양이 맞으면 그 글자, 틀리면 null).
  const image = has("image") ? (typeof data.image === "string" && IMAGE_FILE.test(data.image) ? data.image : null) : undefined;
  if (image === null) fail("image");

  // ── 모르는 항목 ─────────────────────────────────────────────
  // Object.keys(data): 원고에 적힌 항목 이름 목록. 그 가운데 REVIEW_KEYS에 없는 것만 골라요(filter).
  // (REVIEW_KEYS as readonly string[]): 정확한 글자 타입의 배열을 "글자 배열"로 넓혀 includes에 아무 글자나 넣을 수 있게 해요.
  const unknownKeys = Object.keys(data).filter((key) => !(REVIEW_KEYS as readonly string[]).includes(key));
  if (unknownKeys.length > 0) {
    issues.push({
      key: "",
      message: `알 수 없는 항목입니다: ${unknownKeys.join(", ")}. 이름에 오타가 없는지 확인하세요. 쓸 수 있는 항목: ${REVIEW_KEYS.join(", ")}`,
    });
  }

  // 문제가 하나라도 있으면 실패 결과를 돌려주고 여기서 끝내요. `{ ok: false, issues }`는 `issues: issues`를 줄인 모양이에요.
  if (issues.length > 0) return { ok: false, issues };

  // 여기까지 왔다면 필수 항목은 모두 채워졌어요. `!`는 "null이 아니다"라고 TypeScript에 알려 주는 표시예요.
  // 선택 항목은 값이 있을 때만 넣어요. `...(조건 ? { 항목 } : {})`는 조건이 참일 때만 항목을 펼쳐 넣는 관용 표현이에요.
  // ({ image }는 { image: image }를 줄여 쓴 모양이에요.)
  return {
    ok: true,
    value: {
      title: title!,
      year: year!,
      creator: creator!,
      category: category!,
      rating: rating!,
      oneLiner: oneLiner!,
      publishedAt: publishedAt!,
      ...(image ? { image } : {}),
    },
  };
}
