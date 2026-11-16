/**
 * @file categories.ts 테스트
 *
 * 분류 목록이
 *   - 정한 두 가지(영화, 도서)이고, 그 순서인지(분류 필터와 글쓰기 화면이 이 순서를 그대로 써요)
 *   - isCategory가 목록에 있는 이름만 받아 주는지
 *   - 주소 이름(movie, book)과 감독·작가 이름이 맞는지
 * 확인해요.
 *
 * 테스트 도구 문법
 *   - describe / it         : 테스트 묶음 / 테스트 하나
 *   - expect(값).toBe(기대) : 값이 똑같은지(true/false, 글자)
 *   - toEqual               : 배열의 내용이 같은지
 *   - toBeNull              : 값이 null인지
 */

import { describe, expect, it } from "vitest";

import { CATEGORIES, CATEGORY_SLUGS, categoryFromParam, categorySlug, isCategory } from "./categories";

describe("CATEGORIES", () => {
  it("정한 두 가지 분류를 영화, 도서 순서로 둔다", () => {
    expect(CATEGORIES).toEqual(["영화", "도서"]);
  });
});

describe("isCategory", () => {
  it("목록에 있는 이름만 분류로 받아 준다", () => {
    expect(isCategory("영화")).toBe(true);
    expect(isCategory("도서")).toBe(true);
    expect(isCategory("책")).toBe(false);
    expect(isCategory("")).toBe(false);
    // 글자가 아닌 값(숫자)도 넣어 봐요. 원고에는 무엇이든 적힐 수 있어서요.
    expect(isCategory(1)).toBe(false);
  });
});

describe("분류 영어 주소 이름(CATEGORY_SLUGS)", () => {
  it("모든 분류에 겹치지 않는 영어 소문자 이름이 있다", () => {
    const slugs = CATEGORIES.map((category) => categorySlug(category));
    // 모두 영어 소문자로만 되어 있는지(/^[a-z]+$/: 처음부터 끝까지 a~z만)
    expect(slugs.every((slug) => /^[a-z]+$/.test(slug))).toBe(true);
    // Set은 같은 값을 한 번만 담아요. 크기가 분류 수와 같으면 겹치는 이름이 없다는 뜻이에요.
    expect(new Set(slugs).size).toBe(CATEGORIES.length);
    // 영어 이름 표의 항목 순서가 분류 목록과 같은지. `[...CATEGORIES]`: 읽기 전용 배열을 보통 배열로 펼쳐 비교해요.
    expect(Object.keys(CATEGORY_SLUGS)).toEqual([...CATEGORIES]);
  });

  it("주소 값을 분류로 바꾼다: 영어 이름(대소문자 무시)과 한글 이름을 받고, 없는 값은 null", () => {
    expect(categoryFromParam("movie")).toBe("영화");
    expect(categoryFromParam("BOOK")).toBe("도서");
    expect(categoryFromParam("도서")).toBe("도서");
    expect(categoryFromParam("music")).toBeNull();
    expect(categoryFromParam("")).toBeNull();
    // 주소에 ?category=가 아예 없으면 null이 와요.
    expect(categoryFromParam(null)).toBeNull();
  });
});

