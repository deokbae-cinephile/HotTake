/**
 * @file 설치 정보 = 웹 앱 매니페스트 (app/manifest.ts → 주소 "/manifest.webmanifest")
 * 읽는 순서: 62/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/components/delete-review.tsx → 다음: public/sw.js (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   이 블로그를 "앱으로 설치"할 때 필요한 정보(이름, 아이콘, 색, 여는 방식)를 브라우저에 알려 줘요.
 *   휴대폰 홈 화면이나 PC 바탕화면에 설치하면 주소창 없는 앱 창으로 열려요.
 *
 * Next.js 약속
 *   app/manifest.ts가 대표 내보내기로 정보를 돌려주면, Next.js가 manifest.webmanifest 파일로 만들고
 *   모든 페이지의 <head>에 <link rel="manifest">를 알아서 달아 줘요.
 *
 * 주소를 "./"처럼 상대 주소로 적은 이유
 *   매니페스트 안의 상대 주소는 매니페스트 파일 위치(/manifest.webmanifest)를 기준으로 풀려요.
 *   그래서 "./"는 /, "icons/icon-192.png"는 /icons/icon-192.png가 돼요.
 *   도메인을 바꾸거나 다른 주소 아래에 올려도 매니페스트를 고칠 필요가 없어요.
 *
 * 아이콘 파일은 scripts/make-icons.mjs가 만들어요(pnpm icons).
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 이름(app/manifest.ts)을 보고 저절로 써요. 브라우저가 이 정보를 읽어 설치 창을 띄워요.
 */

// MetadataRoute.Manifest: Next.js가 정해 둔 "매니페스트" 객체의 타입이에요. 항목 이름을 틀리면 타입 오류로 알려 줘요.
import type { MetadataRoute } from "next";

// site: 블로그 이름·짧은 이름·설명(lib/site.ts)
import { site } from "@/lib/site";

/**
 * 빌드하면서 파일로 만들어 두라는 표시예요(app/sitemap.ts와 같아요).
 * 내용이 늘 같아서 요청마다 다시 만들 필요가 없어요. Next.js 약속: 이 값은 이 파일에 직접 적어야 해요.
 */
export const dynamic = "force-static";

/**
 * 설치 정보를 돌려줘요.
 *
 * @returns 이름·주소·색·아이콘을 담은 매니페스트 객체(Next.js가 JSON 파일로 바꿔요)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // 설치 화면과 앱 목록에 보이는 이름
    name: site.name,
    // 홈 화면 아이콘 아래에 보이는 짧은 이름
    short_name: site.shortName,
    // 설치 화면 등에 보이는 설명
    description: site.description,
    // 언어와 글 방향(왼쪽 → 오른쪽)
    lang: "ko",
    dir: "ltr",
    // 앱을 열면 처음 보일 주소, 그리고 앱이 맡는 주소 범위
    start_url: "./",
    scope: "./",
    // standalone: 주소창 없이 앱처럼 열려요.
    display: "standalone",
    // 앱이 뜨는 동안 보이는 바탕색과 상단 막대 색. 화면 바탕색(globals.css의 --screen)과 같게 맞춰요.
    background_color: "#020802",
    theme_color: "#020802",
    // 앱 장터·설치 화면이 참고하는 분류(오락)
    categories: ["entertainment"],
    // 아이콘 목록. sizes: 그림 크기(가로x세로), type: 파일 종류(PNG). 기기가 알맞은 크기를 골라 써요.
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // purpose "maskable": 기기가 동그라미 등으로 잘라 쓰는 아이콘(로고가 안쪽 안전 영역에 들어 있어요)
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
