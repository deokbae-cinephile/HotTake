// @vitest-environment node
// ↑ 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file login-limit.ts 테스트
 *
 * 로그인 시도 제한이 "10분 동안 10번 시도(실패)하면 막고, 시간이 지나거나 성공하면 풀리는지" 확인해요.
 * 시각(now)을 직접 넣어 줘서 10분을 기다리지 않고 시험해요. 테스트마다 다른 곳(IP)을 써서 서로 섞이지 않게 해요.
 * (기록은 파일 안의 Map 하나에 모이므로, 같은 IP를 쓰면 앞 테스트의 시도가 남아 있어요.)
 *
 * 테스트 도구 문법
 *   expect(값).toEqual(기대): 객체의 내용이 같은지 확인해요.
 *   it(`…${값}…`): 백틱 글자라 테스트 이름에 값(MAX_FAILURES 등)을 끼워 넣을 수 있어요.
 *   198.51.100.x·203.0.113.x는 문서·시험용으로 정해 둔 IP 주소라 실제 누구의 주소도 아니에요.
 */

import { describe, expect, it } from "vitest";

import { clearLoginFailures, clientKey, MAX_FAILURES, reserveLoginAttempt, WINDOW_MS } from "./login-limit";

describe("login-limit", () => {
  it(`${MAX_FAILURES}번까지는 시도를 받고(받을 때마다 세어 둠), 그 뒤로는 가장 오래된 시도가 10분을 넘길 때까지 막는다`, () => {
    const key = "198.51.100.1";
    // 기준 시각(밀리초). 1_000_000은 1000000을 읽기 쉽게 끊어 쓴 거예요.
    const start = 1_000_000;
    // 1초 간격으로 10번 시도해요. 모두 받아야 해요.
    for (let index = 0; index < MAX_FAILURES; index += 1) {
      expect(reserveLoginAttempt(key, start + index * 1000)).toEqual({ ok: true });
    }
    // 첫 시도(start)가 시간 창을 벗어나는 때까지 남은 초를 알려 줘요.
    expect(reserveLoginAttempt(key, start + 30_000)).toEqual({ ok: false, retryAfter: (WINDOW_MS - 30_000) / 1000 });
    // 첫 시도가 10분을 넘기면 다시 받아요.
    expect(reserveLoginAttempt(key, start + WINDOW_MS)).toEqual({ ok: true });
  });

  it("로그인에 성공해 기록을 지우면 다시 처음부터 센다", () => {
    const key = "198.51.100.2";
    for (let index = 0; index < MAX_FAILURES; index += 1) reserveLoginAttempt(key, 5_000 + index);
    expect(reserveLoginAttempt(key, 6_000).ok).toBe(false);
    clearLoginFailures(key);
    expect(reserveLoginAttempt(key, 6_000)).toEqual({ ok: true });
  });

  it("다른 곳(IP)의 시도는 따로 센다", () => {
    // .3에서 10번 채워도, .4는 막히지 않아요.
    for (let index = 0; index < MAX_FAILURES; index += 1) reserveLoginAttempt("198.51.100.3", 7_000 + index);
    expect(reserveLoginAttempt("198.51.100.4", 8_000)).toEqual({ ok: true });
  });

  it("요청한 곳은 cf-connecting-ip, x-forwarded-for의 첫 주소, unknown 순서로 알아낸다", () => {
    // new Headers({...}): 요청 머리글 묶음을 만들어요(웹 표준).
    expect(clientKey(new Headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
