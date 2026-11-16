/**
 * @file structured-data.ts 테스트
 *
 * 검색엔진용 사이트 정보(JSON-LD)가
 *   - 사이트 이름(HotTake)과 다른 이름, 주소를 담는지
 *   - <script> 안에 넣어도 "</script>"로 끊기지 않게 바꾸는지
 * 확인해요.
 *
 * 테스트 도구 문법
 *   - toMatchObject : 적은 항목만 같은지 봐요(@context 같은 다른 항목은 상관없어요).
 *   - not.toContain : 글자 안에 그 글자가 "없는지" 확인해요.
 */

import { describe, expect, it } from "vitest";

import { toJsonLd, websiteJsonLd } from "./structured-data";

describe("websiteJsonLd · toJsonLd", () => {
  it("사이트 이름(HotTake)과 다른 이름(작품 한 줄 평 블로그), 주소를 담는다", () => {
    expect(websiteJsonLd()).toMatchObject({ "@type": "WebSite", name: "HotTake", alternateName: "작품 한 줄 평 블로그", url: "https://deokbae.blog/" });
  });

  it("<를 \\u003c로 바꿔 </script>로 끊기지 않게 하고, 다시 읽으면 같은 값이다", () => {
    // 나쁜 사람이 스크립트를 끼워 넣으려는 글자를 일부러 넣어 봐요.
    const text = toJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    // JSON으로 다시 읽으면 \u003c가 "<"로 돌아와 원래 값과 같아야 해요.
    expect(JSON.parse(text)).toEqual({ description: "</script><script>alert(1)</script>" });
  });
});
