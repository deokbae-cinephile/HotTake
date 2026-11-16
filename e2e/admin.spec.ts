/**
 * @file 글쓴이 기능 E2E 테스트 (e2e/admin.spec.ts)
 * 읽는 순서: 80/84번째 · 8단계(설정·테스트·배포)
 *   앞: e2e/blog.spec.ts → 다음: e2e/pwa.spec.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 진짜 브라우저로 글쓴이 기능을 처음부터 끝까지 써 보며 확인해요.
 *   - proxy.ts: 로그인하지 않으면 글쓰기 화면은 로그인 화면으로, 저장 API는 401로 막는지
 *   - 로그인: 틀리면 알리고, 맞으면 원래 가려던 화면으로 돌아가는지
 *   - 리뷰 라이터: 리뷰 추가(이미지 포함)를 저장하면 저장소(가짜 GitHub)에 커밋이 올라가는지,
 *     칸 이름(콘텐츠 정보·분류)과 오른쪽에 붙은 [리뷰 저장] [취소]
 *   - 수정·삭제(목록 한 편의 [수정]·[삭제] 아이콘 단추), 로그아웃
 *   - 접근성: 로그인·글쓰기 화면 axe 검사
 *
 * 저장소는 가짜 GitHub 서버(e2e/mock-github.mjs)예요. 시작할 때 처음 모습으로 되돌려요.
 * 글쓰기는 저장소를 바꾸는 시험이라, 데스크톱에서 차례대로(serial) 한 번만 돌려요.
 * (블로그 화면은 빌드할 때 만든 그대로라, 저장해도 E2E 중에는 목록이 바뀌지 않아요. 결과는 커밋 기록으로 확인해요.)
 *
 * Playwright 테스트 문법
 *   test.describe(이름, 함수): 관련 테스트 묶음. test(이름, async ({ page, request }) => {...}): 테스트 하나.
 *     { page, request, isMobile }는 Playwright가 테스트마다 넘겨 주는 도구(fixture)를 구조 분해로 받는 거예요.
 *     page: 브라우저 탭, request: 탭 없이 HTTP 요청 보내기, isMobile: 휴대폰 프로젝트(playwright.config.ts의 "mobile")인지
 *   page.getByRole(역할, { name }): 화면 낭독기가 읽는 역할·이름으로 요소를 찾아요(사용자가 보는 방식 그대로라 튼튼해요).
 *   page.getByLabel(글자): 레이블로 입력 칸을 찾아요. /.../는 정규 표현식(글자 무늬)이라 "그 글자로 끝나는" 등으로 찾을 수 있어요.
 *   await expect(요소).toBeVisible() 같은 확인은 조건이 맞을 때까지 잠시(기본 5초) 기다렸다가 판단해요.
 *   boundingBox(): 요소의 화면 위치·크기(x, y, width, height). 끝의 !는 "null이 아님"을 TypeScript에 알려 주는 표기예요.
 */

// path: 파일 경로를 다루는 Node.js 도구(시험용 그림 파일의 전체 경로를 만들어요)
import path from "node:path";

// `type Page`: 브라우저 탭의 타입. type을 붙이면 타입만 가져와요.
import { expect, type Page, test } from "@playwright/test";

import { E2E_ADMIN } from "./admin-account";
import { expectNoA11yViolations, expectNoHorizontalScroll, overlaps } from "./helpers";

/** 가짜 GitHub 서버 주소(playwright.config.ts와 같아요) */
const GITHUB = `http://127.0.0.1:${process.env.MOCK_GITHUB_PORT ?? 3101}`;
/** 시험용 그림(화면 조정 무늬, 200×300 PNG). path.resolve로 실행한 폴더 기준 전체 경로를 만들어요. */
const PICTURE = path.resolve("public/images/test-pattern.png");

