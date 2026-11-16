/**
 * @file E2E용 가짜 GitHub 서버 (e2e/mock-github.mjs)
 * 읽는 순서: 78/84번째 · 8단계(설정·테스트·배포)
 *   앞: e2e/admin-account.ts → 다음: e2e/blog.spec.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   E2E 테스트에서 추가·수정·삭제를 끝까지 시험하려면 GitHub 저장소가 필요해요.
 *   진짜 저장소에 시험 커밋을 올릴 수는 없으니, GitHub API처럼 답하는 작은 서버를 띄워요.
 *   블로그 서버는 환경 변수 GITHUB_API_URL로 이 서버를 가리켜요(playwright.config.ts).
 *
 * 누가 쓰나요?
 *   playwright.config.ts의 webServer가 E2E 테스트 전에 `node e2e/mock-github.mjs`로 띄워요.
 *   e2e/admin.spec.ts가 시험용 도구 주소(/__reset, /__commits, /__delay)로 저장소를 되돌리고 결과를 확인해요.
 *
 * 배경 개념: git이 파일을 담는 방법
 *   blob(블롭): 파일 내용 하나. tree(트리): "경로 → blob" 목록(폴더 모습). commit(커밋): 트리 하나 + 부모 커밋 + 메시지.
 *   ref(브랜치): 가장 최근 커밋을 가리키는 이름표. 새 커밋을 만들고 이름표를 옮기면 "올리기"가 끝나요.
 *   각각은 sha(내용으로 만든 40글자 번호)로 찾아요.
 *
 * 흉내 내는 GitHub API(lib/github.ts가 쓰는 것만)
 *   GET   /repos/:주인/:이름/git/ref/heads/main        브랜치의 최신 커밋
 *   GET   /repos/:주인/:이름/git/commits/:sha          커밋의 트리
 *   GET   /repos/:주인/:이름/git/trees/:sha?recursive=1 트리의 파일 목록
 *   POST  /repos/:주인/:이름/git/blobs                 파일 내용 올리기
 *   GET   /repos/:주인/:이름/git/blobs/:sha             파일 내용 읽기
 *   POST  /repos/:주인/:이름/git/trees                 새 트리 만들기(base_tree + 바뀐 파일)
 *   POST  /repos/:주인/:이름/git/commits               새 커밋 만들기
 *   PATCH /repos/:주인/:이름/git/refs/heads/main        브랜치 옮기기
 *
 * 시험용 도구
 *   GET  /__commits : 지금까지 올라온 커밋 목록(메시지, 더한 파일, 지운 파일). 테스트가 결과를 확인할 때 써요.
 *   POST /__reset   : 저장소를 처음 모습으로 되돌려요(테스트를 여러 번 돌려도 결과가 같게). 답 늦추기도 0으로 돌려요.
 *   POST /__delay?ms=2000 : 그다음 GitHub 요청들을 ms만큼 늦게 답해요. 느린 GitHub 때문에 로딩 화면이 보이는지 시험할 때 써요.
 *   GET  /__health  : 서버가 떴는지 확인(Playwright가 이 주소가 응답할 때까지 기다려요)
 *
 * 처음 저장소에는 시험용 원고(e2e/fixtures/reviews)와 화면 조정 무늬 이미지(public/images/test-pattern.png)가 들어 있어요.
 * 모든 내용은 메모리에만 있어서, 서버를 끄면 사라져요.
 *
 * 실행: node e2e/mock-github.mjs (포트는 MOCK_GITHUB_PORT, 기본 3101)
 *   파일 경로("e2e/fixtures/reviews" 등)는 실행한 폴더 기준이라, 저장소 맨 위 폴더에서 실행해요.
 */

// createHash: 내용으로 번호(해시)를 만드는 Node.js 함수
import { createHash } from "node:crypto";
// readdirSync: 폴더 안의 파일 이름 목록, readFileSync: 파일 내용 읽기
import { readdirSync, readFileSync } from "node:fs";
// createServer: 따로 라이브러리 없이 HTTP 서버를 만드는 Node.js 함수
import { createServer } from "node:http";
// path: 폴더·파일 경로를 운영체제에 맞게 이어 붙이고 푸는 도구
import path from "node:path";

