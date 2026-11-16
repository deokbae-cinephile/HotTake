/**
 * @file 블로그 화면 E2E 테스트 (e2e/blog.spec.ts)
 * 읽는 순서: 79/84번째 · 8단계(설정·테스트·배포)
 *   앞: e2e/mock-github.mjs → 다음: e2e/admin.spec.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 진짜 브라우저로 사이트를 열어 방문자처럼 써 보며 확인해요(글쓴이 기능은 admin.spec.ts).
 *   - 목록: 검색, 분류(영화·도서), 정렬, 결과 없음, 조건 지우기, 주소에 조건 남기기, 10편씩 무한 스크롤
 *   - 넓은 화면: 왼쪽 검색 칸(스크롤해도 붙어 있음) + 오른쪽 작품 목록
 *   - 바닥글: 위쪽 점선과 가운데 저작권 줄
 *   - 404 화면, 맨 위로 단추, 머리글의 GitHub 링크
 *   - 키보드: 본문 바로가기, [더 보기] 뒤의 초점, 방향키를 가로채지 않는지
 *   - 접근성: axe 자동 검사(WCAG 2.2 AA 규칙), 레이아웃: 좁은 화면에서 가로로 넘치지 않는지
 *
 * 시험용 원고(e2e/fixtures/reviews) 11편
 *   최신순: 알파 정거장 → 베타 로맨스 → 긴 제목(감마) → 델타 기록 → 엡실론의 밤 → 제타의 노래 → 에타 전선
 *           → 세타 궁정 → 이오타 목장 → 카파 사건 → 람다 질주(11번째라 처음에는 보이지 않아요)
 *   평점순: 감마(5) → 알파(4.5) → 카파(4) → 람다(4) → 엡실론(3.5) → 베타(3) → ...
 *   영화 6편: 알파, 감마, 델타, 에타, 세타, 카파 / 도서 5편: 베타, 엡실론, 제타, 이오타, 람다
 *   이미지: 알파만 있어요(나머지는 기본 이미지)
 *
 * Playwright 기본 문법
 *   - test("이름", async ({ page }) => { ... }) : 테스트 하나. page는 브라우저 탭이에요.
 *   - page.goto("/") : 주소로 이동
 *   - page.getByRole("link", { name: "..." }) : 역할과 이름으로 요소 찾기(Testing Library와 같은 방식)
 *   - await expect(요소).toBeVisible() : 보일 때까지 잠깐 기다렸다가 확인(자동 재시도)
 *   - expect.poll(() => 값).toEqual(...) : 함수를 되풀이해 부르며 값이 기대와 같아질 때까지 기다려요(화면이 늦게 바뀔 때)
 *   - test.describe("묶음", () => {...}) : 관련 테스트 묶음. test.skip(조건, 이유)로 묶음 전체를 건너뛸 수 있어요.
 *   - { page, baseURL, isMobile } : Playwright가 테스트마다 넘겨 주는 도구(fixture)를 구조 분해로 받아요.
 *       isMobile은 휴대폰 프로젝트(playwright.config.ts의 "mobile")에서 true예요.
 *   - 요소.evaluate((element) => ...) : 그 요소를 브라우저 안에서 직접 다뤄요(getComputedStyle로 실제 CSS 값 읽기 등).
 *   - boundingBox() : 요소의 화면 위치·크기(x, y, width, height). 끝의 !는 "null이 아님"을 TypeScript에 알려 주는 표기예요.
 */

// `type Page`: 브라우저 탭의 타입이에요(type을 붙이면 타입만 가져와요).
import { expect, type Page, test } from "@playwright/test";

// 접근성 검사(axe)와 가로 넘침 검사는 다른 테스트 파일과 함께 쓰려고 helpers.ts에 두었어요.
import { expectNoA11yViolations, expectNoHorizontalScroll, loginAsAuthor } from "./helpers";

/** 긴 제목 원고의 제목(gamma-long.json) */
const LONG_TITLE = "끝없이이어지는아주아주긴제목이화면을넘치지않는지살펴보는감마영화";
/** 처음 10편(최신순). 목록은 한 번에 10편씩 보여요. */
const FIRST_TEN = ["알파 정거장", "베타 로맨스", LONG_TITLE, "델타 기록", "엡실론의 밤", "제타의 노래", "에타 전선", "세타 궁정", "이오타 목장", "카파 사건"];

// 아래 넷은 자주 찾는 요소를 짧게 부르려고 만든 화살표 함수예요. (page) => ...: page를 받아 찾은 요소를 돌려줘요.
/** 목록 영역 */
const listRegion = (page: Page) => page.getByRole("region", { name: "작품 목록" });
/** 목록 영역의 편수 안내(role="status") */
const listStatus = (page: Page) => listRegion(page).getByRole("status");
/** 목록에 보이는 리뷰 제목(h3)들을 순서대로 가져와요. */
const listTitles = (page: Page) => listRegion(page).getByRole("heading", { level: 3 }).allTextContents();
/** 검색창(<input type="search">, 역할 searchbox) */
const searchBox = (page: Page) => page.getByRole("searchbox", { name: "검색" });

