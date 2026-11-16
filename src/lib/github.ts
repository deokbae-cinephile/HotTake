/**
 * @file GitHub 저장소에 원고 읽고 쓰기 (github.ts)
 * 읽는 순서: 53/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/review-file.ts → 다음: src/lib/review-store.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰 원고(content/reviews/*.json)와 이미지(public/images)는 모두 GitHub 저장소에 파일로 들어 있어요.
 *   글쓴이가 글쓰기 화면에서 저장하면, 서버가 이 파일의 함수로 저장소에 "커밋"을 만들어 올려요.
 *   그러면 GitHub Actions가 바뀐 저장소를 검사한 뒤 Cloudflare에 다시 배포해서, 몇 분 뒤 새 글이 보여요.
 *
 * 왜 데이터베이스가 아니라 저장소에 저장하나요?
 *   - 원고가 그냥 JSON 글자 파일이라 어디서든 열어 보고 고칠 수 있어요.
 *   - 저장할 때마다 커밋 기록이 남아서, 실수로 지운 글도 기록에서 되살릴 수 있어요.
 *   - 버전 백업(태그)에 원고와 이미지가 함께 들어가요. 따로 챙길 데이터베이스가 없어요.
 *
 * 쓰는 GitHub 기능(Git Data API)
 *   파일 여러 개(원고 + 이미지, 지울 이미지)를 "커밋 하나"로 한 번에 올리려고 낮은 단계의 API를 써요.
 *     1. 브랜치(main)가 가리키는 최신 커밋과 그 커밋의 파일 목록(트리)을 읽어요.      → getSnapshot
 *     2. 새 파일 내용을 blob(파일 덩어리)으로 올려요.                                 → createBlob
 *     3. "최신 트리 + 바뀐 파일"로 새 트리를 만들고, 그 트리로 새 커밋을 만들어요.        → commitChanges
 *     4. 브랜치가 새 커밋을 가리키게 옮겨요. 그사이 누가 먼저 올렸으면 1번부터 한 번 더 해요.
 *
 * 필요한 서버 설정(환경 변수)
 *   - GITHUB_CONTENT_TOKEN: 이 저장소 하나에만 "Contents: Read and write" 권한을 준 GitHub 토큰
 *   - GITHUB_API_URL(없어도 됨): E2E 테스트가 가짜 GitHub 서버(e2e/mock-github.mjs)를 가리킬 때만 써요.
 *   토큰은 서버에만 있고 브라우저로는 절대 보내지 않아요.
 *   저장할 저장소와 브랜치는 lib/site.ts의 repo(deokbae-cinephile/HotTake, main)예요.
 *
 * 누가 쓰나요?
 *   - lib/review-store.ts: 리뷰 읽기·저장·삭제(getSnapshot, readTextBlob, createBlob, commitChanges)
 *   - app/api/images/route.ts: 이미지 올리기(createBlob)
 *   - app/write/page.tsx, app/write/[slug]/page.tsx: 저장 설정이 되어 있는지 확인(isGitHubConfigured), 오류 구분(GitHubError)
 *   - lib/api-response.ts: GitHubError를 HTTP 응답으로 바꾸기
 *
 * 알아 두면 좋은 말
 *   - API: 프로그램끼리 요청과 답을 주고받는 창구예요. 여기서는 GitHub가 주는 주소에 fetch로 요청을 보내요.
 *   - sha: Git이 내용(파일·폴더 목록·커밋)마다 붙이는 40글자 번호. 내용이 같으면 번호도 같아요.
 *   - 트리(tree): 한 시점의 "폴더와 파일 목록"이에요. 커밋은 트리 하나와 부모 커밋을 가리켜요.
 *   - 제네릭 `call<T>`: 부르는 쪽이 <> 안에 "답의 모양"을 넣어 주면, 돌려받는 값이 그 타입으로 잡혀요.
 */

// 서버 전용 표시. 토큰을 다루는 이 파일을 브라우저 코드에서 가져오면 빌드가 오류를 내요.
import "server-only";

// 저장소 주인·이름·브랜치(lib/site.ts)
import { site } from "./site";

/**
 * GitHub와 이야기하다 생긴 문제. status는 화면에 돌려줄 HTTP 상태 번호예요.
 * `extends Error`: 기본 오류(Error)를 바탕으로 status 항목을 더한 새 오류 종류예요.
 * 부르는 쪽은 `error instanceof GitHubError`로 이 오류인지 가려낼 수 있어요.
 */
