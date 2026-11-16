/**
 * @file review-values.ts 테스트
 *
 * 아무것도 적지 않은 처음 칸 값(EMPTY_VALUES)이 모두 비어 있고, 칸 이름이 원고 항목과 꼭 맞는지 확인해요.
 * 리뷰 추가 화면이 이 값으로 시작하므로, 칸이 하나라도 채워져 있으면 빈 화면이 아니게 돼요.
 *
 * 테스트 도구 문법
 *   - expect(값).toBe(true)              : 값이 true인지 확인해요.
 *   - expect(배열).toEqual(배열)          : 두 배열의 내용(순서 포함)이 같은지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { REVIEW_KEYS } from "./review-schema";
import { EMPTY_VALUES } from "./review-values";

describe("EMPTY_VALUES", () => {
  it("모든 칸이 빈 글자다(분류도 아직 고르지 않은 \"\")", () => {
    // Object.values: 객체의 값만 모은 배열. every: 모든 값이 조건을 만족하면 true예요.
    expect(Object.values(EMPTY_VALUES).every((value) => value === "")).toBe(true);
    expect(EMPTY_VALUES.category).toBe("");
  });

  // 칸 이름 = 원고 항목(lib/review-schema.ts의 REVIEW_KEYS) + 파일 이름(slug). 남는 칸도 모자라는 칸도 없어야 해요.
  // [...배열].sort(): 복사본을 가나다·abc순으로 늘어놓아, 순서와 상관없이 같은 이름들인지 견줘요.
  it("칸 이름은 원고 항목과 파일 이름(slug)뿐이다", () => {
    expect(Object.keys(EMPTY_VALUES).sort()).toEqual([...REVIEW_KEYS, "slug"].sort());
  });
});