/**
 * 처음 화면을 열고, 화면이 준비될 때까지(검색창이 켜질 때까지) 기다려요.
 * 미리 만든 HTML이 보인 뒤 자바스크립트가 화면을 맡기 전까지는 검색·방향키 기능이 아직 없어서, 그 전에 누른 키는 쓰이지 않아요.
 *
 * @param page 브라우저 탭
 * @param path 열 주소. 안 넘기면 "/"(기본값 매개변수). 예: "/?q=알파"
 */
async function openHome(page: Page, path = "/") {
  await page.goto(path);
  await expect(searchBox(page)).toBeEnabled();
}

test.describe("처음 화면(목록)", () => {
  test("블로그 이름(h1)과 처음 10편을 최신순으로 보이고, 몇 편이 보이는지 알린다", async ({ page }) => {
    await openHome(page);
    await expect(page).toHaveTitle("HotTake");
    // h1은 화면에서 숨겼지만(sr-only) 화면 낭독기가 찾을 수 있어요.
    await expect(page.getByRole("heading", { level: 1, name: "HotTake" })).toBeAttached();
    await expect(listStatus(page)).toHaveText("전체 11편 / 현재 10편 표시");
    expect(await listTitles(page)).toEqual(FIRST_TEN);
  });

  test("머리글 오른쪽에 소스 코드 저장소로 가는 GitHub 링크가 있고, 같은 창에서 연다", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    const github = banner.getByRole("link", { name: "GitHub", exact: true });
    await expect(github).toHaveAttribute("href", "https://github.com/deokbae-cinephile/HotTake");
    // 같은 창에서 열어요(예고 없는 새 창을 만들지 않아요, KWCAG 7.2.1).
    await expect(github).not.toHaveAttribute("target");
  });

  test("머리글 오른쪽에는 GitHub 아이콘만 보이고, 왼쪽 로고(24 × 22px)와 본문 양 끝·같은 줄에 붙는다. 로고와 이름은 세로 가운데가 같다. 로고와 이름 사이는 12px, 점선 양쪽은 22px로 같다(좁은 휴대폰 포함)", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    // 로고와 이름("작품 한 줄 평 블로그")이 처음 화면으로 가는 링크 하나예요.
    await expect(banner.getByRole("link", { name: "작품 한 줄 평 블로그", exact: true })).toHaveAttribute("href", "/");
    // 글자 "GitHub"는 화면 낭독기용으로만 남아요(화면에는 아이콘만).
    await expect(banner.getByRole("link", { name: "GitHub", exact: true }).locator(".sr-only")).toHaveText("GitHub");
    // 머리글의 본문 칸(안쪽 여백을 뺀 자리) 양 끝과 두 아이콘의 위치·크기, GitHub 링크의 누르는 영역을 재요.
    // 화면 크기를 바꿔 두 번 재려고 함수(measure)로 만들어 둬요. 안의 코드는 브라우저에서 돌아요.
    // [...header.querySelectorAll(...)]: 찾은 요소 목록을 배열로 펴서 map을 쓸 수 있게 해요.
    const measure = () =>
      banner.evaluate((header) => {
        const box = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        const [logo, mark] = [...header.querySelectorAll("a svg")].map((svg) => svg.getBoundingClientRect());
        const github = header.querySelector('a[href^="https://github.com/"]')!.getBoundingClientRect();
        const name = header.querySelector('a[href="/"] > span')!.getBoundingClientRect();
        const leader = header.querySelector(".leader")!.getBoundingClientRect();
        return {
          icons: [
            [logo.width, logo.height],
            [mark.width, mark.height],
          ],
          // 로고 왼쪽 끝 = 본문 왼쪽 끝, 아이콘 오른쪽 끝 = 본문 오른쪽 끝(둘 다 0이면 딱 맞아요)
          leftGap: Math.round(logo.left - (box.left + parseFloat(style.paddingLeft))),
          rightGap: Math.round(box.right - parseFloat(style.paddingRight) - mark.right),
          // 같은 줄(첫 줄)에 있는지: 두 아이콘의 세로 가운데가 같아요(로고 22px, GitHub 24px라 위쪽 끝은 1px 달라요).
          sameRow: Math.round(logo.top + logo.height / 2) === Math.round(mark.top + mark.height / 2),
          // 로고와 이름의 세로 가운데가 같아요.
          nameCentered: Math.abs(logo.top + logo.height / 2 - (name.top + name.height / 2)) < 1,
          hit: [Math.round(github.width), Math.round(github.height)],
          // 가로 스크롤이 생기지 않아요.
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          // 로고와 이름 사이(12px). 점선 양쪽: 이름 끝 ↔ 점선, 점선 끝 ↔ GitHub 아이콘(둘 다 22px).
          // 점선은 640px 이상에서만 보여요(없으면 null).
          nameGap: Math.round(name.left - logo.right),
          nameLeaderGap: leader.width > 0 ? Math.round(leader.left - name.right) : null,
          leaderGap: leader.width > 0 ? Math.round(mark.left - leader.right) : null,
        };
      });
    const expected = { icons: [[24, 22], [24, 24]], leftGap: 0, rightGap: 0, sameRow: true, nameCentered: true, hit: [44, 44], overflow: false, nameGap: 12 };
    const wide = await measure();
    // ?.와 ??: 화면 크기를 모르면(null) 0으로 봐요. 640px 이상이면 점선이 보여요.
    const hasLeader = (page.viewportSize()?.width ?? 0) >= 640;
    // { ...expected, 더할 항목 }: expected를 복사하고 점선 간격 두 항목을 덧붙인 새 객체예요.
    expect(wide).toEqual({ ...expected, nameLeaderGap: hasLeader ? 22 : null, leaderGap: hasLeader ? 22 : null });
    // 좁은 휴대폰(360px)에서도 한 줄이고, 아이콘은 첫 줄 오른쪽 끝에 있어요. 로고와 이름 사이도 같아요.
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await measure()).toEqual({ ...expected, nameLeaderGap: null, leaderGap: null });
  });

  test("머리글 로고 옆에 버전을 보이지 않는다", async ({ page }) => {
    await page.goto("/");
    // /\(v\d/: "(v" 다음에 숫자가 오는 글자(예: "(v2")를 찾는 정규 표현식이에요. 그런 글자가 없어야 해요.
    await expect(page.getByRole("banner")).not.toContainText(/\(v\d/);
  });

  test("검색창은 글쓰기 화면의 입력 칸과 같은 모양(2px 실선 테두리, 높이 44px)이다", async ({ page }) => {
    await openHome(page);
    const style = await searchBox(page).evaluate((input) => {
      const css = getComputedStyle(input);
      return [css.borderTopStyle, css.borderTopWidth, css.borderBottomStyle, css.borderLeftWidth, css.minHeight];
    });
    expect(style).toEqual(["solid", "2px", "solid", "2px", "44px"]);
  });

  test("검색창의 안내 글자(placeholder)는 본문과 같은 12px이다(휴대폰도). 휴대폰에서 글자를 치는 칸만 16px이다", async ({ page, isMobile }) => {
    await openHome(page);
    // getComputedStyle(요소, "::placeholder"): 안내 글자(가짜 요소)에 실제로 적용된 스타일을 읽어요.
    const [text, placeholder] = await searchBox(page).evaluate((input) => [getComputedStyle(input).fontSize, getComputedStyle(input, "::placeholder").fontSize]);
    expect(placeholder).toBe("12px");
    // 휴대폰(손가락 기기)은 아이폰의 자동 확대를 막으려고 치는 글자만 16px이에요.
    expect(text).toBe(isMobile ? "16px" : "12px");
  });

  test("단추와 칩은 입력 칸과 높이가 같다(44px): 검색창·[찾기]·분류와 정렬 칩", async ({ page }) => {
    await openHome(page);
    // boundingBox(): 화면에 실제로 그려진 위치와 크기(px)예요. Math.round로 소수점 아래를 반올림해 견줘요.
    const height = async (locator: ReturnType<Page["locator"]>) => Math.round((await locator.boundingBox())!.height);
    const input = await height(searchBox(page));
    expect(input).toBe(44);
    expect(await height(page.getByRole("button", { name: "찾기" }))).toBe(input);
    // 칩은 투명한 진짜 라디오 단추를 덮은 label(.chip)이에요. 보이는 칩 모양의 높이를 재요.
    for (const chip of await page.locator(".chip-face").all()) expect(await height(chip)).toBe(input);
  });

  test("픽셀 글꼴(갈무리11)을 받아 본문 12px·목록 16px·큰 글자 24px로 쓰고, 고정폭판(ASCII 그림용)은 오프라인 화면에서만 받는다", async ({ page }) => {
    await page.goto("/");
    // document.fonts.ready: 글꼴을 다 받을 때까지 기다려요. 그다음 받은 글꼴 목록을 봐요.
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((font) => `${font.family}:${font.status}`);
    });
    // 본문 글꼴(galmuri)은 받았고, 고정폭판(galmuriMono)은 그림이 있는 오프라인 화면에서만 받아요.
    expect(fonts.some((font) => /^"?galmuri"?:loaded$/i.test(font))).toBe(true);
    expect(fonts.some((font) => /galmuriMono.*:loaded$/i.test(font))).toBe(false);
    // 본문 12px(갈무리11이 또렷한 크기), 작품 목록 구역은 조금 키운 16px
    expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe("12px");
    expect(await listRegion(page).evaluate((region) => getComputedStyle(region).fontSize)).toBe("16px");

    // 404 화면: 큰 제목(text-big)은 24px이고, 텔레비전 그림("NO  SIGNAL")은 없어요.
    await page.goto("/no-such-page");
    expect(await page.getByRole("heading", { level: 1 }).evaluate((element) => getComputedStyle(element).fontSize)).toBe("24px");
    await expect(page.getByText(/NO\s+SIGNAL/)).toHaveCount(0);

    // 오프라인 화면의 ASCII 그림은 글자 폭이 모두 같은 고정폭판으로 그려 줄 끝이 맞아요.
    // (그림은 꾸밈이라 화면 낭독기에서 숨겨 역할·이름이 없어요. 그래서 그림 속 글자 "NO CARRIER"로 찾아요.)
    await page.goto("/offline");
    const art = await page.getByText(/NO CARRIER/).evaluate(async (pre) => {
      await document.fonts.ready;
      // 그림의 첫 줄과 마지막 테두리 줄처럼 글자 수가 같은 줄은 그려진 너비도 같아야 해요(고정폭).
      const lines = (pre.textContent ?? "").split("\n").filter((line) => line.trim().startsWith("|"));
      const widths = lines.map((line) => {
        const probe = document.createElement("span");
        probe.textContent = line;
        probe.style.whiteSpace = "pre";
        pre.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return Math.round(width * 100) / 100;
      });
      return {
        mono: [...document.fonts].some((font) => /galmuriMono/i.test(font.family) && font.status === "loaded"),
        sameWidth: new Set(widths).size === 1,
      };
    });
    expect(art).toEqual({ mono: true, sameWidth: true });
  });

  test("검색어를 쓰고 Enter를 누르면 거르고, 조건을 주소에 남긴다", async ({ page }) => {
    await openHome(page);
    // 실제 브라우저에서는 <search> 태그가 "검색" 역할(랜드마크)로 잡혀요.
    const search = page.getByRole("search", { name: "리뷰 찾기" });
    await expect(search.getByRole("searchbox", { name: "검색" })).toHaveAttribute("placeholder", "검색어를 입력하세요");
    await searchBox(page).fill("알파");
    await searchBox(page).press("Enter");

    // 주소의 q에 검색어가 남아요(한글은 주소에서 %EC... 모양으로 바뀌어서, 풀어 읽은 값으로 견줘요).
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("알파");
    await expect(listStatus(page)).toHaveText("11편 중 1편");
    expect(await listTitles(page)).toEqual(["알파 정거장"]);

    // 새로 고침해도 주소의 조건으로 같은 결과가 보여요.
    await page.reload();
    await expect(listStatus(page)).toHaveText("11편 중 1편");
    await expect(searchBox(page)).toHaveValue("알파");
  });

  test("분류를 고르면 바로 거르고, 평점순으로 정렬할 수 있다", async ({ page }) => {
    await openHome(page);
    await page.getByRole("group", { name: "분류" }).getByRole("radio", { name: "도서 5편" }).check();
    await expect(listStatus(page)).toHaveText("11편 중 5편");
    expect(await listTitles(page)).toEqual(["베타 로맨스", "엡실론의 밤", "제타의 노래", "이오타 목장", "람다 질주"]);

    await page.getByRole("radio", { name: "평점순" }).check();
    // 주소에는 분류를 영어 이름으로 적어요(도서 → book).
    await expect(page).toHaveURL(/\?category=book&sort=rating$/);
    await expect.poll(() => listTitles(page)).toEqual(["람다 질주", "엡실론의 밤", "베타 로맨스", "제타의 노래", "이오타 목장"]);
  });

  test("분류 칩은 전체·영화·도서 순서로 보인다", async ({ page }) => {
    await openHome(page);
    const categories = page.getByRole("group", { name: "분류" });
    // 라디오 단추의 접근 이름("영화 6편"처럼 분류 + 편수)으로 순서를 확인해요. 레이블 연결이 끊기면 이름이 비어 실패해요.
    const radios = categories.getByRole("radio");
    await expect(radios).toHaveCount(3);
    // entries(): [순서 번호, 값] 짝을 하나씩 꺼내요. nth(index): index번째(0부터) 요소예요.
    for (const [index, name] of ["전체 11편", "영화 6편", "도서 5편"].entries()) {
      await expect(radios.nth(index)).toHaveAccessibleName(name);
    }
  });

  test("고르지 않은 칩은 ▶ 자리를 비워 두지 않는다", async ({ page }) => {
    await openHome(page);
    // 고른 칩(전체)의 ▶는 보이고, 고르지 않은 칩(영화)의 ▶는 자리도 차지하지 않아요(display: none).
    const checked = page.locator(".chip", { has: page.getByRole("radio", { name: "전체 11편" }) }).locator(".chip-mark");
    const unchecked = page.locator(".chip", { has: page.getByRole("radio", { name: "영화 6편" }) }).locator(".chip-mark");
    await expect(checked).toBeVisible();
    expect(await unchecked.evaluate((mark) => getComputedStyle(mark).display)).toBe("none");
  });

  test("주소로 들어온 조건(분류·정렬)을 그대로 보인다(한글 분류 주소도 받는다)", async ({ page }) => {
    // encodeURIComponent: 한글을 주소에 쓸 수 있는 글자(%EC%98%81...)로 바꿔요.
    await openHome(page, `/?category=${encodeURIComponent("영화")}&sort=rating`);
    await expect(page.getByRole("radio", { name: "영화 6편" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "평점순" })).toBeChecked();
    await expect.poll(() => listTitles(page)).toEqual([LONG_TITLE, "알파 정거장", "카파 사건", "에타 전선", "세타 궁정", "델타 기록"]);
  });

  test("찾는 리뷰가 없으면 알리고, 조건을 지우면 전체로 돌아가 검색란에 초점을 둔다", async ({ page }) => {
    await openHome(page, "/?q=없는영화");
    await expect(page.getByText("찾는 리뷰가 없습니다.")).toBeVisible();
    await expect(listStatus(page)).toHaveText("11편 중 0편");

    await page.getByRole("button", { name: "검색 조건 지우기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(listStatus(page)).toHaveText("전체 11편 / 현재 10편 표시");
    await expect(searchBox(page)).toBeFocused();
  });

  test("무한 스크롤: 목록 끝으로 내려가면 나머지 리뷰가 저절로 보인다", async ({ page }) => {
    await openHome(page);
    // 목록의 제목은 링크가 아닌 글자(h3)예요.
    const lambda = page.getByRole("heading", { level: 3, name: "람다 질주" });
    await expect(lambda).toHaveCount(0);
    // 목록 끝의 [더 보기] 자리까지 내려가요.
    // scrollIntoViewIfNeeded: 그 요소가 화면에 보이도록 스크롤해요.
    await page.getByRole("button", { name: "1편 더 보기" }).scrollIntoViewIfNeeded();
    await expect(lambda).toBeVisible();
    await expect(listStatus(page)).toHaveText("전체 11편");
    await expect(page.getByRole("button", { name: /더 보기/ })).toHaveCount(0);
  });

  test("접근성 규칙 위반이 없다(처음 상태, 거른 상태, 결과 없음)", async ({ page }) => {
    await openHome(page);
    await expectNoA11yViolations(page);
    await page.goto("/?category=book");
    await expectNoA11yViolations(page);
    await page.goto("/?q=없는영화");
    await expectNoA11yViolations(page);
  });

  test("좁은 화면(320px)에서도 가로로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");
    await expectNoHorizontalScroll(page);
  });

  test("바닥글: 위쪽 점선 아래 가운데에 저작권 줄('© 2026 deokbae. All rights reserved.')이 있다", async ({ page }) => {
    await openHome(page);
    const copyright = page.getByRole("contentinfo").getByText("© 2026 deokbae. All rights reserved.", { exact: true });
    await expect(copyright).toBeVisible();
    const look = await copyright.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const wrap = getComputedStyle(element.parentElement!);
      // 글자 줄의 가운데와, 저작권 줄 칸의 가운데를 견줘요(가운데 정렬이면 같아요).
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return {
        align: getComputedStyle(element).textAlign,
        centered: Math.abs(text.left + text.width / 2 - (box.left + box.width / 2)) < 1,
        border: wrap.borderTopStyle,
      };
    });
    // 저작권 줄 위로 점선이 그어져 있어요.
    expect(look).toEqual({ align: "center", centered: true, border: "dotted" });

    // 맨 아래까지 내려도 화면 아래에 떠 있는 단추([맨 위로] 등)가 저작권 줄을 가리지 않아요(좁은 휴대폰 포함).
    // 맨 아래로 내리면 남은 리뷰를 저절로 더 불러와 문서가 길어져요. 먼저 모든 리뷰가 나올 때까지 기다려요.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect(listStatus(page)).toHaveText("전체 11편");
    for (const width of [page.viewportSize()!.width, 320]) {
      await page.setViewportSize({ width, height: 700 });
      // 진짜 맨 아래(더 내려갈 곳이 없음)까지 내려요.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const root = document.documentElement;
            root.style.scrollBehavior = "auto";
            window.scrollTo(0, root.scrollHeight);
            return Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight;
          }),
        )
        .toBe(true);
      await expect(page.getByRole("button", { name: "맨 위로" })).toBeVisible();
      const overlaps = await copyright.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const floating = [...document.querySelectorAll<HTMLElement>(".fixed button, .fixed a, button.btn-float, a.btn-float")].filter(
          (control) => control.getClientRects().length > 0,
        );
        return floating
          .map((control) => control.getBoundingClientRect())
          .filter((box) => box.left < text.right && box.right > text.left && box.top < text.bottom && box.bottom > text.top).length;
      });
      // 두 번째 값(`${width}px`)은 실패했을 때 어느 너비에서 실패했는지 보여 주는 메시지예요.
      expect(overlaps, `${width}px`).toBe(0);
    }
  });
});

