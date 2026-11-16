/**
 * @file E2E 테스트 도우미 (e2e/helpers.ts)
 * 읽는 순서: 76/84번째 · 8단계(설정·테스트·배포)
 *   앞: playwright.config.ts → 다음: e2e/admin-account.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 여러 E2E 테스트 파일이 함께 쓰는 확인 함수를 모아 둬요.
 *
 * 누가 쓰나요?
 *   e2e/blog.spec.ts, e2e/admin.spec.ts, e2e/pwa.spec.ts가 필요한 함수를 import해요.
 * 이름이 .spec.ts로 끝나지 않아서 Playwright가 테스트 파일로 실행하지는 않아요.
 */

// AxeBuilder: 접근성 검사 도구 axe를 Playwright 탭에서 돌리는 도우미
import { AxeBuilder } from "@axe-core/playwright";
// expect: 결과를 확인하는 함수. `type Page`: 브라우저 탭 하나를 나타내는 타입(타입만 가져와요).
import { expect, type Page } from "@playwright/test";

import { E2E_ADMIN } from "./admin-account";

/**
 * axe로 접근성 규칙 위반이 없는지 검사해요.
 * withTags: WCAG 2.0·2.1·2.2의 A, AA 수준 규칙만 골라 검사해요.
 * 위반이 있으면 "규칙 이름: 문제 요소" 목록이 실패 메시지에 나와 무엇을 고칠지 알 수 있어요.
 * (axe는 Playwright가 페이지에 직접 넣어 실행해서, 인터넷이 끊긴 화면에서도 검사할 수 있어요.)
 * axe를 통과해도 KWCAG(한국형 웹 콘텐츠 접근성 지침)를 모두 지킨 것은 아니에요. 자동으로 찾을 수 있는 문제만 찾아요.
 *
 * @param page 검사할 브라우저 탭(검사하고 싶은 화면을 미리 열어 둬요)
 * @returns 끝나면 풀리는 Promise. 위반이 있으면 expect가 실패해요.
 * @example await expectNoA11yViolations(page);
 */
export async function expectNoA11yViolations(page: Page) {
  // 구조 분해: analyze()가 돌려준 결과에서 위반 목록(violations)만 꺼내요.
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  // 위반마다 "규칙 이름: 요소1, 요소2" 글자로 바꿔, 빈 배열([])과 같은지 봐요. 다르면 그 글자들이 실패 메시지에 나와요.
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/**
 * 두 상자(boundingBox)가 겹치는지 알려 줘요. 단추가 글자를 가리지 않는지 볼 때 써요.
 * 좌표를 하나하나 맞추지 않고 "겹치지 않음"만 봐서, 여백이 조금 바뀌어도 시험이 깨지지 않아요.
 * 가로로도 세로로도 서로의 범위에 걸쳐 있어야 겹친 것이에요(한쪽이라도 떨어져 있으면 안 겹쳐요).
 *
 * @param a 첫째 상자(왼쪽 위 x·y와 너비·높이, 단위 px)
 * @param b 둘째 상자
 * @returns 겹치면 true
 * @example overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }) // → true
 */
export function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * 문서 너비가 화면 너비보다 넓으면(가로 스크롤이 생기면) 실패해요.
 * page.evaluate(함수): 그 함수를 브라우저 탭 안에서 실행하고 결과를 받아 와요(그래서 document·window를 쓸 수 있어요).
 *
 * @param page 검사할 브라우저 탭
 */
export async function expectNoHorizontalScroll(page: Page) {
  const { overflow, offenders } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    // 화면 오른쪽 끝을 넘어선 요소들(태그.클래스 오른쪽 끝 px). 실패했을 때 어디가 넘쳤는지 바로 알 수 있게 모아요.
    const found = [...document.querySelectorAll("body *")]
      .map((element) => ({ element, right: element.getBoundingClientRect().right }))
      .filter(({ right }) => right > width + 0.5)
      .slice(0, 5)
      .map(({ element, right }) => `${element.tagName.toLowerCase()}.${String(element.className).replace(/\s+/g, ".")} → ${Math.round(right)}px`);
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, offenders: found };
  });
  // 두 번째 인자: 실패 문구에 덧붙일 설명이에요. 넘친 요소 목록이 함께 보여요.
  expect(overflow, `화면(가로)을 넘친 요소: ${offenders.join(" / ") || "찾지 못함"}`).toBeLessThanOrEqual(0);
}

/**
 * 글쓴이로 로그인해요(로그인 API를 바로 불러 세션 쿠키를 받아요. 로그인 화면을 거치지 않아 빨라요).
 * 글쓴이에게만 보이는 것(목록의 [수정]·[삭제], [+] 리뷰 추가 등)을 시험할 때 먼저 이 함수를 불러요.
 * page.request는 브라우저 탭과 쿠키를 함께 써서, 받은 세션 쿠키가 그대로 탭에도 들어가요.
 *
 * @param page 시험할 브라우저 탭
 * @param baseURL 시험용 블로그 주소(playwright.config.ts의 use.baseURL). 로그인 API는 같은 곳에서 온 요청(Origin)만 받아요.
 */
export async function loginAsAuthor(page: Page, baseURL: string) {
  // 계정은 시험용 서버와 같은 것을 써요(admin-account.ts).
  // data: JSON 본문으로 보내요. headers의 Origin: "같은 사이트에서 온 요청"임을 밝혀요(다른 사이트의 위조 요청을 막는 검사를 통과해요).
  const response = await page.request.post("/api/session", {
    data: { id: E2E_ADMIN.id, password: E2E_ADMIN.password },
    headers: { Origin: new URL(baseURL).origin },
  });
  // expect의 두 번째 값은 실패했을 때 보일 메시지예요. 응답 번호(예: 401)를 보여 줘서 원인을 찾기 쉬워요.
  expect(response.ok(), `로그인 실패: ${response.status()}`).toBe(true);
}
