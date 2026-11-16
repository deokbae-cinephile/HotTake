/**
 * @file review-schema.ts 테스트
 *
 * 원고 검사 규칙이 "맞는 원고는 통과시키고, 틀린 원고는 고치는 방법과 함께 거절하는지" 확인해요.
 *
 * 알아 두면 좋은 테스트 도구(Vitest)
 *   - describe("묶음 이름", () => { ... }) : 관련 있는 테스트를 한 묶음으로 모아요.
 *   - it("하는 일", () => { ... })          : 테스트 하나. 이름은 "무엇을 확인하는지"를 문장으로 적어요.
 *   - expect(값).toBe(기대값)               : 값이 기대값과 같은지 확인해요(숫자·글자·true/false).
 *   - toEqual                               : 배열·객체의 "내용"이 같은지 비교해요(toBe는 "같은 물건"인지 비교해서 배열·객체에는 안 맞아요).
 *   - toContain                             : 글자 안에 어떤 글자가 들어 있는지 확인해요.
 *   - it.each([값들])("이름 %s", (값) => ...) : 같은 테스트를 값만 바꿔 여러 번 돌려요. %s 자리에 값이 들어가요.
 *   - toMatchObject                         : 객체에 적은 항목들만 같은지 봐요(다른 항목이 더 있어도 괜찮아요).
 *   - toHaveLength(n)                       : 배열의 길이가 n인지 확인해요.
 *   - expect.stringContaining("글자")       : "이 글자가 들어 있는 아무 글자"와 맞아요. toEqual 안에서 쓸 수 있어요.
 *
 * 자주 나오는 모양 `{ ...valid, rating: 4.3 }`
 *   `...`(전개 문법)로 valid의 항목을 모두 펼쳐 넣고, 뒤에 적은 항목(rating)만 덮어써요.
 *   올바른 원고에서 한 곳만 틀린 원고를 짧게 만들 수 있어요.
 */

import { describe, expect, it } from "vitest";

import { checkReview, IMAGE_FILE, isRating, SLUG } from "./review-schema";

/** 모든 항목이 올바르게 들어 있는 원고. 테스트마다 여기서 한 곳만 바꿔 틀린 원고를 만들어요. */
const valid = {
  title: "겨울 정류장",
  year: 2024,
  creator: "한서윤",
  category: "영화",
  rating: 4.5,
  oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
  publishedAt: "2026-11-08T21:30:00+09:00",
};

/**
 * 검사해 보고 실패하면 오류 문구 목록을, 통과하면 빈 목록을 돌려주는 도우미
 * `input: unknown`이라 일부러 틀린 값(글자 연도, 배열 등)도 넣을 수 있어요.
 */
const messages = (input: unknown) => {
  const result = checkReview(input);
  return result.ok ? [] : result.issues.map((issue) => issue.message);
};

/**
 * 통과해야 하는 원고를 검사해 정리된 값을 돌려주는 도우미(틀리면 문구와 함께 시험을 멈춰요)
 * `throw new Error(...)`는 오류를 일으켜 함수를 바로 멈춰요. 테스트 안에서 오류가 나면 그 테스트는 실패로 기록돼요.
 */
const parse = (input: unknown) => {
  const result = checkReview(input);
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return result.value;
};

