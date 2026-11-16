/**
 * @file 글쓰기 칸 검사 (review-form.ts)
 * 읽는 순서: 42/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/review-values.ts → 다음: src/lib/upload-rules.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 칸 값(제목, 연도, 분류, 평점 ...)이 올바른지 검사하고,
 *   틀린 칸마다 "무엇이 틀렸고 어떻게 고치는지" 알려 주는 문구를 돌려줘요.
 *
 * 화면과 서버가 같은 검사를 해요
 *   - 화면(components/review-writer.tsx): [리뷰 저장]을 누르면 서버에 보내기 전에 먼저 검사해요. 틀린 칸을 바로 알려 줘요.
 *   - 서버(lib/review-store.ts): 화면을 거치지 않고 API를 바로 부르는 요청도 있을 수 있어서, 저장하기 전에 한 번 더 검사해요.
 *   검사 규칙의 바탕은 빌드할 때 원고를 검사하는 규칙(lib/review-schema.ts의 checkReview)과 같아요.
 *   그래서 글쓰기 화면에서 통과한 리뷰는 빌드에서도 통과하고, 잘못된 리뷰 때문에 배포가 멈추는 일이 없어요.
 *
 * 원고 검사 문구와 다른 점
 *   원고 검사 문구는 파일을 직접 고치는 사람용이라 '"title": "겨울 정류장"'처럼 JSON 예시를 보여 줘요.
 *   여기서는 칸에 입력하는 사람용으로 "제목을 입력하세요"처럼 칸 이름으로 말해요.
 *
 * 누가 쓰나요?
 *   - components/review-writer.tsx(글쓰기 화면): validateReviewForm, FieldErrors
 *   - lib/review-store.ts(저장): validateReviewForm, FieldErrors
 *   - lib/admin-api.ts(저장 API 부르기): FieldErrors(서버가 돌려준 칸별 문구의 모양)
 */

import type { ReviewFormValues } from "./review-values";
import { checkReview, type ReviewFields, SLUG } from "./review-schema";

/**
 * 칸 이름 → 그 칸의 오류 문구. 오류가 없는 칸은 들어 있지 않아요.
 *   - `keyof ReviewFormValues`: 칸 이름들("slug" | "title" | ...)
 *   - `Record<이름, 값>`: 그 이름들을 항목으로 갖는 객체 타입
 *   - `Partial<T>`: T의 모든 항목을 "없어도 됨(?)"으로 바꾼 타입. 틀린 칸만 들어 있으니까요.
 * @example { year: "연도는 1000부터 ...", rating: "평점을 고르세요. ..." }
 */
export type FieldErrors = Partial<Record<keyof ReviewFormValues, string>>;

/**
 * 칸마다 보여 줄 오류 문구. 원인과 고치는 방법(예시)을 함께 적어요.
 * 타입이 `Record<keyof ReviewFormValues, string>`이라, 칸이 하나 늘면 여기에 문구를 빠뜨렸을 때 TypeScript가 알려 줘요.
 * image·publishedAt은 글쓰기 화면에서 직접 적는 칸이 아니라서, 고치는 곳(이미지 다시 고르기, 원고 파일)을 알려 줘요.
 */
export const FIELD_MESSAGES: Record<keyof ReviewFormValues, string> = {
  slug: "파일 이름은 영어 소문자, 숫자, 하이픈(-)으로만 적어 주세요. 예: winter-stop",
  title: "제목을 입력하세요. 예: 겨울 정류장",
  year: "연도는 1000부터 2100 사이의 숫자 네 자리로 입력하세요. 영화는 개봉한 해, 도서는 펴낸 해입니다. 예: 2024",
  creator: "감독 또는 작가를 입력하세요. 여러 명이면 쉼표로 나눕니다. 예: 한서윤, 김도윤",
  category: "분류(영화 또는 도서)를 고르세요.",
  rating: "평점을 고르세요. 0.5점부터 5점까지 0.5점 단위입니다.",
  oneLiner: "한 줄 평을 입력하세요. 예: 버스는 오지 않아도, 기다림은 끝내 도착한다.",
  image: "이미지 파일 이름이 올바르지 않습니다. 이미지를 다시 골라 주세요.",
  publishedAt:
    "글 쓴 날이 날짜 모양(YYYY-MM-DD, 시각까지면 YYYY-MM-DDTHH:mm:ss+09:00)이 아닙니다. 저장소의 원고 파일에서 publishedAt을 고친 뒤 다시 열어 주세요.",
};

