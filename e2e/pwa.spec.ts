/**
 * @file 설치형 웹 앱(PWA) E2E 테스트 (e2e/pwa.spec.ts)
 * 읽는 순서: 81/84번째 · 8단계(설정·테스트·배포)
 *   앞: e2e/admin.spec.ts → 다음: open-next.config.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 진짜 브라우저(Chromium)로 확인해요.
 *   1. 설치 정보(매니페스트)와 아이콘이 있고, 앱으로 설치하는 데 필요한 값이 들어 있는지
 *   2. 서비스 워커가 켜진 뒤, 한 번 본 처음 화면이 인터넷이 끊겨도 열리는지
 *   3. 처음 보는 화면은 오프라인 안내 화면으로 대신하는지
 *   4. 글쓴이 화면·API·화면 데이터(RSC)는 저장해 두지 않는지
 *   5. 저장소가 넘치면 상한에 맞춰 오래된 것부터 지우는지
 *   시험하는 대상은 public/sw.js(서비스 워커)와 src/app/manifest.ts(설치 정보)예요.
 *
 * 오프라인 흉내: context.setOffline(true)로 이 브라우저의 인터넷을 끊어요. 끝나면 다시 켜요.
 *
 * Playwright 테스트 문법
 *   test.describe(이름, 함수): 관련 테스트를 한 묶음으로 모아요.
 *   test(이름, async ({ page, request, context, baseURL }) => {...}): 테스트 하나.
 *     { page, ... }는 Playwright가 테스트마다 새로 준비해 넘겨 주는 도구(fixture)를 구조 분해로 받는 거예요.
 *     page: 브라우저 탭, context: 탭들이 함께 쓰는 브라우저 환경(쿠키·오프라인 등), request: 탭 없이 HTTP 요청을 보내는 도구.
 *   expect(값).toBe(...): 값이 기대와 같은지 확인해요. await expect(요소).toBeVisible()처럼 요소를 넘기면 될 때까지 잠시 기다려요.
 *   expect.poll(함수): 함수를 되풀이해 부르며 결과가 기대와 같아질 때까지 기다려요(비동기로 늦게 끝나는 일을 확인할 때).
 */

// expect: 확인 함수, test: 테스트를 정의하는 함수
import { expect, test } from "@playwright/test";

import { expectNoA11yViolations, expectNoHorizontalScroll, loginAsAuthor } from "./helpers";

