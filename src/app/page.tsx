/**
 * @file 처음 화면 = 작품 목록 (app/page.tsx → 주소 "/")
 * 읽는 순서: 17/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/loading-status.tsx → 다음: src/lib/browse.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   블로그에 들어오면 처음 보이는 화면이에요. 검색·분류·정렬과 작품 목록을 보여 줍니다.
 *
 * Next.js 약속: app 폴더의 page.tsx
 *   app/page.tsx는 주소 "/"의 페이지가 돼요. (app/write/page.tsx는 "/write"가 되고요.)
 *   폴더 구조가 곧 주소 구조예요.
 *
 * 서버 컴포넌트
 *   이 컴포넌트는 "use client"가 없으니 서버 컴포넌트예요. 빌드할 때 한 번 실행돼서 HTML로 만들어져요.
 *   그래서 서버에서만 되는 일(원고 파일 읽기)을 여기서 할 수 있어요.
 *   읽은 목록을 클라이언트 컴포넌트(ReviewBrowser)에 넘기면, 브라우저에서 검색·필터가 동작해요.
 *
 * 흐름
 *   빌드 → getReviews()로 원고(content/reviews/*.json) 읽기 → <ReviewBrowser>에 넘기기 → HTML 완성
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 주소 "/"를 열 때 이 파일의 대표 내보내기(export default)를 그려요.
 */

import type { Metadata } from "next";

// ReviewBrowser: 검색창·분류·정렬과 목록을 그리는 클라이언트 컴포넌트
import { ReviewBrowser } from "@/components/review-browser";
// getReviews: 원고 JSON을 모두 읽어 검사한 뒤 최신순 목록으로 돌려주는 함수
import { getReviews } from "@/lib/review-data";
import { site } from "@/lib/site";
// websiteJsonLd: 검색엔진용 사이트 정보 객체, toJsonLd: 그것을 <script>에 넣어도 안전한 JSON 글자로 바꾸는 함수
import { toJsonLd, websiteJsonLd } from "@/lib/structured-data";

/**
 * 이 페이지의 메타데이터
 * canonical(대표 주소): "/?category=movie"처럼 조건만 다른 주소가 여러 개여도 검색엔진에는 "/"가 대표라고 알려 줘요.
 * 제목은 따로 정하지 않아 layout.tsx의 기본값("HotTake")을 써요.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * 처음 화면 컴포넌트
 *
 * `async`: 원고 읽기를 기다려야(await) 해서 비동기 함수예요. 서버 컴포넌트는 async로 만들 수 있어요.
 *
 * @returns sr-only 제목(h1), 검색엔진용 정보, 목록 화면(ReviewBrowser)
 */
export default async function HomePage() {
  // 모든 리뷰를 최신순으로 읽어요(lib/review-data.ts).
  const reviews = await getReviews();

  return (
    // <>…</>: Fragment. 여러 요소를 감싸는 요소 없이 한 묶음으로 돌려줘요.
    <>
      {/* 페이지의 가장 큰 제목(h1). 눈에 보이는 제목은 머리글의 블로그 이름이 대신해서, 화면에서는 숨기고(sr-only)
          화면 낭독기 사용자가 제목으로 페이지를 알아볼 수 있게 해요. 한 페이지에 h1은 하나만 둡니다. */}
      <h1 className="sr-only">{site.name}</h1>
      {/* 검색엔진용 사이트 정보(JSON-LD). 화면에는 보이지 않아요(lib/structured-data.ts).
          dangerouslySetInnerHTML: 글자를 HTML 그대로 넣는 React 속성이에요. 이름처럼 위험할 수 있어서,
          넣는 글자는 toJsonLd가 "</script>" 같은 위험한 글자를 미리 바꿔 둔 것만 써요. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd()) }} />
      {/* 읽은 목록을 reviews 값으로 넘겨요. 이 뒤의 검색·분류는 브라우저에서 동작해요. */}
      <ReviewBrowser reviews={reviews} />
    </>
  );
}