export class GitHubError extends Error {
  // 매개변수 앞의 `readonly`: 받은 값을 같은 이름의 읽기 전용 항목(this.status)으로 바로 저장하는 줄임 문법이에요.
  constructor(
    readonly status: number,
    message: string,
  ) {
    // 바탕이 되는 Error에 문구를 넘겨요(error.message로 읽어요).
    super(message);
    // 콘솔에 오류를 찍을 때 보이는 이름이에요.
    this.name = "GitHubError";
  }
}

/** 저장소의 한 시점(최신 커밋) 모습: 커밋 번호, 트리 번호, 파일 목록(경로 → 파일 내용 번호 sha) */
export type RepoSnapshot = {
  /** 최신 커밋의 번호 */
  commitSha: string;
  /** 그 커밋의 트리(파일 목록) 번호. 새 트리를 만들 때 바탕(base_tree)으로 써요. */
  treeSha: string;
  /** 경로 → sha. `ReadonlyMap`은 읽기만 할 수 있는 Map이에요(set으로 바꿀 수 없어요). */
  files: ReadonlyMap<string, string>;
};

/**
 * 파일 하나의 바뀜. sha가 있으면 그 내용(blob)으로 더하거나 바꾸고, null이면 그 파일을 지워요.
 * @example { path: "content/reviews/winter-stop.json", sha: "3b18e5..." } // 더하거나 바꾸기
 * @example { path: "public/images/winter-stop.jpg", sha: null }         // 지우기
 */
export type FileChange = { path: string; sha: string | null };

/**
 * 서버 설정을 읽어요. 토큰이 없으면 null(저장 기능을 쓸 수 없어요).
 * 돌려주는 타입을 적지 않아서 TypeScript가 return 값을 보고 알아서 정해요(타입 추론).
 *
 * @returns { token, api } 또는 null
 */
function readConfig() {
  // process.env: 서버의 환경 변수. `?? ""`: 없으면(undefined) 빈 글자로 둬요.
  const token = process.env.GITHUB_CONTENT_TOKEN ?? "";
  if (token === "") return null;
  return {
    token,
    // 끝의 /는 지워 둬요. 주소를 이어 붙일 때 //가 생기지 않게요. 정규식 /\/$/는 "맨 끝의 / 한 글자"예요.
    api: (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, ""),
  };
}

/**
 * 저장 기능을 쓸 수 있게 설정되어 있는지 알려 줘요(글쓰기 화면이 안내 문구를 보여 줄 때 써요).
 * @returns 토큰이 있으면 true
 */
export function isGitHubConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * GitHub의 실패 응답을 글쓴이가 알아듣고 고칠 수 있는 한국어 문구로 바꿔요.
 *   401: 로그인 실패(토큰이 틀림) / 403·404: 권한 없음(GitHub는 권한이 없으면 404로 숨기기도 해요) / 500 이상: GitHub 쪽 문제
 *
 * @param status GitHub가 돌려준 HTTP 상태 번호
 * @returns 원인과 고치는 방법을 담은 문구
 */
function describeFailure(status: number): string {
  if (status === 401) return "서버의 GitHub 토큰이 맞지 않거나 기한이 지났습니다. 새 토큰을 만들어 GITHUB_CONTENT_TOKEN에 넣어 주세요.";
  if (status === 403 || status === 404) {
    return "서버의 GitHub 토큰으로 저장소에 쓸 수 없습니다. 토큰에 이 저장소의 Contents: Read and write 권한을 주었는지 확인해 주세요.";
  }
  if (status >= 500) return "GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.";
  return `GitHub가 요청을 받지 않았습니다(응답 ${status}). 잠시 뒤 다시 시도해 주세요.`;
}

/**
 * 저장소 API에 요청을 보내고 JSON 답을 돌려줘요. 실패하면 GitHubError를 던져요.
 *
 * @param path "/git/..."처럼 저장소 주소 뒤에 붙일 경로
 * @param init 요청 방법(method)과 보낼 내용(body). 없으면 GET
 * @returns GitHub가 돌려준 JSON(타입은 부르는 쪽이 T로 정해요)
 * @throws GitHubError 토큰이 없거나(503), 연결하지 못했거나(502), GitHub가 실패로 답했으면
 * @example const ref = await call<{ object: { sha: string } }>("/git/ref/heads/main");
 */
