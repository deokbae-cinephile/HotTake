/**
 * @file 모든 화면의 공통 틀 (app/layout.tsx)
 * 읽는 순서: 13/84번째 · 3단계(화면의 뼈대와 공통 모양)
 *   앞: src/lib/github-mark.ts → 다음: src/components/site-header.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   Next.js의 "루트 레이아웃"이에요. 모든 페이지가 이 틀 안에 들어갑니다.
 *   <html>, <body>처럼 페이지마다 똑같은 뼈대와, 머리글·바닥글처럼 모든 화면에 나오는 부분을 여기서 한 번만 그려요.
 *
 *     <html>
 *       <body>
 *         [본문 바로가기]  ← 키보드 사용자를 위한 건너뛰기 링크
 *         <SiteHeader />   ← 머리글
 *         <main>{children}</main>  ← 여기에 각 페이지(목록, 글쓰기, 로그인, 404)가 들어와요
 *         <SiteFooter />   ← 바닥글
 *       </body>
 *     </html>
 *
 * 맡은 기능
 *   1. 글꼴(갈무리11, 오프라인 화면의 ASCII 그림용 갈무리모노11) 불러오기
 *   2. 전역 스타일(globals.css) 불러오기
 *   3. 기본 메타데이터: 브라우저 탭 제목 규칙, 검색엔진 설명, 설치 앱 정보
 *   4. 본문 바로가기 링크(키보드로 머리글을 건너뛰기)
 *   5. 리뷰 이미지를 형광 초록 4단계 명암으로 바꾸는 SVG 필터
 *
 * Next.js App Router의 약속
 *   app 폴더 안의 layout.tsx, page.tsx 같은 "정해진 이름"의 파일은 Next.js가 알아서 찾아 써요.
 *   - layout.tsx: 틀, page.tsx: 페이지, not-found.tsx: 없는 주소 화면
 *   - `export const metadata`: 그 페이지의 <title>, <meta>를 정해요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 이름(app/layout.tsx)을 보고 모든 페이지를 그릴 때 저절로 써요.
 *
 * 이 파일은 서버 컴포넌트예요("use client"가 없어요). 안에 넣은 머리글·바닥글 속 작은 조각만 브라우저에서 돌아요.
 */

// Metadata·Viewport: Next.js가 정해 둔 메타데이터·화면 설정의 타입. `import type`이라 타입 검사에만 쓰이고 실행 코드에는 남지 않아요.
import type { Metadata, Viewport } from "next";
// next/font/local: 내 프로젝트 안의 글꼴 파일을 불러오는 Next.js 도구예요.
// 글꼴을 미리 받아 두도록(preload) 설정해 주고, 다른 사이트(CDN)를 거치지 않아 빠르고 안전해요.
import localFont from "next/font/local";
// ReactNode: 화면에 그릴 수 있는 것(요소, 글자, null 등) 모두를 뜻하는 타입
import type { ReactNode } from "react";

// "@/": src 폴더를 뜻하는 줄임 경로예요(tsconfig.json의 paths).
import { ServiceWorker } from "@/components/service-worker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
// DEFAULT_SHARE_IMAGE: 공유 미리 보기 그림(public/og.png), site: 블로그 이름·설명, siteUrl: 블로그 전체 주소(예: https://deokbae.blog)
import { DEFAULT_SHARE_IMAGE, site, siteUrl } from "@/lib/site";

// 전역 스타일. 여기서 한 번 불러오면 모든 페이지에 적용돼요.
import "./globals.css";

/**
 * 갈무리11 글꼴(Galmuri11, 이민서, SIL OFL 1.1 — https://github.com/quiple/galmuri)
 * localFont({...})는 설정 객체를 받아, 글꼴 이름·CSS 변수를 담은 객체를 돌려줘요(아래 galmuri.variable로 써요).
 *
 * - 닌텐도 DS 글꼴에서 영감을 받은 단정한 픽셀 글꼴이에요.
 * - 12px 격자로 그린 글꼴이라 12px, 24px처럼 12의 배수 크기에서 픽셀이 또렷해요(이 블로그는 12px·24px을 기본으로, 목록·구역 제목에 16px, 머리글 이름에 20px을 써요. 단계는 globals.css "글자 크기 단계").
 * - 원본(npm galmuri 2.40.3, 493KB)에서 블로그에 쓰지 않는 일본어 가나·한자(약 7천 자)를 덜어 낸 판이에요(190KB).
 *   한글 11,172자와 라틴·기호는 모두 남겼어요. 만드는 명령은 docs/development.md "글꼴"에 있어요.
 *   글꼴 라이선스(SIL OFL 1.1)는 글꼴 파일과 함께 라이선스 전문을 두라고 해서, 같은 폴더의 OFL.txt는 지우지 않아요.
 *   (이름 보호 조항이 없는 라이선스라, 글자를 덜어 낸 판도 이름을 그대로 써도 돼요.)
 */