test.describe("넓은 화면의 목록 배치", () => {
  test.skip(({ isMobile }) => isMobile, "넓은 화면 전용");

  test("검색 칸은 16~18rem 너비로 목록 왼쪽에 놓이고, 스크롤해도 왼쪽 위에 붙어 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    const aside = page.getByRole("search", { name: "리뷰 찾기" });
    const list = listRegion(page);
    const asideBox = (await aside.boundingBox())!;
    const listBox = (await list.boundingBox())!;

    // 같은 줄(위쪽 높이가 같음)에, 검색 칸이 왼쪽이고 너비는 16~18rem(256~288px)이에요.
    expect(Math.abs(asideBox.y - listBox.y)).toBeLessThan(2);
    expect(asideBox.x + asideBox.width).toBeLessThan(listBox.x);
    expect(asideBox.width).toBeGreaterThanOrEqual(256);
    expect(asideBox.width).toBeLessThanOrEqual(288);

    // 많이 내려도 검색 칸은 화면 위쪽에 붙어 보이고, 목록만 움직여요.
    await page.evaluate(() => window.scrollTo(0, 900));
    // toBeInViewport: 요소가 지금 화면 안에 보이는 자리에 있는지 확인해요.
    await expect(aside).toBeInViewport();
    expect((await aside.boundingBox())!.y).toBeLessThan(80);
  });

  test("목록 한 편: 제목은 링크가 아니고(항목 안에 링크가 없음), 마우스를 올려도 반전되지 않는다", async ({ page }) => {
    await openHome(page);
    const item = page.getByRole("article", { name: "알파 정거장" });
    await expect(item.getByRole("link")).toHaveCount(0);
    // 누를 곳이 없어 마우스를 올려도 반전되지 않아요.
    const background = () => item.evaluate((element) => getComputedStyle(element).backgroundColor);
    const before = await background();
    await item.hover();
    expect(await background()).toBe(before);
  });

  test("목록 한 편의 둘째 줄은 연도·감독 또는 작가 이름만(이름표·분류 태그 없음) 보이고, 길면 두 줄까지만 보인다", async ({ page }) => {
    await openHome(page);
    const item = page.getByRole("article", { name: "알파 정거장" });
    // 분류 태그는 목록에 두지 않아요. 감독 또는 작가는 이름표 없이 이름만 둬요.
    await expect(item).not.toContainText("[영화]");
    await expect(item).not.toContainText("감독");
    // ^는 "처음부터", $는 "끝까지", \s는 빈칸이에요. 둘째 줄 글자 전체가 정확히 이 모양이어야 해요.
    const facts = item.getByText(/^2020\s·\s김시험$/);
    await expect(facts).toBeVisible();
    // 아주 길게 바꿔 보면 두 줄까지만 보이고 나머지는 잘려 "…"로 줄여요(line-clamp-2).
    const clamp = await facts.evaluate((element) => {
      // repeat(20): 글자를 20번 이어 붙여요. 시험 안에서만 글자를 바꿔 보는 것이라 원고는 그대로예요.
      element.textContent = "아주 긴 감독 이름이 끝없이 이어지는 경우 · ".repeat(20);
      return {
        lines: Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)),
        clipped: element.scrollHeight > element.clientHeight,
      };
    });
    expect(clamp).toEqual({ lines: 2, clipped: true });
  });

  test("이미지 썸네일은 가로 2 : 세로 3으로 맨 앞에 있고(넓은 화면 70px), 평점은 첫째 줄 끝, 한 줄 평은 둘째 줄 바로 아래에 이어진다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page);
    const item = listRegion(page).locator("li").first();
    const box = (await item.locator(".image-frame").boundingBox())!;
    // 넓은 화면의 썸네일은 70px이고 가로 2 : 세로 3이에요(반올림 오차 0.02까지).
    expect(Math.round(box.width)).toBe(70);
    expect(Math.abs(box.width / box.height - 2 / 3)).toBeLessThanOrEqual(0.02);
    // 앞에 "-"나 번호가 없고, 썸네일이 제목보다 앞(왼쪽)에 있어요.
    await expect(item.locator("article > span[aria-hidden='true']")).toHaveCount(0);
    const title = (await item.getByRole("heading", { level: 3 }).boundingBox())!;
    expect(box.x).toBeLessThan(title.x);
    // 평점은 첫째 줄 오른쪽 끝에 하나만 보여요(이미지 아래의 휴대폰용 평점은 숨어 있어요).
    const ratings = item.getByText("평점 5점 만점에 4.5점");
    await expect(ratings).toHaveCount(2);
    // :visible은 Playwright가 더해 주는 선택자로, 화면에 보이는 것만 골라요.
    const shown = item.locator("span.whitespace-nowrap:visible");
    await expect(shown).toHaveCount(1);
    const rating = (await shown.boundingBox())!;
    expect(Math.abs(rating.y + rating.height / 2 - (title.y + title.height / 2))).toBeLessThan(4);
    expect(rating.x).toBeGreaterThan(title.x + title.width);
    // 한 줄 평은 둘째 줄 바로 아래에 이어 놓여요(썸네일 아래 끝으로 밀어 내리지 않아요). 줄 사이는 첫째·둘째 줄 사이보다 조금 넓어요.
    // locator(".."): 바로 위 부모 요소예요(제목 h3를 감싼 첫째 줄 전체).
    const first = (await item.getByRole("heading", { level: 3 }).locator("..").boundingBox())!;
    const facts = (await item.getByText(/^2020\s·\s김시험$/).boundingBox())!;
    const oneLiner = (await item.locator("p", { hasText: "한 줄 평:" }).boundingBox())!;
    const factsGap = facts.y - (first.y + first.height);
    const oneLinerGap = oneLiner.y - (facts.y + facts.height);
    expect(oneLinerGap).toBeGreaterThan(factsGap);
    expect(oneLinerGap).toBeLessThan(first.height);
  });
});

