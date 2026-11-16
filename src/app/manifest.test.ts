/**
 * @file manifest.ts 테스트
 *
 * 앱으로 설치하는 데 꼭 필요한 정보가 들어 있는지 확인해요.
 * (브라우저가 설치를 허락하려면 이름, 시작 주소, 앱 창 방식, 192·512 아이콘이 있어야 해요.)
 *
 * 테스트 도구 문법
 *   - manifest(): 화면에 그리는 컴포넌트가 아니라 객체를 돌려주는 보통 함수라, render 없이 바로 불러 결과를 확인해요.
 *   - toMatchObject(객체): 결과에 이 항목들이 "같은 값으로 들어 있기만" 하면 맞아요(다른 항목이 더 있어도 괜찮아요).
 *   - toEqual(배열): 내용이 "모두 똑같아야" 맞아요(항목이 하나라도 더 있거나 순서가 다르면 실패).
 */

import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  it("이름, 시작 주소, 앱 창 방식, 색을 정한다", () => {
    expect(manifest()).toMatchObject({
      name: "HotTake",
      short_name: "HotTake",
      lang: "ko",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#020802",
      theme_color: "#020802",
    });
  });

  it("192·512 아이콘과 모양 잘림용(maskable) 아이콘을 상대 주소로 적는다", () => {
    expect(manifest().icons).toEqual([
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});
