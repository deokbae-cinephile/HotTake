/**
 * @file review-image.tsx 테스트
 *
 * 확인할 것
 *   1. 형광 초록 필터 클래스가 붙는지(원본 파일은 그대로, 화면에서만 바뀌어요)
 *   2. 이미지 최적화를 거쳐 줄인 파일 주소(/_next/image?url=...)를 쓰는지
 *   3. 늘 꾸밈 그림인지: 그림은 alt="", 기본 이미지는 aria-hidden(옆의 제목이 같은 뜻을 알려 줘요)
 *   4. 이미지가 없으면 기본 이미지(픽셀 아이콘, 큰 크기는 NO IMAGE 글자)를 보이는지
 *   5. 상자는 늘 가로 2 : 세로 3 비율인지
 *   6. 그림을 받지 못하면 기본 이미지로 바뀌고, 다른 이미지로 바뀌면 그 그림을 다시 받는지
 *
 * 테스트 도구 문법
 *   - describe("이름", () => {...}): 관련 테스트를 한 묶음으로 모아요.
 *   - it("설명", () => {...}): 테스트 하나. 설명은 "무엇이 어떻게 되어야 한다"로 적어요.
 *   - expect(값).toXxx(...): "값이 이래야 한다"고 확인해요. 다르면 테스트가 실패해요.
 *   - render(<컴포넌트 />): 가상의 화면(jsdom)에 그려요. 돌려받은 container는 그린 결과를 감싼 div예요.
 *   - screen.queryByRole("img"): 역할로 요소를 찾아요. 없으면 null을 돌려줘요(꾸밈 그림은 img 역할로 찾히지 않아요).
 *   - fireEvent.error(요소): 그 요소에서 "error" 사건(그림을 받지 못함)이 일어난 것처럼 꾸며요.
 *   - rerender(<…/>): 같은 자리에 다른 값으로 다시 그려요(값이 바뀌는 상황을 흉내 내요).
 *   - waitFor(() => …) / findByRole: 화면이 바뀔 때까지 조금 기다리며 다시 확인해요(await와 함께 써요).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReviewImage } from "./review-image";

describe("ReviewImage", () => {
  it("그림에 초록 필터 클래스를 붙이고, 이미지 최적화 주소로 받는다", () => {
    const { container } = render(<ReviewImage src="/images/winter-stop.jpg" size="large" />);
    const image = container.querySelector("img")!;
    expect(image).toHaveClass("image-tint");
    // next/image가 화면 크기에 맞게 줄인 파일을 받도록 최적화 주소를 만들어요. 원본 주소는 url= 뒤에 들어가요.
    expect(image.getAttribute("src")).toContain(encodeURIComponent("/images/winter-stop.jpg"));
  });

  it("그림은 꾸밈(alt=\"\")이라 이름 있는 그림으로 읽히지 않는다", () => {
    const { container } = render(<ReviewImage src="/images/winter-stop.jpg" size="thumb" />);
    // 대체 텍스트가 빈 img는 역할이 "presentation"이 되어 img 역할로 찾을 수 없어요.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("이미지가 없으면 기본 이미지를 화면 낭독기에서 숨긴 채 보인다(큰 크기는 NO IMAGE 글자까지)", () => {
    const { container } = render(<ReviewImage size="large" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    const fallback = container.querySelector("[aria-hidden='true']")!;
    expect(fallback).toHaveTextContent("NO IMAGE");
    expect(fallback.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("썸네일의 기본 이미지에는 글자 없이 그림만 있다", () => {
    const { container } = render(<ReviewImage size="thumb" />);
    expect(container).not.toHaveTextContent("NO IMAGE");
    expect(container.querySelector("[aria-hidden='true'] svg")).toBeInTheDocument();
  });

  it("상자는 가로 2 : 세로 3 비율이고, 썸네일은 휴대폰 56px, 넓은 화면 70px로 그린다", () => {
    const { container } = render(<ReviewImage src="/images/a.jpg" size="thumb" />);
    expect(container.firstElementChild).toHaveClass("aspect-[2/3]", "w-14", "sm:w-[4.375rem]");
    // 화면 크기에 맞는 작은 파일을 고르도록 실제 크기를 알려 줘요.
    expect(container.querySelector("img")).toHaveAttribute("sizes", "(min-width: 640px) 70px, 56px");
  });

  it("그림을 받지 못하면 기본 이미지로 바뀌고, 다른 이미지로 바뀌면 그 그림을 다시 받는다", async () => {
    const { container, rerender } = render(<ReviewImage src="/images/a.jpg" size="large" />);
    // `!`: "이 값은 null이 아니에요"라고 TypeScript에 알려 주는 표시예요(없으면 테스트가 어차피 실패해요).
    fireEvent.error(container.querySelector("img")!);
    // waitFor: 기본 이미지로 바뀔 때까지 기다렸다가 확인해요.
    await waitFor(() => expect(container).toHaveTextContent("NO IMAGE"));
    expect(container.querySelector("img")).toBeNull();

    // 같은 자리에 다른 이미지가 오면, 앞의 "받지 못함"이 남지 않고 새 그림과 스켈레톤으로 다시 시작해요.
    rerender(<ReviewImage src="/images/b.jpg" size="large" />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector(".skeleton")).not.toBeNull();
  });
});
