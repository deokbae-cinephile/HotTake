/**
 * @file review.ts 테스트
 *
 * "최신순" 정렬 규칙(compareLatest)이
 *   - 같은 날 쓴 글끼리는 시각으로 가르는지(나중에 쓴 글이 앞)
 *   - 날짜만 적힌 원고는 그날 0시로 봐서, 같은 날 시각까지 적힌 글보다 뒤에 오는지
 *   - 시각까지 같으면 제목 가나다순인지
 * 확인해요. 목록 화면의 "최신순"이 이 규칙을 그대로 써서, 여기가 틀리면 목록 순서가 뒤섞여요.
 *
 * 테스트 도구(Vitest) 문법
 *   - describe("묶음 이름", () => { ... }) : 관련 있는 테스트를 한 묶음으로 모아요.
 *   - it("확인하는 일", () => { ... })     : 테스트 하나. 이름은 "무엇을 확인하는지" 문장으로 적어요.
 *   - expect(실제 값).toEqual(기대 값)     : 배열·객체의 "내용"이 같은지 비교해요.
 *   - expect(실제 값).toBe(기대 값)        : 숫자·글자처럼 단순한 값이 같은지 비교해요.
 */

import { describe, expect, it } from "vitest";

import { compareLatest, publishedTime } from "./review";

/**
 * 정렬에 필요한 항목만 있는 가짜 리뷰를 만들어요.
 * 화살표 함수가 `({ ... })`처럼 괄호로 감싼 객체를 돌려줘요(괄호가 없으면 { }를 함수 몸통으로 읽어요).
 * `{ title, publishedAt }`은 `{ title: title, publishedAt: publishedAt }`을 줄여 쓴 모양이에요.
 */
const item = (title: string, publishedAt: string) => ({ title, publishedAt, rating: 4 });

describe("compareLatest", () => {
  it("같은 날 쓴 글은 나중에 쓴 글이 앞에 온다(제목 순서와 상관없이)", () => {
    const shutter = item("셔터 아일랜드", "2026-11-14T17:12:40+09:00");
    const phone = item("폰 부스", "2026-11-14T19:35:48+09:00");
    // .sort로 정렬한 뒤 .map으로 제목만 뽑아 순서를 비교해요.
    expect([shutter, phone].sort(compareLatest).map((review) => review.title)).toEqual(["폰 부스", "셔터 아일랜드"]);
  });

  it("날짜만 적힌 원고는 그날 0시로 보고, 날짜가 다르면 최근 날짜가 앞이며, 시각까지 같으면 가나다순이다", () => {
    // 일부러 뒤섞어 둔 순서예요. "라 저녁"만 시각이 있고, 나머지는 날짜만 있어요.
    const reviews = [
      item("나 지난 글", "2026-11-13"),
      item("다 날짜만", "2026-11-14"),
      item("가 날짜만", "2026-11-14"),
      item("라 저녁", "2026-11-14T20:00:00+09:00"),
    ];
    expect(reviews.sort(compareLatest).map((review) => review.title)).toEqual(["라 저녁", "가 날짜만", "다 날짜만", "나 지난 글"]);
  });
});

describe("publishedTime", () => {
  it("날짜만 있으면 한국 시간 0시, 시각이 있으면 그 순간(ms)이다", () => {
    // 한국 시간(+09:00) 11월 14일 0시는 세계 표준시(Z, UTC)로 11월 13일 15시예요.
    expect(publishedTime("2026-11-14")).toBe(Date.parse("2026-11-13T15:00:00Z"));
    expect(publishedTime("2026-11-14T19:35:48+09:00")).toBe(Date.parse("2026-11-14T10:35:48Z"));
  });
});
