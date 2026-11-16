/**
 * @file 검색엔진 안내문 (app/robots.ts → 주소 "/robots.txt")
 * 읽는 순서: 69/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/app/sitemap.ts → 다음: scripts/make-icons.mjs (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   검색엔진 로봇에게 "글쓴이 화면 말고는 살펴봐도 좋아요, 사이트맵은 여기 있어요"라고 알려 주는 robots.txt를 만들어요.
 *
 * Next.js 약속
 *   app/robots.ts가 대표 내보내기로 규칙을 돌려주면, Next.js가 robots.txt 파일로 만들어 줘요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 이름(app/robots.ts)을 보고 저절로 /robots.txt로 내보내요.
 *   robots.txt는 "부탁"이에요. 착한 검색엔진은 따르지만, 막는 힘은 없어요(글쓴이 화면은 로그인으로 따로 막아요).
 */

// MetadataRoute.Robots: Next.js가 정해 둔 robots.txt 규칙 객체의 타입
import type { MetadataRoute } from "next";

// siteUrl: 블로그 전체 주소(예: https://deokbae.blog). 사이트맵 주소를 전체 주소로 적으려고 써요.
import { siteUrl } from "@/lib/site";

/** 빌드하면서 파일로 만들어 두라는 표시예요(app/sitemap.ts와 같아요). */
export const dynamic = "force-static";

/**
 * robots.txt 규칙을 돌려줘요.
 *
 * @returns 검색엔진 로봇에게 줄 규칙(rules)과 사이트맵 주소(sitemap)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    // userAgent "*": 모든 검색엔진 로봇에게, allow "/": 모든 페이지를 허락해요.
    // 로그인·글쓰기 화면과 API는 글쓴이만 쓰는 곳이라 검색엔진이 모으지 않게 해요(disallow: 들어오지 말아 주세요).
    // "/write"는 "/write"로 시작하는 주소(/write/<파일 이름> 포함)를 모두 뜻해요.
    rules: { userAgent: "*", allow: "/", disallow: ["/login", "/write", "/api/"] },
    // 사이트맵 주소
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
