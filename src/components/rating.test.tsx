/**
 * @file rating.tsx 테스트
 *
 * 평점이 별 그림 없이 숫자로 보이고, 화면 낭독기에는 무엇의 숫자인지 알려 주는지 확인해요.
 *
 * 테스트 도구 문법
 *   - render: 가상의 화면(jsdom)에 그려요. screen.getByText("4.0"): 그 글자를 가진 요소를 찾아요(없으면 실패).
 *   - toHaveAttribute(이름, 값): 요소에 그 속성이 그 값으로 붙어 있는지 확인해요.
 *   - toHaveClass(이름): 요소에 그 CSS 클래스가 있는지 확인해요.
 *   - .not.toBeInTheDocument(): 화면에 "없어야" 한다는 뜻이에요(not은 반대로 확인).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Rating } from "./rating";

describe("Rating", () => {
  it("숫자를 소수 한 자리로 보이고, 화면 낭독기에는 '평점 5점 만점에 4점'처럼 읽힌다", () => {
    const { container } = render(<Rating value={4} />);
    expect(screen.getByText("4.0")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("평점 5점 만점에 4.0점")).toHaveClass("sr-only");
    // 별 그림(svg)은 그리지 않아요. 숫자만 보여요.
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("가장 낮은 평점 0.5도 그대로 보인다(0점은 없다)", () => {
    // 평점은 0.5부터 시작해요. 가장 작은 값도 "0.5" 그대로 보이는지 봐요.
    render(<Rating value={0.5} />);
    expect(screen.getByText("0.5")).toBeInTheDocument();
  });
});
