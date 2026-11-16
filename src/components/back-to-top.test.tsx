/**
 * @file back-to-top.tsx 테스트
 *
 * jsdom(가짜 브라우저)은 실제로 스크롤하지 않아요. 그래서
 *   - 스크롤 위치(window.scrollY)는 값을 직접 넣고 "scroll" 이벤트를 일으켜 흉내 내요.
 *   - window.scrollTo는 vi.spyOn으로 바꿔, 어떻게 불렸는지만 확인해요.
 *
 * 테스트 도구 문법
 *   - vi.spyOn(객체, "함수 이름"): 원래 함수를 지켜보는 "스파이"로 바꿔요. mockImplementation으로 하는 일도 갈아 끼울 수 있어요.
 *   - vi.restoreAllMocks(): 스파이로 바꾼 함수를 모두 원래대로 돌려놔요(다음 테스트에 영향이 없게).
 *   - beforeEach / afterEach: 각 테스트(it)의 앞·뒤에 매번 도는 준비·뒷정리예요.
 *   - userEvent.setup() + await user.click(…): 진짜 사용자처럼 누르기(마우스 내림·올림, 초점 이동까지)를 흉내 내요.
 *   - toHaveBeenCalledWith(값): 그 함수가 이 값으로 불렸는지 확인해요. toHaveFocus(): 그 요소에 키보드 초점이 있는지 봐요.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackToTop } from "./back-to-top";

/** 스크롤 위치를 바꾸고 "scroll" 이벤트를 일으켜요. act: 그로 인한 화면 바뀜이 끝날 때까지 기다려요. */
function scrollTo(y: number) {
  act(() => {
    // window.scrollY는 원래 읽기만 되는 값이라, defineProperty로 원하는 값을 강제로 넣어요.
    // configurable: true — 다음 호출에서 또 바꿀 수 있게 열어 둬요.
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    fireEvent.scroll(window);
  });
}

describe("BackToTop", () => {
  beforeEach(() => {
    // 가짜 scrollTo: 아무 일도 하지 않고 불린 기록만 남겨요.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollTo(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("맨 위에서는 숨어 있고, 400px 넘게 내려가면 보인다", () => {
    render(<BackToTop />);
    // hidden 속성으로 숨긴 단추는 화면 낭독기에도 없는 것으로 쳐서, 역할(role)로 찾으면 나오지 않아요.
    expect(screen.queryByRole("button", { name: "맨 위로" })).not.toBeInTheDocument();

    scrollTo(401);
    expect(screen.getByRole("button", { name: "맨 위로" })).toBeVisible();

    scrollTo(100);
    expect(screen.queryByRole("button", { name: "맨 위로" })).not.toBeInTheDocument();
  });

  it("누르면 맨 위로 부드럽게 올라가고, 초점을 머리글로 옮긴다", async () => {
    const user = userEvent.setup();
    // 실제 화면처럼 id="top"인 머리글을 함께 그려요. tabIndex={-1}: Tab으로는 가지 않지만 코드로 초점을 줄 수 있어요.
    render(
      <>
        <header id="top" tabIndex={-1}>
          머리글
        </header>
        <BackToTop />
      </>,
    );
    scrollTo(800);

    await user.click(screen.getByRole("button", { name: "맨 위로" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    // header 요소의 역할 이름은 "banner"(머리글 랜드마크)예요.
    expect(screen.getByRole("banner")).toHaveFocus();
  });

  it("'동작 줄이기'를 켠 사용자에게는 움직임 없이 바로 올라간다", async () => {
    const user = userEvent.setup();
    // matchMedia가 "동작 줄이기 켜짐"이라고 답하게 바꿔요(vitest.setup.ts의 기본값은 늘 꺼짐).
    // `as MediaQueryList`: 필요한 항목(matches, media)만 가진 객체를 MediaQueryList 타입으로 봐 달라고 TypeScript에 알려요.
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query }) as MediaQueryList,
    );
    render(<BackToTop />);
    scrollTo(800);

    await user.click(screen.getByRole("button", { name: "맨 위로" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