test.describe("휴대폰의 목록 배치", () => {
  test.skip(({ isMobile }) => !isMobile, "휴대폰 화면 전용");

  test("휴대폰에서는 평점이 이미지 아래 가운데에 놓이고, 썸네일은 56px 그대로다", async ({ page }) => {
    await openHome(page);
    const item = listRegion(page).locator("li").first();
    const image = (await item.locator(".image-frame").boundingBox())!;
    expect(Math.round(image.width)).toBe(56);
    const shown = item.locator("span.whitespace-nowrap:visible");
    await expect(shown).toHaveCount(1);
    const rating = (await shown.boundingBox())!;
    // 이미지 바로 아래(사이 8px), 가로 가운데가 같아요.
    expect(Math.round(rating.y - (image.y + image.height))).toBe(8);
    expect(Math.abs(rating.x + rating.width / 2 - (image.x + image.width / 2))).toBeLessThan(1);
    await expectNoHorizontalScroll(page);
  });

  test("휴대폰에서도 한 줄 평 위에 여백을 둔다(첫째·둘째 줄 사이보다 조금 넓게)", async ({ page }) => {
    await openHome(page);
    const item = page.getByRole("article", { name: "알파 정거장" });
    // 첫째 줄(제목 · 평점 줄), 둘째 줄(연도 · 감독), 한 줄 평
    const first = (await item.getByRole("heading", { level: 3 }).locator("..").boundingBox())!;
    const facts = (await item.getByText(/^2020\s·\s김시험$/).boundingBox())!;
    const oneLiner = (await item.locator("p", { hasText: "한 줄 평:" }).boundingBox())!;
    // 둘째 줄과 한 줄 평 사이가 첫째·둘째 줄 사이보다 넓어, 한 줄 평이 따로 보여요.
    expect(oneLiner.y - (facts.y + facts.height)).toBeGreaterThan(facts.y - (first.y + first.height));
  });
});

