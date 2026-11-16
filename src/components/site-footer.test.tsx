/**
 * @file site-footer.tsx 테스트
 *
 * <footer>는 화면 낭독기에서 "contentinfo"(콘텐츠 정보) 역할을 가져요. 그 역할로 찾아 내용을 확인해요.
 * 바닥글 안의 떠 있는 단추(usePathname)와 로그아웃 단추(useRouter)가 Next.js 훅을 써서 가짜를 넣어 줘요.
 *
 * 테스트 도구 문법
 *   - vi.mock("모듈", 함수): 그 모듈을 가짜로 바꿔요. 원래 모듈(importOriginal)을 펼친(...) 위에 필요한 훅만 덮어써요.
 *   - vi.fn(): 아무 일도 하지 않고 불린 기록만 남기는 가짜 함수예요.
 *   - within(바닥글).getByText(…): 바닥글 안에서만 찾아요.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteFooter } from "./site-footer";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SiteFooter", () => {
  it("위쪽 점선 아래 가운데에 저작권 줄('© 2026 deokbae. All rights reserved.')을 둔다", () => {
    render(<SiteFooter />);
    const copyright = within(screen.getByRole("contentinfo")).getByText("© 2026 deokbae. All rights reserved.");
    expect(copyright.tagName).toBe("P");
    expect(copyright).toHaveClass("text-center");
    // 저작권 줄을 감싼 칸의 위쪽 테두리가 점선이에요(목록의 점선과 같은 2px 점선, 선 색).
    expect(copyright.parentElement).toHaveClass("border-t-2", "border-dotted", "border-crt-line");
  });

  // 바닥글에는 설치 안내와 저작권 줄만 있어요. 방문자에게 글쓴이 로그인 길을 드러내지 않으려고 로그인 링크를 두지 않아요.
  it("글쓴이 로그인 링크는 두지 않는다(글쓴이는 /login 주소로 직접 가요)", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByRole("link", { name: /로그인/ })).not.toBeInTheDocument();
  });
});
