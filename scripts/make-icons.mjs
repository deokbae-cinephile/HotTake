/**
 * @file 아이콘 만들기 (scripts/make-icons.mjs)
 * 읽는 순서: 70/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/app/robots.ts → 다음: next.config.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   로고 픽셀 그림(src/lib/logo.ts)으로 블로그에 필요한 아이콘 파일을 모두 만들어요.
 *
 *     src/app/icon.svg                브라우저 탭 아이콘(파비콘). Next.js가 <link rel="icon">을 알아서 달아요.
 *     src/app/apple-icon.png          아이폰·아이패드 홈 화면 아이콘(180×180). <link rel="apple-touch-icon">도 알아서 달려요.
 *     public/icons/icon-192.png       설치 앱 아이콘(192×192)  ┐
 *     public/icons/icon-512.png       설치 앱 아이콘(512×512)  ├ 설치 정보(src/app/manifest.ts)에 적혀 있어요.
 *     public/icons/icon-maskable-512.png 모양 잘림용 아이콘    ┘
 *     public/og.png                   공유 미리 보기 그림(1200×630). 링크를 카카오톡·메신저·SNS에 붙이면 카드에 보여요.
 *                                     (src/lib/site.ts의 DEFAULT_SHARE_IMAGE, app/layout.tsx의 openGraph에 적혀 있어요.)
 *
 * 언제 실행하나요?
 *   로고 그림(src/lib/logo.ts)이나 블로그 이름을 고쳤을 때만 실행해요. 만든 파일은 저장소에 함께 올려요.
 *     pnpm icons
 *
 * 픽셀이 흐려지지 않게 그리는 방법
 *   로고 한 칸을 아이콘마다 정수 크기(예: 512 아이콘은 한 칸 32px)로 키우고, 가운데 자리도 정수 픽셀에 맞춰요.
 *   그래서 아이콘을 크게 봐도 칸 가장자리가 또렷해요.
 *
 * maskable(모양 잘림용) 아이콘이 뭔가요?
 *   안드로이드는 홈 화면 아이콘을 동그라미·둥근 사각형 등 기기마다 다른 모양으로 잘라요.
 *   잘려도 로고가 남도록, 가운데 원(지름 80%) 안에 들어가게 로고를 더 작게 그린 판이에요.
 *
 * 누가 쓰나요?
 *   사람이 터미널에서 직접 실행해요: pnpm icons (package.json의 "icons" 명령)
 *   다른 코드가 import하지는 않고, 만든 파일(위 목록)을 블로그가 써요.
 *
 * Playwright(E2E 테스트에 쓰는 브라우저 도구)로 SVG를 PNG로 찍어요. 새 라이브러리가 필요 없어요.
 * Node.js 26은 .ts 파일을 바로 불러올 수 있어서(타입만 지우고 실행) src/lib의 로고 데이터를 그대로 써요.
 * 확장자 .mjs는 "import/export를 쓰는 ES 모듈 파일"이라는 표시예요. 그래서 함수 밖에서도 await를 바로 쓸 수 있어요.
 * 파일 경로("src/app/icon.svg" 등)는 명령을 실행한 폴더 기준이라, 저장소 맨 위 폴더에서 pnpm icons로 실행해요.
 */

// node:fs: 파일을 읽고 쓰는 Node.js 모듈. 이름 끝의 Sync는 "끝날 때까지 기다렸다가 다음 줄로 가는" 방식이라는 뜻이에요.
//   mkdirSync: 폴더 만들기, readFileSync: 파일 읽기, writeFileSync: 파일 쓰기
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// chromium: Playwright가 띄우는 크롬 계열 브라우저. 화면 없이(headless) 띄워 그림을 찍어요.
import { chromium } from "@playwright/test";

import { LOGO_ROWS } from "../src/lib/logo.ts";
import { GREEN_PHOSPHOR } from "../src/lib/palette.ts";
import { pixelPath } from "../src/lib/pixel-path.ts";
import { site } from "../src/lib/site.ts";

/** 화면 바탕색과 형광 초록 (src/lib/palette.ts — globals.css의 --screen, --phosphor와 같아요) */
const SCREEN = GREEN_PHOSPHOR.screen;
const GREEN = GREEN_PHOSPHOR.phosphor;
/** 보조 글자색과 선 색(globals.css의 --phosphor-dim, --phosphor-line) */
const DIM = GREEN_PHOSPHOR.dim;
const LINE = GREEN_PHOSPHOR.line;

/**
 * 로고 그림의 가로·세로 칸 수
 * LOGO_ROWS는 줄마다 글자("#"는 칠한 칸)로 그린 그림이에요. 가장 긴 줄의 길이가 가로 칸 수, 줄 수가 세로 칸 수예요.
 * ...(펼침 연산자)는 배열을 낱개 값으로 풀어서 Math.max(3, 5, 4)처럼 넘겨요.
 */
const logoWidth = Math.max(...LOGO_ROWS.map((row) => row.length));
const logoHeight = LOGO_ROWS.length;

/**
 * 정사각형 아이콘 SVG를 만들어요: 어두운 바탕 + 가운데 초록 로고
 *
 * @param {number} size 아이콘 한 변의 픽셀 수
 * @param {number} cell 로고 한 칸의 픽셀 수(정수)
 * @returns {string} SVG 글자
 */
