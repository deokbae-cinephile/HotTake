/**
 * @file review-form.ts 테스트
 *
 * 글쓰기 칸 검사가 빌드할 때의 원고 검사와 같은 규칙으로, 칸 이름으로 된 문구를 돌려주는지 확인해요.
 * 또 새 리뷰의 "글 쓴 날"에 한국 시간이 시각까지 들어가는지(nowInSeoul) 확인해요.
 *
 * 테스트 도구 문법
 *   - describe / it / expect      : 테스트 묶음 / 테스트 하나 / 값 확인
 *   - toEqual / toBe              : 내용이 같은지 / 값이 똑같은지
 *   - toMatchObject               : 적은 항목만 같은지(나머지 항목은 상관없어요)
 *   - it.each([...])("%s ...")    : 같은 테스트를 값만 바꿔 여러 번 돌려요. %s 자리에 값이 차례로 들어가요.
 *
 * now 인자
 *   검사는 "글 쓴 날"이 비어 있으면 지금 시각을 넣어요. 테스트는 시각을 고정(now: "2026-11-13")해서
 *   언제 돌려도 같은 결과가 나오게 해요.
 */

import { describe, expect, it } from "vitest";

import { EMPTY_VALUES, type ReviewFormValues } from "./review-values";
import { FIELD_MESSAGES, nowInSeoul, validateReviewForm } from "./review-form";

/** 꼭 필요한 칸을 모두 채운 올바른 값. `...EMPTY_VALUES`로 모든 칸을 ""로 깔고 필요한 칸만 덮어써요. */
const valid: ReviewFormValues = {
  ...EMPTY_VALUES,
  slug: "winter-stop",
  title: "겨울 정류장",
  year: "2024",
  creator: "한서윤",
  category: "영화",
  rating: "4.5",
  oneLiner: "기다림은 끝내 도착한다.",
};

describe("validateReviewForm", () => {
  it("빈 칸이면 꼭 채워야 하는 칸마다 칸 이름으로 된 문구를 돌려준다", () => {
    const result = validateReviewForm(EMPTY_VALUES, { checkSlug: true, now: "2026-11-13" });
    expect(result).toEqual({
      ok: false,
      errors: {
        slug: FIELD_MESSAGES.slug,
        title: FIELD_MESSAGES.title,
        year: FIELD_MESSAGES.year,
        creator: FIELD_MESSAGES.creator,
        category: FIELD_MESSAGES.category,
        rating: FIELD_MESSAGES.rating,
        oneLiner: FIELD_MESSAGES.oneLiner,
      },
    });
  });

  it("통과하면 원고에 넣을 정보를 돌려주고, 글 쓴 날이 비어 있으면 오늘 날짜를 넣는다", () => {
    const result = validateReviewForm(valid, { checkSlug: true, now: "2026-11-13" });
    expect(result).toEqual({
      ok: true,
      fields: {
        title: "겨울 정류장",
        year: 2024,
        creator: "한서윤",
        category: "영화",
        rating: 4.5,
        oneLiner: "기다림은 끝내 도착한다.",
        publishedAt: "2026-11-13",
      },
    });
  });

  it("불러온 원고의 글 쓴 날과 선택 칸(이미지)은 그대로 넣는다", () => {
    const result = validateReviewForm(
      {
        ...valid,
        publishedAt: "2026-01-02",
        image: "winter-stop.jpg",
      },
      { checkSlug: true, now: "2026-11-13" },
    );
    expect(result.ok && result.fields).toMatchObject({
      publishedAt: "2026-01-02",
      image: "winter-stop.jpg",
    });
  });

  // [칸 이름, 넣어 볼 틀린 값] 짝들이에요. 끝의 `as const`로 칸 이름이 정확한 글자 타입("year" 등)으로 잡혀요.
  it.each([
    ["year", "이천이십사"],
    ["year", "999"],
    ["category", "음악"],
    ["rating", "4.3"],
    ["rating", "0"],
  ] as const)("%s 칸의 %s는 받지 않는다", (field, value) => {
    // 분류에 목록에 없는 글자("음악")를 넣어 보려고 칸 값 타입으로 맞춰 넘겨요(as).
    // `[field]: value`: 대괄호 안 변수의 값("year" 등)을 항목 이름으로 써요(계산된 속성 이름).
    const result = validateReviewForm({ ...valid, [field]: value } as ReviewFormValues, { checkSlug: true });
    // 실패했고(ok === false) 그 칸에 정해 둔 문구가 달렸는지 봐요.
    expect(result.ok === false && result.errors[field]).toBe(FIELD_MESSAGES[field]);
  });

  // 수정 화면은 파일 이름 칸을 바꾸지 않아서 검사할 필요가 없어요. 새 글이면 한글 이름을 막아요.
  it("수정(checkSlug: false)에서는 파일 이름을 검사하지 않는다", () => {
    expect(validateReviewForm({ ...valid, slug: "" }, { checkSlug: false }).ok).toBe(true);
    expect(validateReviewForm({ ...valid, slug: "겨울" }, { checkSlug: true }).ok).toBe(false);
  });
});

describe("nowInSeoul", () => {
  it("서버 시간대와 상관없이 한국 시간 날짜와 시각을 ISO 모양(+09:00)으로 돌려준다", () => {
    // Date.UTC(년, 월, 일, 시)의 월은 0부터 세요(10 = 11월). UTC 2026-11-12 16:00 = 한국 2026-11-13 01:00
    expect(nowInSeoul(new Date(Date.UTC(2026, 10, 12, 16)))).toBe("2026-11-13T01:00:00+09:00");
    // 한국 자정은 24시가 아니라 00시로 적어요.
    expect(nowInSeoul(new Date(Date.UTC(2026, 10, 13, 15, 0, 5)))).toBe("2026-11-14T00:00:05+09:00");
  });

  it("새 리뷰(글 쓴 날이 빈 칸)에는 지금 시각까지 넣고, 수정은 원래 값을 그대로 둔다", () => {
    const fresh = validateReviewForm({ ...valid, publishedAt: "" }, { checkSlug: true, now: "2026-11-14T19:35:48+09:00" });
    expect(fresh.ok && fresh.fields.publishedAt).toBe("2026-11-14T19:35:48+09:00");
    const kept = validateReviewForm({ ...valid, publishedAt: "2026-11-14" }, { checkSlug: true, now: "2026-11-15T09:00:00+09:00" });
    expect(kept.ok && kept.fields.publishedAt).toBe("2026-11-14");
  });
});