async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const config = readConfig();
  if (!config) throw new GitHubError(503, "서버에 GitHub 토큰(GITHUB_CONTENT_TOKEN)이 없어 저장할 수 없습니다. .env.example을 보고 설정해 주세요.");

  // Response: fetch가 돌려주는 "답" 객체의 타입이에요(상태 번호, 내용 등).
  let response: Response;
  try {
    // fetch(주소, 설정): 브라우저와 서버 모두에 있는 "요청 보내기" 함수예요.
    // 저장소 API 주소: https://api.github.com/repos/<주인>/<이름><경로>
    response = await fetch(`${config.api}/repos/${site.repo.owner}/${site.repo.name}${path}`, {
      method: init.method ?? "GET",
      headers: {
        // Accept: 받고 싶은 답의 모양(GitHub가 권하는 JSON)
        Accept: "application/vnd.github+json",
        // Authorization: "이 토큰의 주인으로 요청한다"는 증명. Bearer는 토큰 방식의 이름이에요.
        Authorization: `Bearer ${config.token}`,
        // GitHub가 권하는 API 판 번호. 답의 모양이 갑자기 바뀌지 않게 정해 둬요.
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub API는 User-Agent(누가 보낸 요청인지)가 없는 요청을 거절해요.
        // Node.js의 fetch는 알아서 붙이지만 Cloudflare Workers의 fetch는 붙이지 않아서 직접 적어요.
        "User-Agent": "deokbae-blog",
        // 보낼 내용이 있을 때만 "내용은 JSON"이라고 알려요.
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      // 보낼 내용은 JSON 글자로 바꿔 보내요.
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // 저장소의 최신 상태가 필요해서, 앞서 받아 둔 답(캐시)을 다시 쓰지 않아요.
      cache: "no-store",
    });
  } catch {
    // 인터넷이 끊기는 등 GitHub에 닿지 못했어요.
    throw new GitHubError(502, "GitHub에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  // response.ok: 상태 번호가 200~299(성공)면 true예요.
  if (!response.ok) throw new GitHubError(response.status, describeFailure(response.status));
  // 답의 내용을 JSON으로 풀어 T 타입이라고 알려 주고 돌려줘요.
  return (await response.json()) as T;
}

/**
 * 브랜치의 최신 커밋과, 그 커밋에 들어 있는 모든 파일 목록을 읽어요.
 *
 * recursive=1: 폴더 안의 폴더까지 한 번에 받아요. 블로그 저장소는 작아서 한 번이면 충분해요.
 * truncated: 파일이 너무 많아 목록이 잘렸다는 표시예요. 잘린 목록으로 저장하면 위험해서 멈춰요.
 *
 * 요청 세 번: 브랜치 → 커밋 → 트리 순서로 따라가요.
 *
 * @returns 커밋 번호, 트리 번호, 파일 목록(경로 → sha)
 */
export async function getSnapshot(): Promise<RepoSnapshot> {
  // 1) 브랜치(ref)가 가리키는 커밋 번호
  const ref = await call<{ object: { sha: string } }>(`/git/ref/heads/${site.repo.branch}`);
  // 2) 그 커밋이 가리키는 트리 번호
  const commit = await call<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
  // 3) 그 트리 안의 모든 파일·폴더 목록
  const tree = await call<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(
    `/git/trees/${commit.tree.sha}?recursive=1`,
  );
  if (tree.truncated) throw new GitHubError(500, "저장소의 파일이 너무 많아 목록을 다 받지 못했습니다.");
  // 폴더(type "tree")는 빼고 파일(type "blob")만 "경로 → sha" 표로 담아요.
  // new Map([[키, 값], ...]): 짝 목록으로 Map을 만들어요. `as const`는 [경로, sha]를 "두 칸짜리 짝"으로 잡게 해요.
  const files = new Map(tree.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.sha] as const));
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha, files };
}

/**
 * 파일 내용 번호(sha)로 글자 파일(원고)을 읽어요.
 * GitHub는 내용을 base64로 줘서, Buffer로 풀어 UTF-8 글자로 바꿔요.
 * (base64: 바이트를 영문자·숫자 등 64가지 글자로만 적는 방법. JSON에 그림 같은 바이트를 담을 때 써요.
 *  Buffer: Node.js의 바이트 묶음 도구. Cloudflare Workers에서도 Node.js 호환 기능으로 쓸 수 있어요.)
 *
 * @param sha 파일 내용 번호
 * @returns 파일의 글자
 */
