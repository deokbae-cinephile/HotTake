// @vitest-environment node
// ↑ 서버 코드(server-only, Buffer)를 시험해서 브라우저 흉내(jsdom) 대신 Node.js 환경에서 돌려요.

/**
 * @file github.ts 테스트
 *
 * 진짜 GitHub에 요청을 보내지 않고, fetch를 가짜로 바꿔(vi.stubGlobal) 주고받는 순서와 내용을 확인해요.
 *   - 최신 커밋 → 트리 읽기 → 새 트리 → 새 커밋 → 브랜치 옮기기 순서로 부르는지
 *   - 그사이 다른 커밋이 올라와 브랜치를 못 옮기면(422) 한 번 더 시도하는지
 *   - 실패 응답을 글쓴이가 고칠 수 있는 한국어 문구로 바꾸는지
 *
 * 테스트 도구 문법
 *   - vi.stubGlobal("fetch", 가짜) / vi.unstubAllGlobals() : 전역 함수(fetch)를 가짜로 바꾸고, 원래대로 돌려놔요.
 *   - vi.stubEnv("이름", 값) / vi.unstubAllEnvs()          : 환경 변수를 잠깐 바꾸고, 원래대로 돌려놔요.
 *   - vi.fn(함수)                                          : 불린 기록을 남기는 가짜 함수
 *   - vi.mocked(fetch).mock.calls                          : 가짜 함수가 불린 인자들의 목록([[인자1, 인자2], ...])
 *   - toHaveBeenCalledTimes(n)                             : 가짜 함수가 n번 불렸는지
 *   - rejects.toThrow("글자") / rejects.toBeInstanceOf(종류) : Promise가 그 문구를 담은 오류로 / 그 종류의 오류로 끝나는지
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitChanges, createBlob, getSnapshot, GitHubError, isGitHubConfigured, readTextBlob } from "./github";

/** 가짜 fetch가 받은 요청 기록: [방법, 주소 뒷부분, 보낸 내용]. `[string, string, unknown][]`은 "세 칸짜리 짝(튜플)의 배열"이에요. */
let calls: [string, string, unknown][];
/** 브랜치 옮기기(PATCH)에 몇 번 실패시킬지 */
let refFailures: number;

/**
 * 주소와 방법에 따라 GitHub처럼 답하는 가짜 fetch
 * @param url 요청 주소
 * @param init fetch의 둘째 인자(방법, 머리글, 내용). RequestInit은 그 타입 이름이에요.
 * @returns 진짜 fetch처럼 Response를 담은 Promise
 */
function fakeGitHub(url: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  // 저장소 주소 앞부분을 지워 "/git/..." 부분만 남겨요. 비교하기 쉽게요.
  const path = url.replace("https://api.github.com/repos/deokbae-cinephile/HotTake", "");
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  calls.push([method, path, body]);
  // 값을 JSON 답(Response)으로 감싸 주는 도우미. Promise.resolve: 바로 성공으로 끝나는 Promise를 만들어요.
  const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

  // 아래는 github.ts가 부르는 주소마다 정해 둔 답이에요. 정해 두지 않은 주소는 맨 끝에서 404로 답해요.
  // 브랜치를 읽을 때마다 커밋 번호가 달라지게(commit-1, commit-7 ...) 요청 수를 붙여요.
  if (path === "/git/ref/heads/main") return json({ object: { sha: `commit-${calls.length}` } });
  if (path.startsWith("/git/commits/")) return json({ tree: { sha: "base-tree" } });
  if (path === "/git/trees/base-tree?recursive=1") {
    return json({ truncated: false, tree: [{ path: "content/reviews/a.json", type: "blob", sha: "sha-a" }, { path: "content", type: "tree", sha: "t" }] });
  }
  if (path === "/git/blobs" && method === "POST") return json({ sha: "new-blob" }, 201);
  if (path.startsWith("/git/blobs/")) return json({ content: Buffer.from("한글 원고").toString("base64"), encoding: "base64" });
  if (path === "/git/trees" && method === "POST") return json({ sha: "new-tree" }, 201);
  if (path === "/git/commits" && method === "POST") return json({ sha: "new-commit" }, 201);
  if (path === "/git/refs/heads/main" && method === "PATCH") {
    // 정해 둔 횟수만큼 "그사이 다른 커밋이 올라왔다"(422)고 답해요.
    if (refFailures > 0) {
      refFailures -= 1;
      return json({ message: "Update is not a fast forward" }, 422);
    }
    return json({ object: { sha: "new-commit" } });
  }
  return json({ message: "Not Found" }, 404);
}

