// @vitest-environment node
// ↑ 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file 로그인·로그아웃 API 테스트 (app/api/session/route.ts)
 *
 * Route Handler는 그냥 함수라서, 요청(NextRequest)을 만들어 넣고 돌아온 응답을 확인하면 돼요.
 * 비밀번호 해시와 세션 열쇠는 테스트용 값을 환경 변수에 넣어 써요.
 *
 * 확인하는 것: 맞으면 쿠키 두 개, 틀리면 401, 설정 없음 503, 다른 사이트 403, 너무 많이 틀림 429, 로그아웃
 *
 * 테스트 도구 문법
 *   beforeAll: 이 묶음의 테스트를 시작하기 전에 한 번만 실행해요(해시 계산은 느려서 한 번만 해요).
 *   beforeEach/afterEach: 테스트 하나마다 앞·뒤에 실행해요. 환경 변수를 넣었다가(vi.stubEnv) 되돌려요(vi.unstubAllEnvs).
 *   response.headers.getSetCookie(): 응답이 구운 쿠키(set-cookie 머리글)들을 배열로 돌려줘요.
 *   expect(글자).toMatch(정규식): 정규식과 맞는지. /HttpOnly/i의 i는 대소문자를 가리지 않는다는 뜻이에요.
 *   192.0.2.x는 문서·시험용으로 정해 둔 IP 주소라 실제 누구의 주소도 아니에요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_FAILURES, reserveLoginAttempt } from "@/lib/login-limit";
import { hashPassword } from "@/lib/password-hash";

import { DELETE, POST } from "./route";

/** 테스트용 비밀 열쇠(32글자 이상) */
const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
/** 비밀번호 "correct horse"의 해시. beforeAll에서 계산해 넣어요(그래서 const가 아니라 let이에요). */
let hash: string;

/**
 * 로그인 요청을 만들어요.
 * origin: 요청을 보낸 사이트(기본은 우리 사이트), ip: 요청한 곳(실패 횟수를 곳마다 세요. 테스트끼리 섞이지 않게 바꿔 써요)
 */
const loginRequest = (body: unknown, origin = "http://localhost", ip = "192.0.2.1") =>
  new NextRequest("http://localhost/api/session", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });

describe("POST /api/session (로그인)", () => {
  beforeAll(async () => {
    hash = await hashPassword("correct horse");
  });
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("아이디·비밀번호가 맞으면 세션 쿠키(httpOnly)와 로그인 표시 쿠키를 굽는다", async () => {
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }));
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.find((cookie) => cookie.startsWith("blog_session="))).toMatch(/HttpOnly/i);
    expect(cookies.find((cookie) => cookie.startsWith("blog_session="))).toMatch(/SameSite=lax/i);
    expect(cookies.find((cookie) => cookie.startsWith("blog_admin="))).toMatch(/^blog_admin=1;/);
    expect(cookies.find((cookie) => cookie.startsWith("blog_admin="))).not.toMatch(/HttpOnly/i);
  });

  it("틀리면 쿠키 없이 401과 다시 입력하라는 문구를 돌려준다(무엇이 틀렸는지는 알려 주지 않는다)", async () => {
    // 비밀번호 틀림, 아이디 틀림, 아무것도 안 보냄 — 세 경우 모두 같은 답이어야 해요.
    for (const body of [{ id: "deokbae", password: "wrong" }, { id: "someone", password: "correct horse" }, {}]) {
      const response = await POST(loginRequest(body));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: "아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요." });
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });

  it("서버에 로그인 설정이 없으면 503과 설정할 값을 알려 준다", async () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toContain("ADMIN_PASSWORD_HASH");
  });

  it("다른 사이트에서 보낸 요청은 받지 않는다(CSRF 막기)", async () => {
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }, "https://evil.example"));
    expect(response.status).toBe(403);
  });

  it(`같은 곳에서 ${MAX_FAILURES}번 틀린 뒤에는 맞는 비밀번호라도 확인하지 않고 429와 기다릴 시간을 알려 준다`, async () => {
    const ip = "192.0.2.50";
    // 이 IP의 시도를 한도까지 미리 채워 둬요.
    for (let index = 0; index < MAX_FAILURES; index += 1) reserveLoginAttempt(ip);
    // origin 자리에 undefined를 넘기면 기본값(우리 사이트)을 써요.
    const response = await POST(loginRequest({ id: "deokbae", password: "correct horse" }, undefined, ip));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await response.json()).message).toContain("분 뒤 다시 시도");
    expect(response.headers.getSetCookie()).toEqual([]);
    // 다른 곳에서는 그대로 로그인할 수 있어요.
    expect((await POST(loginRequest({ id: "deokbae", password: "correct horse" }, undefined, "192.0.2.51"))).status).toBe(200);
  });

  it("같은 곳에서 동시에 보낸 요청도 하나씩 세어, 제한을 넘는 요청은 비밀번호를 확인하지 않고 막는다", async () => {
    const ip = "192.0.2.70";
    // Array.from({ length: n }, 함수): 함수를 n번 불러 배열을 만들어요. 여기서는 한도보다 2개 많은 요청을 기다리지 않고 한꺼번에 보내요.
    const requests = Array.from({ length: MAX_FAILURES + 2 }, () => POST(loginRequest({ id: "deokbae", password: "wrong" }, undefined, ip)));
    // Promise.all: 모든 요청이 끝날 때까지 기다려 결과를 배열로 모아요.
    const statuses = (await Promise.all(requests)).map((response) => response.status);
    // 한도(10)까지는 비밀번호를 확인해 401, 넘친 2개는 확인하지 않고 429
    expect(statuses.filter((status) => status === 401)).toHaveLength(MAX_FAILURES);
    expect(statuses.filter((status) => status === 429)).toHaveLength(2);
  });

  it("로그인에 성공하면 그곳의 실패 기록을 지운다", async () => {
    const ip = "192.0.2.60";
    for (let index = 0; index < MAX_FAILURES - 1; index += 1) reserveLoginAttempt(ip);
    expect((await POST(loginRequest({ id: "deokbae", password: "correct horse" }, undefined, ip))).status).toBe(200);
    // 기록이 지워져서, 다시 MAX_FAILURES - 1번 틀려도 막히지 않아요.
    for (let index = 0; index < MAX_FAILURES - 1; index += 1) reserveLoginAttempt(ip);
    expect((await POST(loginRequest({ id: "deokbae", password: "correct horse" }, undefined, ip))).status).toBe(200);
  });
});

describe("DELETE /api/session (로그아웃)", () => {
  it("로그인 쿠키 두 개를 지운다", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/session", { method: "DELETE", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    // 구운 쿠키들을 줄바꿈으로 이어 한 글자로 만들어요. "이름=;"(빈 값)은 지우라는 뜻이에요.
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("blog_session=;");
    expect(cookies).toContain("blog_admin=;");
  });
});
