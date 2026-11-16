/**
 * @file browse.ts 테스트
 *
 * 처음 화면의 검색·분류 필터·정렬 규칙을 화면 없이 함수만으로 확인해요.
 * 테스트 데이터는 src/test/review-mocks.ts의 가짜 리뷰 4편이에요.
 *
 *   최신순: 겨울 정류장 → 화성 세탁소 → 필름이 끊기기 전에 → 8비트 영웅전
 *   평점순: 필름이 끊기기 전에(5) → 겨울 정류장(4.5) → 화성 세탁소(3.5) → 8비트 영웅전(2.5)
 *   분류: 영화(겨울 정류장, 필름이 끊기기 전에), 도서(화성 세탁소, 8비트 영웅전)
 *
 * 테스트 도구 문법
 *   - describe / it / expect : 테스트 묶음 / 테스트 하나 / 값 확인
 *   - toEqual / toBe         : 배열·객체의 내용이 같은지 / 값이 똑같은지
 *   - toHaveLength(n)        : 배열의 길이가 n인지
 *   - toContainEqual(값)     : 배열 안에 그 내용과 같은 항목이 있는지
 */

import { describe, expect, it } from "vitest";

import { reviewMocks } from "@/test/review-mocks";

import {
  browse,
  countCategories,
  DEFAULT_PARAMS,
  isFiltered,
  matchesQuery,
  parseParams,
  resultStatus,
  toSearch,
} from "./browse";

/** 결과를 비교하기 쉽게 파일 이름(slug)만 뽑는 도우미. 리뷰 전체를 비교하는 것보다 순서가 한눈에 보여요. */
const slugs = (list: { slug: string }[]) => list.map((review) => review.slug);

// 가짜 리뷰 4편에 이름을 붙여 둬요. `as [...]`는 "4칸이 꼭 있다"고 TypeScript에 알려 주는 표시예요.
// (그냥 배열에서 꺼내면 "없을 수도 있음(undefined)"으로 잡혀서요. `(typeof reviewMocks)[number]`는 "배열 한 칸의 타입"이에요.)
const [winter, mars, reel, legend] = reviewMocks as [
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
  (typeof reviewMocks)[number],
];

describe("parseParams / toSearch", () => {
  it("주소의 조건을 읽고, 다시 같은 주소로 만든다", () => {
    const params = parseParams(new URLSearchParams("q=겨울&category=movie&sort=rating"));
    expect(params).toEqual({ q: "겨울", category: "영화", sort: "rating" });
    // 한글은 주소에 쓸 수 있는 모양(%EA%B2%A8...)으로 바뀌어요.
    // 분류는 영어 이름으로 적어요(한글을 적으면 %EC%98%81…처럼 길어져요).
    expect(toSearch(params)).toBe("?q=%EA%B2%A8%EC%9A%B8&category=movie&sort=rating");
  });

  it("없는 분류, 모르는 정렬, 공백만 있는 검색어는 기본값으로 둔다(모르는 조건 이름 ?foo=도 무시한다)", () => {
    // %20은 주소에 적은 공백이에요. 공백뿐인 검색어는 빈 검색어로 봐요.
    expect(parseParams(new URLSearchParams("q=%20%20&category=music&sort=random"))).toEqual(DEFAULT_PARAMS);
    expect(parseParams(new URLSearchParams("foo=bar"))).toEqual(DEFAULT_PARAMS);
  });

  it("한글 분류(?category=도서)가 와도 같은 분류로 받고, 다시 적을 때는 영어 이름으로 적는다", () => {
    // encodeURIComponent: 한글을 주소에 쓸 수 있는 모양(%EB%8F%84...)으로 바꿔요. 실제 주소창과 같은 상황을 만들어요.
    const params = parseParams(new URLSearchParams(`category=${encodeURIComponent("도서")}`));
    expect(params.category).toBe("도서");
    expect(toSearch(params)).toBe("?category=book");
    // 영어 이름은 대소문자를 가리지 않아요.
    expect(parseParams(new URLSearchParams("category=Book")).category).toBe("도서");
  });

  it("기본값만 있으면 주소에 아무것도 붙이지 않는다", () => {
    expect(toSearch(DEFAULT_PARAMS)).toBe("");
  });
});