/**
 * 가짜 GitHub에 올라온 커밋 하나의 모양(e2e/mock-github.mjs의 GET /__commits가 돌려줘요)
 * message: 커밋 메시지, added: 더하거나 바뀐 파일, deleted: 지운 파일, texts: 바뀐 원고(.json)의 글자
 * Record<string, string>: "열쇠도 글자, 값도 글자"인 객체 타입이에요.
 */
type Commit = { message: string; added: string[]; deleted: string[]; texts: Record<string, string> };

/**
 * 로그인 화면에서 아이디·비밀번호를 넣고 로그인해요.
 * 로그인 API를 바로 부르는 helpers.ts의 loginAsAuthor와 달리, 사람처럼 화면의 칸에 입력해요(로그인 화면 자체를 시험하려고요).
 *
 * @param page 로그인 화면을 연 브라우저 탭
 * @param password 넣을 비밀번호. 안 넘기면 시험용 계정의 맞는 비밀번호(기본값 매개변수)
 */
async function login(page: Page, password: string = E2E_ADMIN.password) {
  await page.getByLabel(/아이디/).fill(E2E_ADMIN.id);
  // .and(page.locator("input")): "비밀번호" 레이블에 걸리는 것 가운데 <input>만 골라요(비밀번호 보기 단추 등은 빼요).
  // fill: 칸을 비우고 글자를 넣어요.
  await page.getByLabel(/비밀번호/, { exact: false }).and(page.locator("input")).fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test.describe("로그인 전(proxy.ts가 막기)", () => {
  test("글쓰기 화면에 가면 로그인 화면으로 보내고, 원래 주소를 기억한다", async ({ page }) => {
    await page.goto("/write");
    // 주소가 /login?next=%2Fwrite로 끝나야 해요. %2F는 주소 안의 "/"를 안전하게 바꿔 적은 글자예요.
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
    await expect(page.getByRole("heading", { level: 1, name: "글쓴이 로그인" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("저장 API는 로그인 없이 부르면 401로 답한다", async ({ request }) => {
    // 브라우저 탭 없이 빈 본문({})으로 저장 API를 불러요. 로그인 쿠키가 없으니 막혀야 해요.
    const response = await request.post("/api/reviews", { data: {} });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ message: "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요." });
  });

  test("로그인 전에는 목록에 [+](리뷰 추가)·[수정]·[삭제]가 보이지 않는다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "작품 목록" })).toBeVisible();
    // toHaveCount(0): 그런 요소가 하나도 없어야 해요.
    await expect(page.getByRole("link", { name: /수정$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /삭제$/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "리뷰 추가" })).toHaveCount(0);
    // 방문자에게는 로그인 링크도 보이지 않아요(글쓴이는 /login으로 직접 가요).
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /로그인/ })).toHaveCount(0);
  });
});

