// @vitest-environment node
// ↑ 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file 리뷰 추가·수정·삭제 API 테스트 (app/api/reviews/route.ts, app/api/reviews/[slug]/route.ts)
 *
 * API가 로그인과 보낸 내용의 모양을 확인하고, 실제 일은 lib/review-store.ts에 맡기는지 봐요.
 * 저장 함수는 가짜로 바꿔서, 받은 값과 돌려줄 결과를 우리가 정해요(진짜 GitHub에 커밋하지 않아요).
 *
 * Route Handler는 그냥 함수라서, 요청(NextRequest)을 만들어 POST·PUT·DELETE에 넣고 돌아온 응답을 확인하면 돼요.
 *
 * 테스트 도구 문법
 *   vi.mock(모듈, 만들기 함수): 그 모듈을 가져오는 모든 곳에서 가짜 모듈을 쓰게 해요. 파일 맨 위로 끌어올려져 먼저 실행돼요.
 *     importOriginal(): 진짜 모듈. `...진짜`로 ReviewStoreError·readSavePayload는 그대로 두고 saveReview·deleteReview만 바꿔요.
 *   vi.fn(함수): 부른 기록을 남기는 가짜 함수. vi.mocked(함수): 그 함수를 가짜 함수 타입으로 다루게 해 줘요.
 *   mockRejectedValueOnce(오류): 다음 한 번만 그 오류로 실패하게 해요.
 *   toHaveBeenCalledWith(값들): 그 값들로 불렸는지 확인해요.
 *   expect.objectContaining({...}): 적은 항목만 맞으면 되는 "느슨한" 비교예요.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_VALUES } from "@/lib/review-values";
import { deleteReview, ReviewStoreError, saveReview } from "@/lib/review-store";
import { createSessionToken } from "@/lib/session";

import { DELETE, PUT } from "./[slug]/route";
import { POST } from "./route";

// _mode: 받기만 하고 쓰지 않는 값이라 이름 앞에 _를 붙였어요. 가짜 저장은 받은 파일 이름(slug)을 그대로 돌려줘요.
vi.mock("@/lib/review-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/review-store")>()),
  saveReview: vi.fn(async (_mode: string, slug: string) => ({ commitSha: "c", slug })),
  deleteReview: vi.fn(async () => ({ commitSha: "c", title: "겨울 정류장" })),
}));

/** 테스트용 비밀 열쇠(32글자 이상) */
const SECRET = "test-secret-0123456789-abcdefghij-klmnop";
/** 올바른 모양의 저장 요청 내용. 빈 칸 값(EMPTY_VALUES)을 펼쳐(...) 넣고 파일 이름과 제목만 바꿔요. */
const body = { values: { ...EMPTY_VALUES, slug: "winter-stop", title: "겨울 정류장" } };

/**
 * 요청을 만들어요. 우리 사이트에서 보낸 것처럼 origin을 붙여요.
 *
 * @param method "POST" | "PUT" | "DELETE"
 * @param url 경로. 예: "/api/reviews/winter-stop"
 * @param data 본문으로 보낼 값(없으면 본문 없이)
 * @param login 세션 쿠키를 붙일지(기본 true)
 */
async function request(method: string, url: string, data?: unknown, login = true) {
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { origin: "http://localhost", cookie, "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

/**
 * [slug] 라우트에 넘길 두 번째 매개변수(params는 Promise예요).
 * Promise.resolve(값): 이미 값이 준비된 Promise를 만들어요. Next.js가 넘겨주는 모양을 흉내 내요.
 */
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("리뷰 API", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    // 앞 테스트에서 부른 기록을 지워요.
    vi.mocked(saveReview).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("POST: 새 리뷰를 칸에 적은 파일 이름으로 저장하고 201로 답한다", async () => {
    const response = await POST(await request("POST", "/api/reviews", body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ commitSha: "c", slug: "winter-stop" });
    expect(saveReview).toHaveBeenCalledWith("create", "winter-stop", expect.objectContaining({ values: expect.objectContaining({ title: "겨울 정류장" }) }));
  });

  it("로그인하지 않았거나 다른 사이트에서 보낸 요청은 저장하지 않는다", async () => {
    expect((await POST(await request("POST", "/api/reviews", body, false))).status).toBe(401);
    // 다른 사이트(evil.example)에서 보낸 것처럼 꾸민 요청
    const forged = new NextRequest("http://localhost/api/reviews", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" });
    expect((await POST(forged)).status).toBe(403);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("보낸 내용의 모양이 틀리면 400", async () => {
    // 제목이 글자가 아니라 숫자인, 약속과 다른 모양
    expect((await POST(await request("POST", "/api/reviews", { values: { title: 1 } }))).status).toBe(400);
  });

  it("저장소 쪽에서 막히면 그 상태 번호와 칸별 문구를 그대로 돌려준다", async () => {
    // 저장소 쪽에서 "같은 파일 이름이 있어요"(409)로 막힌 상황을 흉내 내요.
    vi.mocked(saveReview).mockRejectedValueOnce(new ReviewStoreError(409, "같은 주소의 리뷰가 이미 있습니다.", { slug: "이미 있어요" }));
    const response = await POST(await request("POST", "/api/reviews", body));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "같은 주소의 리뷰가 이미 있습니다.", errors: { slug: "이미 있어요" } });
  });

  // 칸 값의 slug를 "other"로 바꿔 보내도, 요청 주소의 "winter-stop"으로 저장해야 해요.
  it("PUT: 수정은 칸에 적힌 파일 이름이 아니라 요청 주소의 파일 이름(slug)으로 저장한다", async () => {
    const response = await PUT(await request("PUT", "/api/reviews/winter-stop", { ...body, values: { ...body.values, slug: "other" }, baseSha: "s" }), ctx("winter-stop"));
    expect(response.status).toBe(200);
    expect(saveReview).toHaveBeenCalledWith("update", "winter-stop", expect.objectContaining({ baseSha: "s" }));
  });

  it("DELETE: 리뷰를 지우고 제목을 돌려준다", async () => {
    const response = await DELETE(await request("DELETE", "/api/reviews/winter-stop"), ctx("winter-stop"));
    expect(await response.json()).toEqual({ commitSha: "c", title: "겨울 정류장" });
    expect(deleteReview).toHaveBeenCalledWith("winter-stop");
  });
});