test.describe("이미지를 받지 못할 때", () => {
  // 서비스 워커가 그림 요청을 대신 받으면 아래 page.route로 막을 수 없어서, 이 시험에서는 꺼요.
  // test.use: 이 묶음에서만 쓸 설정을 바꿔요.
  test.use({ serviceWorkers: "block" });

  test("목록 썸네일을 받지 못하면 스켈레톤을 치우고 기본 이미지(픽셀 그림)를 보인다", async ({ page }) => {
    // 이미지 요청을 실패시켜요(파일이 없거나 연결이 끊긴 것처럼).
    // page.route(조건, 처리): 조건에 맞는 요청(줄인 이미지 /_next/image, 원본 /images/)을 가로채 abort()로 끊어요.
    await page.route((url) => url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/images/"), (route) => route.abort());
    await openHome(page);
    // 시험용 원고 중 이미지가 있는 것은 알파 정거장뿐이에요.
    const thumb = page.getByRole("article", { name: "알파 정거장" }).locator(".image-frame");
    await expect(thumb.locator("svg")).toBeVisible();
    await expect(thumb.locator("img")).toHaveCount(0);
    await expect(thumb.locator(".skeleton")).toHaveCount(0);
  });

});

test.describe("맨 위로 단추", () => {
  test("내려가면 나타나고(아이콘 없이 글자만), 누르면 맨 위로 올라가 머리글에 초점을 둔다", async ({ page }) => {
    // 방문자 화면에서 재요(로그인하면 [+]가 생겨 [맨 위로]가 그 왼쪽으로 옮겨 가요. admin.spec.ts에서 확인해요).
    // 좁은 높이(600px)에서는 처음 화면 목록도 충분히 길어요.
    await page.setViewportSize({ width: 800, height: 600 });
    await openHome(page);
    const toTop = page.getByRole("button", { name: "맨 위로" });
    await expect(toTop).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(toTop).toBeVisible();
    await expect(toTop).toHaveText("맨 위로");
    // 화면 오른쪽 아래 구석(오른쪽·아래 끝에서 16px)에 떠 있어요.
    const box = (await toTop.boundingBox())!;
    expect([Math.round(800 - (box.x + box.width)), Math.round(600 - (box.y + box.height))]).toEqual([16, 16]);
    await toTop.click();

    // 부드럽게 올라가는 데 시간이 조금 걸려서, 0이 될 때까지 다시 확인해요(expect.poll).
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("banner")).toBeFocused();
    await expect(toTop).toBeHidden();
  });
});

