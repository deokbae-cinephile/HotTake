/**
 * @file install-prompt.tsx 테스트
 *
 * 브라우저마다 다른 세 가지 경우를 흉내 내어 확인해요.
 *   1. 크롬 계열: beforeinstallprompt 이벤트가 오면 [앱으로 설치] 단추 → 누르면 설치 창(prompt)
 *   2. 아이폰·아이패드: 공유 단추 안내 글
 *   3. 이미 앱으로 열었을 때: 아무것도 보이지 않음
 *
 * 흉내 내는 방법
 *   - vi.spyOn(navigator, "userAgent", "get"): 브라우저 이름표(userAgent)를 읽을 때 우리가 정한 값을 돌려줘요.
 *   - window.dispatchEvent(이벤트): 브라우저가 이벤트를 보낸 것처럼 흉내 내요.
 *   - act(...): 화면을 바꾸는 일(상태 바꾸기)을 React가 다 처리할 때까지 기다려요.
 *   - toHaveBeenCalledOnce(): 가짜 함수가 딱 한 번 불렸는지 확인해요.
 *   - toBeEmptyDOMElement(): 그린 결과가 텅 비었는지(아무것도 보이지 않는지) 확인해요.
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "./install-prompt";

/**
 * 크롬이 보내는 beforeinstallprompt 이벤트를 흉내 낸 가짜
 *
 * @returns prompt(가짜 함수)·userChoice(설치함)를 더한 이벤트
 */
function fakeInstallEvent() {
  // cancelable: true — preventDefault()로 막을 수 있는 이벤트로 만들어요(막았는지 defaultPrevented로 확인하려고요).
  const event = new Event("beforeinstallprompt", { cancelable: true });
  // Object.assign(대상, 더할 것): 이벤트 객체에 prompt·userChoice 항목을 덧붙여 돌려줘요.
  return Object.assign(event, {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
}

/**
 * matchMedia가 "앱으로 열었어요(matches: true)"라고 답하게 바꿔요.
 * 컴포넌트가 쓰는 항목(matches, addEventListener 등)을 모두 가진 가짜 MediaQueryList를 돌려줘요.
 */
function pretendStandalone() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === "(display-mode: standalone)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("InstallPrompt", () => {
  // 테스트마다 바꾼 흉내(spyOn)를 원래대로 돌려놓아요.
  afterEach(() => vi.restoreAllMocks());

  it("처음에는(설치 이벤트가 오기 전) 아무것도 보이지 않는다", () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("크롬 계열에서 설치 이벤트가 오면 [앱으로 설치] 단추를 보이고, 누르면 설치 창을 띄운다", async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);

    const event = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    // 브라우저가 스스로 띄우는 안내는 막았는지(preventDefault)
    expect(event.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "앱으로 설치" }));
    expect(event.prompt).toHaveBeenCalledOnce();
    // 설치 창은 한 번만 띄울 수 있어서, 누른 뒤에는 단추가 사라져요.
    expect(screen.queryByRole("button", { name: "앱으로 설치" })).not.toBeInTheDocument();
  });

  it("아이폰에서는 공유 단추로 홈 화면에 추가하라고 안내한다", () => {
    // 셋째 값 "get": userAgent를 "읽을 때"를 가로채요. mockReturnValue로 아이폰 Safari의 이름표를 돌려줘요.
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    render(<InstallPrompt />);
    expect(screen.getByText(/공유 단추를 누르고 ‘홈 화면에 추가’를 고르면/)).toBeInTheDocument();
  });

  it("이미 앱으로 열었으면 아무것도 보이지 않는다", () => {
    // 원래 matchMedia를 맡아 뒀다가 테스트 끝에 되돌려요(직접 바꿔 넣어서 restoreAllMocks로는 돌아오지 않아요).
    const original = window.matchMedia;
    pretendStandalone();
    const { container } = render(<InstallPrompt />);
    act(() => {
      window.dispatchEvent(fakeInstallEvent());
    });
    expect(container).toBeEmptyDOMElement();
    window.matchMedia = original;
  });
});