const galmuri = localFont({
  // 이 파일(layout.tsx) 기준의 상대 경로예요. woff2: 웹용으로 압축한 글꼴 파일 형식이에요.
  src: "./fonts/galmuri11-ko.woff2",
  // CSS 변수 이름. globals.css에서 var(--font-galmuri)로 이 글꼴을 써요.
  variable: "--font-galmuri",
  // swap: 글꼴을 받는 동안 기본 글꼴로 먼저 보여 주고, 다 받으면 바꿔요. 글자가 안 보이는 시간이 없어요.
  display: "swap",
  // Next.js가 크기를 맞춘 대체 글꼴을 따로 만드는 기능이에요. 픽셀 글꼴과는 잘 맞지 않아 꺼요.
  adjustFontFallback: false,
  // 글꼴을 받기 전이나 못 받았을 때 쓸 글꼴. 단말기 느낌의 고정폭(monospace) 글꼴을 써요.
  fallback: ["ui-monospace", "monospace"],
});

/**
 * 갈무리모노11(GalmuriMono11) — 글자 폭이 모두 같은 판. ASCII 그림(오프라인 화면)에만 써요.
 *
 * - 갈무리11은 글자마다 폭이 달라서(비례폭), 칸을 맞춰 그린 ASCII 그림이 어긋나요. 그림에는 이 고정폭판을 써요.
 * - ASCII 95자만 남긴 판이라 2.5KB예요. preload: false — 미리 받지 않고, 그림이 있는 화면을 열 때만 받아요.
 */