/**
 * 검사 결과예요.
 *   - 통과: { ok: true, fields: 원고에 넣을 값 }
 *   - 실패: { ok: false, errors: 칸별 오류 문구 }
 * ok를 먼저 확인하면 TypeScript가 fields 또는 errors가 있는 쪽으로 타입을 좁혀 줘요(유니언 타입).
 */
export type FormCheck = { ok: true; fields: ReviewFields } | { ok: false; errors: FieldErrors };

/**
 * 지금 시각을 한국 시간 기준 "YYYY-MM-DDTHH:mm:ss+09:00"으로 돌려줘요. 새 리뷰의 "글 쓴 날"에 넣어요.
 * 날짜뿐 아니라 시각까지 적어야, 같은 날 쓴 리뷰끼리도 "최신순"에서 나중에 쓴 글이 앞에 와요(lib/review.ts의 compareLatest).
 *
 * 서버는 다른 나라 시간대에 있을 수 있어서(timeZone 지정 없이 쓰면 한국의 새벽이 전날이 될 수 있어요),
 * 시간대를 "Asia/Seoul"로 정해 계산해요. "sv-SE"(스웨덴) 모양이 마침 "2026-11-14 19:35:48"이라서 빌려 쓰고,
 * 가운데 빈칸을 T로 바꾼 뒤 한국 시간대(+09:00)를 붙여 국제 표준(ISO 8601) 모양으로 만들어요.
 *
 * @param now 기준 시각. 테스트에서 시각을 정해 넣으려고 받아요. 기본은 지금(`now = new Date()`: 넘기지 않으면 지금 시각)
 * @returns 한국 시간 날짜·시각 글자. 예: "2026-11-14T19:35:48+09:00"
 * @example nowInSeoul(new Date(Date.UTC(2026, 10, 14, 10, 35, 48))); // "2026-11-14T19:35:48+09:00"
 */
export function nowInSeoul(now = new Date()): string {
  // Intl.DateTimeFormat: 날짜를 나라·시간대에 맞는 글자로 바꿔 주는 JavaScript 기본 도구예요.
  // "2-digit": 두 자리로 맞춰요(3월 → "03"). "numeric": 숫자 그대로(2026).
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // h23: 자정을 24시가 아니라 00시로 적어요.
    hourCycle: "h23",
  }).format(now);
  // "2026-11-14 19:35:48" → "2026-11-14T19:35:48+09:00"
  return `${text.replace(" ", "T")}+09:00`;
}

/**
 * 입력란의 숫자 글자를 숫자로 바꿔요. 숫자 모양이 아니면 글자 그대로 두어, 검사가 "숫자가 아니에요"라고 알려 주게 해요.
 *
 * @param text 칸에 적힌 글자. 예: "2024", "4.5", "이천이십사"
 * @returns 숫자 모양이면 숫자(2024, 4.5), 아니면 앞뒤 빈칸을 지운 글자
 */
