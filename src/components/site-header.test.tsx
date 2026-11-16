/**
 * @file site-header.tsx 테스트
 *
 * 머리글이 블로그 이름(처음 화면 링크)과 GitHub 아이콘 링크만 보이는지 확인해요(버전 글자는 머리글에 없어요).
 * 리뷰 추가 단추는 머리글이 아니라 화면 오른쪽 아래에 떠 있어요(floating-buttons.test.tsx).
 *
 * 테스트 도구 문법
 *   - within(요소).getByText(…): 화면 전체가 아니라 그 요소 안에서만 찾아요.
 *   - for (const [link, size] of [...] as const): 배열의 [링크, 크기] 쌍을 하나씩 꺼내 같은 확인을 되풀이해요.
 *     `as const`는 크기 배열을 ["24", "22"] 그대로의 값으로 고정해, toEqual에 넘길 때 타입이 맞게 해요.
 *   - container.not.toHaveTextContent(/\(v\d/): 그린 글자 어디에도 "(v숫자" 모양이 없어야 해요(정규식).
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "./site-header";

/** 처음 화면 링크의 이름: 블로그 이름(lib/site.ts의 headerTitle) */
const HOME = "작품 한 줄 평 블로그";

describe("SiteHeader", () => {
  afterEach(() => {
    // 로그인 표시 쿠키를 지워 다음 테스트가 로그인 전 상태에서 시작하게 해요.
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("블로그 이름(작품 한 줄 평 블로그)이 처음 화면으로 가는 링크이고, 짧은 소개 문구는 없다", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: HOME })).toHaveAttribute("href", "/");
  });

  it("왼쪽 로고는 24 × 22px, 오른쪽 GitHub 아이콘은 24 × 24px로 그리고, 둘 다 읽지 않는 꾸밈이다", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: HOME });
    const github = screen.getByRole("link", { name: "GitHub" });
    for (const [link, size] of [
      [home, ["24", "22"]],
      [github, ["24", "24"]],
    ] as const) {
      const icon = link.querySelector("svg")!;
      expect([icon.getAttribute("width"), icon.getAttribute("height")]).toEqual(size);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    // 아이콘이 본문 양 끝·같은 줄에 있는지는 진짜 브라우저 E2E에서 재요(e2e/blog.spec.ts).
  });

  it("로고 옆에 버전(예: '(v2.0.0)')을 보이지 않는다", () => {
    const { container } = render(<SiteHeader />);
    expect(container).not.toHaveTextContent(/\(v\d/);
  });

  it("오른쪽에 소스 코드 저장소로 가는 GitHub 링크를 아이콘만 보이게 두고, 글자 'GitHub'는 화면 낭독기용으로 남긴다", () => {
    render(<SiteHeader />);
    // 링크 이름은 "GitHub"(화면 낭독기용 글자)예요.
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/deokbae-cinephile/HotTake");
    // 같은 창에서 열어요(예고 없는 새 창을 만들지 않아요).
    expect(link).not.toHaveAttribute("target");
    // 글자 "GitHub"는 화면에서 숨겨요(sr-only). 화면에는 아이콘만 보여요.
    expect(within(link).getByText("GitHub")).toHaveClass("sr-only");
    // 아이콘은 링크 이름과 같은 뜻이라 꾸밈(aria-hidden)이에요.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("로그인해도 머리글에는 리뷰 추가 링크가 없다(리뷰 추가는 오른쪽 아래의 떠 있는 + 단추)", () => {
    // 로그인 표시 쿠키를 넣어 로그인한 상태를 흉내 내요.
    document.cookie = "blog_admin=1; path=/";
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: /추가|새 리뷰/ })).not.toBeInTheDocument();
    // 링크는 블로그 이름과 GitHub 두 개뿐이에요.
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
