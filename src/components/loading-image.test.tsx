/**
 * @file loading-image.tsx 테스트
 *
 * 그림이 오기 전에는 스켈레톤을 깔아 두고, 그림이 오면(load) 스켈레톤을 치우는지,
 * 받지 못하면(error) 스켈레톤을 치우고 대신 보일 것(기본 이미지)으로 바꾸는지 확인해요.
 * 넘겨받은 onLoad·onError도 그대로 불러 주는지 봐요.
 *
 * 테스트 도구 문법
 *   - vi.fn(): 가짜 함수를 만들어요. 몇 번, 어떤 값으로 불렸는지 기록해 둬서 toHaveBeenCalledTimes(1)로 확인할 수 있어요.
 *   - fireEvent.load / fireEvent.error: 그림이 "다 옴" / "받지 못함" 사건을 일으킨 것처럼 꾸며요(jsdom은 실제로 그림을 받지 않아요).
 *   - waitFor(() => expect(...)): 확인이 통과할 때까지 잠깐씩 다시 해 봐요. 상태가 바뀌어 다시 그려지기를 기다릴 때 써요.
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoadingImage } from "./loading-image";

describe("LoadingImage", () => {
  it("그림이 오기 전에는 숨긴 스켈레톤을 깔아 두고, 그림이 오면 치운다", async () => {
    const onLoad = vi.fn();
    const { container } = render(<LoadingImage src="/images/test-pattern.png" alt="" fill sizes="64px" onLoad={onLoad} />);
    // 처음에는 스켈레톤(.skeleton)이 있고, 꾸밈이라 화면 낭독기에서 숨어 있어야 해요.
    const skeleton = container.querySelector(".skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");

    // next/image는 그림을 다 풀어낸 다음(decode)에 onLoad를 불러서, 조금 기다려요(waitFor).
    fireEvent.load(container.querySelector("img")!);
    await waitFor(() => expect(container.querySelector(".skeleton")).toBeNull());
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("그림을 받지 못하면 스켈레톤을 치우고 대신 보일 것(기본 이미지)으로 바꾼다", async () => {
    const onError = vi.fn();
    const { container, getByText } = render(
      <LoadingImage src="/images/missing.png" alt="" fill sizes="64px" onError={onError} fallback={<span>NO IMAGE</span>} />,
    );
    fireEvent.error(container.querySelector("img")!);
    // 대신 보일 것(fallback)이 나오고, 스켈레톤과 깨진 그림(img)은 둘 다 사라져야 해요.
    await waitFor(() => expect(getByText("NO IMAGE")).toBeInTheDocument());
    expect(container.querySelector(".skeleton")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