/** 서버 포트 */
const PORT = Number(process.env.MOCK_GITHUB_PORT ?? 3101);
/** 받아 줄 토큰. 블로그 서버의 GITHUB_CONTENT_TOKEN과 같아야 해요. */
const TOKEN = process.env.MOCK_GITHUB_TOKEN ?? "e2e-token";
/** 저장소 주소 앞부분 */
const REPO = "/repos/deokbae-cinephile/HotTake";

// Map: 열쇠로 값을 찾는 모음이에요(get·set·has·delete로 다뤄요). 아래 셋이 이 가짜 저장소의 전부예요.
/** 파일 내용 번호(sha) → 내용(Buffer: Node.js에서 바이트 덩어리를 담는 그릇) */
const blobs = new Map();
/** 트리 번호 → 그 트리의 파일 목록(Map: 경로 → 내용 번호) */
const trees = new Map();
/** 커밋 번호 → { message, tree, parent } */
const commits = new Map();
/** 브랜치(main)가 가리키는 커밋 번호 */
let head = "";
/** GitHub 요청에 답하기 전에 기다릴 시간(ms). POST /__delay로 정하고, /__reset이 0으로 돌려요. */
let delayMs = 0;

/**
 * 내용으로 번호를 만들어요(git처럼 같은 내용이면 같은 번호).
 * sha1로 섞은 결과를 16진수 글자(hex, 40글자)로 돌려줘요.
 * @param {string | Buffer} data 번호를 만들 내용
 * @returns {string} 40글자 번호
 */
const hash = (data) => createHash("sha1").update(data).digest("hex");

/**
 * 내용을 저장하고 번호를 돌려줘요.
 * @param {Buffer} buffer 파일 내용
 * @returns {string} 내용 번호(sha)
 */
function putBlob(buffer) {
  const sha = hash(buffer);
  blobs.set(sha, buffer);
  return sha;
}

/**
 * 파일 목록으로 트리를 만들어 저장하고 번호를 돌려줘요.
 * [...files]로 Map을 [경로, 번호] 짝의 배열로 바꾸고, 정렬해서 넣은 순서가 달라도 같은 목록이면 같은 번호가 되게 해요.
 * @param {Map<string, string>} files 경로 → 내용 번호
 * @returns {string} 트리 번호
 */
function putTree(files) {
  const sha = hash(JSON.stringify([...files].sort()));
  trees.set(sha, files);
  return sha;
}

/** 처음 저장소: 시험용 원고 + 화면 조정 무늬 이미지. 지금까지 쌓인 내용은 모두 지우고 새로 만들어요. */
function seed() {
  blobs.clear();
  trees.clear();
  commits.clear();
  const files = new Map();
  // path.resolve: 실행한 폴더 기준의 상대 경로를 전체 경로로 바꿔요.
  const dir = path.resolve("e2e/fixtures/reviews");
  // 시험용 원고 파일마다 내용을 저장하고, 진짜 저장소와 같은 경로(content/reviews/...)에 둬요.
  for (const name of readdirSync(dir)) {
    files.set(`content/reviews/${name}`, putBlob(readFileSync(path.join(dir, name))));
  }
  files.set("public/images/test-pattern.png", putBlob(readFileSync(path.resolve("public/images/test-pattern.png"))));
  const tree = putTree(files);
  // 첫 커밋은 부모가 없어요(parent: null). 브랜치가 이 커밋을 가리키게 해요.
  head = hash(`first-commit-${tree}`);
  commits.set(head, { message: "처음 원고", tree, parent: null });
}

/**
 * 요청 본문(JSON)을 읽어요.
 * 본문은 여러 조각(chunk)으로 나눠 도착해서, for await로 조각을 모두 모은 뒤 이어 붙여 글자로 바꿔요.
 * @param {import("node:http").IncomingMessage} request 받은 요청
 * @returns {Promise<any>} JSON을 푼 값. 본문이 비었으면 빈 객체 {}
 */
