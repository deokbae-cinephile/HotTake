/**
 * @file 검색엔진용 사이트 정보 (structured-data.ts)
 * 읽는 순서: 27/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/floating-buttons.tsx → 다음: src/proxy.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   검색엔진(구글·네이버 등)이 "이 사이트가 무엇인지" 정확히 알 수 있게, 정해진 모양의 정보(JSON-LD)를 만들어요.
 *   처음 화면(app/page.tsx)의 <script type="application/ld+json">에 넣어요. 화면에는 보이지 않아요.
 *
 * JSON-LD와 schema.org
 *   schema.org는 검색엔진들이 함께 정한 "정보의 이름표 사전"이에요(예: WebSite = 웹사이트, name = 이름).
 *   JSON-LD는 그 이름표를 JSON 모양으로 적는 방법이에요. "@context"에 사전 주소를, "@type"에 종류를 적어요.
 *
 * 누가 쓰나요?
 *   app/page.tsx(처음 화면)
 */

import { site, siteUrl } from "./site";

/**
 * 처음 화면의 검색엔진용 정보(schema.org WebSite). 검색 결과에 사이트 이름을 바르게 보이게 도와요.
 *
 * @returns JSON-LD 객체. 예: { "@context": "https://schema.org", "@type": "WebSite", name: "HotTake", ... }
 */
export function websiteJsonLd() {
  // 항목 이름에 @처럼 특별한 글자가 있으면 따옴표로 감싸야 해요("@context"). 보통 이름(name)은 따옴표 없이 써요.
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    // 다른 이름: 머리글에 보이는 "작품 한 줄 평 블로그"
    alternateName: site.headerTitle,
    // 사이트의 대표 주소(끝에 /를 붙인 처음 화면 주소)
    url: `${siteUrl}/`,
    // 사이트의 언어(한국어, 한국)
    inLanguage: "ko-KR",
  };
}

/**
 * 객체를 <script type="application/ld+json"> 안에 넣을 글자로 바꿔요.
 * 글 속에 "</script>" 같은 글자가 있어도 스크립트가 거기서 끝나지 않게 "<"를 "\u003c"로 바꿔요(JSON으로는 같은 글자예요).
 * 브라우저는 <script> 안에서 "</script>"를 보면 JSON 내용과 상관없이 스크립트를 끝내 버려서, 이렇게 미리 막아요.
 *
 * @param data 넣을 객체. `object`는 "아무 객체"라는 타입이에요.
 * @returns <script> 안에 그대로 넣어도 안전한 JSON 글자
 * @example toJsonLd({ a: "</script>" }) // '{"a":"\u003c/script>"}'
 */
export function toJsonLd(data: object): string {
  // /</g: 모든 "<" 글자(g: 전부). 바꿀 글자 "\\u003c"에서 \\는 역슬래시 한 글자예요.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