test.describe("글쓴이 기능", () => {
  // test.skip에 조건과 이유를 넘기면, 조건이 참일 때 이 묶음의 테스트를 건너뛰어요.
  test.skip(({ isMobile }) => isMobile, "저장소를 바꾸는 시험이라 데스크톱에서 한 번만 돌려요");
  // serial: 이 묶음의 테스트를 적힌 차례대로 하나씩 돌려요(앞 테스트가 만든 저장소 상태를 뒤 테스트가 이어 써요).
  test.describe.configure({ mode: "serial" });

  // beforeAll: 이 묶음의 테스트를 시작하기 전에 한 번만 돌아요. testInfo: 지금 돌고 있는 프로젝트 이름 등을 알려 줘요.
  test.beforeAll(async ({ request }, testInfo) => {
    // 위의 건너뛰기 조건(isMobile)은 시험마다 보는 값이라, 휴대폰 프로젝트에서도 이 준비는 먼저 돌 수 있어요.
    // 그러면 데스크톱에서 저장하던 중에 저장소가 처음 모습으로 돌아가 커밋이 거절돼요(422). 그래서 데스크톱에서만 되돌려요.
    if (testInfo.project.name !== "desktop") return;
    // 가짜 저장소를 처음 모습(시험용 원고)으로 되돌려요.
    await request.post(`${GITHUB}/__reset`);
  });

  test("비밀번호가 틀리면 알리고, 맞으면 원래 가려던 글쓰기 화면으로 돌아간다", async ({ page }) => {
    await page.goto("/write");
    await login(page, "wrong-password");
    await expect(page.getByText("아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요.")).toBeVisible();

    await login(page);
    await expect(page).toHaveURL(/\/write$/);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();
    // 글쓰기 화면에서는 떠 있는 [+](리뷰 추가)를 숨겨요.
    await expect(page.getByRole("link", { name: "리뷰 추가" })).toHaveCount(0);
    await expectNoA11yViolations(page);

    // 다른 화면에서는 오른쪽 아래 구석에 44 × 44px [+]가 떠 있고, 누르면 글쓰기 화면으로 가요.
    await page.goto("/");
    const add = page.getByRole("link", { name: "리뷰 추가" });
    await expect(add).toBeVisible();
    const box = (await add.boundingBox())!;
    const viewport = page.viewportSize()!;
    // 소수점 오차를 없애려고 Math.round로 반올림해 비교해요. 44px은 손가락으로 누르기 쉬운 크기예요.
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([44, 44]);
    // 오른쪽·아래 끝에서 16px 안쪽
    expect([Math.round(viewport.width - (box.x + box.width)), Math.round(viewport.height - (box.y + box.height))]).toEqual([16, 16]);
    // 내려 읽어 [맨 위로]가 나타나면 [+]의 왼쪽에 붙고(사이 8px), [+]는 그 자리 그대로예요.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const toTop = page.getByRole("button", { name: "맨 위로" });
    await expect(toTop).toBeVisible();
    const topBox = (await toTop.boundingBox())!;
    expect(Math.round(box.x - (topBox.x + topBox.width))).toBe(8);
    expect(Math.round((await add.boundingBox())!.x)).toBe(Math.round(box.x));
    await expectNoA11yViolations(page);
    await add.click();
    await expect(page).toHaveURL(/\/write$/);
  });

  test("리뷰 추가: 이미지를 넣고 저장하면, 원고·이미지가 커밋 하나로 저장소에 올라간다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    // 틀린 칸 먼저: 빈 칸으로 저장하면 "고칠 곳" 목록 없이, 가장 위의 비운 칸(제목)으로 스크롤하고 초점이 가요.
    await page.getByRole("button", { name: "리뷰 저장" }).click();
    const titleField = page.getByRole("textbox", { name: "제목", exact: true });
    await expect(titleField).toBeFocused();
    await expect(titleField).toBeInViewport();
    await expect(page.getByText(/고칠 곳/)).toHaveCount(0);

    // 칸 이름에는 "[필수]" 같은 표시가 없어요. 꼭 적어야 하는 칸에는 required만 달아요(화면 낭독기가 "필수"라고 알려 줘요).
    // 칸 이름에는 "(영문)" 같은 덧붙임이 없고, 제목 칸은 "제목" 하나예요. 칸 아래 도움말도 없어요.
    await expect(page.locator("form")).not.toContainText("필수");
    await expect(page.locator("form")).not.toContainText("(영문)");
    const slug = page.getByRole("textbox", { name: "파일 이름", exact: true });
    await expect(slug).toHaveAttribute("required", "");
    await expect(page.locator(`label[for="${await slug.getAttribute("id")}"]`)).toHaveText("파일 이름");
    await expect(titleField).toBeVisible();
    await expect(page.getByRole("textbox", { name: "영문 제목" })).toHaveCount(0);
    await expect(page.locator("form")).not.toContainText("shutter-island");
    // 분류는 처음부터 영화가 골라져 있어요.
    await expect(page.getByRole("group", { name: "분류" }).getByRole("radio", { name: "영화" })).toBeChecked();
    // 칸 묶음 이름: 이미지, 콘텐츠 정보. 칸 이름: 연도, 감독 또는 작가, 분류 등
    await expect(page.getByRole("group", { name: "콘텐츠 정보" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "연도", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "감독 또는 작가", exact: true })).toBeVisible();

    await page.getByLabel(/파일 이름$/).fill("e2e-new-review");
    await page.getByLabel("제목", { exact: true }).fill("E2E 새 리뷰");
    await page.getByLabel(/연도$/).fill("2026");
    await page.getByLabel(/감독 또는 작가$/).fill("시험작가");
    await page.getByRole("group", { name: "분류" }).getByRole("radio", { name: "도서" }).check();
    // 평점은 처음에 5.0이 골라져 있어요("고르세요"가 없어요).
    await expect(page.getByLabel(/평점$/)).toHaveValue("5.0");
    await page.getByLabel(/평점$/).selectOption("3.5");
    await page.getByLabel(/한 줄 평$/).fill("끝까지 저장되는지 보는 한 줄 평");
    // 이미지를 고르기 전에는 목록과 같은 기본 이미지(그림 액자 아이콘 + NO IMAGE)가 보여요.
    const imageFrame = page.getByRole("group", { name: "이미지" }).locator(".image-frame");
    await expect(imageFrame).toContainText("NO IMAGE");
    await expect(imageFrame.locator("svg")).toBeVisible();
    // setInputFiles: 파일 고르기 창을 띄우지 않고 <input type="file">에 파일을 바로 넣어요.
    await page.getByLabel("이미지 고르기").setInputFiles(PICTURE);
    // 고르면 기본 이미지 대신 고른 사진이 보여요.
    await expect(imageFrame.locator("img")).toBeVisible();
    await expect(imageFrame).not.toContainText("NO IMAGE");
    // [이미지 고르기]·[이미지 빼기]는 이미지와 같은 너비예요.
    const frame = (await imageFrame.boundingBox())!;
    for (const button of [page.getByText("이미지 고르기", { exact: true }), page.getByRole("button", { name: "이미지 빼기" })]) {
      expect(Math.round((await button.boundingBox())!.width)).toBe(Math.round(frame.width));
    }
    // 평점 칸: ▼와 칸 오른쪽 끝 사이가, 글자와 칸 왼쪽 끝 사이(테두리 + 안쪽 여백)와 같아요(좌우 같은 간격).
    // evaluate: 찾은 요소(select)를 브라우저 안에서 직접 다뤄요. getComputedStyle로 실제 적용된 CSS 값을 읽어요.
    const inset = await page.getByLabel(/평점$/).evaluate((select) => {
      const style = getComputedStyle(select);
      const arrow = select.parentElement!.querySelector("svg")!.getBoundingClientRect();
      return {
        left: parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: select.getBoundingClientRect().right - arrow.right,
      };
    });
    expect(Math.round(inset.right)).toBe(Math.round(inset.left));
    // [리뷰 저장] [취소]는 폼 오른쪽 끝에 붙어 있어요(취소의 오른쪽 끝 = 폼 오른쪽 끝, 저장은 취소 왼쪽).
    const formBox = (await page.locator("form").boundingBox())!;
    const saveBox = (await page.getByRole("button", { name: "리뷰 저장" }).boundingBox())!;
    const cancelBox = (await page.getByRole("link", { name: "취소" }).boundingBox())!;
    expect(Math.round(cancelBox.x + cancelBox.width)).toBe(Math.round(formBox.x + formBox.width));
    expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(cancelBox.x);
    await expectNoA11yViolations(page);

    // 저장소(가짜 GitHub)의 답을 늦춰, 저장하는 동안 단추 아래에 로딩 UI가 보이는지 확인해요.
    // try { ... } finally { ... }: 중간에 확인이 실패해도 finally 안의 "늦추기 끄기"는 반드시 실행해요(다음 테스트가 느려지지 않게).
    await request.post(`${GITHUB}/__delay?ms=700`);
    try {
      await page.getByRole("button", { name: "리뷰 저장" }).click();
      await expect(page.getByRole("status").filter({ hasText: /이미지를 올리는 중\(1\/1\)|리뷰를 저장하는 중/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused({ timeout: 15_000 });
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }

    // 가짜 GitHub에 커밋이 하나 올라갔는지, 무엇이 들어갔는지 확인해요. 원고는 JSON 파일이에요.
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    // find: 조건에 맞는 첫 항목을 찾아요. as Commit[]은 받은 JSON의 모양을 TypeScript에 알려 주는 표기(타입 단언)예요.
    const commit = commits.find((item) => item.message === "리뷰 추가: E2E 새 리뷰")!;
    expect(commit.added.sort()).toEqual(["content/reviews/e2e-new-review.json", "public/images/e2e-new-review.png"]);
    const saved = JSON.parse(commit.texts["content/reviews/e2e-new-review.json"]!);
    expect(saved).toMatchObject({ title: "E2E 새 리뷰", year: 2026, creator: "시험작가", category: "도서", rating: 3.5, image: "e2e-new-review.png" });
  });

  test("큰 사진은 줄여서 올린다(이미지는 JPG, 긴 변 800px)", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    // 2400 × 1800 PNG를 브라우저에서 그려 만들어요(긴 변이 800px보다 커서 줄여야 해요).
    // <canvas>에 초록→검정 그러데이션을 칠하고 toDataURL로 PNG 글자(base64)를 받아, Buffer(바이트 덩어리)로 바꿔요.
    const bigPng = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2400;
        canvas.height = 1800;
        const context = canvas.getContext("2d")!;
        const gradient = context.createLinearGradient(0, 0, 2400, 1800);
        gradient.addColorStop(0, "#39ff14");
        gradient.addColorStop(1, "#020802");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2400, 1800);
        return canvas.toDataURL("image/png").split(",")[1]!;
      }),
      "base64",
    );

    await page.getByLabel(/파일 이름$/).fill("e2e-big-photo");
    // 파일 경로 대신 { 이름, 종류, 내용 }을 넘겨, 디스크에 없는 파일도 고른 것처럼 넣을 수 있어요.
    await page.getByLabel("이미지 고르기").setInputFiles({ name: "big-cover.png", mimeType: "image/png", buffer: bigPng });
    // 고른 뒤 위쪽에 "이미지로 …을 골랐습니다" 같은 안내는 띄우지 않아요(미리보기로 바로 보여요).
    await expect(page.getByRole("group", { name: "이미지" }).locator("img")).toBeVisible();
    await expect(page.getByText(/골랐습니다/)).toHaveCount(0);
    // 미리보기 그림의 실제 크기가 긴 변 800px이에요. naturalWidth·naturalHeight는 화면에 그린 크기가 아니라 파일 자체의 크기예요.
    // expect.poll: 함수를 되풀이해 부르며 결과가 기대와 같아질 때까지 기다려요(줄이는 일이 끝나기를 기다려요).
    const previewImage = page.getByRole("group", { name: "이미지" }).locator("img");
    await expect.poll(() => previewImage.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([800, 600]);

    // 나머지 칸을 채워 저장하면, 줄인 파일(.jpg)이 올라가요(사진 올리기 API가 파일 앞부분으로 형식도 확인해요).
    await page.getByLabel("제목", { exact: true }).fill("큰 사진 시험");
    await page.getByLabel(/연도$/).fill("2026");
    await page.getByLabel(/감독 또는 작가$/).fill("시험감독");
    await page.getByRole("radio", { name: "영화" }).check();
    await page.getByLabel(/한 줄 평$/).fill("줄여서 올라가는지 보는 한 줄 평");
    await page.getByRole("button", { name: "리뷰 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeFocused();
    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 추가: 큰 사진 시험")!;
    expect(commit.added.sort()).toEqual(["content/reviews/e2e-big-photo.json", "public/images/e2e-big-photo.jpg"]);
  });

  test("수정 화면은 저장소에서 원고를 읽는 동안 로딩 UI와 글쓰기 스켈레톤을 보이고, 다 읽으면 폼으로 바뀐다", async ({ page, request }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    // 느린 GitHub 흉내: 요청마다 0.7초 늦게 답해요(원고 하나를 읽는 데 요청이 여러 번 들어요).
    await request.post(`${GITHUB}/__delay?ms=700`);
    try {
      // commit: 화면을 다 받기 전, 응답이 시작되자마자 돌아와요. 먼저 오는 로딩 화면을 보려고요.
      await page.goto("/write/alpha-station", { waitUntil: "commit" });
      const status = page.getByRole("status").filter({ hasText: "글쓰기 화면을 불러오는 중" });
      await expect(status).toBeVisible();
      await expect(page.locator(".skeleton").first()).toBeVisible();
      await expectNoA11yViolations(page);
      await expectNoHorizontalScroll(page);

      // 원고를 다 읽으면 로딩 화면은 사라지고 수정 화면이 보여요.
      await expect(page.getByRole("heading", { level: 1, name: "리뷰 수정: alpha-station" })).toBeVisible({ timeout: 15_000 });
      await expect(status).toHaveCount(0);
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
  });

  test("수정: 목록 한 편의 [수정]으로 들어가 저장소 원고를 고치면, 고친 원고가 커밋된다", async ({ page, request }) => {
    await page.goto("/login?next=/");
    await login(page);
    // 목록의 아이콘 단추 이름은 "알파 정거장 리뷰 수정"이에요(어느 리뷰인지 이름에 들어 있어요).
    // locator("visible=true"): 넓은 화면용·휴대폰용 두 자리 가운데 화면에 보이는 것만 골라 눌러요(숨긴 쪽은 display: none이라 누를 수 없어요).
    await page.getByRole("article", { name: "알파 정거장" }).getByRole("link", { name: "알파 정거장 리뷰 수정" }).locator("visible=true").click();
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 수정: alpha-station" })).toBeVisible();
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("알파 정거장");
    // 분류 칸에 원고의 분류(영화)가 골라져 있어요.
    await expect(page.getByRole("radio", { name: "영화" })).toBeChecked();
    // 파일 이름은 바꿀 수 없어요. "(수정할 때는 바꿀 수 없습니다.)"는 파일 이름 다음 줄에 보여요.
    const slugLabel = (await page.getByText("파일 이름:", { exact: true }).boundingBox())!;
    const slugNote = (await page.getByText("(수정할 때는 바꿀 수 없습니다.)", { exact: true }).boundingBox())!;
    expect(slugNote.y).toBeGreaterThanOrEqual(slugLabel.y + slugLabel.height - 1);
    expect(Math.round(slugNote.x)).toBe(Math.round(slugLabel.x));

    await page.getByLabel(/한 줄 평$/).fill("고친 한 줄 평");
    await page.getByRole("button", { name: "수정한 내용 저장" }).click();
    await expect(page.getByRole("heading", { name: "저장했습니다" })).toBeVisible();

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    const commit = commits.find((item) => item.message === "리뷰 수정: 알파 정거장")!;
    const saved = JSON.parse(commit.texts["content/reviews/alpha-station.json"]!);
    expect(saved.oneLiner).toBe("고친 한 줄 평");
    // 화면에 칸이 없는 글 쓴 날은 원고에 적힌 그대로 남아요.
    expect(saved.publishedAt).toBe("2026-03-01");
  });

  test("삭제(목록): 확인 창에서 [삭제]를 누르면 로딩 UI를 보이고 원고를 지우는 커밋이 올라가며, 안내로 초점이 가고, 로그아웃하면 다시 막힌다", async ({ page, request }) => {
    await page.goto("/login?next=/");
    await login(page);
    const item = page.getByRole("article", { name: "엡실론의 밤" });
    // 아이콘 단추(연필·휴지통)라 이름은 화면에 보이지 않는 글자예요. 어느 리뷰의 단추인지 이름에 들어 있어요.
    const edit = item.getByRole("link", { name: "엡실론의 밤 리뷰 수정" });
    const remove = item.getByRole("button", { name: "엡실론의 밤 리뷰 삭제" });

    // 넓은 화면: 한 줄 평 오른쪽에 [수정] [삭제]가 나란히 있고, 한 줄 평을 가리지 않아요. 누르기 쉬운 44px 정사각형이에요.
    await expect(remove).toBeVisible();
    // Promise.all로 두 단추의 위치를 함께 재고, 배열 구조 분해로 editBox·removeBox에 나눠 담아요.
    const [editBox, removeBox] = (await Promise.all([edit, remove].map(async (control) => (await control.boundingBox())!))) as [DOMRect, DOMRect];
    for (const box of [editBox, removeBox]) expect([Math.round(box.width), Math.round(box.height)]).toEqual([44, 44]);
    const oneLiner = (await item.locator("p", { hasText: "한 줄 평:" }).boundingBox())!;
    expect(removeBox.x).toBeGreaterThan(editBox.x);
    expect(editBox.x).toBeGreaterThanOrEqual(oneLiner.x + oneLiner.width);
    for (const box of [editBox, removeBox]) expect(overlaps(box, oneLiner)).toBe(false);
    expect(overlaps(editBox, removeBox)).toBe(false);
    await expectNoHorizontalScroll(page);

    await remove.click();
    const dialog = page.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    // 처음 초점은 되돌리기 쉬운 [취소]에 있어요.
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    await expectNoA11yViolations(page);

    // 느린 GitHub 흉내(0.8초): 삭제하는 동안 창 안에 로딩 UI가 보이고, 두 단추는 막혀요.
    await request.post(`${GITHUB}/__delay?ms=800`);
    try {
      const confirm = dialog.getByRole("button", { name: "삭제" });
      await confirm.click();
      await expect(dialog.getByRole("status")).toHaveText(/리뷰를 삭제하는 중/);
      await expect(dialog.getByRole("button", { name: "취소" })).toHaveAttribute("aria-disabled", "true");
      await expect(confirm).toHaveAttribute("aria-disabled", "true");
      // 막아도 초점은 누른 [삭제]에 그대로 있고, Esc로도 닫히지 않아요. 끝날 때까지 결과를 기다려요.
      await expect(confirm).toBeFocused();
      // page.keyboard.press: 키보드 키를 눌러요.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();

      // 다 지우면 창이 닫히고, 그 리뷰 아래에 안내가 보이며, 초점은 안내로 가요(누른 [삭제]가 사라져서요).
      const notice = item.getByRole("status").filter({ hasText: "리뷰를 삭제했습니다" });
      await expect(notice).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toBeHidden();
      await expect(notice).toBeFocused();
      await expect(notice).toHaveText("‘엡실론의 밤’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    } finally {
      await request.post(`${GITHUB}/__delay?ms=0`);
    }
    // 지운 리뷰의 [수정]·[삭제]는 치워요(다른 리뷰의 단추는 그대로예요).
    await expect(edit).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    await expect(page.getByRole("article", { name: "알파 정거장" }).getByRole("link", { name: "알파 정거장 리뷰 수정" })).toBeVisible();
    await expectNoA11yViolations(page);

    const commits = (await (await request.get(`${GITHUB}/__commits`)).json()) as Commit[];
    // ?.(옵셔널 체이닝): 커밋을 찾지 못하면(undefined) deleted를 읽지 않고 undefined로 넘어가, 확인이 실패로 끝나요.
    expect(commits.find((commit) => commit.message === "리뷰 삭제: 엡실론의 밤")?.deleted).toEqual(["content/reviews/epsilon-night.json"]);

    // 로그아웃하면 목록의 [수정]·[삭제]가 모두 사라지고, 글쓰기 화면은 다시 로그인 화면으로 보내요.
    await page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /수정$/ })).toHaveCount(0);
    await page.goto("/write");
    await expect(page).toHaveURL(/\/login\?next=%2Fwrite$/);
  });

});