describe("checkReview", () => {
  // 검사를 통과하면 원고 값이 하나도 바뀌지 않고 그대로 나와야 해요.
  it("올바른 원고를 그대로 읽는다", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("선택 항목(이미지)은 없어도 된다", () => {
    // valid에는 image가 없어요. 필수 항목만으로도 통과해요.
    expect(checkReview(valid).ok).toBe(true);
  });

  it("지금은 쓰지 않는 항목(originalTitle)을 적으면 알 수 없는 항목으로 알려 준다", () => {
    expect(messages({ ...valid, originalTitle: "Winter Stop" })[0]).toContain("알 수 없는 항목입니다: originalTitle");
  });

  it("분류는 영화·도서 가운데 하나를 받는다", () => {
    expect(parse({ ...valid, category: "도서" }).category).toBe("도서");
  });

  it("글 쓴 날은 날짜만 적어도, 시각과 시간대까지 적어도 받는다", () => {
    expect(parse({ ...valid, publishedAt: "2026-11-14" }).publishedAt).toBe("2026-11-14");
    expect(parse({ ...valid, publishedAt: "2026-11-14T10:35Z" }).publishedAt).toBe("2026-11-14T10:35Z");
  });

  // 빈칸으로 띄운 시각, 시간대가 없는 시각(어디서 읽느냐에 따라 순간이 달라져요), 25시, 없는 날, 다른 모양을 거절해요.
  it.each(["2026-11-14 19:35:48", "2026-11-14T19:35:48", "2026-11-14T25:00:00+09:00", "2026-02-30", "2026.11.08"])(
    "글 쓴 날 %s는 고치는 방법과 함께 거절한다",
    (publishedAt) => {
      expect(messages({ ...valid, publishedAt })).toEqual([expect.stringContaining('"publishedAt"(글 쓴 날)은 YYYY-MM-DD 모양으로 적고')]);
    },
  );

  // 0.5 단위가 아닌 값(4.3), 범위 밖의 값(0점은 없어요, 5.5), 글자("4.5")를 모두 거절하는지 한 번에 확인해요.
  it.each([4.3, 0, 5.5, "4.5"])("평점 %s는 고치는 방법과 함께 거절한다", (rating) => {
    expect(messages({ ...valid, rating })).toEqual([
      '"rating"(평점)은 따옴표 없이 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: "rating": 4.5',
    ]);
  });

  // 분류 목록(lib/categories.ts)에 없는 이름, 목록으로 적은 분류, 글자가 아닌 값은 쓸 수 없어요.
  it.each(["책", "드라마", "movie", ["영화"], 1])("분류 %s는 쓸 수 있는 분류를 알려 주며 거절한다", (category) => {
    expect(messages({ ...valid, category })).toEqual(['"category"(분류)는 영화, 도서 가운데 하나를 적습니다. 예: "category": "영화"']);
  });

  it("빠진 필수 항목을 한꺼번에 모두 알려 준다", () => {
    expect(messages({})).toEqual([
      '"title"(한국어 제목)을 적어 주세요. 예: "title": "겨울 정류장"',
      '"year"(연도)는 따옴표 없이 숫자 네 자리로 적습니다. 영화는 개봉한 해, 도서는 펴낸 해예요. 예: "year": 2024',
      '"creator"(감독 또는 작가)를 적어 주세요. 여러 명이면 쉼표로 나눕니다. 예: "creator": "한서윤, 김도윤"',
      '"category"(분류)는 영화, 도서 가운데 하나를 적습니다. 예: "category": "영화"',
      '"rating"(평점)은 따옴표 없이 0.5부터 5까지 0.5 단위 숫자로 적습니다(0점은 없습니다). 예: "rating": 4.5',
      '"oneLiner"(한 줄 평)를 적어 주세요. 예: "oneLiner": "눈이 그친 뒤에야 들리는 이야기"',
      '"publishedAt"(글 쓴 날)은 YYYY-MM-DD 모양으로 적고, 시각까지 적으려면 YYYY-MM-DDTHH:mm:ss+09:00 모양으로 적습니다. 예: "publishedAt": "2026-10-05T21:30:00+09:00"',
    ]);
  });

  it("알 수 없는 항목(오타)을 쓸 수 있는 항목과 함께 알려 준다", () => {
    // `const [message] = 배열`: 배열의 첫 값만 꺼내요(배열 구조 분해).
    const [message] = messages({ ...valid, ratting: 4 });
    expect(message).toContain("알 수 없는 항목입니다: ratting");
    expect(message).toContain("쓸 수 있는 항목: title");
  });

  it("이미지 파일 이름을 받는다", () => {
    const result = parse({ ...valid, image: "winter-stop.jpg" });
    expect(result.image).toBe("winter-stop.jpg");
  });

  // 폴더를 거슬러 올라가는 이름(../), 경로까지 적은 이름, 대문자, 받지 않는 확장자는 모두 막아요.
  it.each(["../secret.jpg", "/images/a.jpg", "Winter.JPG", "cover.gif", "images/a.jpg"])("이미지 파일 이름 %s는 거절한다", (image) => {
    const [message] = messages({ ...valid, image });
    expect(message).toContain('"image"(이미지)에는 public/images 폴더에 넣은 파일 이름만 적습니다');
  });

  it("공백만 있는 제목은 빈 제목으로 보고 거절한다", () => {
    expect(messages({ ...valid, title: "   " })).toEqual(['"title"(한국어 제목)을 적어 주세요. 예: "title": "겨울 정류장"']);
  });

  // 손으로 고친 원고에 실수로 들어간 빈칸이 화면에 그대로 보이지 않게 지워서 받아요.
  it("앞뒤 공백은 지우고 받는다", () => {
    expect(parse({ ...valid, title: "  겨울 정류장  ", oneLiner: " 한줄 " })).toMatchObject({ title: "겨울 정류장", oneLiner: "한줄" });
  });

  it("문제마다 어느 항목인지(key)를 알려 준다(글쓰기 화면이 칸에 문구를 달 때 써요)", () => {
    // 두 항목을 함께 틀리게 해서, key가 항목 순서(year → rating)대로 나오는지 봐요.
    const result = checkReview({ ...valid, year: "2024", rating: 4.3 });
    expect(result.ok ? [] : result.issues.map((issue) => issue.key)).toEqual(["year", "rating"]);
  });

  // 숫자 칸에 글자를 적었거나(따옴표 "2024"), 범위 밖이거나, 정수가 아니면 거절해요.
  // 값을 [ ]로 한 번 더 감싼 것은 it.each가 배열 하나를 "인자 목록"으로 읽기 때문이에요(값마다 인자 하나).
  it.each([["2024"], [999], [2101], [2024.5]])("연도에 %s를 적으면 거절한다", (year) => {
    expect(messages({ ...valid, year })).toHaveLength(1);
  });

  it("선택 항목을 적어 놓고 값을 비우면(null, 빈 글자) 거절한다", () => {
    const expected = [expect.stringContaining('"image"(이미지)에는 public/images 폴더에 넣은 파일 이름만 적습니다')];
    expect(messages({ ...valid, image: null })).toEqual(expected);
    expect(messages({ ...valid, image: "" })).toEqual(expected);
  });

  it("원고가 객체가 아니면(null, 목록) 빠진 항목을 모두 알려 준다", () => {
    expect(messages(null)).toEqual(messages({}));
    expect(messages(["title"])).toEqual(messages({}));
  });

  it("빠진 항목과 알 수 없는 항목이 함께 있으면, 알 수 없는 항목은 맨 끝에 알린다", () => {
    const list = messages({ ratting: 4 });
    expect(list[0]).toContain('"title"(한국어 제목)');
    // `.at(-1)`: 배열의 맨 끝 값. 음수는 뒤에서부터 세요.
    expect(list.at(-1)).toContain("알 수 없는 항목입니다: ratting");
  });
});

describe("isRating", () => {
  it("0.5부터 5까지 0.5 단위 숫자만 평점이다", () => {
    expect([0.5, 1, 2.5, 5].every(isRating)).toBe(true);
    // some: 하나라도 조건을 만족하면 true. false가 나와야 "하나도 평점이 아니다"예요. NaN은 "숫자가 아님"을 뜻하는 특별한 숫자 값이에요.
    expect([0, 4.3, 5.5, "4.5", Number.NaN].some(isRating)).toBe(false);
  });
});

// SLUG: 원고 파일 이름 규칙. 대문자·한글·하이픈 두 개·앞 하이픈·빈칸·빈 글자는 막아요.
describe("SLUG", () => {
  it.each(["winter-stop", "3am-store", "a1"])("%s는 원고 파일 이름으로 쓸 수 있다", (slug) => {
    expect(SLUG.test(slug)).toBe(true);
  });

  it.each(["Winter-Stop", "겨울", "a--b", "-a", "a b", ""])("%s는 쓸 수 없다", (slug) => {
    expect(SLUG.test(slug)).toBe(false);
  });
});

// IMAGE_FILE: 이미지 파일 이름 규칙. 받지 않는 확장자, 대문자 확장자, 폴더 경로, 확장자 없는 이름은 막아요.
describe("IMAGE_FILE", () => {
  it.each(["winter-stop.jpg", "a.jpeg", "b-2.png", "c.webp", "d.avif"])("%s는 이미지 파일 이름으로 쓸 수 있다", (file) => {
    expect(IMAGE_FILE.test(file)).toBe(true);
  });

  it.each(["a.gif", "a.JPG", "../a.jpg", "a/b.jpg", "a"])("%s는 쓸 수 없다", (file) => {
    expect(IMAGE_FILE.test(file)).toBe(false);
  });
});