test.describe("설치형 웹 앱(PWA)", () => {
  test("설치 정보(매니페스트)와 아이콘이 있다", async ({ page, request }) => {
    await page.goto("/");
    // Next.js가 모든 페이지 <head>에 매니페스트 링크를 달아 줘요(app/manifest.ts).
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    // request: 브라우저 탭 없이 파일만 받아 오는 도구예요.
    // href!: 끝의 !는 "이 값은 null이 아니에요"라고 TypeScript에 알려 주는 표기예요(바로 위에서 확인했으니까요).
    const manifestUrl = new URL(href!, page.url());
    const manifest = await (await request.get(manifestUrl.href)).json();
    // toMatchObject: 적은 항목만 같은지 봐요(다른 항목이 더 있어도 괜찮아요).
    expect(manifest).toMatchObject({ name: "HotTake", start_url: "./", scope: "./", display: "standalone" });

    // 매니페스트의 아이콘 주소는 상대 주소라 매니페스트 위치를 기준으로 풀어서 받아 봐요.
    // as { src: string }[]: JSON에서 읽은 값의 모양을 TypeScript에 알려 주는 표기(타입 단언)예요.
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toBe("image/png");
    }

    // 아이폰·아이패드 홈 화면 아이콘(app/apple-icon.png)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-icon/);
  });

  test("한 번 본 처음 화면은 오프라인에서도 열리고, 처음 보는 화면은 오프라인 안내를 보인다", async ({ page, context }) => {
    await page.goto("/");
    // page.evaluate: 브라우저 탭 안에서 함수를 실행해요. ready는 서비스 워커가 켜지면 풀리는 Promise예요.
    await page.evaluate(() => navigator.serviceWorker.ready);
    // 처음 화면(저장소 열쇠는 맨 처음 주소 그대로 "/"예요)과 CSS가 저장될 때까지 기다려요.
    // performance.getEntriesByType("resource"): 이 탭이 받은 파일 목록이에요. 그중 우리 사이트의 CSS만 골라요.
    // 15_000ms(15초) 안에 true가 되지 않으면 실패해요.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const pageCached = Boolean(await caches.match(`${location.origin}/`));
            const cssUrls = performance
              .getEntriesByType("resource")
              .map((entry) => entry.name)
              .filter((name) => name.startsWith(location.origin) && name.endsWith(".css"));
            const cssCached = await Promise.all(cssUrls.map((url) => caches.match(url)));
            // every(Boolean): 모든 CSS가 저장소에 있으면(찾은 값이 비어 있지 않으면) true
            return pageCached && cssUrls.length > 0 && cssCached.every(Boolean);
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    // 인터넷을 끊고 새로 고침해도 목록이 열리고, CSS도 저장본에서 와요(화면 바탕색 #020802).
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("region", { name: "작품 목록" })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(2, 8, 2)");

    // 처음 보는 화면은 저장본이 없으니 오프라인 안내 화면이 대신 보여요.
    // (로그인·글쓰기 화면은 서비스 워커가 손대지 않는 주소라, 한 번도 열지 않은 다른 주소로 확인해요.)
    await page.goto("/never-visited");
    await expect(page.getByRole("heading", { level: 1, name: "인터넷에 연결되어 있지 않습니다" })).toBeVisible();
    // 오프라인 안내 화면도 접근성 규칙을 지키고, 좁은 화면에서 넘치지 않아야 해요.
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    await context.setOffline(false);
  });

  test("글쓴이 화면(로그인·글쓰기)과 API, 화면 데이터(RSC) 요청은 저장해 두지 않는다", async ({ page, baseURL }) => {
    await page.goto("/login");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // baseURL!: playwright.config.ts의 use.baseURL. 늘 정해 두었으니 !로 "비어 있지 않음"을 알려요.
    // 글쓴이로 로그인해, 처음 화면의 [+](리뷰 추가) 링크로 글쓰기 화면에 들어가며 화면 데이터(RSC) 요청을 만들어요.
    await loginAsAuthor(page, baseURL!);
    await page.goto("/");
    await page.getByRole("link", { name: "리뷰 추가" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "리뷰 추가" })).toBeVisible();

    // 저장소의 모든 열쇠를 모아, 로그인 화면·API·_rsc가 없는지 확인해요.
    // caches.keys(): 저장소 이름들 → 저장소마다 keys(): 저장된 요청들 → 주소만 모아 flat()으로 한 줄 배열로 펴요.
    const keys = await page.evaluate(async () => {
      const names = await caches.keys();
      const all = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)));
      return all.flat();
    });
    // /.../는 정규 표현식(글자 무늬)이에요. 주소에 /login, /write, /api/, _rsc= 중 하나라도 있으면 실패해요.
    expect(keys.some((url) => /\/login|\/write|\/api\/|_rsc=/.test(url))).toBe(false);
  });

  test("저장소가 넘치면 오래된 것부터 지워 상한(페이지 40개·파일 120개)을 지키고, 처음 화면과 오프라인 안내 화면은 남긴다", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // 설치할 때 저장하는 오프라인 안내 화면이 들어갈 때까지 기다려요.
    await expect.poll(() => page.evaluate(async () => Boolean(await caches.match(`${location.origin}/offline`))), { timeout: 15_000 }).toBe(true);

    // 일부러 넘치게 넣어요: 가짜 페이지 60개, 가짜 이미지 150개(public/sw.js의 저장소 이름 그대로. 판 번호 VERSION도 같아야 해요).
    // 페이지 주소는 실제로 없는 아무 주소여도 돼요. 저장소에 쌓이는 개수만 시험해요.
    await page.evaluate(async () => {
      const pages = await caches.open("blog-pages-v3");
      const runtime = await caches.open("blog-runtime-v3");
      for (let index = 0; index < 60; index += 1) await pages.put(`${location.origin}/reviews/fake-${index}`, new Response("page"));
      for (let index = 0; index < 150; index += 1) await runtime.put(`${location.origin}/images/fake/${index}.webp`, new Response("image"));
    });
    // 저장 부탁을 보내면(빈 목록이어도) 서비스 워커가 끝에 상한에 맞춰 정리해요.
    // postMessage: 켜진 서비스 워커(registration.active)에 메시지를 보내요. sw.js의 "message" 이벤트가 받아요.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      registration.active!.postMessage({ type: "CACHE_URLS", pages: [], assets: [] });
    });
    // 페이지는 상한 40개 + 늘 남기는 2개(처음 화면, 오프라인 안내), 파일은 120개
    await expect
      .poll(
        () =>
          page.evaluate(async () => [
            (await (await caches.open("blog-pages-v3")).keys()).length,
            (await (await caches.open("blog-runtime-v3")).keys()).length,
          ]),
        { timeout: 15_000 },
      )
      .toEqual([42, 120]);
    // 오래된 것(먼저 넣은 것)부터 지웠고, 처음 화면과 오프라인 안내 화면은 남았어요.
    expect(
      await page.evaluate(async () => [
        Boolean(await caches.match(`${location.origin}/`)),
        Boolean(await caches.match(`${location.origin}/offline`)),
        Boolean(await caches.match(`${location.origin}/reviews/fake-0`)),
        Boolean(await caches.match(`${location.origin}/reviews/fake-59`)),
      ]),
    ).toEqual([true, true, false, true]);
  });
});
