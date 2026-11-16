// @vitest-environment node
// ↑ 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요. Web Crypto(crypto.subtle)는 Node.js에도 있어요.

/**
 * @file session.ts 테스트
 *
 * 로그인 표(세션 토큰)가 "진짜이고, 기한이 남았고, 지금 글쓴이의 것"일 때만 통과하는지 확인해요.
 * 특히 누군가 표를 고치거나(위조) 다른 열쇠로 만든 표는 반드시 걸러져야 해요.
 *
 * 테스트 도구 문법
 *   describe/it: 테스트 묶음과 테스트 하나. expect(값).toBe(기대): 값이 기대와 같은지(===) 확인해요.
 *   it.each([...])(이름, 함수): 배열의 값마다 같은 테스트를 되풀이해요. 이름의 %s 자리에 값이 들어가요.
 *   vi.stubEnv(이름, 값): 테스트 동안만 환경 변수(process.env)를 바꿔요. vi.unstubAllEnvs()로 되돌려요.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_MAX_AGE } from "./auth-cookies";
import { createSessionToken, isValidSession, readSessionConfig, verifySessionToken } from "./session";

/** 테스트용 비밀 열쇠(32글자 이상) */
const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
/** 기준 시각: 2026-11-13 00:00(UTC). Date.UTC의 달은 0부터 세서 10이 11월이에요. */
const NOW = Date.UTC(2026, 10, 13);

describe("createSessionToken / verifySessionToken", () => {
  it("만든 표는 같은 열쇠·같은 글쓴이로 확인된다", async () => {
    const token = await createSessionToken("deokbae", SECRET, NOW);
    // "내용.서명" 두 부분이에요.
    expect(token.split(".")).toHaveLength(2);
    expect(await verifySessionToken(token, SECRET, "deokbae", NOW)).toBe(true);
  });

  it("다른 열쇠, 다른 글쓴이의 표는 통과하지 못한다", async () => {
    const token = await createSessionToken("deokbae", SECRET, NOW);
    // 열쇠가 다르면 서명이 맞지 않아요.
    expect(await verifySessionToken(token, `${SECRET}-other`, "deokbae", NOW)).toBe(false);
    // 서명은 맞아도, 지금 글쓴이 아이디와 다르면 막아요.
    expect(await verifySessionToken(token, SECRET, "someone-else", NOW)).toBe(false);
  });

  it("기한(7일)이 지나면 통과하지 못한다", async () => {
    const token = await createSessionToken("deokbae", SECRET, NOW);
    // 7일(초 → 밀리초로 × 1000)하고 1초 뒤
    const later = NOW + SESSION_MAX_AGE * 1000 + 1000;
    expect(await verifySessionToken(token, SECRET, "deokbae", later)).toBe(false);
  });

  it("내용을 고친 표(예: 기한 늘리기)는 서명이 맞지 않아 통과하지 못한다", async () => {
    const token = await createSessionToken("deokbae", SECRET, NOW);
    // `const [, signature]`: 배열의 첫 값은 건너뛰고 두 번째 값(서명)만 꺼내요.
    const [, signature] = token.split(".");
    // 기한을 아주 먼 미래로 바꾼 가짜 내용을 만들어 원래 서명을 붙여 봐요.
    // 9_999_999_999: 숫자 사이의 _는 읽기 쉽게 끊어 쓰는 표시예요(값은 9999999999).
    const forged = btoa(JSON.stringify({ sub: "deokbae", exp: 9_999_999_999 })).replace(/=+$/, "");
    expect(await verifySessionToken(`${forged}.${signature}`, SECRET, "deokbae", NOW)).toBe(false);
  });

  // 빈 글자, 점이 없음, 점이 둘, base64url이 아닌 글자, 서명이 빈 표("e30"은 "{}"의 base64url)
  it.each(["", "abc", "a.b.c", "!!!.???", "e30."])("모양이 틀린 표 %s는 통과하지 못한다", async (token) => {
    expect(await verifySessionToken(token, SECRET, "deokbae", NOW)).toBe(false);
  });
});

describe("readSessionConfig / isValidSession", () => {
  // 테스트마다 바꾼 환경 변수를 원래대로 돌려놔요.
  afterEach(() => vi.unstubAllEnvs());

  it("비밀 열쇠가 32글자보다 짧거나 아이디가 없으면 설정 없음(null)으로 본다", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    vi.stubEnv("ADMIN_ID", "deokbae");
    expect(readSessionConfig()).toBeNull();

    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "");
    expect(readSessionConfig()).toBeNull();
  });

  it("설정이 있으면 환경 변수의 열쇠·아이디로 표를 확인한다", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    expect(await isValidSession(await createSessionToken("deokbae", SECRET))).toBe(true);
    // 쿠키가 없으면(undefined) 로그인하지 않은 것이에요.
    expect(await isValidSession(undefined)).toBe(false);
  });

  it("설정이 없으면 어떤 표도 통과하지 못한다(아무도 로그인할 수 없음)", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_ID", "");
    expect(await isValidSession(await createSessionToken("deokbae", SECRET))).toBe(false);
  });
});
