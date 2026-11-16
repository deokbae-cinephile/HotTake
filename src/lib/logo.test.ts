/**
 * @file logo.ts 테스트
 *
 * 로고 그림을 손으로 고치다가 줄 길이가 어긋나면(칸을 하나 빠뜨리면) 그림이 비뚤어져요.
 * 모든 줄의 칸 수가 같은지, 쓰는 글자가 '#'과 '.'뿐인지 확인해요.
 * 머리글에서 이름 글자와 높이가 맞도록 크기(12 × 11칸)와 테두리도 확인해요.
 *
 * 테스트 도구 문법
 *   describe(이름, 함수): 테스트 묶음. it(이름, 함수): 테스트 하나.
 *   expect(값).toBe(기대): 값이 기대와 같은지(===) 확인해요. toEqual은 배열·객체의 내용을 비교해요.
 *   expect(글자).toContain("#"): 글자 안에 "#"이 들어 있는지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { LOGO_ROWS } from "./logo";

describe("LOGO_ROWS", () => {
  it("모든 줄의 칸 수가 같다", () => {
    // 줄마다 길이를 구해 Set(같은 값은 한 번만 담는 모음)에 넣어요. 모두 같으면 Set에 하나만 남아요.
    const widths = new Set(LOGO_ROWS.map((row) => row.length));
    expect(widths.size).toBe(1);
  });

  it("'#'(칠한 칸)과 '.'(빈칸)만 쓴다", () => {
    // every: 모든 줄이 조건을 만족하면 true. /^[#.]+$/: 처음부터 끝까지 '#' 또는 '.'만 1개 이상
    expect(LOGO_ROWS.every((row) => /^[#.]+$/.test(row))).toBe(true);
  });
});

describe("LOGO_ROWS 크기", () => {
  it("12 × 11칸이라 머리글(한 칸 2px)에서 24 × 22px로, 20px 이름 글자와 높이가 맞는다", () => {
    // [가로 칸 수, 세로 칸 수]
    expect([LOGO_ROWS[0].length, LOGO_ROWS.length]).toEqual([12, 11]);
  });

  it("위아래 끝 줄과 왼쪽·오른쪽 끝 칸이 색칠돼 있어, 그림 끝이 곧 요소 끝이다(머리글의 세로 가운데·로고 ↔ 이름 간격이 그대로)", () => {
    // at(0): 첫 줄, at(-1): 마지막 줄(음수는 뒤에서부터 세요)
    expect(LOGO_ROWS.at(0)).toContain("#");
    expect(LOGO_ROWS.at(-1)).toContain("#");
    // some: 한 줄이라도 조건을 만족하면 true. 왼쪽 끝 칸이 색칠된 줄이 있는지, 오른쪽 끝 칸이 색칠된 줄이 있는지 봐요.
    expect(LOGO_ROWS.some((row) => row.startsWith("#"))).toBe(true);
    expect(LOGO_ROWS.some((row) => row.endsWith("#"))).toBe(true);
  });
});