test.describe("로그아웃 단추(왼쪽 아래에 고정)", () => {
  test("로그인 전에는 없고, 로그인하면 왼쪽 아래에 떠 있다", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);

    // 로그인하면 [로그아웃]이 왼쪽 아래에 떠 있어요.
    await page.goto("/login?next=/");
    await login(page);
    await expect(page).toHaveURL(/\/$/);
    const logout = page.getByRole("contentinfo").getByRole("button", { name: "로그아웃" });
    await expect(logout).toBeVisible();
    const box = (await logout.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(viewport.height - (box.y + box.height))).toBe(16);
    // [로그아웃]은 왼쪽 끝(16px)에 있어요.
    expect(Math.round(box.x)).toBe(16);
    // 내려 읽어도 같은 자리에 붙어 있어요(position: fixed).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(Math.round(viewport.height - ((await logout.boundingBox())!.y + box.height))).toBe(16);
    await expectNoA11yViolations(page);

    // 로그아웃에 실패하면(연결이 끊김) 단추 위에 안내 상자가 뜨고, 화면 오른쪽 밖으로 넘치지 않아요(640px 너비 포함).
    // page.route(주소 무늬, 함수): 그 주소로 가는 요청을 가로채요. **는 "앞에 무엇이 와도"라는 뜻이에요.
    //   로그아웃(DELETE) 요청만 abort()로 끊어 "연결 실패"를 흉내 내고, 나머지는 continue()로 그대로 보내요.
    await page.route("**/api/session", (route) => (route.request().method() === "DELETE" ? route.abort() : route.continue()));
    for (const width of isMobile ? [viewport.width] : [640, viewport.width]) {
      await page.setViewportSize({ width, height: viewport.height });
      await logout.click();
      const alert = page.getByRole("alert").filter({ hasText: "서버에 연결하지 못했습니다" });
      await expect(alert).toBeVisible();
      const alertBox = (await alert.boundingBox())!;
      expect(alertBox.x).toBeGreaterThanOrEqual(0);
      expect(alertBox.x + alertBox.width).toBeLessThanOrEqual(width);
      // 안내 상자는 단추 위에 떠요(단추를 가리지 않아요).
      expect(alertBox.y + alertBox.height).toBeLessThanOrEqual((await logout.boundingBox())!.y);
    }
    // 화면 크기와 요청 가로채기를 처음대로 되돌려요.
    await page.setViewportSize(viewport);
    await page.unroute("**/api/session");

    // 다시 누르면 로그아웃되고 단추가 사라져요.
    await logout.click();
    await expect(page.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
  });
});