async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

/**
 * JSON으로 답해요.
 * @param {import("node:http").ServerResponse} response 보낼 응답
 * @param {number} status 응답 번호(200 성공, 201 만듦, 404 없음, 422 처리할 수 없음 등)
 * @param {unknown} data JSON으로 바꿔 보낼 값
 */
function send(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

/**
 * 커밋 하나를 사람이 확인하기 쉬운 모양으로: 부모 커밋 대비 더한(바뀐) 파일과 지운 파일
 * @param {string} sha 커밋 번호
 * @returns {{ message: string, added: string[], deleted: string[], texts: Record<string, string> }}
 *   message: 커밋 메시지, added: 더하거나 바뀐 파일, deleted: 지운 파일, texts: 바뀐 원고(.json)의 글자
 */
function describeCommit(sha) {
  const commit = commits.get(sha);
  // 부모가 없으면(첫 커밋) "아무 파일도 없던 상태"(빈 Map)와 비교해요.
  const before = commit.parent ? trees.get(commits.get(commit.parent).tree) : new Map();
  const after = trees.get(commit.tree);
  return {
    message: commit.message,
    added: [...after].filter(([file, blob]) => before.get(file) !== blob).map(([file]) => file),
    deleted: [...before.keys()].filter((file) => !after.has(file)),
    // 원고(.json)는 글자 내용도 함께 보여 줘요(저장한 원고 모양을 확인하려고요).
    // Object.fromEntries: [열쇠, 값] 짝의 배열을 { 열쇠: 값 } 객체로 바꿔요.
    texts: Object.fromEntries(
      [...after].filter(([file, blob]) => file.endsWith(".json") && before.get(file) !== blob).map(([file, blob]) => [file, blobs.get(blob).toString("utf8")]),
    ),
  };
}

// 서버를 띄우기 전에 처음 저장소를 만들어 둬요.
seed();

/**
 * 요청마다 불리는 함수예요. 주소(route)와 방식(GET·POST·PATCH)을 보고 위에서부터 차례로 맞는 답을 찾아요.
 * return send(...)로 답하고 바로 끝내서, 아래 조건까지 내려가지 않아요.
 */
const server = createServer(async (request, response) => {
  // request.url은 "/__health" 같은 경로만 있어서, 기준 주소를 붙여 URL로 풀어요(?ms= 같은 조건을 읽기 쉬워져요).
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  // 시험용 도구(토큰 없이 써요)
  if (route === "/__health") return send(response, 200, { ok: true });
  if (route === "/__reset" && request.method === "POST") {
    seed();
    delayMs = 0;
    return send(response, 200, { ok: true });
  }
  if (route === "/__delay" && request.method === "POST") {
    delayMs = Math.max(0, Number(url.searchParams.get("ms") ?? 0));
    return send(response, 200, { ok: true, delayMs });
  }
  if (route === "/__commits") {
    // 처음 커밋부터 지금까지(부모를 따라 거꾸로 모은 뒤 뒤집어요). 부모가 없는 첫 커밋("처음 원고")은 빼요.
    // toReversed(): 원래 배열은 그대로 두고 순서를 뒤집은 새 배열을 돌려줘요.
    const list = [];
    for (let sha = head; sha && commits.get(sha).parent; sha = commits.get(sha).parent) list.push(describeCommit(sha));
    return send(response, 200, list.toReversed());
  }

  // 느린 GitHub 흉내: 정해 둔 시간만큼 기다렸다가 답해요(시험용 도구 요청은 빼고).
  // setTimeout을 Promise로 감싸면 await로 "그 시간만큼 기다리기"를 할 수 있어요.
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  // 토큰 확인: 진짜 GitHub처럼 틀리면 401(인증 실패). 블로그 서버가 토큰을 제대로 보내는지도 함께 시험돼요.
  if (request.headers.authorization !== `Bearer ${TOKEN}`) return send(response, 401, { message: "Bad credentials" });

  // 여기부터는 저장소 API예요. "/repos/deokbae-cinephile/HotTake/git/" 뒤의 나머지(rest)로 무엇을 할지 나눠요.
  if (!route.startsWith(`${REPO}/git/`)) return send(response, 404, { message: "Not Found" });
  const rest = route.slice(`${REPO}/git/`.length);

  try {
    // 브랜치의 최신 커밋 번호
    if (request.method === "GET" && rest === "ref/heads/main") return send(response, 200, { object: { sha: head } });

    // 커밋 → 그 커밋의 트리 번호
    if (request.method === "GET" && rest.startsWith("commits/")) {
      const commit = commits.get(rest.slice("commits/".length));
      return commit ? send(response, 200, { tree: { sha: commit.tree } }) : send(response, 404, { message: "Not Found" });
    }

    // 트리 → 파일 목록(경로, 종류, 내용 번호). truncated: false는 "목록을 자르지 않고 다 줬다"는 뜻이에요.
    if (request.method === "GET" && rest.startsWith("trees/")) {
      const files = trees.get(rest.slice("trees/".length));
      if (!files) return send(response, 404, { message: "Not Found" });
      return send(response, 200, { truncated: false, tree: [...files].map(([file, sha]) => ({ path: file, type: "blob", sha })) });
    }

    // 파일 내용 올리기. 이미지는 base64 글자로, 원고는 utf8 글자로 와요.
    if (request.method === "POST" && rest === "blobs") {
      const body = await readBody(request);
      return send(response, 201, { sha: putBlob(Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8")) });
    }

    // 파일 내용 읽기. 진짜 GitHub처럼 base64 글자로 돌려줘요.
    if (request.method === "GET" && rest.startsWith("blobs/")) {
      const blob = blobs.get(rest.slice("blobs/".length));
      return blob ? send(response, 200, { content: blob.toString("base64"), encoding: "base64" }) : send(response, 404, { message: "Not Found" });
    }

    // 새 트리 만들기: 바탕 트리(base_tree)를 복사한 뒤 바뀐 파일만 고쳐요. sha가 null이면 그 파일을 지워요.
    if (request.method === "POST" && rest === "trees") {
      const body = await readBody(request);
      const base = trees.get(body.base_tree);
      if (!base) return send(response, 422, { message: "base_tree not found" });
      const files = new Map(base);
      for (const entry of body.tree) {
        if (entry.sha === null) files.delete(entry.path);
        else if (blobs.has(entry.sha)) files.set(entry.path, entry.sha);
        else return send(response, 422, { message: `blob ${entry.sha} not found` });
      }
      return send(response, 201, { sha: putTree(files) });
    }

    // 새 커밋 만들기. 같은 내용이어도 번호가 겹치지 않게 시각(Date.now)과 무작위 수를 섞어요.
    if (request.method === "POST" && rest === "commits") {
      const body = await readBody(request);
      const sha = hash(`${body.message}-${body.tree}-${body.parents[0]}-${Date.now()}-${Math.random()}`);
      commits.set(sha, { message: body.message, tree: body.tree, parent: body.parents[0] });
      return send(response, 201, { sha });
    }

    if (request.method === "PATCH" && rest === "refs/heads/main") {
      const body = await readBody(request);
      const commit = commits.get(body.sha);
      // 앞으로 감기만 받아요: 새 커밋의 부모가 지금 브랜치 끝이어야 해요(진짜 GitHub처럼 아니면 422).
      if (!commit || commit.parent !== head) return send(response, 422, { message: "Update is not a fast forward" });
      head = body.sha;
      return send(response, 200, { object: { sha: head } });
    }

    return send(response, 404, { message: "Not Found" });
  } catch (error) {
    // 위에서 생각지 못한 오류(잘못된 본문 등)가 나면 500(서버 오류)으로 답해요.
    return send(response, 500, { message: String(error) });
  }
});

// 이 컴퓨터 안에서만(127.0.0.1) 받도록 포트를 열고, 뜨면 주소를 알려 줘요.
server.listen(PORT, "127.0.0.1", () => console.log(`가짜 GitHub 서버: http://127.0.0.1:${PORT}`));