test.describe("없는 주소(404)", () => {
  test("404 상태로 안내하고 목록으로 돌아갈 수 있다", async ({ page }) => {
    // goto는 응답(response)을 돌려줘요. status()로 서버가 보낸 상태 번호를 확인해요.
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    // /reviews/... 아래에도 화면이 없어서 404예요. page.request는 탭을 옮기지 않고 응답만 받아 와요.
    expect((await page.request.get("/reviews/alpha-station")).status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "찾는 화면이 없습니다" })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("link", { name: "목록으로 가기" }).click();
    await expect(page.getByRole("region", { name: "작품 목록" })).toBeVisible();
  });
});

test.describe("키보드", () => {
  // 휴대폰(터치) 화면에서는 Tab 키를 쓰지 않으니 데스크톱에서만 확인해요.
  test.skip(({ isMobile }) => isMobile, "키보드 시험은 데스크톱에서만");

  test("처음 Tab을 누르면 '본문 바로가기'가 보이고, Enter로 본문에 초점이 간다", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "본문 바로가기" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    // #main: id가 main인 요소(본문). 바로가기 링크가 가리키는 곳이에요.
    await expect(page.locator("#main")).toBeFocused();
  });

  test("목록: ▼를 눌러도 리뷰를 고르지 않는다(글쓴이의 [수정]으로도 가지 않는다)", async ({ page, baseURL }) => {
    await openHome(page);
    // 제목이 링크가 아니라 고를 리뷰가 없어요. ▼는 평소처럼 화면을 스크롤해요(초점은 그대로).
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("body")).toBeFocused();

    // 글쓴이의 목록에는 한 편마다 [수정] 링크가 있지만, ▼ ▶가 그 링크로 초점을 옮기지 않아요.
    await loginAsAuthor(page, baseURL!);
    await openHome(page);
    await expect(page.getByRole("link", { name: /리뷰 수정$/ }).first()).toBeVisible();
    for (const key of ["ArrowDown", "ArrowRight"]) {
      await page.keyboard.press(key);
      await expect(page.locator("body")).toBeFocused();
    }
  });

  test("키보드로 [더 보기]에 가면 나머지를 불러오고, 새로 나온 첫 리뷰(리뷰 한 편)로 초점이 간다. 글쓴이도 [수정]이 아니라 리뷰로 간다", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 방문자, 그다음 글쓴이(목록에 [수정] 링크가 있어요)로 똑같이 확인해요.
    for (const asAuthor of [false, true]) {
      if (asAuthor) await loginAsAuthor(page, baseURL!);
      await openHome(page);
      // 단추에 초점이 가면 화면이 단추까지 스크롤되면서 저절로 불러오기가 일어나요.
      // 그때 단추가 사라져도 초점을 잃지 않고, 새로 나온 첫 리뷰(람다 질주)로 옮겨 가요.
      await page.getByRole("button", { name: "1편 더 보기" }).focus();
      // 누르는 사이 단추가 사라지면 press가 오류를 낼 수 있어서, catch로 오류를 무시하고 결과(초점)만 확인해요.
      await page.keyboard.press("Enter").catch(() => {});
      // 제목이 링크가 아니라서, 리뷰 한 편(article)으로 초점이 가고 점선 테두리로 보여요.
      const lambda = page.getByRole("article", { name: "람다 질주" });
      await expect(lambda).toBeFocused();
      expect(await lambda.evaluate((article) => getComputedStyle(article).outlineStyle)).toBe("dashed");
    }
  });

  test("검색창과 분류 단추에서는 방향키를 가로채지 않는다", async ({ page }) => {
    await openHome(page);
    await searchBox(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(searchBox(page)).toBeFocused();

    // 라디오 단추에서 ▼는 다음 분류(영화)를 고르는 원래 기능 그대로예요. 초점도 목록으로 끌려가지 않고 그 단추에 있어요.
    await page.getByRole("radio", { name: "전체 11편" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "전체 11편" })).not.toBeChecked();
    const next = page.getByRole("radio", { name: "영화 6편" });
    await expect(next).toBeChecked();
    await expect(next).toBeFocused();
  });

});