test.describe("글쓰기 화면(좁은 화면)", () => {
  test.skip(({ isMobile }) => !isMobile, "휴대폰 화면에서만 돌려요");

  test("이미지 → 콘텐츠 정보 → [리뷰 저장] [취소] 차례로 한 칸에 쌓이고, 화면이 가로로 넘치지 않는다", async ({ page }) => {
    await page.goto("/login?next=/write");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();
    // 세 덩어리의 위치를 재서, 아래 것의 위쪽(y)이 위 것의 아래쪽(y + height)보다 아래에 있는지 봐요(-1은 반올림 오차 여유).
    const image = (await page.getByRole("group", { name: "이미지" }).boundingBox())!;
    const info = (await page.getByRole("group", { name: "콘텐츠 정보" }).boundingBox())!;
    const save = (await page.getByRole("button", { name: "리뷰 저장" }).boundingBox())!;
    expect(info.y).toBeGreaterThan(image.y + image.height - 1);
    expect(save.y).toBeGreaterThan(info.y + info.height - 1);
    // 휴대폰에서도 평점 고르기 칸의 글자는 다른 글자와 같은 12px이에요(글자를 치는 칸만 16px).
    expect(await page.getByLabel(/평점$/).evaluate((select) => getComputedStyle(select).fontSize)).toBe("12px");
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