function toNumber(text: string): number | string {
  const trimmed = text.trim();
  // 정규식 /^\d+(?:\.\d+)?$/: 숫자 한 개 이상(\d+), 그 뒤에 "점 + 숫자"가 있어도 없어도(?) 돼요. 예: "2024", "4.5"
  // Number("")는 0이 되어 버려서, 이렇게 모양을 먼저 확인한 뒤에만 숫자로 바꿔요.
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * 칸 값을 원고 모양({ title, year, ... })으로 바꿔요(아직 검사 전). 비워 둔 선택 칸은 아예 넣지 않아요.
 * `Record<string, unknown>`은 "글자 이름 → 아무 값"인 객체 타입이에요. 검사 전이라 값의 모양을 아직 믿지 않아요.
 *
 * @param values 글쓰기 칸 값
 * @param publishedAt 원고에 넣을 글 쓴 날(비어 있었다면 부르는 쪽이 지금 시각을 넣어 줘요)
 * @returns checkReview에 넘길 원고 모양의 값
 */
function toReviewInput(values: ReviewFormValues, publishedAt: string): Record<string, unknown> {
  const input: Record<string, unknown> = {
    title: values.title,
    year: toNumber(values.year),
    creator: values.creator,
    // 분류를 고르지 않았으면("") 목록에 없는 값이라 검사가 분류 문구를 보여 줘요.
    category: values.category,
    // 평점을 고르지 않았으면("") 숫자가 아니라서 검사가 평점 문구를 보여 줘요.
    rating: values.rating === "" ? undefined : toNumber(values.rating),
    oneLiner: values.oneLiner,
    // `publishedAt,`은 `publishedAt: publishedAt`을 줄여 쓴 모양이에요.
    publishedAt,
  };
  // 선택 칸: 무엇이든 적었을 때만 넣어요. (trim(): 공백만 친 칸은 빈 칸으로 봐요)
  if (values.image.trim() !== "") input.image = values.image;
  return input;
}

/**
 * 글쓰기 칸을 모두 검사해요.
 *
 * 둘째 인자 `{ checkSlug, now = nowInSeoul() }`는 객체를 받자마자 항목을 꺼내는 구조 분해예요.
 * `now = ...`처럼 적으면 넘기지 않았을 때의 기본값이 돼요. `now?: string`의 ?는 "넘기지 않아도 됨"이라는 뜻이에요.
 *
 * @param values 칸 값
 * @param options.checkSlug 파일 이름도 검사할지. 새 글이면 true(수정 화면은 파일 이름을 바꾸지 않아요)
 * @param options.now "글 쓴 날"이 비어 있을 때(새 리뷰) 넣을 날짜·시각. 기본은 지금(한국 시간, 시각까지)
 * @returns 통과하면 { ok: true, fields }, 아니면 { ok: false, errors }
 * @example
 * validateReviewForm({ ...EMPTY_VALUES, title: "겨울 정류장" }, { checkSlug: true });
 * // { ok: false, errors: { slug: "...", year: "...", creator: "...", ... } }
 */
export function validateReviewForm(
  values: ReviewFormValues,
  { checkSlug, now = nowInSeoul() }: { checkSlug: boolean; now?: string },
): FormCheck {
  // 틀린 칸의 문구를 모을 빈 객체. const여도 객체 "안"의 항목은 더할 수 있어요.
  const errors: FieldErrors = {};

  // 1) 파일 이름: 원고 파일 이름 규칙(SLUG)을 따라요.
  if (checkSlug && !SLUG.test(values.slug)) errors.slug = FIELD_MESSAGES.slug;

  // 2) 나머지 칸: 빌드할 때와 같은 규칙(checkReview)으로 검사하고, 틀린 칸에는 칸 이름으로 된 문구를 달아요.
  //    `A || B`: 글 쓴 날이 비어 있으면(새 리뷰) 지금 시각을 넣어요.
  const parsed = checkReview(toReviewInput(values, values.publishedAt.trim() || now));
  if (!parsed.ok) {
    // for...of: 문제 목록에서 문제를 하나씩 꺼내 되풀이해요.
    for (const issue of parsed.issues) {
      // issue.key: 어느 항목이 틀렸는지(예: "year"). 원고 항목 이름과 칸 이름이 같게 지었어요.
      // `as keyof ReviewFormValues`: "이 글자는 칸 이름 가운데 하나"라고 TypeScript에 알려 줘요(아래 in으로 정말 그런지 확인해요).
      const key = issue.key as keyof ReviewFormValues;
      // `key in 객체`: 객체에 그 이름의 항목이 있으면 true. `??=`: 그 칸에 문구가 아직 없을 때만 넣어요.
      if (key in FIELD_MESSAGES) errors[key] ??= FIELD_MESSAGES[key];
    }
  }

  // 틀린 칸이 하나라도 있으면 실패. Object.keys(errors).length: 오류 문구가 달린 칸의 수
  // (`|| !parsed.ok`는 TypeScript에게 "아래에서는 parsed.ok가 true"라고 확실히 알려 주려고 함께 적어요.)
  if (Object.keys(errors).length > 0 || !parsed.ok) return { ok: false, errors };
  return { ok: true, fields: parsed.value };
}
