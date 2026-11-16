/**
 * @file 단위 테스트 준비 (vitest.setup.ts)
 * 읽는 순서: 73/84번째 · 8단계(설정·테스트·배포)
 *   앞: vitest.config.mts → 다음: src/test/review-mocks.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   테스트에 필요한 준비를 한곳에 모아요.
 *   1. 화면용 확인 함수(toBeInTheDocument 등)를 expect에 더해요.
 *   2. 테스트가 끝날 때마다 그린 화면을 치워요.
 *   3. jsdom(가짜 브라우저)에 없는 브라우저 기능(scrollIntoView, <dialog>, matchMedia)을 흉내 내 채워요.
 *
 * 누가 쓰나요?
 *   vitest.config.mts의 setupFiles가 이 파일을 가리켜서, 모든 테스트 파일보다 먼저 한 번 실행돼요.
 *   테스트 파일이 직접 import하지는 않아요.
 */

// toBeInTheDocument(), toHaveAttribute() 같은 "화면용 확인 함수"를 expect에 더해요.
import "@testing-library/jest-dom/vitest";
// cleanup: Testing Library가 render로 그린 화면을 모두 치우는 함수
import { cleanup } from "@testing-library/react";
// afterEach: 테스트 하나가 끝날 때마다 부를 함수를 등록해요. vi: Vitest의 흉내(mock) 도구 모음이에요.
import { afterEach, vi } from "vitest";

// 테스트가 하나 끝날 때마다 그려 둔 화면을 치워요. 다음 테스트가 깨끗한 화면에서 시작해요.
// (Vitest의 globals 설정을 쓰지 않아 Testing Library가 자동으로 치우지 못해서, 여기서 직접 등록해요.)
afterEach(cleanup);

// jsdom(가짜 브라우저)은 화면을 실제로 그리지 않아서 스크롤 기능인 scrollIntoView가 없어요.
// 글쓰기 화면(components/review-writer.tsx)이 가장 위의 틀린 칸으로 옮겨 갈 때 scrollIntoView를 불러서,
// 테스트가 "함수가 없다"는 오류로 멈추지 않도록 아무 일도 하지 않는 가짜를 넣어 둬요.
// vi.fn(): 불려도 아무 일도 하지 않고 "몇 번, 무엇으로 불렸는지"만 기록하는 가짜 함수예요.
// Element.prototype에 넣으면 모든 요소가 이 함수를 함께 써요.
// typeof window !== "undefined": 서버 코드 테스트(window가 없는 node 환경)에서는 건너뛰어요.
if (typeof window !== "undefined") {
  Element.prototype.scrollIntoView = vi.fn();
}

// jsdom에는 <dialog>의 showModal()과 close()가 아직 없어요. 리뷰 지우기 확인 창(delete-review.tsx)을 시험하려고
// "열림(open 속성) 붙이기·떼기 + close 이벤트 알리기"만 하는 간단한 흉내를 넣어 둬요.
// !HTMLDialogElement.prototype.showModal: 이미 있으면(jsdom이 나중에 지원하면) 진짜를 그대로 써요.
// function 안의 `this: HTMLDialogElement`는 매개변수가 아니라 "this가 무슨 타입인지" 알려 주는 TypeScript 표기예요.
if (typeof window !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    // 이미 닫혀 있으면 아무것도 하지 않아요(진짜 브라우저도 이때는 close 이벤트를 보내지 않아요).
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom(가짜 브라우저)에는 matchMedia가 없어요. 앱 설치 안내(install-prompt.tsx)가
// "앱으로 열었는지"를 matchMedia로 확인하므로, 늘 "아니요(matches: false)"라고 답하는 가짜를 넣어 둬요.
// 다른 답이 필요한 테스트는 그 테스트 안에서 window.matchMedia를 바꿔 써요.
// 서버 코드 테스트(맨 위에 `@vitest-environment node`를 적은 파일)에는 window가 없으니 건너뛰어요.
// Object.defineProperty: 객체에 속성을 정해서 넣어요. writable·configurable을 true로 해야 테스트가 나중에 바꿔 끼울 수 있어요.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
