/**
 * @file 사이트맵 (app/sitemap.ts → 주소 "/sitemap.xml")
 * 읽는 순서: 68/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/app/not-found.tsx → 다음: src/app/robots.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   검색엔진(구글, 네이버 등)에 "이 사이트에는 이런 페이지들이 있어요"라고 알려 주는 목록(sitemap.xml)을 만들어요.
 *   이 블로그에서 검색엔진에 알릴 페이지는 처음 화면(작품 목록) 하나예요(글쓰기·로그인 화면은 알리지 않아요).
 *
 * Next.js 약속
 *   app/sitemap.ts가 대표 내보내기(export default)로 주소 목록을 돌려주면, Next.js가 sitemap.xml 파일로 만들어 줘요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 이름을 보고 저절로 /sitemap.xml로 내보내고, app/robots.ts가 이 주소를 검색엔진에 알려요.
 */

// MetadataRoute.Sitemap: Next.js가 정해 둔 "사이트맵 목록"의 타입이에요.
import type { MetadataRoute } from "next";

// getReviews: 원고를 모두 읽어 최신순 목록으로 돌려주는 함수, siteUrl: 블로그 전체 주소
import { getReviews } from "@/lib/review-data";
import { siteUrl } from "@/lib/site";

/**
 * 빌드할 때 파일로 만들어 두라고 알려 줘요. 원고는 빌드할 때만 읽어서, 요청마다 다시 만들 필요가 없어요.
 * Next.js 약속: 이 값은 이 파일에 직접 적어야 해요.
 */
export const dynamic = "force-static";

/**
 * 사이트맵 목록
 *
 * - url: 페이지의 전체 주소
 * - lastModified: 마지막으로 바뀐 날. 검색엔진이 언제 다시 와 볼지 참고해요.
 *
 * `async` + `Promise<…>`: 원고 읽기를 기다려야 해서 비동기 함수예요. 돌려주는 값은 "나중에 사이트맵 목록이 될 약속(Promise)"이에요.
 *
 * @returns 주소 하나(처음 화면)만 담은 사이트맵 목록
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reviews = await getReviews();
  // 처음 화면. 가장 최근 리뷰(최신순 맨 앞)를 쓴 날을 마지막으로 바뀐 날로 써요.
  // `reviews[0]?.publishedAt`: 리뷰가 하나도 없으면 reviews[0]이 없어서 ?.가 undefined를 돌려줘요(오류 없이).
  return [{ url: `${siteUrl}/`, lastModified: reviews[0]?.publishedAt }];
}
