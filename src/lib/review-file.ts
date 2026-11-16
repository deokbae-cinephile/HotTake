/**
 * @file 리뷰 원고 파일 읽기·쓰기 (review-file.ts)
 * 읽는 순서: 52/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/components/review-writer.tsx → 다음: src/lib/github.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰 원고(content/reviews/<파일 이름>.json)의 글자와 글쓰기 화면의 칸 값을 서로 바꿔 줘요.
 *
 *     원고 글자(JSON)                          글쓰기 칸 값(ReviewFormValues)
 *     {                                         {
 *       "title": "겨울 정류장",      ──parse──>     title: "겨울 정류장",
 *       "year": 2024,               <──serialize──  year: "2024",      ← 칸 값은 모두 글자예요
 *       ...                                         ...
 *     }                                         }
 *
 *   - parseReviewFile: 원고 글자 → 칸 값. "리뷰 수정" 화면(서버)이 저장소의 원고를 읽을 때 써요.
 *   - serializeReviewFile: 검사를 통과한 값 → 원고 글자. 저장할 때 서버가 써요.
 *   읽기와 쓰기가 한 파일에 있어서 "읽은 원고"와 "저장한 원고"의 모양이 늘 같아요.
 *
 * JSON이란?
 *   JavaScript 객체를 글자로 적는 약속이에요. 항목 이름과 글자 값은 큰따옴표(")로 감싸고, 숫자는 그대로 적어요.
 *   JavaScript에 기본으로 들어 있는 JSON.parse(글자 → 값)와 JSON.stringify(값 → 글자)로 바로 다룰 수 있어서
 *   따로 라이브러리를 설치할 필요가 없어요.
 *
 * 누가 쓰나요?
 *   app/write/[slug]/page.tsx(수정할 원고 읽기), lib/review-store.ts(원고 읽기·저장),
 *   components/review-writer.test.tsx(글쓰기 화면 테스트에서 원고를 칸 값으로 바꿀 때)
 */

import { isCategory } from "./categories";
import { isRecord, REVIEW_KEYS, type ReviewFields } from "./review-schema";
import type { ReviewFormValues } from "./review-values";

/**
 * parseReviewFile의 결과예요.
 *   - 읽음: { ok: true, values: 칸 값(파일 이름 slug는 빼고) }
 *   - 못 읽음: { ok: false, message: 이유 }
 *
 * `Omit<T, "slug">`는 T에서 slug 항목만 뺀 타입이에요. 파일 이름은 원고 "안"에 없고 부르는 쪽이 알고 있어서 빼요.
 */
export type ParsedReviewFile = { ok: true; values: Omit<ReviewFormValues, "slug"> } | { ok: false; message: string };

/**
 * 원고의 값 하나를 칸에 넣을 글자로 바꿔요.
 * 글자는 앞뒤 빈칸을 지우고, 숫자는 글자로 바꾸고(2024 → "2024"), 그 밖의 값(없음, 목록 등)은 빈 글자로 둬요.
 * Number.isFinite: 보통 숫자면 true예요. NaN(숫자 아님)이나 Infinity(무한대) 같은 특별한 값은 false예요.
 *
 * @param value 원고에서 읽은 값(무엇이든)
 * @returns 칸에 넣을 글자
 * @example asText(2024)      // "2024"
 * @example asText(" 겨울 ")  // "겨울"
 * @example asText(undefined) // ""
 */
function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/**
 * 평점을 칸 값으로 바꿔요. 평점 칸(<select>)의 선택지가 "4.0", "4.5"처럼 소수 한 자리라서 모양을 맞춰요.
 * toFixed(1): 소수 한 자리 글자로 바꿔요(4 → "4.0"). 숫자가 아니면 ""(아직 고르지 않음)예요.
 *
 * @param value 원고의 rating 값
 * @returns "4.0"·"4.5" 같은 글자, 또는 ""
 */
function asRating(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "";
}