describe("matchesQuery", () => {
  it("제목, 감독 또는 작가, 한 줄 평, 분류에서 찾는다", () => {
    expect(matchesQuery(winter, "정류장")).toBe(true); // 제목
    expect(matchesQuery(winter, "한서윤")).toBe(true); // 감독 또는 작가
    expect(matchesQuery(winter, "기다림")).toBe(true); // 한 줄 평
    expect(matchesQuery(mars, "도서")).toBe(true); // 분류
    expect(matchesQuery(winter, "화성")).toBe(false);
  });

  it("대소문자와 띄어쓰기를 가리지 않는다", () => {
    // 영어 이름도 대소문자와 상관없이 찾아요.
    expect(matchesQuery({ ...winter, creator: "Dana Whitfield" }, "DANA whitfield")).toBe(true);
    expect(matchesQuery(winter, "겨울정류장")).toBe(true);
  });

  it("낱말을 여럿 쓰면 모두 들어 있어야 한다", () => {
    expect(matchesQuery(winter, "겨울 한서윤")).toBe(true);
    expect(matchesQuery(winter, "겨울 화성")).toBe(false);
  });

  it("빈 검색어는 모두 남긴다", () => {
    expect(matchesQuery(mars, "  ")).toBe(true);
  });
});

describe("browse", () => {
  it("기본은 최근에 쓴 글부터 보인다", () => {
    expect(slugs(browse(reviewMocks, DEFAULT_PARAMS))).toEqual([winter.slug, mars.slug, reel.slug, legend.slug]);
  });

  it("분류로 거른다", () => {
    expect(slugs(browse(reviewMocks, { ...DEFAULT_PARAMS, category: "영화" }))).toEqual([winter.slug, reel.slug]);
    expect(slugs(browse(reviewMocks, { ...DEFAULT_PARAMS, category: "도서" }))).toEqual([mars.slug, legend.slug]);
  });

  it("평점이 높은 순으로 정렬한다", () => {
    expect(slugs(browse(reviewMocks, { ...DEFAULT_PARAMS, sort: "rating" }))).toEqual([
      reel.slug,
      winter.slug,
      mars.slug,
      legend.slug,
    ]);
  });

  it("검색어와 분류를 함께 쓴다", () => {
    expect(slugs(browse(reviewMocks, { q: "영사기", category: "영화", sort: "latest" }))).toEqual([reel.slug]);
    expect(browse(reviewMocks, { q: "영사기", category: "도서", sort: "latest" })).toEqual([]);
  });
});

describe("countCategories", () => {
  it("리뷰가 있는 분류만 분류 목록 순서(영화, 도서)로 센다", () => {
    expect(countCategories(reviewMocks)).toEqual([
      { category: "영화", count: 2 },
      { category: "도서", count: 2 },
    ]);
  });

  it("리뷰가 없는 분류는 빼되, 지금 고른 분류는 0편이어도 남긴다", () => {
    const movies = reviewMocks.filter((review) => review.category === "영화");
    expect(countCategories(movies)).toEqual([{ category: "영화", count: 2 }]);
    // toContainEqual: 배열 안에 이 내용과 같은 항목이 있는지 확인해요.
    expect(countCategories(movies, "도서")).toContainEqual({ category: "도서", count: 0 });
  });
});

describe("isFiltered / resultStatus", () => {
  it("정렬만 바꾼 것은 거른 것이 아니다", () => {
    expect(isFiltered({ ...DEFAULT_PARAMS, sort: "rating" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_PARAMS, q: "겨울" })).toBe(true);
  });

  it("결과 안내 문구를 만든다", () => {
    expect(resultStatus(8, 8, DEFAULT_PARAMS)).toBe("전체 8편");
    expect(resultStatus(8, 1, { ...DEFAULT_PARAMS, category: "도서" })).toBe("8편 중 1편");
    expect(resultStatus(8, 0, { ...DEFAULT_PARAMS, q: "없음" })).toBe("8편 중 0편");
  });
});

