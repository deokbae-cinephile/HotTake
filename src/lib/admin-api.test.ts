// @vitest-environment node
// ↑ 이 줄은 Vitest(테스트 도구)에게 "브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요"라고 알려요.
//   fetch와 Response는 Node.js에도 들어 있어서 브라우저 흉내가 필요 없어요.

/**
 * @file admin-api.ts 테스트
 *
 * 화면이 서버 API를 부를 때, 서버의 여러 답을 같은 모양(ApiResult)으로 바꾸는지 확인해요.
 *   - 성공 답 → { ok: true, data }
 *   - 중간에 끊긴 성공 답 → 성공으로 넘기지 않음
 *   - 실패 답 → 서버 문구 또는 기본 문구
 *   - 서버에 닿지 못함 → status 0
 * 진짜 서버 대신 fetch를 가짜로 바꿔(vi.stubGlobal) 원하는 답을 돌려줘요.
 *
 * 테스트 도구 문법
 *   describe(이름, 함수): 테스트 묶음. it(이름, 함수): 테스트 하나.
 *   expect(값).toEqual(기대): 값의 내용이 기대와 똑같은지 확인해요.
 *   expect(값).toMatchObject(기대): 기대에 적은 항목만 맞는지 확인해요(나머지 항목은 상관없어요).
 *   expect.stringContaining("글자"): "이 글자가 들어 있는 아무 문자열"과 맞아요.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteReview, login } from "./admin-api";

/**
 * 가짜 fetch가 돌려줄 답을 정해요.
 *
 * vi.stubGlobal("fetch", 가짜): 전역(어디서나 쓰는) fetch를 테스트 동안만 가짜로 바꿔요.
 * vi.fn(함수): 부른 기록을 남기는 가짜 함수를 만들어요. 여기서는 늘 정한 답(Response)을 돌려줘요.
 *
 * @param body 답 본문(글자)
 * @param status HTTP 상태 번호. 예: 200(성공), 401(로그인 필요), 502(중간 서버 문제)
 */
function answer(body: string, status: number) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

// afterEach: 테스트 하나가 끝날 때마다 실행해요. 가짜로 바꾼 fetch를 원래대로 돌려놔 다음 테스트에 섞이지 않게 해요.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin-api", () => {
  // async 테스트: API 함수가 Promise를 돌려줘서, await로 결과를 기다린 뒤 확인해요.
  it("성공 답(JSON)은 ok: true와 내용으로 돌려준다", async () => {
    answer(JSON.stringify({ commitSha: "c1", title: "겨울 정류장" }), 200);
    expect(await deleteReview("winter-stop")).toEqual({ ok: true, data: { commitSha: "c1", title: "겨울 정류장" } });
  });

  it("성공 답을 끝까지 받지 못하면(JSON이 끊김) 성공으로 넘기지 않고, 먼저 확인하라고 알린다", async () => {
    // 일부러 중간에서 끊긴 JSON 글자를 돌려줘요. 상태 번호는 성공(201)이지만 내용을 읽을 수 없어요.
    answer('{"commitSha":"c1","sl', 201);
    const result = await deleteReview("winter-stop");
    expect(result).toMatchObject({ ok: false, status: 201, message: expect.stringContaining("먼저 확인") });
  });

  it("실패 답은 서버가 보낸 문구와 칸별 오류를 꺼내고, 문구가 없으면 기본 문구를 쓴다", async () => {
    // 1) 서버가 { message, errors }를 보낸 경우: 그대로 꺼내요.
    answer(JSON.stringify({ message: "아이디나 비밀번호가 맞지 않습니다.", errors: { id: "확인" } }), 401);
    expect(await login("a", "b")).toEqual({ ok: false, status: 401, message: "아이디나 비밀번호가 맞지 않습니다.", errors: { id: "확인" } });

    // 2) JSON이 아닌 답(호스팅의 오류 화면 같은 HTML): 상태 번호를 넣은 기본 문구를 써요.
    answer("<html>오류</html>", 502);
    expect(await login("a", "b")).toMatchObject({ ok: false, status: 502, message: expect.stringContaining("응답 502") });
  });

  it("서버에 닿지 못하면 status 0과 연결 확인 문구를 돌려준다", async () => {
    // 인터넷이 끊기면 진짜 fetch는 TypeError("Failed to fetch")를 던져요. 그 상황을 흉내 내요.
    // Promise.reject(오류): 실패로 끝나는 Promise를 바로 만들어요.
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await login("a", "b")).toMatchObject({ ok: false, status: 0, message: expect.stringContaining("인터넷 연결") });
  });
});