/**
 * 원고 글자를 읽어 글쓰기 칸 값으로 바꿔요.
 *
 * 값이 조금 틀려도(예: 분류 오타) 읽기는 해요. 칸에 넣어 보여 주고, 저장할 때 칸 검사가 고칠 곳을 알려 주는 편이
 * "읽지 못했습니다"로 막는 것보다 고치기 쉬워서예요. JSON 문법 자체가 틀린 경우만 실패로 돌려줘요.
 *
 * @param text 원고 파일의 글자 전체
 * @returns 읽었으면 { ok: true, values }, JSON 문법이 틀렸거나 객체가 아니면 { ok: false, message }
 * @example
 * parseReviewFile('{"title":"겨울 정류장","year":2024}');
 * // { ok: true, values: { title: "겨울 정류장", year: "2024", creator: "", ... } }
 */
export function parseReviewFile(text: string): ParsedReviewFile {
  // 무엇이 들어올지 모르는 값이라 unknown으로 받아요. 아래 isRecord로 확인한 뒤에야 항목을 꺼낼 수 있어요.
  let data: unknown;
  // try { ... } catch { ... }: try 안에서 오류가 나면 프로그램이 멈추지 않고 catch로 넘어와요.
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "JSON 모양이 아닙니다. 큰따옴표와 쉼표가 맞는지 확인하세요." };
  }
  // "[1, 2]"나 "\"글자\""처럼 JSON 문법은 맞지만 { } 객체가 아닌 원고도 막아요.
  if (!isRecord(data)) return { ok: false, message: '원고는 { "title": ..., "year": ... }처럼 중괄호로 감싼 항목 모음이어야 합니다.' };

  // 칸 값은 모두 글자라서, 원고에 없는 항목도 ""로 채워 모든 칸을 돌려줘요.
  return {
    ok: true,
    values: {
      title: asText(data.title),
      year: asText(data.year),
      creator: asText(data.creator),
      // 목록에 없는 분류(오타 등)는 비워 둬요. 글쓰기 화면이 "분류를 고르세요"라고 알려 줘요.
      category: isCategory(data.category) ? data.category : "",
      rating: asRating(data.rating),
      oneLiner: asText(data.oneLiner),
      image: asText(data.image),
      publishedAt: asText(data.publishedAt),
    },
  };
}

/**
 * 검사를 통과한 값을 원고 글자로 바꿔요.
 *
 * 항목 순서는 늘 REVIEW_KEYS 순서예요. 그래서 고친 원고를 GitHub에서 비교해 볼 때 바뀐 줄만 보여요.
 * 값이 없는 선택 항목(image)은 줄 자체를 쓰지 않아요.
 *
 * @param fields 원고 검사(lib/review-schema.ts의 checkReview)를 통과한 값
 * @returns 원고 파일에 그대로 쓸 JSON 글자(끝에 줄바꿈 하나)
 * @example
 * serializeReviewFile({ title: "겨울 정류장", year: 2024, ... });
 * // '{\n  "title": "겨울 정류장",\n  "year": 2024,\n  ...\n}\n'
 */
export function serializeReviewFile(fields: ReviewFields): string {
  // REVIEW_KEYS 순서대로 [이름, 값] 짝을 만들고(map), 값이 없는 짝은 빼요(filter).
  // `([, value]) =>`: 짝 배열의 첫 값(이름)은 건너뛰고 둘째 값만 value로 받는 구조 분해예요.
  // Object.fromEntries: [이름, 값] 짝의 목록을 다시 객체로 묶어요. 객체 항목은 넣은 순서를 지켜요.
  const ordered = Object.fromEntries(REVIEW_KEYS.map((key) => [key, fields[key]]).filter(([, value]) => value !== undefined));
  // JSON.stringify(값, null, 2): 두 칸 들여쓰기로 보기 좋게 적어요. 끝에 줄바꿈을 하나 붙이는 것이 텍스트 파일의 관례예요.
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
