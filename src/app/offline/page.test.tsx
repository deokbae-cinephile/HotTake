/**
 * @file offline/page.tsx 테스트
 *
 * 좋은 안내 화면인지 확인해요: 무슨 일인지(제목), 지금 할 수 있는 것(안내), 갈 곳(목록 링크)
 * 함께 내보낸 metadata도 불러와, 검색엔진에 올리지 않게 했는지 봐요.
 *
 * 테스트 도구 문법
 *   - import OfflinePage, { metadata } from "./page": 대표 내보내기(default)와 이름 있는 내보내기(metadata)를 함께 가져와요.
 *   - toEqual({ index: false }): 객체 내용이 똑같은지 비교해요(=== 와 달리 같은 객체가 아니어도 내용만 같으면 맞아요).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflinePage, { metadata } from "./page";

describe("OfflinePage", () => {
  it("연결이 끊겼다고 알리고, 한 번 본 리뷰는 읽을 수 있다고 안내하며 목록 링크를 둔다", () => {
    render(<OfflinePage />);
    expect(screen.getByRole("heading", { level: 1, name: "인터넷에 연결되어 있지 않습니다" })).toBeInTheDocument();
    expect(screen.getByText(/한 번 열어 본 리뷰는 지금도 읽을 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로 가기" })).toHaveAttribute("href", "/");
  });

  it("검색엔진에는 올리지 않는다", () => {
    expect(metadata.robots).toEqual({ index: false });
  });
});