describe("github", () => {
  // 시험마다 기록을 비우고, 토큰을 넣고, fetch를 가짜로 바꿔요.
  beforeEach(() => {
    calls = [];
    refFailures = 0;
    vi.stubEnv("GITHUB_CONTENT_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(fakeGitHub));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("토큰이 있으면 설정된 것으로 보고, 요청에 토큰과 API 판 번호, User-Agent를 붙인다", async () => {
    expect(isGitHubConfigured()).toBe(true);
    await getSnapshot();
    // 첫 요청의 둘째 인자(init)만 꺼내요. `[, init]`은 첫 값을 건너뛰는 구조 분해, `!`는 "없을 리 없다"는 표시예요.
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    // User-Agent가 없으면 GitHub가 요청을 거절해요(Cloudflare Workers의 fetch는 알아서 붙이지 않아요).
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "deokbae-blog",
    });
  });

  it("최신 커밋의 파일 목록(폴더 제외)을 읽는다", async () => {
    const snapshot = await getSnapshot();
    expect(snapshot.treeSha).toBe("base-tree");
    // `[...Map]`: Map을 [경로, sha] 짝의 배열로 펼쳐 비교해요. 폴더(content)는 빠져야 해요.
    expect([...snapshot.files]).toEqual([["content/reviews/a.json", "sha-a"]]);
  });

  it("글자 파일은 UTF-8로 읽고, 파일 내용은 base64로 올린다", async () => {
    expect(await readTextBlob("sha-a")).toBe("한글 원고");
    expect(await createBlob(new TextEncoder().encode("hi"))).toBe("new-blob");
    expect(calls.at(-1)).toEqual(["POST", "/git/blobs", { content: Buffer.from("hi").toString("base64"), encoding: "base64" }]);
  });

  it("바뀐 파일을 커밋 하나로 올린다(지울 파일은 sha: null)", async () => {
    const sha = await commitChanges("리뷰 추가: 겨울", () => [
      { path: "content/reviews/b.json", sha: "blob-b" },
      { path: "content/reviews/a.json", sha: null },
    ]);
    expect(sha).toBe("new-commit");
    // 요청 순서: 브랜치 → 커밋 → 트리 → 새 트리 → 새 커밋 → 브랜치 옮기기
    expect(calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      "GET /git/ref/heads/main",
      "GET /git/commits/commit-1",
      "GET /git/trees/base-tree?recursive=1",
      "POST /git/trees",
      "POST /git/commits",
      "PATCH /git/refs/heads/main",
    ]);
    // 넷째 요청(새 트리)의 보낸 내용. calls[3]은 넷째 기록, [2]는 그 안의 "보낸 내용"이에요.
    expect(calls[3]![2]).toEqual({
      base_tree: "base-tree",
      tree: [
        { path: "content/reviews/b.json", mode: "100644", type: "blob", sha: "blob-b" },
        { path: "content/reviews/a.json", mode: "100644", type: "blob", sha: null },
      ],
    });
    // 남의 커밋을 덮어쓰지 않게 force: false로 옮겨요.
    expect(calls[5]![2]).toEqual({ sha: "new-commit", force: false });
  });

  it("그사이 다른 커밋이 올라와 브랜치를 못 옮기면(422) 최신 모습으로 한 번 더 시도한다", async () => {
    refFailures = 1;
    const build = vi.fn(() => [{ path: "content/reviews/b.json", sha: "blob-b" }]);
    expect(await commitChanges("리뷰 수정", build)).toBe("new-commit");
    // 바꿀 파일 목록도 최신 모습으로 다시 만들어요.
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("두 번 모두 못 옮기면 포기하고 알린다", async () => {
    refFailures = 2;
    await expect(commitChanges("리뷰 수정", () => [])).rejects.toBeInstanceOf(GitHubError);
  });

  // [상태 번호, 문구에 들어 있어야 할 글자] 짝들. 이름의 %i 자리에 정수(상태 번호)가 들어가요.
  it.each([
    [401, "토큰이 맞지 않거나 기한이 지났습니다"],
    [403, "Contents: Read and write 권한"],
    [404, "Contents: Read and write 권한"],
    [500, "잠시 뒤 다시 시도해 주세요"],
  ])("GitHub가 %i로 답하면 고치는 방법을 알려 준다", async (status, message) => {
    // 이 시험에서만 fetch가 언제나 그 상태 번호로 답하게 바꿔요.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status }))));
    await expect(getSnapshot()).rejects.toThrow(message);
  });

  it("GitHub에 닿지 못하면 502로, 토큰이 없으면 503으로 알린다", async () => {
    // 인터넷이 끊겼을 때처럼 fetch 자체가 실패하게 해요.
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("fetch failed"))));
    await expect(getSnapshot()).rejects.toMatchObject({ status: 502 });

    vi.stubEnv("GITHUB_CONTENT_TOKEN", "");
    expect(isGitHubConfigured()).toBe(false);
    await expect(getSnapshot()).rejects.toMatchObject({ status: 503 });
  });
});