function iconSvg(size, cell) {
  // 로고를 가운데에 두는 자리. Math.floor로 정수 픽셀에 맞춰야 칸 가장자리가 흐려지지 않아요.
  const x = Math.floor((size - logoWidth * cell) / 2);
  const y = Math.floor((size - logoHeight * cell) / 2);
  // path는 "한 칸 = 1" 단위로 그려져 있어서, translate로 자리를 옮기고 scale로 한 칸을 cell px로 키워요.
  // shape-rendering="crispEdges": 가장자리를 부드럽게 번지게 하지 말고 또렷하게 그리라는 뜻이에요(픽셀 그림에 맞아요).
  // 배열에 줄마다 넣고 join("")으로 이어 붙여 한 줄의 SVG 글자를 만들어요(읽기 쉽게 나눠 적었을 뿐이에요).
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="${SCREEN}"/>`,
    `<path fill="${GREEN}" transform="translate(${x} ${y}) scale(${cell})" d="${pixelPath(LOGO_ROWS, "#")}"/>`,
    `</svg>`,
  ].join("");
}

// 1) 파비콘: 16×16 격자에 한 칸 1로 그린 벡터 그림(SVG)이라 파일을 바로 써요. 끝의 \n은 파일 끝 줄바꿈이에요.
writeFileSync("src/app/icon.svg", `${iconSvg(16, 1)}\n`);

// 2) PNG 아이콘들: [저장할 파일, 한 변 크기, 로고 한 칸 크기]
const pngs = [
  ["src/app/apple-icon.png", 180, 12],
  ["public/icons/icon-192.png", 192, 12],
  ["public/icons/icon-512.png", 512, 32],
  // 모양 잘림용: 로고가 가운데 원(지름 80%) 안에 들어가도록 한 칸을 24px로 작게
  ["public/icons/icon-maskable-512.png", 512, 24],
];

// recursive: true → 폴더가 이미 있어도 오류 없이 넘어가고, 중간 폴더가 없으면 함께 만들어요.
mkdirSync("public/icons", { recursive: true });

// 브라우저를 띄우고 새 탭을 하나 열어요.
// deviceScaleFactor: 1 → 화면 1px을 그림 1px로 찍어요(2로 하면 레티나처럼 두 배 크기 그림이 돼요).
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

// for...of + 구조 분해: 배열의 한 줄 ["파일", 크기, 칸]을 file, size, cell 세 이름으로 나눠 받아요.
for (const [file, size, cell] of pngs) {
  // 아이콘 크기에 딱 맞는 빈 화면에 SVG를 그리고, 그 SVG 요소만 PNG로 찍어요.
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${iconSvg(size, cell)}</body>`);
  await page.locator("svg").screenshot({ path: file });
  console.log(`${file} (${size}×${size})`);
}

// 3) 공유 미리 보기 그림: 1200×630. [큰 로고 | HotTake / 작품 한 줄 평 블로그 / deokbae.blog]
//    글자는 사이트와 같은 갈무리11이에요. 글꼴 파일을 base64 글자로 바꿔 페이지 안에 넣어(@font-face) 바로 써요.
//    글자 크기는 12의 배수(갈무리11이 또렷한 크기)로, 형광 번짐(text-shadow)과 주사선도 사이트처럼 그려요.
//    주사선: repeating-linear-gradient로 4px마다 1px짜리 어두운 줄을 되풀이해 옛 모니터 화면처럼 보이게 해요.
//    data: 주소(data:font/woff2;base64,...)는 파일 내용을 주소 안에 그대로 담는 방법이라, 따로 파일을 받지 않아요.
const font = readFileSync("src/app/fonts/galmuri11-ko.woff2").toString("base64");
const ogLogoCell = 24;
const ogHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face { font-family: "galmuri"; src: url(data:font/woff2;base64,${font}) format("woff2"); }
html, body { margin: 0; }
body {
  width: 1200px; height: 630px; box-sizing: border-box; padding: 40px;
  background: repeating-linear-gradient(to bottom, transparent 0 3px, rgb(0 0 0 / 0.35) 3px 4px), ${SCREEN};
  font-family: "galmuri", monospace; color: ${GREEN};
}
.frame {
  box-sizing: border-box; height: 100%; border: 4px solid ${LINE};
  display: flex; align-items: center; justify-content: center; gap: 72px;
}
.text { display: grid; gap: 24px; }
.name { font-size: 156px; line-height: 1; text-shadow: 0 0 6px ${GREEN}, 0 0 24px rgb(57 255 20 / 0.45); }
.title { font-size: 60px; line-height: 1; text-shadow: 0 0 4px rgb(57 255 20 / 0.6); }
.url { font-size: 36px; line-height: 1; color: ${DIM}; }
svg { filter: drop-shadow(0 0 12px rgb(57 255 20 / 0.45)); }
</style></head><body><div class="frame">
<svg xmlns="http://www.w3.org/2000/svg" width="${logoWidth * ogLogoCell}" height="${logoHeight * ogLogoCell}" shape-rendering="crispEdges">
<path fill="${GREEN}" transform="scale(${ogLogoCell})" d="${pixelPath(LOGO_ROWS, "#")}"/></svg>
<div class="text"><div class="name">${site.name}</div><div class="title">${site.headerTitle}</div><div class="url">deokbae.blog</div></div>
</div></body></html>`;
// 화면 크기를 공유 그림 크기에 맞추고, 위의 HTML을 탭에 그려요.
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(ogHtml);
// 글꼴을 다 받은 뒤에 찍어요(받기 전에 찍으면 다른 글꼴로 찍혀요).
await page.evaluate(() => document.fonts.ready);
// 이번에는 요소 하나가 아니라 화면 전체(1200×630)를 찍어요.
await page.screenshot({ path: "public/og.png" });
console.log("public/og.png (1200×630)");

// 브라우저를 닫아야 프로그램이 끝나요. 만든 파일 이름을 마지막으로 알려 줘요.
await browser.close();
console.log("src/app/icon.svg (16×16)");
