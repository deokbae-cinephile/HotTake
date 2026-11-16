// @vitest-environment node
// ↑ 서버에서 도는 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file proxy.ts 테스트
 *
 * 문지기(proxy)가 로그인하지 않은 요청을 막고, 로그인한 요청만 통과시키는지 확인해요.
 *   - 글쓰기 화면: 로그인 화면으로 보내기(원래 주소를 next에 적어서)
 *   - 저장 API: 401 JSON으로 답하기
 *   - 로그인했으면: 그대로 통과(NextResponse.next()는 x-middleware-next 머리글로 알 수 있어요)
 *
 * proxy는 그냥 함수라서, 진짜 서버 없이 요청(NextRequest)을 만들어 넣고 돌아온 응답을 확인하면 돼요.
 *
 * 테스트 도구 문법
 *   beforeEach/afterEach: 테스트 하나마다 앞·뒤에 실행해요. 여기서는 환경 변수를 넣었다가 되돌려요.
 *   vi.stubEnv(이름, 값): 테스트 동안만 환경 변수(process.env)를 바꿔요. vi.unstubAllEnvs()로 되돌려요.
 *   expect(값).toBe(기대) / toEqual(기대) / toContain(조각): 같은지 / 내용이 같은지 / 조각이 들어 있는지
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken } from "@/lib/session";

import { config, proxy } from "./proxy";

/** 테스트용 비밀 열쇠(32글자 이상이어야 설정으로 인정돼요) */
const SECRET = "test-secret-0123456789-abcdefghij-klmnop";

/**
 * 쿠키를 붙인 요청을 만들어요.
 *
 * @param path 요청 주소의 경로. 예: "/write"
 * @param cookie 붙일 쿠키 글자. 예: "blog_session=…". 빈 글자면 쿠키 없이 보내요(로그인하지 않은 사람).
 */
const request = (path: string, cookie = "") =>
  new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("글쓰기 화면과 저장 API만 지킨다(목록·로그인 화면은 거치지 않는다)", () => {
    expect(config.matcher).toEqual(["/write/:path*", "/api/reviews/:path*", "/api/images/:path*"]);
  });

  it("로그인하지 않고 글쓰기 화면에 오면 로그인 화면으로 보내고, 원래 주소를 next에 적는다", async () => {
    const response = await proxy(request("/write/winter-stop"));
    // 307: "잠시 다른 주소로 가세요"(임시 이동). 갈 주소는 location 머리글에 있어요.
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fwrite%2Fwinter-stop");
    // 남아 있던 로그인 표시 쿠키도 지워요(화면이 단추를 잘못 보이지 않게).
    // set-cookie에 값이 빈 "blog_admin=;"이 있으면 쿠키를 지우라는 뜻이에요.
    expect(response.headers.get("set-cookie")).toContain("blog_admin=;");
  });

  it("로그인하지 않고 저장 API를 부르면 401과 고치는 방법을 JSON으로 답한다", async () => {
    const response = await proxy(request("/api/reviews"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요." });
  });

  it("위조하거나 기한이 지난 표로는 지나갈 수 없다", async () => {
    // 서명이 맞지 않는 가짜 표를 붙여 봐요.
    const response = await proxy(request("/write", "blog_session=forged.token"));
    expect(response.status).toBe(307);
  });

  it("올바른 표가 있으면 그대로 통과시킨다", async () => {
    const token = await createSessionToken("deokbae", SECRET);
    const response = await proxy(request("/write", `blog_session=${token}`));
    // NextResponse.next()는 "다음으로 넘기기" 표시 머리글을 달아요.
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
