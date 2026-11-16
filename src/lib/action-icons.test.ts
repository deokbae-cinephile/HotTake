/**
 * @file action-icons.ts 테스트
 *
 * 아이콘 그림을 손으로 고치다가 줄 길이가 어긋나면(칸을 하나 빠뜨리면) 그림이 비뚤어져요.
 * 두 그림 모두 '#'과 '.'만 쓰고 24 × 24칸인지, 그려지는 크기가 GitHub 아이콘(12칸 × 2px)과 같은 24px인지 확인해요.
 *
 * 테스트 도구 문법
 *   it.each([[이름, 값], ...])(제목, 함수): 배열의 짝마다 같은 테스트를 되풀이해요.
 *     제목의 %s 자리에 짝의 첫 값(이름)이 들어가고, 함수는 짝의 값들을 차례로 받아요.
 *   expect(값).toEqual(기대): 내용이 같은지, toHaveLength(n): 길이가 n인지 확인해요.
 */

import { describe, expect, it } from "vitest";

import { ACTION_ICON_CELL, DELETE_ICON_ROWS, EDIT_ICON_ROWS } from "./action-icons";
import { GITHUB_MARK_ROWS } from "./github-mark";

/** 머리글의 GitHub 아이콘은 한 칸 2px로 그려요(components/site-header.tsx). */
const GITHUB_MARK_CELL = 2;

describe("수정·삭제 아이콘 그림", () => {
  it.each([
    ["수정(문서와 연필)", EDIT_ICON_ROWS],
    ["삭제(꽉 찬 통)", DELETE_ICON_ROWS],
  ])("%s은 '#'과 '.'만 쓰는 24 × 24칸이고, GitHub 아이콘과 같은 24px로 그려진다", (_name, rows) => {
    // _name: 제목에만 쓰고 여기서는 쓰지 않는 값이라 이름 앞에 _를 붙였어요(린트 도구에 "일부러 안 써요"라고 알리는 관례).
    // 모든 줄이 '#'·'.'만 쓰는지
    expect(rows.every((row) => /^[#.]+$/.test(row))).toBe(true);
    // 모든 줄의 길이가 24인지(줄 길이를 Set에 모으면 24 하나만 남아야 해요)
    expect(new Set(rows.map((row) => row.length))).toEqual(new Set([24]));
    expect(rows).toHaveLength(24);
    // 그려지는 높이(칸 수 × 한 칸 px)가 GitHub 아이콘과 같은지: 24 × 1 = 12 × 2
    expect(rows.length * ACTION_ICON_CELL).toBe(GITHUB_MARK_ROWS.length * GITHUB_MARK_CELL);
  });
});
