/**
 * @file review-file.ts 테스트
 *
 * 원고 글자(JSON) ↔ 글쓰기 칸 값이 서로 잘 바뀌는지 확인해요.
 *   - 불러오기(parseReviewFile): 수정 화면이 저장소의 원고를 읽으면 칸이 바로 채워져야 해요.
 *   - 저장(serializeReviewFile): 저장한 원고가 빌드할 때 원고 검사(lib/review-schema.ts)를 통과하는 모양이어야 해요.
 *   - 둘을 이어 붙여도(저장 → 다시 읽기) 값이 그대로여야 해요.
 *
 * 테스트 도구 문법
 *   - toEqual / toBe          : 내용이 같은지 / 값(글자)이 똑같은지
 *   - expect.stringContaining : toEqual 안에서 "이 글자가 들어 있는 아무 글자"와 맞아요.
 *   - not.toContain           : 글자 안에 그 글자가 "없는지" 확인해요.
 *   - toMatchObject           : 적은 항목만 같은지 봐요(나머지 항목은 상관없어요).
 */

import { describe, expect, it } from "vitest";

import { parseReviewFile, serializeReviewFile } from "./review-file";
import { checkReview } from "./review-schema";

/**
 * 글쓰기 화면이 저장하는 모양 그대로의 원고
 * 백틱(`)으로 감싼 글자(템플릿 리터럴)는 여러 줄을 그대로 적을 수 있어요. 끝의 빈 줄은 마지막 줄바꿈이에요.
 */
const SOURCE = `{
  "title": "겨울 정류장",
  "year": 2024,
  "creator": "한서윤",
  "category": "영화",
  "rating": 4.5,
  "oneLiner": "버스는 오지 않아도, 기다림은 끝내 도착한다.",
  "publishedAt": "2026-11-08T21:30:00+09:00",
  "image": "winter-stop.jpg"
}
`;

/** 검사를 통과한 원고 값을 만들어요(틀리면 문구와 함께 시험을 멈춰요). */
function parse(input: unknown) {
  const result = checkReview(input);
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  return result.value;
}

describe("parseReviewFile", () => {
  it("원고를 칸 값으로 바꾼다(숫자는 글자로, 평점은 소수 한 자리로, 없는 항목은 빈 글자로)", () => {
    expect(parseReviewFile(SOURCE)).toEqual({
      ok: true,
      values: {
        title: "겨울 정류장",
        year: "2024",
        creator: "한서윤",
        category: "영화",
        rating: "4.5",
        oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
        image: "winter-stop.jpg",
        publishedAt: "2026-11-08T21:30:00+09:00",
      },
    });
  });

  it("분류가 목록에 없거나 빠졌으면 빈 칸(아직 고르지 않음)으로 읽는다", () => {
    // replace(찾을 글자, 바꿀 글자)로 원고의 분류만 바꿔 읽어요.
    // `wrong.ok && 값`: ok가 false면 false, true면 뒤의 값이 돼요. 실패했다면 ""와 달라 테스트가 실패해요.
    const wrong = parseReviewFile(SOURCE.replace('"category": "영화"', '"category": "드라마"'));
    expect(wrong.ok && wrong.values.category).toBe("");
    const book = parseReviewFile(SOURCE.replace('"category": "영화"', '"category": "도서"'));
    expect(book.ok && book.values.category).toBe("도서");
  });

  it("JSON 문법이 틀렸거나 객체가 아니면 고치는 방법을 알려 준다", () => {
    // 마지막 항목 뒤의 쉼표는 JSON에서 틀린 문법이에요.
    expect(parseReviewFile('{ "title": "겨울", }')).toEqual({ ok: false, message: expect.stringContaining("큰따옴표와 쉼표") });
    expect(parseReviewFile('["title"]')).toEqual({ ok: false, message: expect.stringContaining("중괄호") });
  });
});

describe("serializeReviewFile", () => {
  it("항목을 늘 같은 순서로, 두 칸 들여쓰기 JSON으로 적고 끝에 줄바꿈을 붙인다", () => {
    // 원고 → 값(JSON.parse) → 검사(parse) → 다시 원고(serializeReviewFile)가 글자 하나까지 같아야 해요.
    expect(serializeReviewFile(parse(JSON.parse(SOURCE)))).toBe(SOURCE);
  });

  it("값이 없는 선택 항목은 줄 자체를 쓰지 않는다", () => {
    // 선택 항목(image)을 꺼내 버리고 나머지(...required)만 남겨요. void는 "안 쓰는 변수" 경고를 피하는 표시예요.
    const { image, ...required } = JSON.parse(SOURCE);
    void image;
    const text = serializeReviewFile(parse(required));
    expect(text).not.toContain("image");
  });

  it("따옴표·줄바꿈 같은 특별한 글자도 다시 읽으면 같은 값이다", () => {
    // JSON.stringify가 큰따옴표는 \"로, 줄바꿈은 \n으로 바꿔 적어 주는지, 다시 읽으면 원래대로 돌아오는지 봐요.
    const fields = parse({ ...JSON.parse(SOURCE), title: '그 "말"', oneLiner: "첫 줄\n둘째 줄" });
    const parsed = parseReviewFile(serializeReviewFile(fields));
    expect(parsed.ok && parsed.values).toMatchObject({ title: '그 "말"', oneLiner: "첫 줄\n둘째 줄" });
  });
});