export async function readTextBlob(sha: string): Promise<string> {
  const blob = await call<{ content: string; encoding: string }>(`/git/blobs/${sha}`);
  return Buffer.from(blob.content, "base64").toString("utf8");
}

/**
 * 파일 내용을 blob으로 올리고, 그 내용의 번호(sha)를 돌려줘요.
 * 아직 어떤 커밋에도 들어가지 않은 상태라 저장소 화면에는 보이지 않아요. commitChanges가 커밋에 넣어야 보여요.
 *
 * @param content 파일 내용(바이트). 글자 파일도 그림 파일도 base64로 바꿔 보내요.
 * @returns 올린 내용의 번호(sha). 커밋할 때 FileChange의 sha로 넣어요.
 */
export async function createBlob(content: Uint8Array): Promise<string> {
  const blob = await call<{ sha: string }>("/git/blobs", {
    method: "POST",
    body: { content: Buffer.from(content).toString("base64"), encoding: "base64" },
  });
  return blob.sha;
}

/**
 * 바뀐 파일들을 커밋 하나로 만들어 브랜치에 올려요.
 *
 * buildChanges에 최신 저장소 모습(snapshot)을 넘겨주면, 그걸 보고 바꿀 파일 목록을 돌려줘야 해요.
 * 그사이 다른 커밋이 먼저 올라가 브랜치를 옮기지 못하면(422), 최신 모습으로 한 번 더 시도해요.
 * buildChanges가 오류를 던지면(예: 파일 이름이 겹침) 커밋하지 않고 그 오류를 그대로 던져요.
 *
 * @param message 커밋 메시지. 예: "리뷰 추가: 겨울 정류장"
 * @param buildChanges 최신 모습을 받아 바꿀 파일 목록을 돌려주는 함수(목록을 바로 돌려줘도, Promise로 돌려줘도 돼요)
 * @returns 새 커밋의 번호(sha)
 */
export async function commitChanges(
  message: string,
  buildChanges: (snapshot: RepoSnapshot) => FileChange[] | Promise<FileChange[]>,
): Promise<string> {
  // 최대 두 번 시도해요. `for (시작; 조건; 다음)`에서 조건을 비워 두면 끝없이 돌아요.
  // 끝내는 길은 안에 있어요: 성공하면 return, 더 시도하지 않을 때는 throw.
  for (let attempt = 1; ; attempt += 1) {
    const snapshot = await getSnapshot();
    const changes = await buildChanges(snapshot);

    // 새 트리: 최신 트리(base_tree)에 바뀐 파일만 덮어써요. sha: null은 "이 경로의 파일을 지워요"라는 뜻이에요.
    // mode "100644"는 "보통 파일"이라는 git의 표시예요.
    const tree = await call<{ sha: string }>("/git/trees", {
      method: "POST",
      body: {
        base_tree: snapshot.treeSha,
        // `({ path, sha }) =>`: 받은 객체에서 path, sha를 바로 꺼내는 구조 분해 매개변수예요.
        tree: changes.map(({ path, sha }) => ({ path, mode: "100644", type: "blob", sha })),
      },
    });
    // 새 커밋: 부모는 방금 읽은 최신 커밋이에요.
    const commit = await call<{ sha: string }>("/git/commits", {
      method: "POST",
      body: { message, tree: tree.sha, parents: [snapshot.commitSha] },
    });

    try {
      // 브랜치를 새 커밋으로 옮겨요. force: false — 그사이 올라온 남의 커밋을 덮어쓰지 않아요.
      await call(`/git/refs/heads/${site.repo.branch}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
      return commit.sha;
    } catch (error) {
      // continue: 이번 차례를 끝내고 for의 다음 차례(attempt 2)로 넘어가 처음부터 다시 해요.
      // 422: 그사이 다른 커밋이 올라와서 "앞으로 감기"가 안 됐어요. 한 번만 처음부터 다시 해 봐요.
      if (attempt < 2 && error instanceof GitHubError && error.status === 422) continue;
      throw error;
    }
  }
}