const galmuriMono = localFont({
  src: "./fonts/galmuri-mono11-ascii.woff2",
  // globals.css에서 var(--font-galmuri-mono)로 써요(font-pixel-mono 클래스).
  variable: "--font-galmuri-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

/**
 * 모든 페이지에 들어가는 기본 메타데이터(<head> 안의 정보)
 *
 * 페이지 파일에서 metadata를 따로 정하면 그 페이지에서는 그 값이 우선해요.
 * `metadata: Metadata`: 변수 이름 뒤의 `: 타입`은 "이 값은 이 타입이어야 한다"는 표시예요. 항목 이름을 틀리면 타입 오류가 나요.
 */
export const metadata: Metadata = {
  // 대표 주소 같은 "상대 주소"를 "전체 주소"로 바꿀 때 기준이 되는 주소예요.
  // `${siteUrl}/`: 템플릿 리터럴. 백틱(`) 안의 ${…} 자리에 변수 값을 끼워 넣어요.
  metadataBase: new URL(`${siteUrl}/`),
  // 브라우저 탭 제목 규칙
  //  - default: 페이지가 제목을 정하지 않으면 "HotTake"
  //  - template: 페이지가 "겨울 정류장 리뷰"라고 정하면 "겨울 정류장 리뷰 — HotTake" (%s 자리에 들어가요)
  title: { default: site.name, template: `%s — ${site.name}` },
  // 검색 결과에 보이는 설명
  description: site.description,
  // 웹 앱 이름(<meta name="application-name">)
  applicationName: site.name,
  // Open Graph: 카카오톡·메신저 등에 링크를 붙였을 때 보이는 제목·설명·그림이에요.
  // 그림은 미리 만들어 둔 파일(public/og.png)이라 서버가 그릴 일이 없어요(워커가 무거워지지 않아요).
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "ko_KR",
    title: site.name,
    description: site.description,
    images: [DEFAULT_SHARE_IMAGE],
  },
  // X(트위터) 카드: 큰 그림 카드로 보여요.
  twitter: { card: "summary_large_image", title: site.name, description: site.description, images: [DEFAULT_SHARE_IMAGE] },
  // 아이폰 사파리가 숫자(예: 연도)를 전화번호로 착각해 링크로 바꾸지 않게 해요.
  formatDetection: { telephone: false },
  // 아이폰·아이패드 홈 화면에 추가했을 때: 앱 창으로 열고(capable), 아이콘 아래 이름과 상단 막대 색을 정해요.
  // (설치 정보의 나머지는 app/manifest.ts, 홈 화면 아이콘은 app/apple-icon.png에 있어요.)
  appleWebApp: { capable: true, title: site.shortName, statusBarStyle: "black" },
};

/**
 * 화면(뷰포트) 설정
 * - themeColor: 휴대폰 브라우저 주소창 색을 화면 배경색(거의 검정)에 맞춰요.
 * - colorScheme: 이 사이트는 어두운 화면이라고 알려 줘요. 스크롤바 같은 기본 요소도 어둡게 그려져요.
 */
export const viewport: Viewport = {
  themeColor: "#020802",
  colorScheme: "dark",
};

/**
 * 리뷰 이미지를 형광 초록으로 칠하는 SVG 필터의 마지막 단계(회색 → 초록) 값이에요.
 *
 * 행렬은 한 줄이 결과 색 하나(R, G, B, A)예요. 앞 단계에서 회색(R=G=B)이 된 그림에
 * 빨강·초록·파랑을 각각 형광 초록 #39FF14의 비율만큼 곱하면 초록으로 칠해져요.
 *   빨강 57/255 ≈ 0.224, 초록 1, 파랑 20/255 ≈ 0.078
 */
const PHOSPHOR_TINT = "0.224 0 0 0 0  0 1 0 0 0  0 0 0.078 0 0  0 0 0 1 0";

/**
 * 루트 레이아웃 컴포넌트
 *
 * `export default`: 이 파일의 "대표" 내보내기예요. Next.js는 layout.tsx의 대표 내보내기를 틀로 씁니다.
 *
 * `{ children }: { children: ReactNode }`: 받은 값에서 children을 꺼내고(구조 분해), 그 타입이 ReactNode라고 적어요.
 *
 * @param children 지금 주소에 맞는 페이지(app/page.tsx 등)가 들어오는 자리
 * @returns html·body와 공통 부분(바로가기, 머리글, 본문, 바닥글)을 담은 전체 문서
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang="ko": 이 페이지의 기본 언어는 한국어예요. 화면 낭독기가 한국어 발음으로 읽어요.
    // galmuri.variable·galmuriMono.variable: --font-galmuri·--font-galmuri-mono 변수를 정의하는 클래스를 붙여요.
    <html lang="ko" className={`${galmuri.variable} ${galmuriMono.variable}`}>
      {/* flex flex-col: 머리글·본문·바닥글을 세로로 쌓아요. 본문(main)이 남는 높이를 모두 차지해서(flex-1),
          글이 짧은 화면(404 등)에서도 바닥글이 화면 맨 아래에 붙어요. */}
      <body className="flex flex-col">
        {/* 본문 바로가기: 키보드 Tab을 처음 누르면 나타나는 링크예요. 머리글을 건너뛰고 본문으로 바로 가요.
            평소에는 화면 위로 숨겨 두었다가(-translate-y-[200%]) 초점을 받으면 내려와요(focus-visible:translate-y-0).
            z-[60]: 화면 효과 막(globals.css의 z-index 50, 51)보다 위에 둬서 어두운 그늘에 가리지 않게 해요.
            inverse: 초록 바탕에 어두운 글자(반전, globals.css). fixed top-3 left-3: 화면 왼쪽 위 12px 자리에 고정해요. */}
        <a
          href="#main"
          className="inverse fixed top-3 left-3 z-[60] -translate-y-[200%] px-3 py-2 no-underline focus-visible:translate-y-0"
        >
          본문 바로가기
        </a>

        {/* 리뷰 이미지를 형광 초록 4단계 명암으로 바꾸는 SVG 필터예요. CSS에서 filter: url(#crt-phosphor)로 불러 써요(globals.css).
            원본 그림 파일은 그대로 두고 화면에 그릴 때만 바꿔요.
            그림을 그리는 SVG가 아니라 "필터 정의"만 담은 상자라서 크기를 0으로 두고 화면 낭독기에서도 숨겨요.
            (display: none으로 숨기면 몇몇 브라우저에서 필터까지 사라져서, 크기 0 + absolute로 숨깁니다.) */}
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          {/* colorInterpolationFilters="sRGB": 색 계산을 화면 색 공간(sRGB) 그대로 해서 결과 색이 예측한 대로 나와요. */}
          <filter id="crt-phosphor" colorInterpolationFilters="sRGB">
            {/* 1단계: 흑백으로. 빨강·초록·파랑에 사람 눈이 느끼는 밝기 비율(0.2126, 0.7152, 0.0722)을 곱해 더해요.
                세 줄 모두 같은 식이라 R=G=B, 즉 회색이 돼요. */}
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
            />
            {/* 2단계: 밝기를 4단계로 줄여요(discrete = 계단식). 0~25%는 0.04, 25~50%는 0.3, 50~75%는 0.62, 75~100%는 1이 돼요. */}
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0.04 0.3 0.62 1" />
              <feFuncG type="discrete" tableValues="0.04 0.3 0.62 1" />
              <feFuncB type="discrete" tableValues="0.04 0.3 0.62 1" />
            </feComponentTransfer>
            {/* 3단계: 회색을 형광 초록으로 칠해요(위의 PHOSPHOR_TINT 설명 참고). */}
            <feColorMatrix type="matrix" values={PHOSPHOR_TINT} />
          </filter>
        </svg>

        {/* 모든 화면 맨 위의 머리글(components/site-header.tsx) */}
        <SiteHeader />

        {/* <main>: 페이지의 주요 내용이라는 뜻이에요. id="main"은 위 바로가기 링크의 목적지예요.
            tabIndex={-1}: 원래 초점을 받지 않는 요소지만, 바로가기로 왔을 때 초점을 받을 수 있게 해요(Tab 순서에는 안 들어가요).
            outline-none: 그때 생기는 초점 테두리는 지워요(단추가 아니라 본문 영역이라서요).
            flex-1: 남는 높이를 모두 차지해요. pt-10: 위쪽 40px. 좌우 여백은 머리글·바닥글과 같아요(16 → 32 → 48px). */}
        <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-10 outline-none sm:px-8 lg:px-12">
          {children}
        </main>

        {/* 모든 화면 맨 아래의 바닥글(components/site-footer.tsx). 떠 있는 단추들도 이 안에 있어요. */}
        <SiteFooter />

        {/* 서비스 워커 등록(앱 설치·오프라인 읽기). 화면에는 아무것도 그리지 않아요. */}
        <ServiceWorker />
      </body>
    </html>
  );
}
