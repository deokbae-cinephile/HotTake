// @vitest-environment node
// ↑ 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file 이미지 올리기 API 테스트 (app/api/images/route.ts)
 *
 * 로그인했는지, 경로·크기·형식이 맞는지 확인한 뒤에만 GitHub에 blob을 올리는지 봐요.
 * GitHub에 올리는 함수(createBlob)는 가짜로 바꿔요. 진짜 GitHub에 올리지 않고, 불렸는지만 확인해요.
 *
 * Route Handler는 그냥 함수라서, 요청(NextRequest)을 만들어 POST에 넣고 돌아온 응답을 확인하면 돼요.
 *
 * 테스트 도구 문법
 *   vi.mock(모듈, 만들기 함수): 그 모듈을 가져오는 모든 곳에서 가짜 모듈을 쓰게 해요. 파일 맨 위로 끌어올려져 먼저 실행돼요.
 *     importOriginal(): 진짜 모듈을 가져와요. `...진짜`로 나머지는 그대로 두고 createBlob만 바꿔요.
 *   vi.fn(함수): 부른 기록을 남기는 가짜 함수. vi.mocked(함수): 그 함수를 가짜 함수 타입으로 다루게 해 줘요.
 *   mockClear(): 부른 기록을 지워요(테스트끼리 섞이지 않게).
 *   toHaveBeenCalledOnce(): 딱 한 번 불렸는지, not.toHaveBeenCalled(): 한 번도 불리지 않았는지 확인해요.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlob } from "@/lib/github";
import { createSessionToken } from "@/lib/session";
import { MAX_IMAGE_BYTES } from "@/lib/upload-rules";

import { POST } from "./route";

// `typeof import("…")`: 그 모듈의 타입을 가리켜요. 진짜 모듈을 그 타입으로 받아요.
// "b".repeat(40): "b"를 40번 이은 글자(진짜 sha처럼 40글자인 가짜 번호)
vi.mock("@/lib/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github")>()),
  createBlob: vi.fn(async () => "b".repeat(40)),
}));

/** 테스트용 비밀 열쇠(32글자 이상) */
const SECRET = "test-secret-0123456789-abcdefghij-klmnop";

/**
 * 이미지 올리기 요청을 만들어요. 우리 사이트에서 보낸 것처럼 origin을 붙여요.
 *
 * @param file 보낼 파일
 * @param filePath 저장소 안 경로
 * @param login 세션 쿠키를 붙일지(기본 true)
 */
async function uploadRequest(file: Blob, filePath: string, login = true) {
  const form = new FormData();
  // 세 번째 값은 파일 이름이에요. path.basename: 경로의 마지막 조각(예: "winter-stop.png")
  form.append("file", file, path.basename(filePath));
  form.append("path", filePath);
  const cookie = login ? `blog_session=${await createSessionToken("deokbae", SECRET)}` : "";
  return new NextRequest("http://localhost/api/images", { method: "POST", headers: { origin: "http://localhost", cookie }, body: form });
}

/** 진짜 PNG 그림(시험용 화면 조정 무늬, public/images/test-pattern.png)을 Blob으로 읽어요. */
const png = async () => new Blob([await readFile(path.resolve("public/images/test-pattern.png"))], { type: "image/png" });

describe("POST /api/images", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_ID", "deokbae");
    vi.mocked(createBlob).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  // 통과하는 경우 하나와, 단계마다 막히는 경우를 하나씩 확인해요.
  it("로그인했고 형식이 맞으면 blob으로 올리고 경로와 번호를 돌려준다", async () => {
    const response = await POST(await uploadRequest(await png(), "public/images/winter-stop.png"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "public/images/winter-stop.png", sha: "b".repeat(40) });
    expect(createBlob).toHaveBeenCalledOnce();
  });

  it("로그인하지 않았으면 401", async () => {
    const response = await POST(await uploadRequest(await png(), "public/images/winter-stop.png", false));
    expect(response.status).toBe(401);
    expect(createBlob).not.toHaveBeenCalled();
  });

  it("저장 경로가 규칙에 맞지 않으면 400", async () => {
    // "../"로 폴더 밖으로 빠져나가려는 경로
    const response = await POST(await uploadRequest(await png(), "public/images/../secret.png"));
    expect(response.status).toBe(400);
  });

  it("4MB보다 크면 413", async () => {
    // 한도보다 1바이트 큰, 0으로 채운 파일
    const big = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/png" });
    const response = await POST(await uploadRequest(big, "public/images/winter-stop.png"));
    expect(response.status).toBe(413);
  });

  it("그림이 아니거나 확장자와 실제 형식이 다르면 415", async () => {
    // type을 image/png라고 적어도, 내용이 그림이 아니면 막아요(내용을 직접 읽어 확인하니까요).
    const text = new Blob(["그림이 아니에요"], { type: "image/png" });
    expect((await POST(await uploadRequest(text, "public/images/winter-stop.png"))).status).toBe(415);
    // 진짜 PNG를 .jpg라고 우겨도 받지 않아요.
    expect((await POST(await uploadRequest(await png(), "public/images/winter-stop.jpg"))).status).toBe(415);
    expect(createBlob).not.toHaveBeenCalled();
  });
});
