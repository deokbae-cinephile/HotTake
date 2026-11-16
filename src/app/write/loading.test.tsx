/**
 * @file app/write/loading.tsx 테스트
 *
 * 리뷰 추가·수정 화면을 불러오는 동안 "글쓰기 화면을 불러오는 중"을 상태 알림(role=status)으로 알리고,
 * 글쓰기 화면 모양의 스켈레톤을 함께 그리는지 확인해요.
 *
 * 테스트 도구 문법
 *   - getByRole("status"): 상태 안내 영역을 찾아요. toHaveTextContent(/^…$/): 딱 그 글자만 있는지 정규식으로 확인해요.
 *   - container.querySelectorAll(".skeleton").length: 스켈레톤 조각 수. 3개보다 많으면 화면 모양을 그렸다고 봐요.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WriteLoading from "./loading";

describe("글쓰기 로딩 화면", () => {
  it("'글쓰기 화면을 불러오는 중'을 알리고, 스켈레톤을 함께 그린다", () => {
    const { container } = render(<WriteLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/^글쓰기 화면을 불러오는 중$/);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(3);
  });
});
